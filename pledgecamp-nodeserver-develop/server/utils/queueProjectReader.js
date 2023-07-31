const axios = require('axios');
const merge = require('lodash.merge');
const utils = require('pledgecamp-blockchain-utils');
const tx = require('../models/transaction');
const project = require('../models/project');
const { web3, getAdminWalletAddress } = require('../modules/eth');
const logger = require('../utils/logger');
const config = require('../config');
const { pushObject, queueRead } = require('../utils/queueHandler');
const { txStatus, statusMap } = require('../constants');

let balance;
let eventArray;
const axiosInstance = axios.create(config.axios);
axiosInstance.defaults.headers.common.Authorization = `Bearer ${config.auth.oracleAuth}`;
let { gasOpFlag } = config.ethereum;
const { warningGasPercent, criticalGasLv, blockTime, confirmationsNeeded } = config.ethereum;

const { queueTransactions } = config.rabbitMq;

const warningGasLv = (1 + warningGasPercent / 100) * criticalGasLv;
let adminWalletAddress;

/**
 * TRANSACTION READ CALLBACK
 * @param {string} mqProject Message on the queue
 * @param {string} channel Channel for processing messages on the queue
 * A default callback function which can be used to write the outcome of an ethereum transaction
 */
async function projectQueueCallback(mqProject, channel) {
  logger.debug('[func] Transaction Queue Callback');

  let projectTx;

  // Get balance from the Admin wallet
  adminWalletAddress = await getAdminWalletAddress();
  balance = await utils.ethereum.getBalance(adminWalletAddress, 'eth');

  if (balance <= criticalGasLv) {
    // TODO: Send notification of critical gas level
    gasOpFlag = false;

    logger.error(
      `${adminWalletAddress} balance: ${balance} below the critical threshold: ${criticalGasLv}.`,
    );
  } else if (balance >= warningGasLv) {
    // Reset flag once the gas balance gets to a normal level
    gasOpFlag = true;
  } else if (balance < warningGasLv) {
    // TODO: Send notification of low gas level
    logger.error(
      `Wallet (${adminWalletAddress}) balance low: ${balance} threshold: ${warningGasLv}.`,
    );
  }

  // Convert MQ message in to object
  try {
    projectTx = JSON.parse(mqProject.content.toString());
  } catch (err) {
    logger.error({ message: `Failed parsing RabbitMQ message: ${err}`, meta: mqProject });
    try {
      await axiosInstance.post(projectTx.transaction_callback, projectTx);
      channel.reject(mqProject);
    } catch (error) {
      channel.ack(mqProject);
    }
  }

  logger.info(`Transaction (${projectTx.transaction_uuid}) ${statusMap[projectTx.transaction_status]}`);
  logger.debug({ message: '******************* projectTx: ', meta: projectTx });
  // Assign confirmation wait time based on the number of retries already attempted
  const waitFactor = projectTx.transaction_retry_attempts + 1;
  const confirmationWaitTime = blockTime * waitFactor;
  logger.debug(`Wait Time: ${confirmationWaitTime}`);

  switch (projectTx.transaction_status) {
    // New Transaction to broadcast to network
    case txStatus.INITIAL:
      // Get balance from the Admin wallet
      balance = await utils.ethereum.getBalance(adminWalletAddress, 'eth');

      if (balance <= criticalGasLv) {
        // TODO: Send notification of critical gas level
        gasOpFlag = false;
        logger.error(`Wallet (${adminWalletAddress}) balance critically low`);
      } else if (balance >= warningGasLv) {
        // Reset flag once the gas balance gets to a normal level
        logger.info('Sufficient wallet balance');
        gasOpFlag = true;
      } else if (balance < warningGasLv) {
        // TODO: Send notification of low gas level
        logger.error(`Wallet (${adminWalletAddress}) balance is running low`);
      }

      if (gasOpFlag) {
        return web3.eth
          .sendSignedTransaction(projectTx.transaction_serialized)
          .on('receipt', async (receipt) => {
            logger.debug({ message: '****************** Receipt: ', meta: receipt });
            // Update this to find the version
            if (receipt.logs.length > 0) {
              eventArray = await utils.ethereum.eventHandler(
                receipt.logs,
                projectTx.transaction_type,
                config.localContractsPath,
              );
            } else {
              eventArray = '[]';
            }
            if (receipt.status) {
              // Update transaction record with network details and pending status
              const updateData = {
                transaction_block_number: receipt.blockNumber,
                transaction_from: receipt.from,
                transaction_gas_used: receipt.gasUsed,
                transaction_hash: receipt.transactionHash,
                transaction_status: txStatus.PENDING,
                transaction_type: projectTx.transaction_type,
                transaction_to: receipt.contractAddress,
              };
              await tx.update(projectTx.transaction_uuid, updateData);

              // Remove transaction bytecode to shrink message
              delete projectTx.transaction_serialized;
              const transaction = merge(projectTx, updateData);
              // Push transaction to queue for later confirmation
              pushObject(queueTransactions, transaction);
              channel.ack(mqProject);
            } else {
              // Receipt is with failure status
              logger.error({ message: 'Transaction failed', meta: receipt });
              const updateData = {
                transaction_block_number: receipt.blockNumber,
                transaction_from: receipt.from,
                transaction_gas_used: receipt.gasUsed,
                transaction_hash: receipt.transactionHash,
                transaction_status: txStatus.FAILED_RECEIPT,
                transaction_to: receipt.contractAddress,
              };
              await tx.update(projectTx.transaction_uuid, updateData);

              delete projectTx.transaction_serialized;
              const transaction = merge(projectTx, updateData);
              // Send the postback to callback definition
              if (projectTx.transaction_callback != null) {
                try {
                  await axiosInstance.post(projectTx.transaction_callback, transaction);
                  channel.ack(mqProject);
                } catch (error) {
                  logger.error(`Axios call ${projectTx.transaction_callback} failed with ${error.code}`);
                  channel.ack(mqProject);
                }
              } else {
                // If there is no callback, simply acknowledge channel when completed
                logger.error({ message: 'Manual transaction failed', meta: projectTx });
                channel.ack(mqProject);
              }
            }
          })
          .on('error', async (err) => {
            // Nonce error also falls here
            logger.error('ERROR in transaction: ', err);
            // Handling for gas shortage issues
            if (
              err.message.includes("sender doesn't have enough funds to send tx.") ||
              err.message.includes('out of gas')
            ) {
              gasOpFlag = false;
            } else if (err.message.includes('base fee exceeds gas limit')) {
              gasOpFlag = false;
            }
            const updateData = {
              transaction_status: txStatus.FAILED_INITIAL,
            };
            await tx.update(projectTx.transaction_uuid, updateData);
            delete projectTx.transaction_serialized;
            const transaction = merge(projectTx, updateData);
            try {
              await axiosInstance.post(projectTx.transaction_callback, transaction);
            } catch (error) {
              logger.error(`Axios call ${projectTx.transaction_callback} failed with ${error.code}`);
            }
            channel.ack(mqProject);
          });
      }
      break;
    // When a transaction comes in to this status, it should wait for a number of block
    case txStatus.PENDING:
      logger.debug(`Start wait timer for ${projectTx.transaction_uuid} for ${confirmationWaitTime}s`);
      setTimeout(async () => {
        const receiptFlag = await utils.ethereum.getConfirmationTime(projectTx.transaction_hash);
        if (
          (receiptFlag !== false && process.env.NODE_ENV === 'development') ||
          (receiptFlag !== false && projectTx.transaction_retry_attempts < confirmationsNeeded)
        ) {
          const receipt = await utils.ethereum.getTransactionReceipt(projectTx.transaction_hash);
          logger.debug({ message: 'Pending receipt: ', meta: receipt });
          // Case 1: If receipt is received
          // Convert eventArray to string for local db

          if (receipt.logs.length > 0) {
            eventArray = await utils.ethereum.eventHandler(
              receipt.logs,
              projectTx.transaction_type,
              config.localContractsPath,
            );
          } else {
            eventArray = '[]';
          }

          let updateData = {
            transaction_to: receipt.to,
            transaction_status: txStatus.COMPLETE,
            transaction_contract_address: receipt.contractAddress || receipt.to,
            transaction_events: eventArray.toString(),
          };
          logger.debug(`(${projectTx.transaction_uuid} receipt received) - ${receipt.status}`);

          await tx.update(projectTx.transaction_uuid, updateData);

          if (projectTx.transaction_type.toUpperCase() === 'PROJECT_DEPLOY') {
            logger.info('Updating database for new project address');
            logger.info('Event array received: ', eventArray, typeof eventArray);
            updateData = {
              transaction_contract_address: eventArray.toString(),
            };
            await tx.update(projectTx.transaction_uuid, updateData);

            const projectUpdateData = {
              project_address: eventArray.toString(),
            };
            await project.update(projectTx.transaction_project_id, projectUpdateData);
          }

          // Transfer eventArray back to Oracle
          updateData = {
            transaction_to: receipt.to,
            transaction_status: txStatus.COMPLETE,
            transaction_contract_address: receipt.contractAddress || receipt.to,
            transaction_events: eventArray,
          };
          const transaction = merge(projectTx, updateData);
          // Send the postback to callback definition
          if (projectTx.transaction_callback != null) {
            // If there is a callback, send a notification back to Oracle callback
            try {
              await axiosInstance.post(projectTx.transaction_callback, transaction);
            } catch (error) {
              logger.error(`Axios call ${projectTx.transaction_callback} failed with ${error.code}`);
            }
          } else {
            // If there is no callback, simply acknowledge channel when completed
            logger.error({ message: 'Manual transaction failed', meta: projectTx });
          }
          channel.ack(mqProject);
        } else if (receiptFlag === false && projectTx.transaction_retry_attempts < confirmationsNeeded) {
          logger.debug(`Retries: ${projectTx.transaction_retry_attempts}`);
          // Case 2: Continue retrying transaction until the maximum number of retries hit
          const currentTries = projectTx.transaction_retry_attempts + 1;
          const updateData = {
            transaction_retry_attempts: currentTries,
          };
          logger.debug(`${projectTx.transaction_uuid} moved back into queue`);
          await tx.update(projectTx.transaction_uuid, updateData);
          channel.ack(mqProject);
          pushObject(queueTransactions, merge(projectTx, updateData));
        } else {
          // All error cases
          let updateData;
          if (projectTx.transaction_retry_attempts >= confirmationsNeeded) {
            logger.debug(`Retries: ${projectTx.transaction_retry_attempts}`);
            // Case 3: If retry hits the maximum number of intervals
            // it will fail on timeout and notify the Oracle
            updateData = {
              transaction_status: txStatus.FAILED_TIMEOUT,
            };
          } else {
            // Case 4: For all other cases send a message of the error back to the Oracle
            updateData = {
              transaction_status: txStatus.FAILED_PENDING,
            };
          }
          logger.debug(`${projectTx.transaction_uuid} marked as ${projectTx.transaction_status}`);
          await tx.update(projectTx.transaction_uuid, updateData);
          const transaction = merge(projectTx, updateData);
          // Send the postback to callback definition
          if (projectTx.transaction_callback != null) {
            // For transactions with callback URLs
            try {
              await axiosInstance.post(projectTx.transaction_callback, transaction);
            } catch (error) {
              logger.error(`Axios: ${projectTx.transaction_callback} failed with ${error.code}`);
            }
          } else if (
            projectTx.transaction_retry_attempts >= confirmationsNeeded &&
            projectTx.transaction_callback == null
          ) {
            // If no callback provided and retries exceeded
            logger.error(
              `No callback provided, tx ${projectTx.transaction_uuid} timeout`,
            );
          } else {
            // For all other errors if no callback provided
            logger.error(`No callback provided, tx ${projectTx.transaction_uuid} failed`);
          }
          channel.ack(mqProject);
        }
      }, confirmationWaitTime);
      break;
    default:
      logger.debug(`Reach unhandled project tx status ${projectTx.transaction_status}`);
      channel.ack(mqProject);
      break;
  }
  return true;
}

const transactionsQueue = async () => {
  try {
    await queueRead(queueTransactions, projectQueueCallback);
  } catch (error) {
    logger.error(error.message);
    throw error;
  }
};

module.exports = transactionsQueue;
