// TODO Once abstract contract operations, change this
const { project: contractHandler } = require('../contracts');

const { web3 } = contractHandler;

const reduceErrorMessage = require('../utils/reduceErrorMessage');

exports.getMonitor = (req, res) => {
  return res.json({ status: 'ok', message: 'Server is working now !' });
};

// eslint-disable-next-line consistent-return
exports.getMonitorRpc = async (req, res) => {
  try {
    web3.eth
      .getProtocolVersion()
      .then((result) => {
        return res.json({ status: 'ok', data: { protocolVersion: result } });
      })
      .catch((err) => {
        return res.status(400).json({ status: 'error', message: reduceErrorMessage(err) });
      });
  } catch (err) {
    return res.status(400).json({ status: 'error', message: reduceErrorMessage(err) });
  }
};
