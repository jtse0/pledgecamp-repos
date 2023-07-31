const config = {
  mnemonic: (process.env.BLOCKCHAIN_MNEMONIC_PHRASE || ''),
  infuraApiKey: (process.env.INFURA_API_KEY || ''),
  unstakePeriod: (process.env.CS_UNSTAKE_PERIOD || 30) * 24 * 60 * 60,
  testReportGas: (process.env.TEST_REPORT_GAS === '1'),
};

module.exports = config;
