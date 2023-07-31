const { v4: uuidv4 } = require('uuid');
const utils = require('pledgecamp-blockchain-utils');

const logger = require('../utils/logger');
const config = require('../config');
const queueHandler = require('../utils/queueHandler');
const { errorMessage, errorMap, txStatus, taskPriority, opsLevel, baseGas } = require('../constants');
const { Error400 } = require('../utils/errors');
const { projectModel, transactionModel } = require('../models');

const {
  getSerializedTransaction,
  getContractVersionAddress,
  getContractVersionAbi,
  getFundingWalletAddress,
  getAdminWalletAddress,
} = require('../modules/eth');

const {
  contractProjectFactoryAddress,
  contractAccountManagerAddress,
  contractAccountStorageAddress,
  contractAdministratorAddress,
  contractTokenAddress,
  contractCampshareAddress,
  contractModeratorAddress,
  milestoneIntervalMinimum,
  milestoneIntervalMaximum,
  releasePercentMinimum,
  releasePercentMaximum,
  adminWalletIndex,
  bipChangeIndex,
  bipTokenIndex,
} = config.ethereum;

const txParams = {
  transactionType: '',
  toAddress: '',
  fromAddress: '',
  bipIndex: adminWalletIndex,
  changeIndex: bipChangeIndex,
  coinIndex: bipTokenIndex,
  abiData: '',
  abiType: 0,
  callbackURL: '',
};

let ownerAddress;
let fundingWalletAddress;

// Setup addresses
const init = async () => {
  ownerAddress = await getAdminWalletAddress();
  fundingWalletAddress = await getFundingWalletAddress();
};

/**
 * DEPLOY PROJECT
 * Creates a project on the blockchain, persisting and returning the transaction
 * status and contract address. Full confirmation should be carried out in a
 * separate routine.
 * @param {string} transactionType Type of transaction
 * @param {integer} projectId Project Id
 * @param {integer} activityId Activity Id associated with function
 * @param {integer[]} milestoneTimes Array of milestone timestamps to set for project
 * @param {integer[]} releasePercents Array of release percentages associated with each milestone
 * @param {string} urlCallback URL of callback path for getting response from blockchain
 * @param {string} contractVersion Git version tag for contract version set
 */
const deployProject = async (
  transactionType,
  projectId,
  activityId,
  milestoneTimes,
  releasePercents,
  urlCallback,
  contractVersion = false,
) => {
  logger.debug(`[func] DEPLOY PROJECT - ${projectId}`);

  await init();

  // Test the validity of milestone dates
  const date = new Date();
  const epochTime = Math.round(date.getTime() / 1000);
  let previousMilestone = epochTime;

  const milestoneTimesInt = [];
  let milestoneTimesArray;
  if (typeof milestoneTimes === 'string') {
    milestoneTimesArray = milestoneTimes.replace('[', '').replace(']', '');
    milestoneTimesArray = milestoneTimesArray.split(' ');
  } else {
    milestoneTimesArray = milestoneTimes;
  }

  if (!Array.isArray(milestoneTimesArray)) {
    throw new Error400({
      type: errorMap[errorMessage.INVALID_PARAM_FORMAT],
      msg: `${errorMessage.INVALID_PARAM_FORMAT}: milestoneTimesArray`,
      data: milestoneTimesArray,
    });
  }

  milestoneTimesArray.forEach((ms) => {
    if (typeof ms !== 'number') {
      throw new Error400({
        type: errorMap[errorMessage.INVALID_PARAM_FORMAT],
        msg: `${errorMessage.INVALID_PARAM_FORMAT}: milestoneTimes`,
        data: ms,
      });
    }
    const timeDiff = ms - previousMilestone;
    logger.debug(`Now: ${epochTime}, Current: ${ms}, Previous: ${previousMilestone}, Diff: ${timeDiff}`);
    if (ms - epochTime < 0) {
      throw new Error400({
        type: errorMap[errorMessage.INVALID_MILESTONE_PAST],
        msg: `${errorMessage.INVALID_MILESTONE_PAST}`,
        data: ms,
      });
    }
    if (milestoneIntervalMinimum > timeDiff && previousMilestone !== epochTime) {
      throw new Error400({
        type: errorMap[errorMessage.INVALID_MILESTONE_MIN_INTERVAL],
        msg: `${errorMessage.INVALID_MILESTONE_MIN_INTERVAL}. ${milestoneIntervalMinimum} minimum`,
        data: ms,
      });
    }
    if (milestoneIntervalMaximum < timeDiff) {
      throw new Error400({
        type: errorMap[errorMessage.INVALID_MILESTONE_MAX_INTERVAL],
        msg: `${errorMessage.INVALID_MILESTONE_MAX_INTERVAL}. ${milestoneIntervalMaximum} maximum`,
        data: ms,
      });
    }
    previousMilestone = ms;

    milestoneTimesInt.push(parseInt(ms));
  });
  logger.debug(`Milestone array conversion: ${milestoneTimesInt}`);

  // Test the validity of releasePercentages
  let cumulativePercentage = 0;
  const releasePercentsInt = [];
  let releasePercentsArray;
  if (typeof releasePercents === 'string') {
    releasePercentsArray = releasePercents.replace('[', '').replace(']', '');
    releasePercentsArray = releasePercentsArray.split(' ');
  } else {
    releasePercentsArray = releasePercents;
  }

  if (!Array.isArray(releasePercentsArray)) {
    throw new Error400({
      type: errorMap[errorMessage.INVALID_PARAM_FORMAT],
      msg: `${errorMessage.INVALID_PARAM_FORMAT}: releasePercentsArray`,
      data: releasePercentsArray,
    });
  }

  releasePercentsArray.forEach((rp) => {
    if (typeof rp !== 'number') {
      throw new Error400({
        type: errorMap[errorMessage.INVALID_PARAM_FORMAT],
        msg: `${errorMessage.INVALID_PARAM_FORMAT}: releasePercents`,
        data: rp,
      });
    }
    cumulativePercentage += rp;
    if (rp > releasePercentMaximum) {
      logger.debug(
        `[EXTREME] Release percentage of ${rp}% is more than ${releasePercentMaximum}%.
        Please confirm that this is a valid project release percentage.`,
      );
    } else if (rp < releasePercentMinimum) {
      logger.debug(
        `[EXTREME] Release percentage of ${rp}% is less than ${releasePercentMinimum}%.
        Please confirm that this is a valid project release percentage.`,
      );
    }
    releasePercentsInt.push(parseInt(rp));
  });

  if (cumulativePercentage !== 100) {
    throw new Error400({
      type: errorMap[errorMessage.RELEASE_PERCENTAGE_NOT_100],
      msg: `${errorMessage.RELEASE_PERCENTAGE_NOT_100}`,
      data: cumulativePercentage,
    });
  }
  logger.debug(`ReleasePercents array conversion: ${releasePercentsInt}`);

  // Prepare transaction data
  logger.debug('Transaction Packing');
  const contract = getContractVersionAbi('PLGProjectFactory', contractVersion);

  logger.debug(`Parameters: ${projectId}, ${contractTokenAddress}, ${contractAdministratorAddress},
    ${contractAccountStorageAddress}, ${contractAccountManagerAddress}, ${contractAccountStorageAddress},
    ${milestoneTimesInt}, ${releasePercentsInt}`);

  let abiData;
  try {
    abiData = await contract.methods
      .createChild(
        projectId,
        contractTokenAddress,
        contractAdministratorAddress,
        contractAccountStorageAddress,
        fundingWalletAddress,
        contractAccountManagerAddress,
        contractAccountStorageAddress,
        milestoneTimesInt,
        releasePercentsInt,
      )
      .encodeABI();
  } catch (error) {
    throw new Error400({
      type: errorMap[errorMessage.ABI_ERROR],
      msg: errorMessage.ABI_ERROR,
    });
  }

  // Prepare some base properties for the deployment transaction
  logger.debug('Prepare Network info');
  const priorityFactor = taskPriority.PRIORITY_3;
  const opsFactor = opsLevel.OPS_LV2;
  // TODO Delete when Blockchain-Utils PR#18 merged
  const baseGasIndex = baseGas.ETHEREUM_GAS_BASE_DEPLOY;
  const isDeploy = true;

  const gasParams = {
    priorityFactor,
    opsFactor,
    // TODO Delete when Blockchain-Utils PR#18 merged
    baseGasIndex,
    isDeploy,
  };

  txParams.toAddress = contractProjectFactoryAddress;
  txParams.fromAddress = ownerAddress;
  txParams.transactionType = transactionType;
  txParams.callbackURL = urlCallback;
  txParams.abiData = abiData;

  logger.debug('Start serializing transaction');
  const txData = await getSerializedTransaction(gasParams, activityId, txParams);
  txData.transaction_project_id = projectId;

  const contractDetails = {
    contract_account_manager_address: contractAccountManagerAddress,
    contract_account_storage_address: contractAccountStorageAddress,
    contract_administrator_address: contractAdministratorAddress,
    contract_campshare_address: contractCampshareAddress,
    contract_moderator_address: contractModeratorAddress,
    contract_token_address: contractTokenAddress,
  };

  const projectData = {
    project_id: projectId.toString(),
    version_tag: config.contractVersion,
    active_version_flag: 'true',
    contract_version_details: JSON.stringify(contractDetails),
  };

  // Create record of initial transaction state, then push to queue system
  logger.debug('Inserting DB entries');
  await transactionModel.insert(txData);
  await projectModel.insert(projectData);

  logger.debug('Pushing object to queue');
  queueHandler.pushObject(config.rabbitMq.queueTransactions, txData);
  return txData;
};

