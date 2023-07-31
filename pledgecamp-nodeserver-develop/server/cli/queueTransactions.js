const { logger, queueHandler, transactionsQueue } = require('../utils');
const { pushMessage } = require('../utils/queueHandler');
const config = require('../config');

const { queueTransactions } = config.rabbitMq;

logger.info('Queue Transactions process started');
const queueFunction = async () => {
  try {
    logger.info('Starting transaction Queue reader');
    await transactionsQueue();
    // Test push for health check
    try {
      pushMessage(queueTransactions, 'Testing');
    } catch (error) {
      logger.info('Issue encountered in queue setup');
    }
    // Any failure here is likely RabbitMQ falling over
    // Wait a period of time, perform a health check and then continue
  } catch (error) {
    logger.info('Lost connection to queue system; polling for restart');
    // Set an interval that will periodically check health and restart
    const queueHealthInterval = setInterval(async () => {
      // TODO: Check functionality
      if (await queueHandler.testConnection()) {
        logger.info('Connection capabilities restored');
        clearInterval(queueHealthInterval);
        queueFunction();
      } else {
        logger.error('Not yet able to connect to queue system. Trying again in 15s');
      }
    }, 15000);
  }
};

queueFunction();

module.exports = {
  queueFunction,
};
