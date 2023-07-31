const config = {
  // Blockchain Settings
  contractVersion: (process.env.ETHEREUM_CONTRACT_VERSION),
  hardhatLogging: (process.env.EVM_LOGGING !== '0'),
  infuraApiKey: (process.env.INFURA_API_KEY || ''),
  mnemonic: (process.env.BLOCKCHAIN_MNEMONIC_PHRASE || ''),
  networkName: (process.env.BLOCKCHAIN_NETWORK_NAME || 'homestead'),
  nodeEnv: (process.env.NODE_ENV || ''),
  rpcProviderHost: (process.env.ETHEREUM_RPC_PROVIDER_HOST || '127.0.0.1'),
  rpcProviderMethod: (process.env.ETHEREUM_RPC_PROVIDER_METHOD || 'https'),
  rpcProviderPort: (process.env.ETHEREUM_RPC_PROVIDER_PORT || '6040'),
  rpcProviderAddress: (process.env.ETHEREUM_RPC_PROVIDER_URL || ''),
  // Pledgecamp Settings
  contractsSourcePath: (process.env.ETHEREUM_CONTRACTS_SOURCE_PATH || '../build/contracts/'),
  contractsCompiledPath: (process.env.ETHEREUM_CONTRACTS_VERSION_PATH || '../build-archive'),
  contractsVersion: (process.env.ETHEREUM_CONTRACTS_VERSION || 'current'),
  unstakePeriod: parseInt((process.env.CS_UNSTAKE_PERIOD || 30) * 24 * 60 * 60, 10),
  outstandingAllowance: (process.env.CS_OUTSTANDING_ALLOWANCE || '2'),
  // Test Settings
  testNumberAddressesUnlock: (process.env.TEST_NUMBER_ADDRESSES_UNLOCK || '1'),
  testReportGas: (process.env.TEST_REPORT_GAS || '1'),
  // Production Settings
  walletKey: `0x${process.env.WALLET_KEY || 'password'}`,
  // This address only used because, we already have the Token out there not to touch
  addressAdminWallet: (process.env.ETHEREUM_ADMIN_WALLET_ADDRESS || ''),
  contractTokenAddress: (process.env.ETHEREUM_CONTRACT_TOKEN_ADDRESS || ''),
  contractProjectAddress: (process.env.ETHEREUM_CONTRACT_PROJECT_ADDRESS || ''),
};

const {
  infuraApiKey,
  networkName,
  rpcProviderAddress,
  rpcProviderHost,
  rpcProviderMethod,
  rpcProviderPort,
} = config;

// Try to calculate RPC Provider address if not provided
if(!rpcProviderAddress) {
  if(infuraApiKey) {
    config.rpcProviderAddress = `${rpcProviderMethod}://${networkName}.infura.io/v3/${infuraApiKey}`;
  } else {
    config.rpcProviderAddress = `${rpcProviderMethod}://${rpcProviderHost}:${rpcProviderPort}`;
  }
}

module.exports = config;