/**
 * SET BACKERS
 * setBackers() method for AccountManager to call and invoke setBackers() within PLGProject contract
 * @param {string} transactionType Type of transaction
 * @param {integer[]} beneficiaries Array of user Ids that corresponds to backers of a project
 * @param {integer[]} amounts Array of token amounts representing the token pledges of each project backer
 * @param {boolean} fundingComplete Mark a project as complete after the most current allocation of backers
 * @param {integer} totalAmount The total amount of pledges allocated in this round of funding
 * @param {string} contractAddress Project contract address
 * @param {integer} activityId Activity Id associated with function
 * @param {string} urlCallback URL of callback path for getting response from blockchain
 * @param {string} contractVersion Git version tag for contract version set
 */
const setBackersExternal = async (
  transactionType,
  beneficiaries,
  amounts,
  fundingComplete,
  totalAmount,
  contractAddress,
  activityId,
  urlCallback,
  contractVersion = false,
) => {
  logger.info('[func] SET BACKERS');

  await init();

  // Check that address is in proper format
  const isAddress = utils.ethereum.checkAddress(contractAddress);

  if (!isAddress) {
    throw new Error400({
      type: errorMap[errorMessage.INVALID_ADDRESS],
      msg: errorMessage.INVALID_ADDRESS,
    });
  }

  // Handling for arrays coming in from Golang
  const beneficiariesInt = [];
  let beneficiariesArray;
  if (typeof beneficiaries === 'string') {
    beneficiariesArray = beneficiaries.replace('[', '').replace(']', '');
    beneficiariesArray = beneficiariesArray.split(' ');
  } else {
    beneficiariesArray = beneficiaries;
  }

  if (!Array.isArray(beneficiariesArray)) {
    throw new Error400({
      type: errorMap[errorMessage.INVALID_PARAM_FORMAT],
      msg: `${errorMessage.INVALID_PARAM_FORMAT}: beneficiariesArray`,
      data: beneficiariesArray,
    });
  }

  beneficiariesArray.forEach((beneficiary) => {
    if (typeof beneficiary !== 'number') {
      throw new Error400({
        type: errorMap[errorMessage.INVALID_PARAM_FORMAT],
        msg: `${errorMessage.INVALID_PARAM_FORMAT}: beneficiaries`,
        data: beneficiary,
      });
    }
    beneficiariesInt.push(parseInt(beneficiary));
  });
  logger.debug(`Beneficiaries array conversion: ${beneficiariesInt}`);

  const amountsInt = [];
  let amountsArray;
  if (typeof amounts === 'string') {
    amountsArray = amounts.replace('[', '').replace(']', '');
    amountsArray = amountsArray.split(' ');
  } else {
    amountsArray = amounts;
  }

  if (!Array.isArray(amountsArray)) {
    throw new Error400({
      type: errorMap[errorMessage.INVALID_PARAM_FORMAT],
      msg: `${errorMessage.INVALID_PARAM_FORMAT}: amountsArray`,
      data: amountsArray,
    });
  }

  amountsArray.forEach((amount) => {
    if (typeof amount !== 'number') {
      throw new Error400({
        type: errorMap[errorMessage.INVALID_PARAM_FORMAT],
        msg: `${errorMessage.INVALID_PARAM_FORMAT}: amounts`,
        data: amount,
      });
    }
    amountsInt.push(parseInt(amount));
  });
  logger.debug(`Amounts array conversion: ${amountsInt}`);

  let fundingCompleteBool;
  if (typeof fundingComplete === 'boolean') {
    fundingCompleteBool = fundingComplete;
  } else if (typeof fundingComplete === 'string') {
    if (fundingComplete.toLowerCase() === 'true' || fundingComplete.toLowerCase() === 'false') {
      fundingCompleteBool = fundingComplete.toLowerCase() === 'true';
    } else {
      throw new Error400({
        type: errorMap[errorMessage.INVALID_PARAM_FORMAT],
        msg: `${errorMessage.INVALID_PARAM_FORMAT}: fundingComplete`,
      });
    }
  }

  // Prepare transaction data
  logger.debug('Transaction Packing');
  const contract = getContractVersionAbi('AccountManager', contractVersion);

  logger.debug(
    `Parameters: ${contractAddress}, ${beneficiariesInt}, ${amountsInt}, ${fundingCompleteBool}, ${totalAmount}`,
  );

  let abiData;
  try {
    abiData = contract.methods
      .setBackers(contractAddress, beneficiariesInt, amountsInt, fundingCompleteBool, totalAmount)
      .encodeABI();
  } catch (error) {
    throw new Error400({
      type: errorMap[errorMessage.ABI_ERROR],
      msg: errorMessage.ABI_ERROR,
    });
  }

  // Prepare some base properties for the deployment transaction
  logger.debug('Prepare Network info');
  const priorityFactor = taskPriority.PRIORITY_3;
  const opsFactor = opsLevel.OPS_LV5;
  // TODO Delete when Blockchain-Utils PR#18 merged
  const baseGasIndex = baseGas.ETHEREUM_GAS_BASE_FUNCTION;
  const isDeploy = false;

  const gasParams = {
    priorityFactor,
    opsFactor,
    // TODO Delete when Blockchain-Utils PR#18 merged
    baseGasIndex,
    isDeploy,
  };

  // Get contract address based on the version tag
  let projectAccountManagerAddress;
  const targetContractName = 'contract_account_manager_address';
  if (!contractVersion) {
    projectAccountManagerAddress = contractAccountManagerAddress;
  } else {
    projectAccountManagerAddress = await getContractVersionAddress(contractAddress, targetContractName);
  }

  txParams.toAddress = projectAccountManagerAddress;
  txParams.fromAddress = ownerAddress;
  txParams.transactionType = transactionType;
  txParams.callbackURL = urlCallback;
  txParams.abiData = abiData;
  const txData = await getSerializedTransaction(gasParams, activityId, txParams);

  // Create record of initial transaction state, then push to queue system
  logger.debug('Inserting DB entries');
  await transactionModel.insert(txData);
  logger.debug('Pushing object to queue');
  queueHandler.pushObject(config.rabbitMq.queueTransactions, txData);
  return txData;
};

/**
 * MILESTONE VOTE
 * Submit vote to pass or fail milestone
 * @param {string} transactionType Type of transaction
 * @param {string} contractAddress Project contract address
 * @param {integer} userId Id of the user voting
 * @param {boolean} vote Submitted vote (TRUE = fail milestone, FALSE = pass milestone)
 * @param {integer} activityId Activity Id associated with function
 * @param {string} urlCallback URL of callback path for getting response from blockchain
 * @param {string} contractVersion Git version tag for contract version set
 */
