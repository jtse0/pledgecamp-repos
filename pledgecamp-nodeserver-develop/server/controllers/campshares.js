// TODO Once abstract contract operations, change this
const { statusMap } = require('../constants');
const { project: contractHandler } = require('../contracts');
const logger = require('../utils/logger');

/**
 * SET MODERATORS
 */
const setProjectModerators = async (req, res) => {
  try {
    const {
      transaction_type,
      contract_address,
      moderators,
      moderation_end_time,
      activity_id,
      url_callback,
      contract_version,
    } = req.body;

    const moderatorResponse = await contractHandler.setProjectModerators(
      transaction_type,
      contract_address,
      moderators,
      moderation_end_time,
      activity_id,
      url_callback,
      contract_version,
    );
    moderatorResponse.transaction_status = statusMap[moderatorResponse.transaction_status];
    logger.debug({ message: 'Setting moderators', meta: moderatorResponse });
    res.status(201).send(moderatorResponse);
  } catch (error) {
    logger.error(error);
    res.status(error.code).send(error.message);
  }
};

/**
 * POST INTEREST
 */
const postInterest = async (req, res) => {
  try {
    const { transaction_type, amount, activity_id, url_callback, contract_version } = req.body;

    const interestResponse = await contractHandler.postInterest(
      transaction_type,
      amount,
      activity_id,
      url_callback,
      contract_version,
    );
    interestResponse.transaction_status = statusMap[interestResponse.transaction_status];
    logger.debug({ message: 'Posting interest', meta: interestResponse });
    res.status(201).send(interestResponse);
  } catch (error) {
    logger.error(error);
    res.status(error.code).send(error.message);
  }
};

module.exports = {
  setProjectModerators,
  postInterest,
};
