// TODO Once abstract contract operations, change this
const { statusMap } = require('../constants');
const { project: contractHandler } = require('../contracts');
const logger = require('../utils/logger');

/**
 * SEND RAW TRANSACTION
 */
const processRawTx = async (req, res) => {
  try {
    const { transaction_type, transaction_serialized, sender_address, receiver_address, url_callback } = req.body;

    const rawTxDetails = await contractHandler.prepareRawTx(
      transaction_type,
      transaction_serialized,
      sender_address,
      receiver_address,
      url_callback,
    );
    rawTxDetails.transaction_status = statusMap[rawTxDetails.transaction_status];
    logger.debug({ message: 'Raw Transaction', meta: rawTxDetails });
    res.status(201).send(rawTxDetails);
  } catch (error) {
    logger.error(error);
    res.status(error.code).send(error.message);
  }
};

module.exports = {
  processRawTx,
};
