#!/usr/bin/env node
const config = require('./config');

const { server } = require('../server');
const logger = require('./utils/logger');
const { pullGasPrice, init } = require('./modules/eth');
const { rabbitWarmup } = require('./cli/rabbitWarmup');
const { queueFunction } = require('./cli/queueTransactions');

// Balance Check at intervals
init();
pullGasPrice();
setInterval(() => {
  pullGasPrice();
}, config.ethereum.gasPriceCheckInterval);

if (process.env.NODE_ENV === 'development') {
  rabbitWarmup();
  queueFunction();
}

logger.debug({ message: 'Starting with config', meta: config });
server
  .listen(config.port, async () => {
    logger.info({ message: `Server listening at port ${config.port}` });
  })
  .on('error', (err) => {
    logger.info({ message: `SERVER ERROR: ${err}` });
  });