const milestoneVote = async (
  transactionType,
  contractAddress,
  userId,
  vote,
  activityId,
  urlCallback,
  contractVersion = false,
) => {
  logger.info('[func] SUBMIT MILESTONE VOTE');

  await init();

  // Check that address is in proper format
  const isAddress = utils.ethereum.checkAddress(contractAddress);

  if (!isAddress) {
    throw new Error400({
      type: errorMap[errorMessage.INVALID_ADDRESS],
      msg: errorMessage.INVALID_ADDRESS,
    });
  }

  // Prepare transaction data
  logger.debug('Transaction Packing');
  // Get contract object based on version
  const contract = getContractVersionAbi('AccountManager', contractVersion);

  let voteBool;
  if (typeof vote === 'boolean') {
    voteBool = vote;
  } else if (typeof vote === 'string') {
    if (vote.toLowerCase() === 'true' || vote.toLowerCase() === 'false') {
      voteBool = vote.toLowerCase() === 'true';
    } else {
      throw new Error400({
        type: errorMap[errorMessage.INVALID_PARAM_FORMAT],
        msg: `${errorMessage.INVALID_PARAM_FORMAT}: vote`,
        data: vote,
      });
    }
  } else {
    throw new Error400({
      type: errorMap[errorMessage.INVALID_PARAM_FORMAT],
      msg: `${errorMessage.INVALID_PARAM_FORMAT}: vote`,
      data: vote,
    });
  }

  logger.debug(`Parameters: ${contractAddress}, ${userId}, ${voteBool}`);

  let abiData;
  try {
    abiData = await contract.methods.milestoneVote(contractAddress, userId, voteBool).encodeABI();
  } catch (error) {
    throw new Error400({
      type: errorMap[errorMessage.ABI_ERROR],
      msg: errorMessage.ABI_ERROR,
    });
  }

  // Prepare some base properties for the deployment transaction
  logger.debug('Prepare Network info');
  const priorityFactor = taskPriority.PRIORITY_2;
  const opsFactor = opsLevel.OPS_LV5;
  // TODO Delete when Blockchain-Utils PR#18 merged
  const baseGasIndex = baseGas.ETHEREUM_GAS_BASE_FUNCTION;
  const isDeploy = false;

  const gasParams = {
    priorityFactor,
    opsFactor,
    // TODO Delete when Blockchain-Utils PR#18 merged
    baseGasIndex,
    isDeploy,
  };

  // Get contract address based on the version tag
  let projectAccountManagerAddress;
  const targetContractName = 'contract_account_manager_address';
  if (!contractVersion) {
    projectAccountManagerAddress = contractAccountManagerAddress;
  } else {
    projectAccountManagerAddress = await getContractVersionAddress(contractAddress, targetContractName);
  }

  txParams.toAddress = projectAccountManagerAddress;
  txParams.fromAddress = ownerAddress;
  txParams.transactionType = transactionType;
  txParams.callbackURL = urlCallback;
  txParams.abiData = abiData;
  const txData = await getSerializedTransaction(gasParams, activityId, txParams);

  // Create record of initial transaction state, then push to queue system
  await transactionModel.insert(txData);
  queueHandler.pushObject(config.rabbitMq.queueTransactions, txData);
  return txData;
};

/**
 * MODERATION VOTE
 * Submit a vote to support a motion to cancel the project
 * @param {string} transactionType Type of transaction
 * @param {string} contractAddress Project contract address
 * @param {integer} userId Id of the moderator
 * @param {string} encryptedVote Encrypted moderation vote
 * @param {integer} activityId Activity Id associated with function
 * @param {string} urlCallback URL of callback path for getting response from blockchain
 * @param {string} contractVersion Git version tag for contract version set
 */
const cancelVote = async (
  transactionType,
  contractAddress,
  userId,
  encryptedVote,
  activityId,
  urlCallback,
  contractVersion = false,
) => {
  logger.info('[func] SUBMIT MODERATION VOTE');

  await init();

  // Check that address is in proper format
  const isAddress = utils.ethereum.checkAddress(contractAddress);

  if (!isAddress) {
    throw new Error400({
      type: errorMap[errorMessage.INVALID_ADDRESS],
      msg: errorMessage.INVALID_ADDRESS,
    });
  }

  // Prepare transaction data
  logger.debug('Transaction Packing');
  // Get contract object based on version
  const contract = getContractVersionAbi('AccountManager', contractVersion);

  logger.debug(`Parameters: ${userId}, ${contractAddress}, ${encryptedVote}`);

  let abiData;
  try {
    abiData = contract.methods.submitVote(userId, contractAddress, encryptedVote).encodeABI();
  } catch (error) {
    throw new Error400({
      type: errorMap[errorMessage.ABI_ERROR],
      msg: errorMessage.ABI_ERROR,
    });
  }

  // Prepare some base properties for the deployment transaction
  logger.debug('Prepare Network info');
  const priorityFactor = taskPriority.PRIORITY_2;
  const opsFactor = opsLevel.OPS_LV5;
  // TODO Delete when Blockchain-Utils PR#18 merged
  const baseGasIndex = baseGas.ETHEREUM_GAS_BASE_FUNCTION;
  const isDeploy = false;

  const gasParams = {
    priorityFactor,
    opsFactor,
    // TODO Delete when Blockchain-Utils PR#18 merged
    baseGasIndex,
    isDeploy,
  };

  // Get contract address based on the version tag
  let projectAccountManagerAddress;
  const targetContractName = 'contract_account_manager_address';
  if (!contractVersion) {
    projectAccountManagerAddress = contractAccountManagerAddress;
  } else {
    projectAccountManagerAddress = await getContractVersionAddress(contractAddress, targetContractName);
  }

  txParams.toAddress = projectAccountManagerAddress;
  txParams.fromAddress = ownerAddress;
  txParams.transactionType = transactionType;
  txParams.callbackURL = urlCallback;
  txParams.abiData = abiData;
  const txData = await getSerializedTransaction(gasParams, activityId, txParams);

  // Create record of initial transaction state, then push to queue system
  await transactionModel.insert(txData);
  queueHandler.pushObject(config.rabbitMq.queueTransactions, txData);
  return txData;
};

/**
 * STAKE PLG
 * Stake PLG Tokens in exchange for CS
 * @param {string} transactionType Type of transaction
 * @param {integer} userId Id of the CS holder
 * @param {integer} amount Amount of PLG tokens up for staking
 * @param {integer} activityId Activity Id associated with function
 * @param {string} urlCallback URL of callback path for getting response from blockchain
 * @param {string} contractVersion Git version tag for contract version set
 */
const stakePLG = async (transactionType, userId, amount, activityId, urlCallback, contractVersion = false) => {
  logger.info('[func] STAKE PLG');

  await init();

  // Prepare transaction data
  logger.debug('Transaction Packing');
  const contract = getContractVersionAbi('AccountManager', contractVersion);

  logger.debug(`Parameters: ${userId}, ${amount}`);

  let abiData;
  try {
    abiData = await contract.methods.stakePLG(userId, amount).encodeABI();
  } catch (error) {
    throw new Error400({
      type: errorMap[errorMessage.ABI_ERROR],
      msg: errorMessage.ABI_ERROR,
    });
  }

  // Prepare some base properties for the deployment transaction
  logger.debug('Prepare Network info');
  const priorityFactor = taskPriority.PRIORITY_4;
  const opsFactor = opsLevel.OPS_LV5;
  // TODO Delete when Blockchain-Utils PR#18 merged
  const baseGasIndex = baseGas.ETHEREUM_GAS_BASE_FUNCTION;
  const isDeploy = false;
  const gasPriceLevel = 4;

  const gasParams = {
    priorityFactor,
    opsFactor,
    // TODO Delete when Blockchain-Utils PR#18 merged
    baseGasIndex,
    isDeploy,
    gasPriceLevel,
  };

  txParams.toAddress = contractAccountManagerAddress;
  txParams.fromAddress = ownerAddress;
  txParams.transactionType = transactionType;
  txParams.callbackURL = urlCallback;
  txParams.abiData = abiData;
  const txData = await getSerializedTransaction(gasParams, activityId, txParams);

  // Create record of initial transaction state, then push to queue system
  await transactionModel.insert(txData);
  queueHandler.pushObject(config.rabbitMq.queueTransactions, txData);
  return txData;
};

/**
 * UNSTAKE PLG
 * Unstake PLG tokens staked for CS
 * @param {string} transactionType Type of transaction
 * @param {integer} userId Id of the CS holder
 * @param {integer} activityId Activity Id associated with function
 * @param {string} urlCallback URL of callback path for getting response from blockchain
 * @param {string} contractVersion Git version tag for contract version set
 */
const unstakePLG = async (transactionType, userId, activityId, urlCallback, contractVersion = false) => {
  logger.info('[func] UNSTAKE PLG');

  await init();

  // Prepare transaction data
  logger.debug('Transaction Packing');
  const contract = getContractVersionAbi('AccountManager', contractVersion);

  logger.debug(`Parameters: ${userId}`);

  let abiData;
  try {
    abiData = await contract.methods.unstakeCS(userId).encodeABI();
  } catch (error) {
    throw new Error400({
      type: errorMap[errorMessage.ABI_ERROR],
      msg: errorMessage.ABI_ERROR,
    });
  }

  // Prepare some base properties for the deployment transaction
  logger.debug('Prepare Network info');
  const priorityFactor = taskPriority.PRIORITY_4;
  const opsFactor = opsLevel.OPS_LV5;
  // TODO Delete when Blockchain-Utils PR#18 merged
  const baseGasIndex = baseGas.ETHEREUM_GAS_BASE_FUNCTION;
  const isDeploy = false;

  const gasParams = {
    priorityFactor,
    opsFactor,
    // TODO Delete when Blockchain-Utils PR#18 merged
    baseGasIndex,
    isDeploy,
  };

  txParams.toAddress = contractAccountManagerAddress;
  txParams.fromAddress = ownerAddress;
  txParams.transactionType = transactionType;
  txParams.callbackURL = urlCallback;
  txParams.abiData = abiData;
  const txData = await getSerializedTransaction(gasParams, activityId, txParams);

  // Create record of initial transaction state, then push to queue system
  await transactionModel.insert(txData);
  queueHandler.pushObject(config.rabbitMq.queueTransactions, txData);
  return txData;
};

