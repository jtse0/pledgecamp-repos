/* eslint-disable no-irregular-whitespace */
const assert = require('assert');
const merge = require('lodash/merge');
const { defaultOptions, testingDeploy } = require('../src/utils/deploy');
const {
  assertBN, account, prepareProjectBackerInformation, toBN, increaseTime, shouldRevert,
} = require('../src/utils/testing');

/**
 * Uses 10 -> 20 for range of accounts to test
 */
describe('Test Account Manager', () => {
  let runtime;
  let accounts;
  let AccountManager;
  let AccountStorage;
  let PLGProject;
  let Token;
  let expectedBalance;
  let expectedValue;
  let currentTime;

  const testProfile = merge({}, defaultOptions, {
    meta: {
      name: 'TEST - Account Manager',
    },
    PLGProject: {
      deploy: true,
      backers: [10, 11, 12, 13, 14],
      backerAccounts: 'backers',
      backerInsurance: toBN('1e3'),
      fee: toBN('1e3'),
      fundingGoal: toBN('10e3'),
      totalRaised: toBN('10e3'),
    },
    accounts: {
      creator: account(10, '10e3'),
      funding: account(11, '10e3'),
      reserve: account(12, '10e3'),
      sender: account(13, '1e3'),
      investors: account(14, '1e3'),
    },
  });
  before(async () => {
    runtime = await testingDeploy(testProfile);
    ({ accounts, PLGProject, Token, AccountStorage, AccountManager } = runtime);
  });

  it('Submit pledges for managed accounts', async() => {
    const { fee, fundingGoal, backerInsurance } = PLGProject;
    const { owner, reserve, funding } = accounts;

    // Set current time to the latest block
    const latestBlock = await ethers.provider.getBlock('latest');
    currentTime = latestBlock.timestamp;

    let reserveBalance = await Token.balanceOf(reserve.address);

    const { backerArray, backerAmountsArray } = prepareProjectBackerInformation(runtime);
    const totalAmount = backerAmountsArray.reduce((a, b) => a + b, 0n);
    await Token.approve(PLGProject.address, totalAmount + fee, { signer: owner.signer });
    await AccountManager.setBackers(
      PLGProject.address,
      backerArray,
      backerAmountsArray,
      true,
      backerInsurance,
    );

    let expectedPledge = 0n;

    // PASS --- Check each backer pledge amount
    for(let x = 0; x < backerArray.length; x += 1) {
      const amount = backerAmountsArray[x];

      const balance = await PLGProject.getBackerPledge(
        AccountStorage.address,
        backerArray[x],
      );

      expectedBalance = balance;
      assertBN(
        amount,
        expectedBalance,
        'Backer pledge amount incorrect',
      );
      expectedPledge += amount;
    }

    // PASS --- Ensure that the total amount in the project is correct
    expectedBalance = expectedPledge;
    const totalPledge = await PLGProject.reserve();
    assertBN(
      totalPledge,
      expectedBalance,
      'Reserve should be sum of backer pledges.',
    );

    // PASS --- Check project balance after transaction
    const projectBalance = await Token.balanceOf(PLGProject.address);
    expectedBalance = totalPledge;
    assertBN(
      projectBalance,
      expectedBalance,
      'Project balance incorrect.',
    );

    // PASS --- Check reserve balance after transaction
    reserveBalance -= fundingGoal;
    reserveBalance = await Token.balanceOf(reserve.address);
    expectedBalance = reserveBalance;
    assertBN(
      reserveBalance,
      expectedBalance,
      'Reserve wallet balance incorrect.',
    );
  });

  it('Check that Managed Accounts can Vote on Milestones', async () => {
    // Negative testing for submitting votes
    const userIndex = 1;
    const voter = PLGProject.backers[userIndex];
    const vote = true;

    // FAIL --- Check that votes cannot go to invalid addresses
    const zeroAddress = '0x0000000000000000000000000000000000000000';
    await shouldRevert(
      AccountManager.milestoneVote(
        zeroAddress,
        voter,
        vote,
      ),
      'Zero addr',
      'Votes cannot be sent to invalid addresses',
    );

    // FAIL --- Cannot use another contract address
    let randomAddress = AccountManager.address;
    await shouldRevert(
      AccountManager.milestoneVote(
        randomAddress,
        voter,
        vote,
      ),
      'function selector was not recognized and there\'s no fallback function',
      'Votes cannot be sent to random addresses',
    );

    // FAIL --- Cannot use another random address
    randomAddress = '0xb3b7874f13387d44a3398d298b075b7a3505d8d4';
    await shouldRevert(
      AccountManager.milestoneVote(
        randomAddress,
        voter,
        vote,
      ),
      'function call to a non-contract account',
      'Votes cannot be sent to non-contract addresses',
    );

    // FAIL --- Votes cannot come from random accounts that are not backers
    await shouldRevert(
      AccountManager.milestoneVote(
        PLGProject.address,
        3,
        vote,
      ),
      'No pledge found',
      'Vote must be from a valid backer account',
    );

    // Submit vote and check that vote was registered
    let weightedVote = await PLGProject.refundVoteCount();
    let refundCount = await PLGProject.refundCount();

    const { backerAmountsArray } = prepareProjectBackerInformation(runtime);

    await AccountManager.milestoneVote(PLGProject.address, voter, vote);
    expectedBalance = weightedVote;

    // PASS --- Check weighted votes and vote values for milestone vote
    weightedVote = await PLGProject.refundVoteCount();
    const backerVote = await PLGProject.getBackerVote(
      AccountStorage.address,
      voter,
    );
    expectedBalance = backerAmountsArray[userIndex];
    assertBN(
      weightedVote,
      expectedBalance,
      'Vote - Refund amount failed.',
    );

    expectedBalance = refundCount + 1n;
    refundCount = await PLGProject.refundCount();
    assertBN(
      refundCount,
      expectedBalance,
      'Vote value incorrect.',
    );

    expectedValue = vote;
    assert.strictEqual(
      backerVote.toString(),
      expectedValue.toString(),
      `Vote value incorrect. Expected value of ${expectedValue.toString()}. Got ${backerVote.toString()}`,
    );
  });

  it('Check that Managed Creator can receive funds', async () => {
    const { creator, owner } = accounts;

    // Fast forward to next milestone & check milestone
    await increaseTime(30, currentTime);
    await PLGProject.checkMilestones();

    let accountStorageBalance = await Token.balanceOf(AccountStorage.address);
    let creatorBalance = await AccountStorage.balanceOf(creator.accountId);

    // Ensure that creator can withdraw funds
    const withdrawal = await PLGProject.withdrawal();
    await AccountManager.withdrawFunds(PLGProject.address, creator.accountId, { signer: owner.signer });

    // PASS --- Check that funds were properly accounted for
    expectedBalance = accountStorageBalance + withdrawal;
    accountStorageBalance = await Token.balanceOf(AccountStorage.address);

    assertBN(
      accountStorageBalance,
      expectedBalance,
      'Withdrawal failed.',
    );

    expectedBalance = creatorBalance + withdrawal;
    creatorBalance = await AccountStorage.balanceOf(creator.accountId);

    // PASS - Test account account storage balanceOf function
    assertBN(
      creatorBalance,
      expectedBalance,
      `Account storage balanceOf function incorrect. Expected balance of ${expectedBalance}. Got ${creatorBalance}`,
    );

    // PASS - Test account account manager balanceOf wrapper function
    const wrapperCreatorBalance = await AccountManager.balanceOf(creator.accountId);
    assertBN(
      wrapperCreatorBalance,
      creatorBalance,
      `Account manager balanceOf function incorrect. Expected balance of ${expectedBalance}. Got ${creatorBalance}`,
    );
  });
});
