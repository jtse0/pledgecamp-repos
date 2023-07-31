const transactionsModel = require('../models/transaction');
const logger = require('../utils/logger');
const { txStatus } = require('../constants');
const { purgeQueue, pushObject } = require('../utils/queueHandler');
const { rabbitMq } = require('../config');

// Due to the amount of reuse for these constants, remap to values
const { INITIAL, PENDING, FAILED_GAS, FAILED_INITIAL, FAILED_RECEIPT, FAILED_PENDING } = txStatus;

const rabbitWarmup = async () => {
  try {
    logger.info('Purging queue...');
    await purgeQueue(rabbitMq.queueTransactions);
    logger.info('Queue purged');
  } catch (error) {
    logger.error('Could not purge queue: ', error);
    process.exit(1);
  }

  const transactions = await transactionsModel.getByStatusArray([
    INITIAL,
    PENDING,
    FAILED_GAS,
    FAILED_INITIAL,
    FAILED_RECEIPT,
    FAILED_PENDING,
  ]);

  logger.info(`Pushing ${transactions.length} transactions in to the queue`);
  await Promise.all(
    transactions.map((tx) => {
      return pushObject(rabbitMq.queueTransactions, tx);
    }),
  );
};

module.exports = {
  rabbitWarmup,
};