/**
 * WITHDRAW INTEREST
 * Withdraw PLG tokens received as interest for holding CS
 * @param {string} transactionType Type of transaction
 * @param {integer} userId Id of the CS holder
 * @param {integer} activityId Activity Id associated with function
 * @param {string} urlCallback URL of callback path for getting response from blockchain
 * @param {string} contractVersion Git version tag for contract version set
 */
const withdrawInterest = async (transactionType, userId, activityId, urlCallback, contractVersion = false) => {
  logger.info('[func] WITHDRAW INTEREST');

  await init();

  // Prepare transaction data
  logger.debug('Transaction Packing');
  const contract = getContractVersionAbi('AccountManager', contractVersion);

  logger.debug(`Parameters: ${userId}`);

  let abiData;
  try {
    abiData = await contract.methods.withdrawInterest(userId).encodeABI();
  } catch (error) {
    throw new Error400({
      type: errorMap[errorMessage.ABI_ERROR],
      msg: errorMessage.ABI_ERROR,
    });
  }

  // Prepare some base properties for the deployment transaction
  logger.debug('Prepare Network info');
  const priorityFactor = taskPriority.PRIORITY_4;
  const opsFactor = opsLevel.OPS_LV5;
  // TODO Delete when Blockchain-Utils PR#18 merged
  const baseGasIndex = baseGas.ETHEREUM_GAS_BASE_FUNCTION;
  const isDeploy = false;

  const gasParams = {
    priorityFactor,
    opsFactor,
    // TODO Delete when Blockchain-Utils PR#18 merged
    baseGasIndex,
    isDeploy,
  };

  txParams.toAddress = contractAccountManagerAddress;
  txParams.fromAddress = ownerAddress;
  txParams.transactionType = transactionType;
  txParams.callbackURL = urlCallback;
  txParams.abiData = abiData;
  const txData = await getSerializedTransaction(gasParams, activityId, txParams);

  // Create record of initial transaction state, then push to queue system
  await transactionModel.insert(txData);
  queueHandler.pushObject(config.rabbitMq.queueTransactions, txData);
  return txData;
};

/**
 * REINVEST PLG
 * Reinvest interest received in PLG
 * @param {string} transactionType Type of transaction
 * @param {integer} userId Id of the CS holder
 * @param {integer} activityId Activity Id associated with function
 * @param {string} urlCallback URL of callback path for getting response from blockchain
 */
const reinvestPLG = async (transactionType, userId, activityId, urlCallback) => {
  logger.info('[func] REINVEST PLG');

  // TODO: Uncomment when merged
  // await init();

  // Prepare transaction data
  logger.debug('Transaction Packing');
  const contract = await utils.ethereum.loadContract('AccountManager', `${__dirname}/abi`);
  // TODO: Replace when merged
  // logger.debug('Transaction Packing');
  // const contract = getContractVersionAbi('AccountManager', contractVersion);

  // logger.debug(`Parameters: ${userId}`);

  logger.debug(`Parameters: ${userId}`);

  let abiData;
  try {
    abiData = await contract.methods.reinvestPLG(userId).encodeABI();
  } catch (error) {
    throw new Error400({
      type: errorMap[errorMessage.ABI_ERROR],
      msg: errorMessage.ABI_ERROR,
    });
  }

  // Prepare some base properties for the deployment transaction
  logger.debug('Prepare Network info');
  const priorityFactor = taskPriority.PRIORITY_4;
  const opsFactor = opsLevel.OPS_LV5;
  // TODO Delete when Blockchain-Utils PR#18 merged
  const baseGasIndex = baseGas.ETHEREUM_GAS_BASE_FUNCTION;
  const isDeploy = false;

  const gasParams = {
    priorityFactor,
    opsFactor,
    // TODO Delete when Blockchain-Utils PR#18 merged
    baseGasIndex,
    isDeploy,
  };

  txParams.toAddress = contractAccountManagerAddress;
  // TODO: Add when merged
  // txParams.fromAddress = ownerAddress;
  txParams.transactionType = transactionType;
  txParams.callbackURL = urlCallback;
  txParams.abiData = abiData;
  const txData = await getSerializedTransaction(gasParams, activityId, txParams);

  // Create record of initial transaction state, then push to queue system
  await transactionModel.insert(txData);
  queueHandler.pushObject(config.rabbitMq.queueTransactions, txData);
  return txData;
};

/**
 * POST INTEREST
 * Post interest payment pool for CS holders
 * @param {string} transactionType Type of transaction
 * @param {integer} amount Amount to distribute in this round's interest pool
 * @param {integer} activityId Activity Id associated with function
 * @param {string} urlCallback URL of callback path for getting response from blockchain
 */
const postInterest = async (transactionType, amount, activityId, urlCallback) => {
  logger.info('[func] POST INTEREST');

  // TODO: Uncomment when merged
  await init();

  // Prepare transaction data
  logger.debug('Transaction Packing');
  const contract = await utils.ethereum.loadContract('CampShareManager', `${__dirname}/abi`);
  // TODO: Replace when merged
  // logger.debug('Transaction Packing');
  // const contract = getContractVersionAbi('CampShareManager', contractVersion);

  // logger.debug(`Parameters: ${amount}`);

  logger.debug(`Parameters: ${amount}`);

  let abiData;
  try {
    abiData = await contract.methods.postInterest(amount).encodeABI();
  } catch (error) {
    throw new Error400({
      type: errorMap[errorMessage.ABI_ERROR],
      msg: errorMessage.ABI_ERROR,
    });
  }

  // Prepare some base properties for the deployment transaction
  logger.debug('Prepare Network info');
  const priorityFactor = taskPriority.PRIORITY_4;
  const opsFactor = opsLevel.OPS_LV5;
  // TODO Delete when Blockchain-Utils PR#18 merged
  const baseGasIndex = baseGas.ETHEREUM_GAS_BASE_FUNCTION;
  const isDeploy = false;

  const gasParams = {
    priorityFactor,
    opsFactor,
    // TODO Delete when Blockchain-Utils PR#18 merged
    baseGasIndex,
    isDeploy,
  };

  console.log('To', contractCampshareAddress, 'From', ownerAddress);
  txParams.toAddress = contractCampshareAddress;
  txParams.fromAddress = ownerAddress;
  txParams.transactionType = transactionType;
  txParams.callbackURL = urlCallback;
  txParams.abiData = abiData;
  const txData = await getSerializedTransaction(gasParams, activityId, txParams);

  // Create record of initial transaction state, then push to queue system
  await transactionModel.insert(txData);
  queueHandler.pushObject(config.rabbitMq.queueTransactions, txData);
  return txData;
};

/**
 * SET PROJECT MODERATORS
 * setProjectModerators() method to set list of moderators for moderation vote
 * @param {string} transactionType Type of transaction
 * @param {string} contractAddress Project contract address
 * @param {integer[]} moderators Array of moderator user Ids to set
 * @param {integer} moderationEndTime Time stamp marking end of moderation vote
 * @param {integer} activityId Activity Id associated with function
 * @param {string} urlCallback URL of callback path for getting response from blockchain
 */
const setProjectModerators = async (
  transactionType,
  contractAddress,
  moderators,
  moderationEndTime,
  activityId,
  urlCallback,
) => {
  logger.info('[func] PROJECT MODERATORS');

  // Check that address is in proper format
  const isAddress = utils.ethereum.checkAddress(contractAddress);

  if (!isAddress) {
    throw new Error400({
      type: errorMap[errorMessage.INVALID_ADDRESS],
      msg: errorMessage.INVALID_ADDRESS,
    });
  }

  // Handling for arrays coming in from Golang
  const moderatorsInt = [];
  let moderatorsArray;
  if (typeof moderators === 'string') {
    moderatorsArray = moderators.replace('[', '').replace(']', '');
    moderatorsArray = moderatorsArray.split(' ');
  } else {
    moderatorsArray = moderators;
  }

  if (!Array.isArray(moderatorsArray)) {
    throw new Error400({
      type: errorMap[errorMessage.INVALID_PARAM_FORMAT],
      msg: `${errorMessage.INVALID_PARAM_FORMAT}: moderatorsArray`,
      data: moderatorsArray,
    });
  }

  moderatorsArray.forEach((moderator) => {
    if (typeof moderator !== 'number') {
      throw new Error400({
        type: errorMap[errorMessage.INVALID_PARAM_FORMAT],
        msg: `${errorMessage.INVALID_PARAM_FORMAT}: moderators`,
        data: moderator,
      });
    }
    moderatorsInt.push(parseInt(moderator));
  });
  logger.debug(`Moderators array conversion: ${moderatorsInt}`);

  // Prepare transaction data
  logger.debug('Transaction Packing');
  const contract = await utils.ethereum.loadContract('CampShareManager', `${__dirname}/abi`);

  logger.debug(`Parameters: ${contractAddress}, ${moderatorsInt}, ${moderationEndTime}`);

  let abiData;
  try {
    abiData = contract.methods.setProjectModerators(contractAddress, moderatorsInt, moderationEndTime).encodeABI();
  } catch (error) {
    throw new Error400({
      type: errorMap[errorMessage.ABI_ERROR],
      msg: errorMessage.ABI_ERROR,
    });
  }

  // Prepare some base properties for the deployment transaction
  logger.debug('Prepare Network info');
  const priorityFactor = taskPriority.PRIORITY_4;
  const opsFactor = opsLevel.OPS_LV5;
  // TODO Delete when Blockchain-Utils PR#18 merged
  const baseGasIndex = baseGas.ETHEREUM_GAS_BASE_FUNCTION;
  const isDeploy = false;

  const gasParams = {
    priorityFactor,
    opsFactor,
    // TODO Delete when Blockchain-Utils PR#18 merged
    baseGasIndex,
    isDeploy,
  };

  txParams.toAddress = contractCampshareAddress;
  txParams.transactionType = transactionType;
  txParams.callbackURL = urlCallback;
  txParams.abiData = abiData;
  const txData = await getSerializedTransaction(gasParams, activityId, txParams);

  // Create record of initial transaction state, then push to queue system
  await transactionModel.insert(txData);
  queueHandler.pushObject(config.rabbitMq.queueTransactions, txData);
  return txData;
};

