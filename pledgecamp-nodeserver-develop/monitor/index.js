const { CronJob } = require('cron');
const queue = require('./queue');

const TxMonitor = new CronJob('*/30 * * * * *', async () => {
  const result = await queue;
  console.log('Check tx queue: ', result);
});

module.exports = TxMonitor;
