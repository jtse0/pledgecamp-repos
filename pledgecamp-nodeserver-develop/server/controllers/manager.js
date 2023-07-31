// TODO Once abstract contract operations, change this
const { statusMap } = require('../constants');
const { project: contractHandler } = require('../contracts');
const logger = require('../utils/logger');

const getBalance = async (req, res) => {
  const { user_id } = req.body;

  try {
    const balanceDetails = await contractHandler.getBalance(user_id);
    balanceDetails.transaction_status = statusMap[balanceDetails.transaction_status];
    logger.debug({ message: 'Get PLG Balance', meta: balanceDetails });
    res.status(201).send(balanceDetails);
  } catch (error) {
    logger.error(error);
    res.status(error.code).send(error.message);
  }
};

const getGains = async (req, res) => {
  const { user_id } = req.params;

  try {
    const gainsDetails = await contractHandler.getGains(user_id);
    gainsDetails.transaction_status = statusMap[gainsDetails.transaction_status];
    logger.debug({ message: 'Get CS Gains', meta: gainsDetails });
    res.status(201).send(gainsDetails);
  } catch (error) {
    logger.error(error);
    res.status(error.code).send(error.message);
  }
};

const setBackerListExternal = async (req, res) => {
  try {
    const {
      transaction_type,
      beneficiaries,
      amounts,
      funding_complete,
      total_amount,
      contract_address,
      activity_id,
      url_callback,
      contract_version,
    } = req.body;

    const backerResponse = await contractHandler.setBackersExternal(
      transaction_type,
      beneficiaries,
      amounts,
      funding_complete,
      total_amount,
      contract_address,
      activity_id,
      url_callback,
      contract_version,
    );
    backerResponse.transaction_status = statusMap[backerResponse.transaction_status];
    logger.debug({ message: 'Backer List', meta: backerResponse });
    res.status(201).send(backerResponse);
  } catch (error) {
    logger.error(error);
    res.status(error.code).send(error.message);
  }
};

const milestoneVote = async (req, res) => {
  try {
    const { transaction_type, contract_address, user_id, vote, activity_id, url_callback, contract_version } = req.body;

    const voteDetails = await contractHandler.milestoneVote(
      transaction_type,
      contract_address,
      user_id,
      vote,
      activity_id,
      url_callback,
      contract_version,
    );
    voteDetails.transaction_status = statusMap[voteDetails.transaction_status];
    logger.debug({ message: 'Milestone Vote Submitted', meta: voteDetails });
    res.status(201).send(voteDetails);
  } catch (error) {
    logger.error(error);
    res.status(error.code).send(error.message);
  }
};

const cancelVote = async (req, res) => {
  try {
    const { transaction_type, contract_address, user_id, encrypted_vote, activity_id, url_callback, contract_version } =
      req.body;

    const voteDetails = await contractHandler.cancelVote(
      transaction_type,
      contract_address,
      user_id,
      encrypted_vote,
      activity_id,
      url_callback,
      contract_version,
    );
    voteDetails.transaction_status = statusMap[voteDetails.transaction_status];
    logger.debug({ message: 'Moderation Vote Submitted', meta: voteDetails });
    res.status(201).send(voteDetails);
  } catch (error) {
    logger.error(error);
    res.status(error.code).send(error.message);
  }
};

const requestRefund = async (req, res) => {
  try {
    const { transaction_type, contract_address, user_id, activity_id, url_callback, contract_version } = req.body;

    const refundDetails = await contractHandler.requestRefund(
      transaction_type,
      contract_address,
      user_id,
      activity_id,
      url_callback,
      contract_version,
    );
    refundDetails.transaction_status = statusMap[refundDetails.transaction_status];
    logger.debug({ message: 'Requesting refund', meta: refundDetails });
    res.status(201).send(refundDetails);
  } catch (error) {
    logger.error(error);
    res.status(error.code).send(error.message);
  }
};

const withdrawFunds = async (req, res) => {
  try {
    const { transaction_type, contract_address, user_id, activity_id, url_callback, contract_version } = req.body;

    const withdrawDetails = await contractHandler.withdrawFunds(
      transaction_type,
      contract_address,
      user_id,
      activity_id,
      url_callback,
      contract_version,
    );
    withdrawDetails.transaction_status = statusMap[withdrawDetails.transaction_status];
    logger.debug({ message: 'Releasing Milestone Funds', meta: withdrawDetails });
    res.status(201).send(withdrawDetails);
  } catch (error) {
    logger.error(error);
    res.status(error.code).send(error.message);
  }
};

const stakePLG = async (req, res) => {
  try {
    const { transaction_type, user_id, amount, activity_id, url_callback, contract_version } = req.body;

    const stakeDetails = await contractHandler.stakePLG(
      transaction_type,
      user_id,
      amount,
      activity_id,
      url_callback,
      contract_version,
    );
    stakeDetails.transaction_status = statusMap[stakeDetails.transaction_status];
    logger.debug({ message: 'Processing staking of PLG Tokens', meta: stakeDetails });
    res.status(201).send(stakeDetails);
  } catch (error) {
    logger.error(error);
    res.status(error.code).send(error.message);
  }
};