/**
 * CANCEL Project
 * Count votes and finalize result of moderation vote
 * @param {string} transactionType Type of transaction
 * @param {string} contractAddress Project contract address
 * @param {integer} activityId Activity Id associated with function
 * @param {string} urlCallback URL of callback path for getting response from blockchain
 * @param {string} contractVersion Git version tag for contract version set
 */
const cancelProject = async (transactionType, contractAddress, activityId, urlCallback, contractVersion = false) => {
  logger.info('[func] CANCEL PROJECT');

  await init();

  // Check that address is in proper format
  const isAddress = utils.ethereum.checkAddress(contractAddress);

  if (!isAddress) {
    throw new Error400({
      type: errorMap[errorMessage.INVALID_ADDRESS],
      msg: errorMessage.INVALID_ADDRESS,
    });
  }

  // Prepare transaction data
  logger.debug('Transaction Packing');
  // Get contract object based on version
  const contract = getContractVersionAbi('Moderator', contractVersion);

  logger.debug(`Parameters: ${contractAddress}`);

  let abiData;
  try {
    abiData = contract.methods.cancelProject(contractAddress).encodeABI();
  } catch (error) {
    throw new Error400({
      type: errorMap[errorMessage.ABI_ERROR],
      msg: errorMessage.ABI_ERROR,
    });
  }

  // Prepare some base properties for the deployment transaction
  logger.debug('Prepare Network info');
  const priorityFactor = taskPriority.PRIORITY_4;
  const opsFactor = opsLevel.OPS_LV5;
  // TODO Delete when Blockchain-Utils PR#18 merged
  const baseGasIndex = baseGas.ETHEREUM_GAS_BASE_FUNCTION;
  const isDeploy = false;

  const gasParams = {
    priorityFactor,
    opsFactor,
    // TODO Delete when Blockchain-Utils PR#18 merged
    baseGasIndex,
    isDeploy,
  };

  // Get contract address based on the version tag
  let projectModeratorAddress;
  const targetContractName = 'contract_moderator_address';
  if (!contractVersion) {
    projectModeratorAddress = contractModeratorAddress;
  } else {
    projectModeratorAddress = await getContractVersionAddress(contractAddress, targetContractName);
  }

  txParams.toAddress = projectModeratorAddress;
  txParams.fromAddress = ownerAddress;
  txParams.transactionType = transactionType;
  txParams.callbackURL = urlCallback;
  txParams.abiData = abiData;
  const txData = await getSerializedTransaction(gasParams, activityId, txParams);

  // Create record of initial transaction state, then push to queue system
  await transactionModel.insert(txData);
  queueHandler.pushObject(config.rabbitMq.queueTransactions, txData);
  return txData;
};

/**
 * CHECK MILESTONES
 * Check that a milestone has reached and conclude voting on milestone
 * @param {string} transactionType Type of transaction
 * @param {string} contractAddress Project contract address
 * @param {integer} activityId Activity Id associated with function
 * @param {string} urlCallback URL of callback path for getting response from blockchain
 * @param {string} contractVersion Git version tag for contract version set
 */
const checkMilestones = async (transactionType, contractAddress, activityId, urlCallback, contractVersion = false) => {
  logger.info('[func] CHECK MILESTONES');

  await init();

  const isAddress = utils.ethereum.checkAddress(contractAddress);

  if (!isAddress) {
    throw new Error400({
      type: errorMap[errorMessage.INVALID_ADDRESS],
      msg: errorMessage.INVALID_ADDRESS,
    });
  }

  // Prepare transaction data
  logger.debug('Transaction Packing');
  const contract = getContractVersionAbi('PLGProject', contractVersion);

  let abiData;
  try {
    abiData = await contract.methods.checkMilestones().encodeABI();
  } catch (error) {
    throw new Error400({
      type: errorMap[errorMessage.ABI_ERROR],
      msg: errorMessage.ABI_ERROR,
    });
  }

  // Prepare some base properties for the deployment transaction
  logger.debug('Prepare Network info');
  const priorityFactor = taskPriority.PRIORITY_4;
  const opsFactor = opsLevel.OPS_LV5;
  // TODO Delete when Blockchain-Utils PR#18 merged
  const baseGasIndex = baseGas.ETHEREUM_GAS_BASE_FUNCTION;
  const isDeploy = false;

  const gasParams = {
    priorityFactor,
    opsFactor,
    // TODO Delete when Blockchain-Utils PR#18 merged
    baseGasIndex,
    isDeploy,
  };

  txParams.toAddress = contractAddress;
  txParams.fromAddress = ownerAddress;
  txParams.transactionType = transactionType;
  txParams.callbackURL = urlCallback;
  txParams.abiData = abiData;
  const txData = await getSerializedTransaction(gasParams, activityId, txParams);

  // Create record of initial transaction state, then push to queue system
  await transactionModel.insert(txData);
  queueHandler.pushObject(config.rabbitMq.queueTransactions, txData);
  return txData;
};

/**
 * REQUEST REFUND
 * Allow backers to collect refunds on failed projects
 * @param {string} transactionType Type of transaction
 * @param {string} contractAddress Project contract address
 * @param {integer} userId User Id of user requesting refunds
 * @param {integer} activityId Activity Id associated with function
 * @param {string} urlCallback URL of callback path for getting response from blockchain
 * @param {string} contractVersion Git version tag for contract version set
 */
const requestRefund = async (
  transactionType,
  contractAddress,
  userId,
  activityId,
  urlCallback,
  contractVersion = false,
) => {
  logger.info('[func] REQUEST REFUND');

  await init();

  // Check that address is in proper format
  const isAddress = utils.ethereum.checkAddress(contractAddress);

  if (!isAddress) {
    throw new Error400({
      type: errorMap[errorMessage.INVALID_ADDRESS],
      msg: errorMessage.INVALID_ADDRESS,
    });
  }

  // Prepare transaction data
  logger.debug('Transaction Packing');
  // Get contract object based on version
  const contract = getContractVersionAbi('AccountManager', contractVersion);

  logger.debug(`Parameters: ${contractAddress}, ${userId}`);

  let abiData;
  try {
    abiData = contract.methods.requestRefund(contractAddress, userId).encodeABI();
  } catch (error) {
    throw new Error400({
      type: errorMap[errorMessage.ABI_ERROR],
      msg: errorMessage.ABI_ERROR,
    });
  }

  // Prepare some base properties for the deployment transaction
  logger.debug('Prepare Network info');
  const priorityFactor = taskPriority.PRIORITY_4;
  const opsFactor = opsLevel.OPS_LV5;
  // TODO Delete when Blockchain-Utils PR#18 merged
  const baseGasIndex = baseGas.ETHEREUM_GAS_BASE_FUNCTION;
  const isDeploy = false;

  const gasParams = {
    priorityFactor,
    opsFactor,
    // TODO Delete when Blockchain-Utils PR#18 merged
    baseGasIndex,
    isDeploy,
  };

  // Get contract address based on the version tag
  let projectAccountManagerAddress;
  const targetContractName = 'contract_account_manager_address';
  if (!contractVersion) {
    projectAccountManagerAddress = contractAccountManagerAddress;
  } else {
    projectAccountManagerAddress = await getContractVersionAddress(contractAddress, targetContractName);
  }

  txParams.toAddress = projectAccountManagerAddress;
  txParams.fromAddress = ownerAddress;
  txParams.transactionType = transactionType;
  txParams.callbackURL = urlCallback;
  txParams.abiData = abiData;
  const txData = await getSerializedTransaction(gasParams, activityId, txParams);

  // Create record of initial transaction state, then push to queue system
  await transactionModel.insert(txData);
  queueHandler.pushObject(config.rabbitMq.queueTransactions, txData);
  return txData;
};

