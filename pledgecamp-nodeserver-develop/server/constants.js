exports.errorMessage = {
  ABI_ERROR: 'An error occurred with the ABI encoding process.',
  SIGNING_ERROR: 'An error occurred with the transaction signing process.',
  INSUFFICIENT_FUNDS: 'There are not enough funds to process the transaction.',
  INVALID_ADDRESS: 'Invalid address format',
  INVALID_PARAM_FORMAT: 'Parameter is not in the right format',
  INVALID_MILESTONE_PAST: 'Milestone cannot be in the past',
  INVALID_MILESTONE_MIN_INTERVAL: 'Milestone Interval not large enough',
  INVALID_MILESTONE_MAX_INTERVAL: 'Milestone Interval too large',
  INVALID_RELEASE_PERCENTAGE: 'Release percentage is not in the right format',
  RAW_TX_ERROR:
    `An error occurred with the Raw Transaction process.
    Check whether the proper parameters (gas, gas limit, nonce) were entered.`,
  RELEASE_PERCENTAGE_NOT_100: 'Release percentages should add up to 100',
};

exports.txStatus = {
  INITIAL: 0,
  PENDING: 1,
  COMPLETE: 2,
  FAILED_TIMEOUT: 3,
  FAILED_GAS: 4,
  FAILED_INITIAL: 5,
  FAILED_RECEIPT: 6,
  FAILED_PENDING: 7,
};

exports.taskPriority = {
  PRIORITY_1: 1,
  PRIORITY_2: 2,
  PRIORITY_3: 3,
  PRIORITY_4: 4,
};

// TODO For any parsing of env variables, please move to config so, that there is only ever single source truth
exports.opsLevel = {
  OPS_LV1: process.env.ETHEREUM_GAS_OPS_LV1,
  OPS_LV2: process.env.ETHEREUM_GAS_OPS_LV2,
  OPS_LV3: process.env.ETHEREUM_GAS_OPS_LV3,
  OPS_LV4: process.env.ETHEREUM_GAS_OPS_LV4,
  OPS_LV5: process.env.ETHEREUM_GAS_OPS_LV5,
};

// TODO Delete when Blockchain-Utils PR#18 merged
exports.baseGas = {
  ETHEREUM_GAS_BASE_DEPLOY: 4000000,
  ETHEREUM_GAS_BASE_FUNCTION: 30115,
};

exports.statusMap = Object.keys(exports.txStatus).reduce((obj, key) => {
  obj[exports.txStatus[key]] = key;
  return obj;
}, {});

exports.errorMap = Object.keys(exports.errorMessage).reduce((obj, key) => {
  obj[exports.errorMessage[key]] = key;
  return obj;
}, {});
