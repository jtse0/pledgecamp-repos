// TODO Once abstract contract operations, change this
const { statusMap } = require('../constants');
const { project: contractHandler } = require('../contracts');
const logger = require('../utils/logger');

/**
 * CANCEL PROJECT
 */
const cancelProject = async (req, res) => {
  try {
    const { transaction_type, contract_address, activity_id, url_callback, contract_version } = req.body;

    const cancelDetails = await contractHandler.cancelProject(
      transaction_type,
      contract_address,
      activity_id,
      url_callback,
      contract_version,
    );
    cancelDetails.transaction_status = statusMap[cancelDetails.transaction_status];
    logger.debug({ message: 'Processing cancel request: ', meta: cancelDetails });
    res.status(201).send(cancelDetails);
  } catch (error) {
    logger.error(error);
    res.status(error.code).send(error.message);
  }
};

/**
 * COMMIT MODERATOR VOTES
 */
const commitModeratorVotes = async (req, res) => {
  try {
    const {
      transaction_type,
      votes,
      decryption_keys,
      user_ids,
      contract_address,
      project_id,
      activity_id,
      url_callback,
      contract_version,
    } = req.body;

    const moderationVoteDetails = await contractHandler.commitModeratorVotes(
      transaction_type,
      votes,
      decryption_keys,
      user_ids,
      contract_address,
      project_id,
      activity_id,
      url_callback,
      contract_version,
    );
    moderationVoteDetails.transaction_status = statusMap[moderationVoteDetails.transaction_status];
    logger.debug({ message: 'Moderation Vote Submitted', meta: moderationVoteDetails });
    res.status(201).send(moderationVoteDetails);
  } catch (error) {
    logger.error(error);
    res.status(error.code).send(error.message);
  }
};

module.exports = {
  cancelProject,
  commitModeratorVotes,
};
