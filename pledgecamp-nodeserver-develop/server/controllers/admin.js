// TODO Once abstract contract operations, change this
const { statusMap } = require('../constants');
const { project: contractHandler } = require('../contracts');
const logger = require('../utils/logger');

/**
 * setProjectInfo
 */
const setProjectInfo = async (req, res) => {
  try {
    const { transaction_type, contract_address, listing_fee, activity_id, url_callback, contract_version } = req.body;

    const projectInfoDetails = await contractHandler.setProjectInfo(
      transaction_type,
      contract_address,
      listing_fee,
      activity_id,
      url_callback,
      contract_version,
    );
    projectInfoDetails.transaction_status = statusMap[projectInfoDetails.transaction_status];
    logger.debug({ message: 'Set project info', meta: projectInfoDetails });
    res.status(201).send(projectInfoDetails);
  } catch (error) {
    logger.error(error);
    res.status(error.code).send(error.message);
  }
};

module.exports = {
  setProjectInfo,
};