/**
 * WITHDRAW FUNDS
 * Allow creator to withdraw funds from a successful milestone
 * @param {string} transactionType Type of transaction
 * @param {string} contractAddress Project contract address
 * @param {integer} userId User Id of project creator
 * @param {integer} activityId Activity Id associated with function
 * @param {string} urlCallback URL of callback path for getting response from blockchain
 * @param {string} contractVersion Git version tag for contract version set
 */
const withdrawFunds = async (
  transactionType,
  contractAddress,
  userId,
  activityId,
  urlCallback,
  contractVersion = false,
) => {
  logger.info('[func] WITHDRAW FUNDS');

  await init();

  // Check that address is in proper format
  const isAddress = utils.ethereum.checkAddress(contractAddress);

  if (!isAddress) {
    throw new Error400({
      type: errorMap[errorMessage.INVALID_ADDRESS],
      msg: errorMessage.INVALID_ADDRESS,
    });
  }

  // Prepare transaction data
  logger.debug('Transaction Packing');
  // Get contract object based on version
  const contract = getContractVersionAbi('AccountManager', contractVersion);

  logger.debug(`Parameters: ${contractAddress}, ${userId}`);

  let abiData;
  try {
    abiData = contract.methods.withdrawFunds(contractAddress, userId).encodeABI();
  } catch (error) {
    throw new Error400({
      type: errorMap[errorMessage.ABI_ERROR],
      msg: errorMessage.ABI_ERROR,
    });
  }

  // Prepare some base properties for the deployment transaction
  logger.debug('Prepare Network info');
  const priorityFactor = taskPriority.PRIORITY_4;
  const opsFactor = opsLevel.OPS_LV5;
  // TODO Delete when Blockchain-Utils PR#18 merged
  const baseGasIndex = baseGas.ETHEREUM_GAS_BASE_FUNCTION;
  const isDeploy = false;

  const gasParams = {
    priorityFactor,
    opsFactor,
    // TODO Delete when Blockchain-Utils PR#18 merged
    baseGasIndex,
    isDeploy,
  };

  // Get contract address based on the version tag
  let projectAccountManagerAddress;
  const targetContractName = 'contract_account_manager_address';
  if (!contractVersion) {
    projectAccountManagerAddress = contractAccountManagerAddress;
  } else {
    projectAccountManagerAddress = await getContractVersionAddress(contractAddress, targetContractName);
  }

  txParams.toAddress = projectAccountManagerAddress;
  txParams.fromAddress = ownerAddress;
  txParams.transactionType = transactionType;
  txParams.callbackURL = urlCallback;
  txParams.abiData = abiData;
  const txData = await getSerializedTransaction(gasParams, activityId, txParams);

  // Create record of initial transaction state, then push to queue system
  await transactionModel.insert(txData);
  queueHandler.pushObject(config.rabbitMq.queueTransactions, txData);
  return txData;
};

/**
 * COMMIT MODERATOR VOTES
 * commitModeratorVotes() method reveals final moderator votes
 * @param {string} transactionType Type of transaction
 * @param {boolean[]} votes Array of boolean votes
 * @param {string[]} decryptionKeys Array of password keys for decrypting each individual vote
 * @param {integer[]} userIds Array of Ids of moderators who submitted votes
 * @param {string} contractAddress Project contract address
 * @param {integer} projectId Project Id
 * @param {integer} activityId Activity Id associated with function
 * @param {string} urlCallback URL of callback path for getting response from blockchain
 * @param {string} contractVersion Git version tag for contract version set
 */
const commitModeratorVotes = async (
  transactionType,
  votes,
  decryptionKeys,
  userIds,
  contractAddress,
  projectId,
  activityId,
  urlCallback,
  contractVersion = false,
) => {
  logger.info('[func] COMMIT MODERATOR VOTES');

  await init();

  // Check that address is in proper format
  const isAddress = utils.ethereum.checkAddress(contractAddress);

  if (!isAddress) {
    throw new Error400({
      type: errorMap[errorMessage.INVALID_ADDRESS],
      msg: errorMessage.INVALID_ADDRESS,
    });
  }

  // Handling for arrays coming in from Golang
  let votesStr = [];
  if (typeof votes === 'string') {
    let votesArray = votes.replace('[', '').replace(']', '');
    votesArray = votesArray.split(' ');

    votesArray.forEach((vote) => {
      let voteBool;
      if (vote.toLowerCase() === 'true' || vote.toLowerCase() === 'false') {
        voteBool = vote.toLowerCase() === 'true';
      } else {
        throw new Error400({
          type: errorMap[errorMessage.INVALID_PARAM_FORMAT],
          msg: `${errorMessage.INVALID_PARAM_FORMAT}: votes`,
        });
      }
      votesStr.push(voteBool);
    });
  } else if (Array.isArray(votes)) {
    let voteBool;
    votes.forEach((vote) => {
      if (vote === true || vote === false) {
        voteBool = true;
      } else {
        voteBool = false;
        throw new Error400({
          type: errorMap[errorMessage.INVALID_PARAM_FORMAT],
          msg: `${errorMessage.INVALID_PARAM_FORMAT}: votes`,
        });
      }
    });
    if (voteBool) {
      votesStr = votes;
    }
  } else {
    votesStr = votes;
  }

  if (!Array.isArray(votesStr)) {
    throw new Error400({
      type: errorMap[errorMessage.INVALID_PARAM_FORMAT],
      msg: `${errorMessage.INVALID_PARAM_FORMAT}: votesStr`,
      data: votesStr,
    });
  }

  logger.debug(`Vote array conversion: ${votesStr}`);

  const decryptionKeysStr = [];
  let decryptionKeysArray;
  if (typeof decryptionKeys === 'string') {
    decryptionKeysArray = decryptionKeys.replace('[', '').replace(']', '');
    decryptionKeysArray = decryptionKeysArray.split(' ');
  } else {
    decryptionKeysArray = decryptionKeys;
  }

  if (!Array.isArray(decryptionKeysArray)) {
    throw new Error400({
      type: errorMap[errorMessage.INVALID_PARAM_FORMAT],
      msg: `${errorMessage.INVALID_PARAM_FORMAT}: decryptionKeysArray`,
      data: decryptionKeysArray,
    });
  }

  decryptionKeysArray.forEach((key) => {
    if (typeof key !== 'string') {
      throw new Error400({
        type: errorMap[errorMessage.INVALID_PARAM_FORMAT],
        msg: `${errorMessage.INVALID_PARAM_FORMAT}: key`,
        data: key,
      });
    }
    decryptionKeysStr.push(key);
  });
  logger.debug(`Decryption Key array conversion: ${decryptionKeysStr}`);

  const userIdsInt = [];
  let userIdsArray;
  if (typeof userIds === 'string') {
    userIdsArray = userIds.replace('[', '').replace(']', '');
    userIdsArray = userIdsArray.split(' ');
  } else {
    userIdsArray = userIds;
  }

  if (!Array.isArray(userIdsArray)) {
    throw new Error400({
      type: errorMap[errorMessage.INVALID_PARAM_FORMAT],
      msg: `${errorMessage.INVALID_PARAM_FORMAT}: userIdsArray`,
      data: userIdsArray,
    });
  }

  userIdsArray.forEach((id) => {
    if (typeof id !== 'number') {
      throw new Error400({
        type: errorMap[errorMessage.INVALID_PARAM_FORMAT],
        msg: `${errorMessage.INVALID_PARAM_FORMAT}: id`,
        data: id,
      });
    }
    userIdsInt.push(parseInt(id));
  });
  logger.debug(`User Id array conversion: ${userIdsInt}`);

  // Prepare transaction data
  logger.debug('Transaction Packing');
  // Get contract object based on version
  const contract = getContractVersionAbi('Moderator', contractVersion);

  logger.debug(`Parameters: ${contractAddress}, ${projectId}, ${userIdsInt}, ${decryptionKeysStr}, ${votesStr}`);

  let abiData;
  try {
    abiData = contract.methods
      .commitFinalVotes(contractAddress, projectId, userIdsInt, decryptionKeysStr, votesStr)
      .encodeABI();
  } catch (error) {
    throw new Error400({
      type: errorMap[errorMessage.ABI_ERROR],
      msg: errorMessage.ABI_ERROR,
    });
  }

  // Prepare some base properties for the deployment transaction
  logger.debug('Prepare Network info');
  const priorityFactor = taskPriority.PRIORITY_4;
  const opsFactor = opsLevel.OPS_LV5;
  // TODO Delete when Blockchain-Utils PR#18 merged
  const baseGasIndex = baseGas.ETHEREUM_GAS_BASE_FUNCTION;
  const isDeploy = false;

  const gasParams = {
    priorityFactor,
    opsFactor,
    // TODO Delete when Blockchain-Utils PR#18 merged
    baseGasIndex,
    isDeploy,
  };

  // Get contract address based on the version tag
  let projectModeratorAddress;
  const targetContractName = 'contract_moderator_address';
  if (!contractVersion) {
    projectModeratorAddress = contractModeratorAddress;
  } else {
    projectModeratorAddress = await getContractVersionAddress(contractAddress, targetContractName);
  }

  txParams.toAddress = projectModeratorAddress;
  txParams.fromAddress = ownerAddress;
  txParams.transactionType = transactionType;
  txParams.callbackURL = urlCallback;
  txParams.abiData = abiData;
  const txData = await getSerializedTransaction(gasParams, activityId, txParams);

  // Create record of initial transaction state, then push to queue system
  await transactionModel.insert(txData);
  queueHandler.pushObject(config.rabbitMq.queueTransactions, txData);
  return txData;
};

