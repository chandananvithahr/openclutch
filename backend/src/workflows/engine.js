// Workflow Engine — DeerFlow2 LangGraph pattern ported to Node.js
//
// Core concepts mirrored from DeerFlow2:
//   - Nodes:     async (state) => partialState   (same as LangGraph node)
//   - Edges:     string | fn(state) => string    (direct or conditional)
//   - State:     immutably merged at each step   (ThreadState pattern)
//   - Retry:     per-node exponential backoff    (DeerFlow middleware retry)
//   - Events:    emit lifecycle events           (DeerFlow SSE events pattern)
//
// Usage:
//   const graph = new WorkflowGraph('emailSync')
//     .addNode('validate', async (s) => ({ valid: true }))
//     .addNode('store',    async (s) => ({ stored: 5 }))
//     .addEdge('validate', 'store')
//     .addEdge('store', '__end__')
//     .setEntry('validate');
//
//   const result = await graph.run({ userId: 'abc' });

'use strict';

const logger = require('../lib/logger');

const END = '__end__';
const DEFAULT_MAX_RETRIES = 3;
const BACKOFF_BASE_MS     = 500;

// ─── Sleep helper ─────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ─── WorkflowGraph ────────────────────────────────────────────────────────────

class WorkflowGraph {
  constructor(name) {
    this.name   = name;
    this.nodes  = {};   // nodeName → async fn(state) → partialState
    this.edges  = {};   // from → string | fn(state) → string
    this.entry  = null;
  }

  // Register a node function
  addNode(name, fn) {
    if (typeof fn !== 'function') throw new Error(`Node "${name}" must be a function`);
    this.nodes[name] = fn;
    return this;
  }

  // Direct edge: always go from → to
  addEdge(from, to) {
    this.edges[from] = to;
    return this;
  }

  // Conditional edge: fn(state) returns the next node name
  addConditionalEdge(from, fn) {
    if (typeof fn !== 'function') throw new Error(`Conditional edge from "${from}" must be a function`);
    this.edges[from] = fn;
    return this;
  }

  setEntry(name) {
    this.entry = name;
    return this;
  }

  // ─── Run the workflow ───────────────────────────────────────────────────────

  async run(initialState = {}, opts = {}) {
    const {
      maxNodeRetries = DEFAULT_MAX_RETRIES,
      onNodeStart,
      onNodeEnd,
      onError,
    } = opts;

    if (!this.entry) throw new Error(`Workflow "${this.name}" has no entry node`);

    // Initial state — DeerFlow ThreadState pattern: add workflow metadata
    let state = {
      ...initialState,
      _workflow:   this.name,
      _startedAt:  Date.now(),
      _errors:     [],
      _nodesRun:   [],
    };

    let current = this.entry;

    while (current && current !== END) {
      const nodeFn = this.nodes[current];
      if (!nodeFn) {
        logger.error(`Workflow "${this.name}" hit unknown node`, { node: current });
        break;
      }

      let nodeResult = null;
      let lastErr    = null;

      // Per-node retry with exponential backoff (DeerFlow retry pattern)
      for (let attempt = 1; attempt <= maxNodeRetries; attempt++) {
        try {
          onNodeStart?.(current, state, attempt);
          logger.debug(`[${this.name}] node:${current}`, { attempt, userId: state.userId });
          nodeResult = await nodeFn(state);
          lastErr = null;
          break;
        } catch (err) {
          lastErr = err;
          logger.warn(`[${this.name}] node:${current} attempt ${attempt} failed`, { err: err.message });
          if (attempt < maxNodeRetries) {
            await sleep(BACKOFF_BASE_MS * attempt);
          }
        }
      }

      // Node permanently failed after all retries
      if (lastErr && nodeResult === null) {
        const errEntry = { node: current, err: lastErr.message, at: new Date().toISOString() };
        logger.error(`[${this.name}] node:${current} permanently failed`, errEntry);
        onError?.(current, lastErr, state);

        state = { ...state, _errors: [...state._errors, errEntry] };

        // Route to error handler if defined, else halt
        const errorEdge = this.edges['__error__'];
        if (errorEdge) {
          current = typeof errorEdge === 'function' ? errorEdge(state) : errorEdge;
          continue;
        }
        break;
      }

      // Merge partial result into state (immutable — DeerFlow ThreadState pattern)
      state = { ...state, ...(nodeResult || {}), _nodesRun: [...state._nodesRun, current] };
      onNodeEnd?.(current, state);

      // Determine next node
      const edge = this.edges[current];
      if (!edge) break;                                            // terminal node
      current = typeof edge === 'function' ? edge(state) : edge;
    }

    state._finishedAt  = Date.now();
    state._durationMs  = state._finishedAt - state._startedAt;
    state._success     = state._errors.length === 0;

    logger.info(`[${this.name}] finished`, {
      durationMs: state._durationMs,
      nodes:      state._nodesRun.length,
      errors:     state._errors.length,
      userId:     state.userId,
    });

    return state;
  }
}

// ─── runWorkflow — convenience wrapper ───────────────────────────────────────

// Registry populated by workflows/index.js
const registry = {};

function register(name, graphFactory) {
  registry[name] = graphFactory;
}

async function runWorkflow(name, input = {}, opts = {}) {
  const factory = registry[name];
  if (!factory) throw new Error(`Unknown workflow: "${name}". Registered: ${Object.keys(registry).join(', ')}`);
  const graph = factory();
  return graph.run(input, opts);
}

function listWorkflows() {
  return Object.keys(registry);
}

module.exports = { WorkflowGraph, END, register, runWorkflow, listWorkflows };
