'use strict';

// LRU-ish bounded Map — evicts oldest entry when maxSize is reached.
// Drop-in replacement for Map() with a size cap.

class BoundedMap extends Map {
  constructor(maxSize = 10_000) {
    super();
    this._maxSize = maxSize;
  }

  set(key, value) {
    // If key already exists, delete first so it moves to "newest" position
    if (this.has(key)) this.delete(key);

    // Evict oldest if at capacity
    if (this.size >= this._maxSize) {
      const oldest = this.keys().next().value;
      this.delete(oldest);
    }

    return super.set(key, value);
  }
}

module.exports = { BoundedMap };