/**
 * FAILED FUND RECOVERY
 * Transfer any leftover funds in project to Admin contract (after 90 days)
 * @param {string} transactionType Type of transaction
 * @param {string} contractAddress Project contract address
 * @param {integer} activityId Activity Id associated with function
 * @param {string} urlCallback URL of callback path for getting response from blockchain
 * @param {string} contractVersion Git version tag for contract version set
 */
const failedFundRecovery = async (
  transactionType,
  contractAddress,
  activityId,
  urlCallback,
  contractVersion = false,
) => {
  logger.info('[func] FAILED FUND RECOVERY');

  await init();

  // Check that address is in proper format
  const isAddress = utils.ethereum.checkAddress(contractAddress);

  if (!isAddress) {
    throw new Error400({
      type: errorMap[errorMessage.INVALID_ADDRESS],
      msg: errorMessage.INVALID_ADDRESS,
    });
  }

  // Prepare transaction data
  logger.debug('Transaction Packing');
  // Get contract object based on version
  const contract = getContractVersionAbi('PLGProject', contractVersion);

  let abiData;
  try {
    abiData = await contract.methods.failedFundRecovery().encodeABI();
  } catch (error) {
    throw new Error400({
      type: errorMap[errorMessage.ABI_ERROR],
      msg: errorMessage.ABI_ERROR,
    });
  }

  // Prepare some base properties for the deployment transaction
  logger.debug('Prepare Network info');
  const priorityFactor = taskPriority.PRIORITY_4;
  const opsFactor = opsLevel.OPS_LV5;
  // TODO Delete when Blockchain-Utils PR#18 merged
  const baseGasIndex = baseGas.ETHEREUM_GAS_BASE_FUNCTION;
  const isDeploy = false;

  const gasParams = {
    priorityFactor,
    opsFactor,
    // TODO Delete when Blockchain-Utils PR#18 merged
    baseGasIndex,
    isDeploy,
  };

  txParams.toAddress = contractAddress;
  txParams.fromAddress = ownerAddress;
  txParams.transactionType = transactionType;
  txParams.callbackURL = urlCallback;
  txParams.abiData = abiData;
  const txData = await getSerializedTransaction(gasParams, activityId, txParams);

  // Create record of initial transaction state, then push to queue system
  await transactionModel.insert(txData);
  queueHandler.pushObject(config.rabbitMq.queueTransactions, txData);
  return txData;
};

/**
 * SET PROJECT INFO
 * setProjectInfo() method for the Admin to set the interest fee percentage to the project contract
 * @param {string} transactionType Type of transaction
 * @param {string} contractAddress Project contract address
 * @param {integer} listingFee Listing fee amount associated with project
 * @param {integer} activityId Activity Id associated with function
 * @param {string} urlCallback URL of callback path for getting response from blockchain
 * @param {string} contractVersion Git version tag for contract version set
 */
const setProjectInfo = async (
  transactionType,
  contractAddress,
  listingFee,
  activityId,
  urlCallback,
  contractVersion = false,
) => {
  logger.info('[func] SET PROJECT INFO');

  await init();

  // Check that address is in proper format
  const isAddress = utils.ethereum.checkAddress(contractAddress);

  if (!isAddress) {
    throw new Error400({
      type: errorMap[errorMessage.INVALID_ADDRESS],
      msg: errorMessage.INVALID_ADDRESS,
    });
  }

  // Prepare transaction data
  logger.debug('Transaction Packing');
  const contract = getContractVersionAbi('Administrator', contractVersion);

  logger.debug(`Parameters: ${contractAddress}, ${listingFee}`);

  let abiData;
  try {
    abiData = contract.methods.setProjectInfo(contractAddress, listingFee).encodeABI();
  } catch (error) {
    throw new Error400({
      type: errorMap[errorMessage.ABI_ERROR],
      msg: errorMessage.ABI_ERROR,
    });
  }

  // Prepare some base properties for the deployment transaction
  logger.debug('Prepare Network info');
  const priorityFactor = taskPriority.PRIORITY_4;
  const opsFactor = opsLevel.OPS_LV5;
  // TODO Delete when Blockchain-Utils PR#18 merged
  const baseGasIndex = baseGas.ETHEREUM_GAS_BASE_FUNCTION;
  const isDeploy = false;

  const gasParams = {
    priorityFactor,
    opsFactor,
    // TODO Delete when Blockchain-Utils PR#18 merged
    baseGasIndex,
    isDeploy,
  };

  // Get contract address based on the version tag
  let projectAdministratorAddress;
  const targetContractName = 'contract_administrator_address';
  if (!contractVersion) {
    projectAdministratorAddress = contractAdministratorAddress;
  } else {
    projectAdministratorAddress = await getContractVersionAddress(contractAddress, targetContractName);
  }

  txParams.toAddress = projectAdministratorAddress;
  txParams.fromAddress = ownerAddress;
  txParams.transactionType = transactionType;
  txParams.callbackURL = urlCallback;
  txParams.abiData = abiData;
  const txData = await getSerializedTransaction(gasParams, activityId, txParams);

  // Create record of initial transaction state, then push to queue system
  await transactionModel.insert(txData);
  queueHandler.pushObject(config.rabbitMq.queueTransactions, txData);
  return txData;
};

/**
 * RECEIVE FROM PRIVATE
 * Receive funds from external wallet after approval was set offline
 * @param {string} transactionType Type of transaction
 * @param {string} senderAddress Address of wallet sending funds
 * @param {integer} userId User Id of recipient
 * @param {integer} activityId Activity Id associated with function
 * @param {string} urlCallback URL of callback path for getting response from blockchain
 */
const receiveFromPrivate = async (
  transactionType,
  senderAddress,
  userId,
  activityId,
  urlCallback,
) => {
  logger.info('[func] RECEIVE FROM PRIVATE');

  await init();

  // Check that address is in proper format
  const isAddress = utils.ethereum.checkAddress(senderAddress);

  if (!isAddress) {
    throw new Error400({
      type: errorMap[errorMessage.INVALID_ADDRESS],
      msg: errorMessage.INVALID_ADDRESS,
    });
  }

  // Prepare transaction data
  logger.debug('Transaction Packing');
  const contract = await utils.ethereum.loadLiveContract(
    'AccountManager',
    contractAccountManagerAddress,
    `${__dirname}/abi`,
  );

  logger.debug(`Parameters: ${senderAddress}, ${userId}`);

  let abiData;
  try {
    abiData = await contract.methods.receiveFromPrivate(senderAddress, userId).encodeABI();
  } catch (error) {
    throw new Error400({
      type: errorMap[errorMessage.ABI_ERROR],
      msg: errorMessage.ABI_ERROR,
    });
  }

  // Prepare some base properties for the deployment transaction
  logger.debug('Prepare Network info');
  const priorityFactor = taskPriority.PRIORITY_4;
  const opsFactor = opsLevel.OPS_LV5;
  // TODO Delete when Blockchain-Utils PR#18 merged
  const baseGasIndex = baseGas.ETHEREUM_GAS_BASE_FUNCTION;
  const isDeploy = false;

  const gasParams = {
    priorityFactor,
    opsFactor,
    // TODO Delete when Blockchain-Utils PR#18 merged
    baseGasIndex,
    isDeploy,
  };

  txParams.toAddress = contractAccountManagerAddress;
  txParams.fromAddress = ownerAddress;
  txParams.transactionType = transactionType;
  txParams.callbackURL = urlCallback;
  txParams.abiData = abiData;
  const txData = await getSerializedTransaction(gasParams, activityId, txParams);

  // Create record of initial transaction state, then push to queue system
  await transactionModel.insert(txData);
  queueHandler.pushObject(config.rabbitMq.queueTransactions, txData);
  return txData;
};

