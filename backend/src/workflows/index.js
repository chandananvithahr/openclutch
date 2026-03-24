// Workflow Registry — registers all workflows in the engine and exports convenience runners
//
// Import this once at server startup. All workflows are then available via:
//   runWorkflow('emailSync', { userId })
//   runWorkflow('smsIngestion', { transactions, userId })
//   runWorkflow('portfolioSync', { userId })
//   runWorkflow('healthSync', { metrics, userId })
//   runWorkflow('weeklyReview', { userId })

'use strict';

const { register, runWorkflow, listWorkflows } = require('./engine');

// Register all workflow factories
register('smsIngestion',  require('./smsIngestion'));
register('emailSync',     require('./emailSync'));
register('portfolioSync', require('./portfolioSync'));
register('healthSync',    require('./healthSync'));
register('weeklyReview',  require('./weeklyReview'));

// Re-export engine API so callers only need to require('./workflows')
module.exports = {
  runWorkflow,
  listWorkflows,
  scheduler: require('./scheduler'),
  notifications: require('./notifications'),
};
