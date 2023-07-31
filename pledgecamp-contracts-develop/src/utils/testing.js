const assert = require('assert');

const { utils, ethUtils, testUtils } = require('@pledgecamp/blockchain-utils');

const account = (id, balance, accountId = null, unmanaged = false) => ({
  bipIndex: id,
  accountId: accountId || id,
  balance: utils.toBN(balance),
  unmanaged,
});

const assertProjectState = async (project, desiredState) => {
  const state = await project.state();
  assert.strictEqual(
    state.toString(),
    desiredState.toString(),
    `Project state ${state}, expected ${desiredState}`,
  );
};

const prepareProjectBackerInformation = ({ accounts, PLGProject }) => {
  const { backerAccounts, backers, backerInsurance } = PLGProject;
  let backerArray;
  if(Number.isInteger(backers)) {
    const backerAccount = accounts[backerAccounts];
    for(let i = 0; i < backers; i += 1) {
      backerArray.push(backerAccount.accountId);
    }
  } else {
    backerArray = backers;
  }
  let backerAmountsArray = [];
  if(typeof backerAccounts === 'string') {
    const averageBackerAmount = backerInsurance / utils.toBN(backers.length);
    for(let i = 0; i < backers.length; i += 1) {
      backerAmountsArray.push(averageBackerAmount);
    }
  } else {
    backerAmountsArray = backerAccounts;
  }
  return { backerArray, backerAmountsArray };
};

function encryptVotes(
  projectId,
  userId,
  decryptKeys,
  votes,
) {
  return ethers.utils.solidityKeccak256(
    [
      'uint256',
      'uint256',
      'bytes32',
      'bool',
    ],
    [
      projectId.toString(),
      userId.toString(),
      decryptKeys,
      votes,
    ],
  );
}

module.exports = {
  toSafeNumber: utils.toSafeNumber,
  toBN: utils.toBN,
  addDays: utils.addDays,
  assertBN: testUtils.assertBN,
  shouldRevert: testUtils.shouldRevert,
  assertBalance: testUtils.assertBalance,
  increaseTime: testUtils.increaseTime,
  toEthTime: ethUtils.toEthTime,
  fromEthTime: ethUtils.fromEthTime,
  addDaysEth: ethUtils.addDaysEth,
  blockDate: ethUtils.blockDate,
  assertProjectState,
  account,
  prepareProjectBackerInformation,
  encryptVotes,
};