/**
 * TRANSFER BETWEEN ACCOUNTS
 * Transfer funds between accounts in the AccountStorage contract
 * @param {string} transactionType Type of transaction
 * @param {integer} senderAccount User Id of sender
 * @param {integer} receiverAccount User Id of recipient
 * @param {integer} transferAmount Amount of tokens being transferred
 * @param {integer} activityId Activity Id associated with function
 * @param {string} urlCallback URL of callback path for getting response from blockchain
 */
const transferBetweenAccounts = async (
  transactionType,
  senderAccount,
  receiverAccount,
  transferAmount,
  activityId,
  urlCallback,
) => {
  logger.info('[func] TRANSFER BETWEEN ACCOUNTS');

  await init();

  // Prepare transaction data
  logger.debug('Transaction Packing');
  const contract = await utils.ethereum.loadLiveContract(
    'AccountManager',
    contractAccountManagerAddress,
    `${__dirname}/abi`,
  );

  logger.debug(`Parameters: ${senderAccount}, ${receiverAccount}, ${transferAmount}`);

  let abiData;
  try {
    abiData = await contract.methods
      .transferBetweenAccounts(senderAccount, receiverAccount, transferAmount)
      .encodeABI();
  } catch (error) {
    throw new Error400({
      type: errorMap[errorMessage.ABI_ERROR],
      msg: errorMessage.ABI_ERROR,
    });
  }

  // Prepare some base properties for the deployment transaction
  logger.debug('Prepare Network info');
  const priorityFactor = taskPriority.PRIORITY_4;
  const opsFactor = opsLevel.OPS_LV5;
  // TODO Delete when Blockchain-Utils PR#18 merged
  const baseGasIndex = baseGas.ETHEREUM_GAS_BASE_FUNCTION;
  const isDeploy = false;

  const gasParams = {
    priorityFactor,
    opsFactor,
    // TODO Delete when Blockchain-Utils PR#18 merged
    baseGasIndex,
    isDeploy,
  };

  txParams.toAddress = contractAccountManagerAddress;
  txParams.fromAddress = ownerAddress;
  txParams.transactionType = transactionType;
  txParams.callbackURL = urlCallback;
  txParams.abiData = abiData;
  const txData = await getSerializedTransaction(gasParams, activityId, txParams);

  // Create record of initial transaction state, then push to queue system
  await transactionModel.insert(txData);
  queueHandler.pushObject(config.rabbitMq.queueTransactions, txData);
  return txData;
};

/**
 * TRANSFER TO PRIVATE
 * Transfer funds to external wallet
 * @param {string} transactionType Type of transaction
 * @param {integer} userId User Id of sender
 * @param {string} receiverAddress Address of wallet receiving funds
 * @param {integer} transferAmount Amount of tokens being transferred
 * @param {integer} activityId Activity Id associated with function
 * @param {string} urlCallback URL of callback path for getting response from blockchain
 */
const transferToPrivate = async (
  transactionType,
  userId,
  receiverAddress,
  transferAmount,
  activityId,
  urlCallback,
) => {
  logger.info('[func] TRANSFER TO PRIVATE');

  await init();

  // Check that address is in proper format
  const isAddress = utils.ethereum.checkAddress(receiverAddress);

  if (!isAddress) {
    throw new Error400({
      type: errorMap[errorMessage.INVALID_ADDRESS],
      msg: errorMessage.INVALID_ADDRESS,
    });
  }

  // Prepare transaction data
  logger.debug('Transaction Packing');
  const contract = await utils.ethereum.loadLiveContract(
    'AccountManager',
    contractAccountManagerAddress,
    `${__dirname}/abi`,
  );

  logger.debug(`Parameters: ${userId}, ${receiverAddress}, ${transferAmount}`);

  let abiData;
  try {
    abiData = await contract.methods.transferToPrivate(userId, receiverAddress, transferAmount).encodeABI();
  } catch (error) {
    throw new Error400({
      type: errorMap[errorMessage.ABI_ERROR],
      msg: errorMessage.ABI_ERROR,
    });
  }

  // Prepare some base properties for the deployment transaction
  logger.debug('Prepare Network info');
  const priorityFactor = taskPriority.PRIORITY_4;
  const opsFactor = opsLevel.OPS_LV5;
  // TODO Delete when Blockchain-Utils PR#18 merged
  const baseGasIndex = baseGas.ETHEREUM_GAS_BASE_FUNCTION;
  const isDeploy = false;

  const gasParams = {
    priorityFactor,
    opsFactor,
    // TODO Delete when Blockchain-Utils PR#18 merged
    baseGasIndex,
    isDeploy,
  };

  txParams.toAddress = contractAccountManagerAddress;
  txParams.fromAddress = ownerAddress;
  txParams.transactionType = transactionType;
  txParams.callbackURL = urlCallback;
  txParams.abiData = abiData;
  const txData = await getSerializedTransaction(gasParams, activityId, txParams);

  // Create record of initial transaction state, then push to queue system
  await transactionModel.insert(txData);
  queueHandler.pushObject(config.rabbitMq.queueTransactions, txData);
  return txData;
};

/**
 * GET BALANCE
 * Get user balance from AccountStorage
 * @param {integer} userId User Id of sender
 */
const getBalance = async (userId) => {
  logger.info('[func] GET BALANCE');

  await init();

  // Prepare transaction data
  logger.debug('Transaction Packing');
  const contract = await utils.ethereum.loadLiveContract(
    'AccountManager',
    contractAccountManagerAddress,
    `${__dirname}/abi`,
  );

  logger.debug(`Parameters: ${userId}`);

  return contract.methods.balanceOf(userId).call();
};

/**
 * GET GAINS
 * Get user unrealized gains from CampShareManager
 * @param {integer} userId User Id of sender
 */
const getGains = async (userId) => {
  logger.info('[func] GET GAINS');

  await init();

  // Prepare transaction data
  logger.debug('Transaction Packing');
  const contract = await utils.ethereum.loadLiveContract(
    'AccountManager',
    contractAccountManagerAddress,
    `${__dirname}/abi`,
  );

  logger.debug(`Parameters: ${userId}`);

  return contract.methods.unrealizedGains(userId).call();
};

/**
 * PREPARE RAW TRANSACTION
 * Prepare raw transaction to be put into the queue and processed on the blockchain
 * @param {string} transactionType Type of transaction
 * @param {string} transactionSerialized Serialized and signed transaction to be processed
 * @param {string} senderAddress Address of wallet sending funds
 * @param {string} receiverAddress Address of wallet receiving funds
 * @param {string} urlCallback URL of callback path for getting response from blockchain
 */
const prepareRawTx = async (transactionType, transactionSerialized, senderAddress, receiverAddress, urlCallback) => {
  logger.info('[func] PREPARE RAW TX');

  await init();

  let isAddress = utils.ethereum.checkAddress(senderAddress);

  if (!isAddress) {
    throw new Error400({
      type: errorMap[errorMessage.INVALID_ADDRESS],
      msg: errorMessage.INVALID_ADDRESS,
    });
  }

  isAddress = utils.ethereum.checkAddress(receiverAddress);

  if (!isAddress) {
    throw new Error400({
      type: errorMap[errorMessage.INVALID_ADDRESS],
      msg: errorMessage.INVALID_ADDRESS,
    });
  }

  if (typeof transactionSerialized === 'string') {
    if (transactionSerialized.substring(0, 2) !== '0x') {
      throw new Error400({
        type: errorMap[errorMessage.INVALID_PARAM_FORMAT],
        msg: `${errorMessage.INVALID_PARAM_FORMAT}: transactionSerialized`,
        data: transactionSerialized,
      });
    }
  } else {
    throw new Error400({
      type: errorMap[errorMessage.INVALID_PARAM_FORMAT],
      msg: `${errorMessage.INVALID_PARAM_FORMAT}: transactionSerialized`,
      data: transactionSerialized,
    });
  }

  console.log('hiiii');

  // With Transaction prepared, broadcast to the message queue
  const txData = {
    transaction_callback: urlCallback,
    transaction_serialized: transactionSerialized,
    transaction_status: txStatus.INITIAL,
    transaction_type: transactionType,
    transaction_uuid: uuidv4(),
    transaction_parent_id: uuidv4(),
    transaction_from: senderAddress,
    transaction_to: receiverAddress,
  };

  await transactionModel.insert(txData);
  queueHandler.pushObject(config.rabbitMq.queueTransactions, txData);
  return txData;
};

module.exports = {
  deployProject,
  setBackersExternal,
  milestoneVote,
  cancelVote,
  stakePLG,
  unstakePLG,
  withdrawInterest,
  reinvestPLG,
  postInterest,
  setProjectModerators,
  cancelProject,
  checkMilestones,
  requestRefund,
  withdrawFunds,
  commitModeratorVotes,
  failedFundRecovery,
  setProjectInfo,
  receiveFromPrivate,
  transferBetweenAccounts,
  transferToPrivate,
  getBalance,
  getGains,
  prepareRawTx,
};
