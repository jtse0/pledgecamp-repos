const fs = require('fs');
const path = require('path');
const utils = require('pledgecamp-blockchain-utils');
const contracts = require('pledgecamp-contracts');
const config = require('../config');
const logger = require('../utils/logger');
const { projectModel, gasPriceModel } = require('../models');

const {
  rpcProviderAddress,
  rpcProviderMethod,
  adminWalletIndex,
  fundingWalletIndex,
  bipMnemonic,
  bipMnemonicPassword,
} = config.ethereum;

const { ethGasAPI } = config.axios;

// Setup web3 connection
const web3 = utils.ethereum.getProvider(rpcProviderMethod, rpcProviderAddress);

let adminWalletAddress;
let fundingWalletAddress;

const getFundingWalletAddress = async () => {
  const fundingWallet = await utils.ethereum.getAccountFromBipIndex(fundingWalletIndex);
  fundingWalletAddress = fundingWallet.address;
  return fundingWalletAddress;
};

const getAdminWalletAddress = async () => {
  const adminWallet = await utils.ethereum.getAccountFromBipIndex(adminWalletIndex);
  adminWalletAddress = adminWallet.address;
  utils.ethereum.setAdminWalletAddress(adminWalletAddress);
  return adminWalletAddress;
};

// Initial setup
const init = async () => {
  logger.debug('Performing initial setup functions');

  // Initial setup of owner & admin wallet address
  fundingWalletAddress = await getFundingWalletAddress();
  adminWalletAddress = await getAdminWalletAddress();

  // Initial setup of blockchain mnemonic
  utils.ethereum.setMnemonic(bipMnemonic, bipMnemonicPassword);

  // TODO: Add back after fix in Blockchain utils
  // Initial set of confirmation wait time
  // utils.ethereum.getConfirmationWaitTime(parseInt(confirmationsNeeded, 10), parseInt(blockTime, 10));
};

/**
 * pullGasPrice() - get lastest Gas Prices from ETH Gas Station
 * @returns {object} Latest priceData object
 */
const pullGasPrice = async () => {
  logger.debug('Pulling latest gas prices');
  const gasPriceData = await utils.ethereum.pullGasPrice(ethGasAPI);
  await gasPriceModel.insert(gasPriceData);
};

/**
 * getSerializedTrans() - get serialized transaction
 * @param {string} gasParams
    priorityFactor {integer} Level of speed required for transaction (Range from 1 - FASTEST to 4 - SLOWEST)
    opsFactor {integer} Ops factor of transaction to allocate more gas for gas intense operations
    baseGasIndex {integer} Base gas level to use for operations
    isDeploy {integer} TRUE = deploy contract operation, FALSE = all other operations
 * @param {integer} activityId Activity ID associated with transaction
 * @param {object} txParams
    transactionType: {string} Type of transaction
    toAddress: {string} Target address
    bipIndex: {integer} bipIndex value
    changeIndex: {integer} 0 = External chain (default), 1 = Internal chain
    abiData: {string} Encoded contract abi data
    abiType: {integer} Value used for gasEstimate() - 0 = raw, 1 = bareTransaction
    callbackURL: {string} Callback URL
 * @returns {object} Transaction data object
 */
const getSerializedTransaction = async (gasParams, activityId = 0, txParams) => {
  const txModel = await utils.ethereum.getSerializedTrans(gasParams, activityId, txParams);

  const txData = {
    transaction_parent_id: txModel.transaction_parent_id,
    transaction_callback: txModel.transaction_callback,
    transaction_serialized: txModel.transaction_serialized,
    transaction_status: txModel.transaction_status,
    transaction_type: txModel.transaction_type,
    transaction_uuid: txModel.transaction_uuid,
    transaction_retry_attempts: txModel.transaction_retry_attempts,
  };
  return txData;
};

const getContractVersionAddress = async (projectContractAddress, contractName) => {
  logger.debug('Getting contract Address');
  const addressList = await projectModel.getByProjectAddress(projectContractAddress);
  const addresses = JSON.parse(addressList[0].contract_version_details);
  const address = addresses[contractName];

  return address;
};

const getContractVersionAbi = (contractName, contractVersion) => {
  logger.debug('Getting contract ABIs');
  let contractObject;

  if (!contractVersion) {
    const contractPath = path.resolve(__dirname, `../contracts/abi/${contractName}.json`);
    logger.debug('No version', contractPath);
    if (fs.existsSync(contractPath)) {
      contractObject = JSON.parse(fs.readFileSync(contractPath));
    } else {
      logger.error('ABI not found');
      return false;
    }
  } else {
    contractObject = contracts.loadVersionContractAbi(contractName, contractVersion);
  }

  return new web3.eth.Contract(contractObject.abi);
};

module.exports = {
  init,
  web3,
  getFundingWalletAddress,
  getAdminWalletAddress,
  getSerializedTransaction,
  pullGasPrice,
  getContractVersionAddress,
  getContractVersionAbi,
};
