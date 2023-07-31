const { statusMap } = require('../constants');
const { project: contractHandler } = require('../contracts');
const logger = require('../utils/logger');

/**
 * POST PROJECT
 */
const postProject = async (req, res) => {
  try {
    const {
      transaction_type,
      project_id,
      activity_id,
      milestone_times,
      release_percents,
      url_callback,
      contract_version,
    } = req.body;

    const deploymentResponse = await contractHandler.deployProject(
      transaction_type,
      project_id,
      activity_id,
      milestone_times,
      release_percents,
      url_callback,
      contract_version,
    );
    // TODO implement a serialize function that each response gets parsed through
    deploymentResponse.transaction_status = statusMap[deploymentResponse.transaction_status];
    logger.debug({ message: 'Deploying project', meta: deploymentResponse });
    res.status(201).send(deploymentResponse);
  } catch (error) {
    logger.error(error);
    res.status(error.code).send(error.message);
  }
};

/**
 * CHECK MILESTONES
 */
const checkMilestones = async (req, res) => {
  try {
    const { transaction_type, contract_address, activity_id, url_callback, contract_version } = req.body;

    const milestoneDetails = await contractHandler.checkMilestones(
      transaction_type,
      contract_address,
      activity_id,
      url_callback,
      contract_version,
    );
    milestoneDetails.transaction_status = statusMap[milestoneDetails.transaction_status];
    logger.debug({ message: 'Checking Milestone', meta: milestoneDetails });
    res.status(201).send(milestoneDetails);
  } catch (error) {
    logger.error(error);
    res.status(error.code).send(error.message);
  }
};

/**
 * FAILED FUND RECOVERY
 */
const failedFundRecovery = async (req, res) => {
  try {
    const { transaction_type, contract_address, activity_id, url_callback, contract_version } = req.body;

    const fundRecoveryDetails = await contractHandler.failedFundRecovery(
      transaction_type,
      contract_address,
      activity_id,
      url_callback,
      contract_version,
    );
    fundRecoveryDetails.transaction_status = statusMap[fundRecoveryDetails.transaction_status];
    logger.debug({ message: 'Recovering funds', meta: fundRecoveryDetails });
    res.status(201).send(fundRecoveryDetails);
  } catch (error) {
    logger.error(error);
    res.status(error.code).send(error.message);
  }
};

module.exports = {
  postProject,
  checkMilestones,
  failedFundRecovery,
};