const unstakePLG = async (req, res) => {
  try {
    const { transaction_type, user_id, activity_id, url_callback, contract_version } = req.body;

    const unstakeDetails = await contractHandler.unstakePLG(
      transaction_type,
      user_id,
      activity_id,
      url_callback,
      contract_version,
    );
    unstakeDetails.transaction_status = statusMap[unstakeDetails.transaction_status];
    logger.debug({ message: 'Processing unstake of PLG Tokens', meta: unstakeDetails });
    res.status(201).send(unstakeDetails);
  } catch (error) {
    logger.error(error);
    res.status(error.code).send(error.message);
  }
};

const withdrawInterest = async (req, res) => {
  try {
    const { transaction_type, user_id, activity_id, url_callback, contract_version } = req.body;

    const withdrawalDetails = await contractHandler.withdrawInterest(
      transaction_type,
      user_id,
      activity_id,
      url_callback,
      contract_version,
    );
    withdrawalDetails.transaction_status = statusMap[withdrawalDetails.transaction_status];
    logger.debug({ message: 'Processing unstaked PLG token withdrawal', meta: withdrawalDetails });
    res.status(201).send(withdrawalDetails);
  } catch (error) {
    logger.error(error);
    res.status(error.code).send(error.message);
  }
};

const reinvestPLG = async (req, res) => {
  try {
    const { transaction_type, user_id, activity_id, url_callback, contract_version } = req.body;

    const interestDetails = await contractHandler.reinvestPLG(
      transaction_type,
      user_id,
      activity_id,
      url_callback,
      contract_version,
    );
    interestDetails.transaction_status = statusMap[interestDetails.transaction_status];
    logger.debug({ message: 'Retrieving interest', meta: interestDetails });
    res.status(201).send(interestDetails);
  } catch (error) {
    logger.error(error);
    res.status(error.code).send(error.message);
  }
};

/**
 * Receive external wallet transfers
 */
const receiveFromPrivate = async (req, res) => {
  try {
    const { transaction_type, sender_address, user_id, activity_id, url_callback, contract_version } = req.body;

    const privateReceiptDetails = await contractHandler.receiveFromPrivate(
      transaction_type,
      sender_address,
      user_id,
      activity_id,
      url_callback,
      contract_version,
    );
    privateReceiptDetails.transaction_status = statusMap[privateReceiptDetails.transaction_status];
    logger.debug({ message: 'Receiving external transfer', meta: privateReceiptDetails });
    res.status(201).send(privateReceiptDetails);
  } catch (error) {
    logger.error(error);
    res.status(error.code).send(error.message);
  }
};

/**
 * Internal transfer between accounts
 */
const transferBetweenAccounts = async (req, res) => {
  try {
    const {
      transaction_type,
      sender_account,
      receiver_account,
      transfer_amount,
      activity_id,
      url_callback,
      contract_version,
    } = req.body;

    const internalTransferDetails = await contractHandler.transferBetweenAccounts(
      transaction_type,
      sender_account,
      receiver_account,
      transfer_amount,
      activity_id,
      url_callback,
      contract_version,
    );
    internalTransferDetails.transaction_status = statusMap[internalTransferDetails.transaction_status];
    logger.debug({ message: 'Internal Transfer', meta: internalTransferDetails });
    res.status(201).send(internalTransferDetails);
  } catch (error) {
    logger.error(error);
    res.status(error.code).send(error.message);
  }
};

/**
 * Transfers managed account tokens to a private wallet
 */
const transferToPrivate = async (req, res) => {
  try {
    const {
      transaction_type,
      user_id,
      receiver_address,
      transfer_amount,
      activity_id,
      url_callback,
      contract_version,
    } = req.body;

    const privateTransferDetails = await contractHandler.transferToPrivate(
      transaction_type,
      user_id,
      receiver_address,
      transfer_amount,
      activity_id,
      url_callback,
      contract_version,
    );
    privateTransferDetails.transaction_status = statusMap[privateTransferDetails.transaction_status];
    logger.debug({ message: 'Transfer to external account', meta: privateTransferDetails });
    res.status(201).send(privateTransferDetails);
  } catch (error) {
    logger.error(error);
    res.status(error.code).send(error.message);
  }
};

module.exports = {
  getBalance,
  getGains,
  setBackerListExternal,
  milestoneVote,
  cancelVote,
  requestRefund,
  withdrawFunds,
  stakePLG,
  unstakePLG,
  withdrawInterest,
  reinvestPLG,
  receiveFromPrivate,
  transferBetweenAccounts,
  transferToPrivate,
};
