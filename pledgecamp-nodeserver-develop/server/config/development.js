const https = require('https');

const config = {
  logLevel: 'debug',
  axios: {
    httpsAgent: new https.Agent({
      rejectUnauthorized: false,
    }),
  },
  ethereum: {
    bipMnemonic:
      process.env.BLOCKCHAIN_MNEMONIC_PHRASE ||
      // eslint-disable-next-line
      'nerve rail connect talk salt fringe scan travel duck reward street deliver tomato try book hour lava crunch road congress banana wet wife broom',
    adminWalletIndex: 0,
    chainId: 1,
    confirmationsNeeded: process.env.ETHEREUM_CONFIRMATIONS_NEEDED || 3,
    blockTime: (process.env.ETHEREUM_BLOCK_TIME || 1) * 1000,
    rpcProviderAddress: process.env.ETHEREUM_RPC_PROVIDER_URL || 'http://127.0.0.1:8545',
  },
  rabbitMq: {
    waitThreshold: process.env.RABBITMQ_WAIT_THRESHOLD || 2000,
    retryIntervals: process.env.RABBITMQ_WAIT_ATTEMPTS || 5,
  },
};

module.exports = config;
