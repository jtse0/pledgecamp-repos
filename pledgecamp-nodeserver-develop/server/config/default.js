const config = {
  port: process.env.APP_PORT || 3000,
  logLevel: process.env.APP_LOG_LEVEL || 'info',
  contractVersion: process.env.ETHEREUM_CONTRACT_VERSION,
  localContractsPath:
    process.env.ETHEREUM_CONTRACTS_PATH ||
    '/Users/user/Documents/PledgeCamp_Workspace/pledgecamp-nodeserver/server/contracts/abi',
  externalContractsPath:
    process.env.ETHEREUM_EXTERNAL_CONTRACTS_PATH ||
    '/Users/user/Documents/PledgeCamp_Workspace/pledgecamp-contracts/build-archive',
  auth: {
    admin: process.env.APP_AUTH_ACCESS_TOKEN || 'development_external',
    backend: process.env.APP_AUTH_INTERNAL_ACCESS_TOKEN || 'development_internal',
    oracleAuth: process.env.ORACLE_AUTH_ACCESS_TOKEN || 'development',
  },
  axios: {
    ethGasAPI: `${process.env.ETHEREUM_GAS_API_URL}${process.env.ETHEREUM_GAS_API_KEY}`,
  },
  ethereum: {
    bipMnemonic: process.env.BLOCKCHAIN_MNEMONIC_PHRASE,
    bipMnemonicPassword: process.env.BLOCKCHAIN_MNEMONIC_PASS,
    bipTokenIndex: process.env.ETHEREUM_BIP_TOKEN_INDEX || 60,
    bipChangeIndex: process.env.ETHEREUM_BIP_CHANGE_INDEX || 0,
    adminWalletIndex: process.env.ETHEREUM_ADMIN_WALLET_INDEX || 0,
    fundingWalletIndex: process.env.ETHEREUM_FUNDING_WALLET_INDEX || 0,
    contractProjectFactoryAddress:
      process.env.ETHEREUM_CONTRACT_PROJECT_FACTORY_ADDRESS || '0x10a195f276db5bd5d54173b4da7f986e9525d552',
    contractProjectMasterAddress:
      process.env.ETHEREUM_CONTRACT_PROJECT_ADDRESS || '0xa9fda356e55ca2099a10c27f18dda59d82e3f225',
    contractAccountManagerAddress:
      process.env.ETHEREUM_CONTRACT_ACCOUNT_MANAGER_ADDRESS || '0x80B22824c29bD2B6697af725E612C4231Caa7066',
    contractAccountStorageAddress:
      process.env.ETHEREUM_CONTRACT_ACCOUNT_STORAGE_ADDRESS || '0xa616319DD543e57CDF4484d35b03C484Cca581A5',
    contractAdministratorAddress:
      process.env.ETHEREUM_CONTRACT_ADMINISTRATOR_ADDRESS || '0xf9A5dF578eE3061D25316627544fd5E2a31b732e',
    contractTokenAddress: process.env.ETHEREUM_CONTRACT_TOKEN_ADDRESS || '0xbb1A5B197B37dA53eb1cD74d4fa52AC06F86bc13',
    contractModeratorAddress:
      process.env.ETHEREUM_CONTRACT_MODERATOR_ADDRESS || '0x42Eee0c353cdA680D3D97e417F185766110A7C10',
    contractCampshareAddress:
      process.env.ETHEREUM_CONTRACT_CAMPSHARE_MANAGER_ADDRESS || '0x29339dcDBFAa06b60FC7B0C12859999dBD88f341',
    contractCampshareStorageAddress:
      process.env.ETHEREUM_CONTRACT_CAMPSHARE_STORAGE_ADDRESS || '0x2adCd69F45F72adADeA6EEDceEEd6D74DF33b4e2',
    contractVersion: process.env.ETHEREUM_CONTRACT_VERSION,
    networkId: process.env.ETHEREUM_NETWORK_ID || 0x01,
    rpcProviderMethod: process.env.ETHEREUM_RPC_PROVIDER_METHOD || 'http',
    rpcProviderAddress:
      process.env.ETHEREUM_RPC_PROVIDER_URL || 'https://ropsten.infura.io/v3/abb35042e7824b7795cb33a340163f6b',
    tokenDecimals: process.env.ETHEREUM_DECIMAL_PLACES || 10,
    tokenSymbol: process.env.ETHEREUM_TOKEN_SYMBOL || 'plg',
    confirmationsNeeded: process.env.ETHEREUM_CONFIRMATIONS_NEEDED || 8,
    blockTime: (process.env.ETHEREUM_BLOCK_TIME || 15) * 1000,
    transactionRetries: process.env.TRANSACTION_RETRIES || 3,
    milestoneIntervalMinimum: process.env.PROJECT_MILESTONE_INTERVAL_MINIMUM || 604800,
    milestoneIntervalMaximum: process.env.PROJECT_MILESTONE_INTERVAL_MAXIMUM || 157680000,
    releasePercentMinimum: process.env.PROJECT_RELEASE_PERCENT_MINIMUM || 10,
    releasePercentMaximum: process.env.PROJECT_RELEASE_PERCENT_MAXIMUM || 50,
    gasPriceCheckInterval: (process.env.INTERVALS_ETHEREUM_GAS_PRICE_CHECK || 1000) * 1000,
    gasOpFlag: process.env.ETHEREUM_GAS_OPS_FLAG || true,
    warningGasPercent: process.env.ETHEREUM_GAS_LEVEL_WARNING_PERCENT || 50,
    criticalGasLv: process.env.ETHEREUM_GAS_LEVEL_CRITICAL || 10,
  },
  rabbitMq: {
    user: process.env.RABBITMQ_USER,
    pass: process.env.RABBITMQ_PASS,
    host: process.env.RABBITMQ_HOST || '127.0.0.1',
    port: process.env.RABBITMQ_PORT || '6379',
    queueTransactions: process.env.RABBITMQ_QUEUE_TRANSACTIONS || 'transactionsQueue',
    waitThreshold: (process.env.RABBITMQ_WAIT_THRESHOLD || 120) * 1000,
    retryIntervals: process.env.RABBITMQ_WAIT_ATTEMPTS || 5,
  },
};
module.exports = config;
