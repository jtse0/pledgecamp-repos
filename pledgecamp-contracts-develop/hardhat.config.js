require('@nomiclabs/hardhat-solhint');
require('@nomiclabs/hardhat-waffle');
require('hardhat-deploy');
require('hardhat-gas-reporter');
require('hardhat-contract-sizer');
require('solidity-coverage');

const {
  chainId,
  hardhatLogging,
  mnemonic,
  rpcProviderAddress,
  walletKey,
  testReportGas,
} = require('./src/config');

module.exports = {
  defaultNetwork: 'hardhat',
  networks: {
    // This is used as a profile for booting up the local network / testing
    hardhat: {
      accounts: {
        count: 100,
        mnemonic,
      },
      chainId: 1,
      allowUnlimitedContractSize: true,
      logged: hardhatLogging,
    },
    // This is used as a profile for connecting to the already running local network
    localRPC: {
      chainId: 1,
      accounts: {
        count: 100,
        mnemonic,
      },
      allowUnlimitedContractSize: true,
      url: 'http://127.0.0.1:8545',
      loggingEnabled: hardhatLogging,
    },
    ropsten: {
      chainId,
      gas: 'auto',
      gasPrice: 'auto',
      gasMultiplier: 1,
      allowUnlimitedContractSize: true,
      url: rpcProviderAddress,
      timeout: 20000,
      accounts: [walletKey],
    },
  },
  gasReporter: {
    enabled: testReportGas,
    showMethodSig: true,
  },
  solidity: {
    version: '0.8.3',
  },
};
