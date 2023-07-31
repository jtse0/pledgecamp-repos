/* eslint-disable no-irregular-whitespace */
const assert = require('assert');
const merge = require('lodash/merge');
const { defaultOptions, testingDeploy, deployProject, setupContract } = require('../src/utils/deploy');
const {
  assertBN,
  account,
  prepareProjectBackerInformation,
  toBN,
  increaseTime,
  shouldRevert,
  encryptVotes,
  assertProjectState,
  toSafeNumber,
  addDaysEth,
} = require('../src/utils/testing');

// eslint-disable-next-line no-unused-vars
const [Inactive, Failed, Funded, MilestoneFailed, ModerationFailed, Complete] = [0, 1, 2, 3, 4, 5];

/**
 * Uses 50 -> 70 for range of accounts to test
 */
describe('Test Moderator', () => {
  let runtime;
  let accounts;
  let AccountManager;
  let AccountStorage;
  let PLGProject;
  let Token;
  let CampShareManager;
  let CampShareStorage;
  let Administrator;
  let Moderator;
  let expectedBalance;
  let expectedValue;
  let accountStorageBalance;
  const managedAccounts = [];
  let managedAmounts = [];
  let vote;
  let stake;
  let encryptedVote;
  let currentTime;
  let moderationEndTime;
  let accountCount = 14;
  const startAccount = 51;
  let projectId = 123;
  const decryptKey = '0xa07401392a302964432a10a884f08df4c301b6bd5980df91b107afd2a8cc1eac';

  let testProfile = merge({}, defaultOptions, {
    meta: {
      name: 'TEST - Moderator',
    },
    PLGProject: {
      deploy: true,
      backers: [51, 52, 53, 54, 55],
      backerAccounts: 'backers',
      backerInsurance: toBN('1e3'),
      fee: toBN('1e3'),
      fundingGoal: toBN('10e3'),
      totalRaised: toBN('10e3'),
    },
    accounts: {
      account1: account(51, '150e3'),
      account2: account(52, '150e3'),
      account3: account(53, '150e3'),
      account4: account(54, '150e3'),
      account5: account(55, '150e3'),
      account6: account(56, '150e3'),
      account7: account(57, '150e3'),
      account8: account(58, '150e3'),
      account9: account(59, '150e3'),
      account10: account(60, '150e3'),
      account11: account(61, '150e3'),
      account12: account(62, '150e3'),
      creator: account(63, '150e3'),
      funding: account(64, '150e3'),
    },
  });
  before(async () => {
    runtime = await testingDeploy(testProfile);
    ({
      accounts, PLGProject, Token, AccountStorage, AccountManager, CampShareManager, CampShareStorage, Administrator, Moderator,
    } = runtime);
  });

  it('Get 12 Contributions, then staking', async () => {
    const { fee, backerInsurance } = PLGProject;
    const { owner, funding } = accounts;

    // Set current time to the latest block
    const latestBlock = await ethers.provider.getBlock('latest');
    currentTime = latestBlock.timestamp;

    // Set the allowance for the transfer from funding wallet to project & set backers
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

    // Have managed accounts stake PLG for CS
    accountStorageBalance = await Token.balanceOf(AccountStorage.address);

    const amount = Number(accountStorageBalance) / accountCount;
    managedAmounts = Array(accountCount).fill(amount);

    stake = toBN(amount / 2);
    for(let accountId = startAccount; accountId < (startAccount + managedAmounts.length); accountId += 1) {
      managedAccounts.push(accountId);
      await AccountManager.stakePLG(
        accountId,
        stake,
      );
    }

    // PASS --- Check that PLG has been transferred out of the AccountStorage contract to the CS Manager contract
    expectedBalance = accountStorageBalance - (toBN(accountCount) * stake);
    accountStorageBalance = await Token.balanceOf(AccountStorage.address);

    assertBN(
      accountStorageBalance,
      expectedBalance,
      'Transfers from accounts failed.',
    );

    const campShareBalance = await Token.balanceOf(CampShareStorage.address);
    expectedBalance = (toBN(accountCount) * stake);

    assertBN(
      campShareBalance,
      expectedBalance,
      'Transfers into CampShareManager failed.',
    );
  });

  it('Test Admin Submitting a Project in need of Moderation', async () => {
    const { account12, funding } = accounts;

    // Unstake all tokens from Account 12
    const unstakeAmount = toBN(stake);
    let account12CS = await CampShareManager.getStake(AccountStorage.address, account12.accountId);
    let account12Balance = await AccountStorage.balanceOf(account12.accountId);
    await AccountManager.unstakeCS(account12.accountId, unstakeAmount);

    // PASS --- Make sure that withdrawal was processed
    expectedBalance = account12CS - unstakeAmount;
    account12CS = await CampShareManager.getStake(AccountStorage.address, account12.accountId);
    assertBN(
      account12CS,
      expectedBalance,
      'Withdrawal of unstaked CS failed.',
    );

    // PASS --- Ensure that the user will not receive interest after withdrawal
    expectedBalance = account12Balance + unstakeAmount;
    account12Balance = await AccountStorage.balanceOf(account12.accountId);
    assertBN(
      account12Balance,
      expectedBalance,
      'Account 12 should not have received interest after withdrawing.',
    );

    // FAIL --- Check that moderators are CS Holders
    moderationEndTime = addDaysEth(currentTime, 1);
    await shouldRevert(CampShareManager.setProjectModerators(
      PLGProject.address,
      managedAccounts,
      moderationEndTime,
    ), 'Moderator has no CS');

    // Remove Account 12 from accountCount
    accountCount -= 1;
    managedAccounts.splice(11, 1);

    await AccountManager.unstakeCS(funding.accountId, unstakeAmount);
    // Remove Funding account from accountCount
    accountCount -= 1;
    managedAccounts.pop();

    // Set new moderation end time
    moderationEndTime = addDaysEth(currentTime, 1);

    // PASS --- Set moderators and check that each is a valid moderator
    await CampShareManager.setProjectModerators(
      PLGProject.address,
      managedAccounts,
      moderationEndTime,
    );
    managedAccounts.forEach(async(acc) => {
      const modSubmitted = await Administrator.checkProjectModerator(
        PLGProject.address,
        acc,
      );
      expectedValue = true;
      assert.strictEqual(
        modSubmitted.toString(),
        expectedValue.toString(),
        `Set Project Moderators failed. Expected value ${expectedValue}, got ${modSubmitted}`,
      );
    });

    // Reset managed accounts
    managedAccounts.splice(11, 0, account12.accountId);
  });

  it('Test Moderator Voting and Interest being given for voting', async () => {
    const { owner, account1, account3, account12, creator } = accounts;

    // FAIL --- Make sure that fully unstaked CS holders cannot vote
    vote = true;
    encryptedVote = encryptVotes(
      projectId,
      account12.accountId,
      decryptKey,
      vote,
    );
    await shouldRevert(
      AccountManager.submitVote(
        account12.accountId,
        PLGProject.address,
        encryptedVote,
      ),
      'Invalid voter',
      'User is no longer a CS holder',
    );

    // FAIL --- Make sure that non-CS holders cannot vote
    const testAccountId = 13;
    encryptedVote = encryptVotes(
      projectId,
      testAccountId,
      decryptKey,
      vote,
    );
    await shouldRevert(
      AccountManager.submitVote(
        testAccountId,
        PLGProject.address,
        encryptedVote,
      ),
      'Invalid voter',
      'This is not a valid CS holder',
    );

    // FAIL --- Ensure that no one but owner or CS Manager can run Moderator contract submitVote()
    encryptedVote = encryptVotes(
      projectId,
      account1.accountId,
      decryptKey,
      vote,
    );
    await shouldRevert(
      Moderator.submitVote(
        PLGProject.address,
        encryptedVote,
        account1.accountId,
        { signer: creator.signer },
      ),
      'Unauthorized access',
      'Function caller is not the owner or CS Manager',
    );

    vote = true;

    // PASS --- Submit 6 True(Cancel) votes and check outstanding moderation
    for(let accountId = startAccount; accountId < (startAccount + 7); accountId += 1) {
      encryptedVote = encryptVotes(
        projectId,
        accountId,
        decryptKey,
        vote,
      );

      await AccountManager.submitVote(
        accountId,
        PLGProject.address,
        encryptedVote,
      );
      const mod = await CampShareStorage.getOutstandingModeration(
        AccountStorage.address,
        accountId,
      );

      expectedBalance = 0;
      assertBN(
        mod,
        expectedBalance,
        'Outstanding mod not updating correctly.',
      );
    }

    // FAIL --- Check that moderators cannot vote more than once
    encryptedVote = encryptVotes(
      projectId,
      account3.accountId,
      decryptKey,
      vote,
    );
    await shouldRevert(
      AccountManager.submitVote(
        account3.accountId,
        PLGProject.address,
        encryptedVote,
      ),
      'Invalid voter',
      'User should not be able to submit more than one moderation vote',
    );

    // PASS --- Submit 4 False (Don't Cancel) votes and check outstanding moderation
    vote = false;
    for(let accountId = startAccount + 7; accountId < (startAccount + 11); accountId += 1) {
      encryptedVote = encryptVotes(
        projectId,
        accountId,
        decryptKey,
        vote,
      );

      await AccountManager.submitVote(
        accountId,
        PLGProject.address,
        encryptedVote,
      );
      const mod = await CampShareStorage.getOutstandingModeration(
        AccountStorage.address,
        accountId,
      );
      expectedBalance = 0;
      assertBN(
        mod,
        expectedBalance,
        'Outstanding mod not updating correctly.',
      );
    }

    // First interest payment
    const interest = toBN('2.4e3');
    await Token.approve(CampShareManager.address, toSafeNumber(interest), { signer: owner.signer });
    await CampShareManager.postInterest(interest, { signer: owner.signer });

    // PASS --- Retrieve interest for all accounts that voted and check CS & PLG interest balances
    for(let accountId = startAccount; accountId < (startAccount + managedAmounts.length - 4); accountId += 1) {
      const accountCS = await CampShareManager.getStake(
        AccountStorage.address,
        accountId,
      );

      await AccountManager.withdrawInterest(accountId);

      const accountPLG = await AccountStorage.balanceOf(
        accountId,
      );

      expectedBalance = toBN('150e3');
      assertBN(
        accountCS,
        expectedBalance,
        'CS balance incorrect',
      );

      const interestCalculation = Math.round(Number(interest) / accountCount);
      expectedBalance = toBN(interestCalculation);
      assertBN(
        accountPLG,
        expectedBalance,
        'Interest receipt failed',
      );
    }
  });

  it('Test Project Cancellation', async () => {
    const { account1, account2, account5, creator } = accounts;

    // FAIL --- An incorrect decryption key will not be accepted when running commitFinalVotes()
    const fakeDecryptKey = '0xb08401392a302964432a10a884f08df4c301b6bd5980df91b107afd2a8cc1eac';
    await shouldRevert(
      Moderator.commitFinalVotes(
        PLGProject.address,
        projectId,
        [51, 52, 53, 54, 55, 56, 57],
        [fakeDecryptKey, decryptKey, decryptKey, decryptKey, decryptKey,
          decryptKey, decryptKey],
        [true, true, true, true, true, true, true],
      ),
      'Insufficient decryptable votes',
    );

    // FAIL --- User IDs of users who are no longer CS holders will not be accepted when running commitFinalVotes()
    await shouldRevert(
      Moderator.commitFinalVotes(
        PLGProject.address,
        projectId,
        [62, 52, 53, 54, 55, 56, 57],
        [decryptKey, decryptKey, decryptKey, decryptKey, decryptKey,
          decryptKey, decryptKey],
        [true, true, true, true, true, true, true],
      ),
      'Insufficient decryptable votes',
    );

    // FAIL --- An incorrect user ID will not be accepted when running commitFinalVotes()
    await shouldRevert(
      Moderator.commitFinalVotes(
        PLGProject.address,
        projectId,
        [51, 52, 53, 54, 55, 56, 73],
        [decryptKey, decryptKey, decryptKey, decryptKey, decryptKey,
          decryptKey, decryptKey],
        [true, true, true, true, true, true, true],
      ),
      'Insufficient decryptable votes',
    );

    // FAIL --- An invalid vote will not be accepted when running commitFinalVotes()
    await shouldRevert(
      Moderator.commitFinalVotes(
        PLGProject.address,
        projectId,
        [51, 52, 53, 54, 55, 56, 57],
        [decryptKey, decryptKey, decryptKey, decryptKey, decryptKey,
          decryptKey, decryptKey],
        [false, true, true, true, true, true, true],
      ),
      'Insufficient decryptable votes',
    );

    // FAIL --- Votes will not be accepted when run in the wrong order
    await shouldRevert(
      Moderator.commitFinalVotes(
        PLGProject.address,
        projectId,
        [52, 53, 54, 55, 56, 57, 58],
        [decryptKey, decryptKey, decryptKey, decryptKey, decryptKey,
          decryptKey, decryptKey],
        [true, true, true, true, true, true, false],
      ),
      'Insufficient decryptable votes',
    );

    // FAIL --- Votes will not be accepted when too many user IDs are inputted
    await shouldRevert(
      Moderator.commitFinalVotes(
        PLGProject.address,
        projectId,
        [51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62],
        [decryptKey, decryptKey, decryptKey, decryptKey, decryptKey,
          decryptKey, decryptKey],
        [true, true, true, true, true, true, true],
      ),
      'User IDs length',
    );

    // FAIL --- Votes will not be accepted when too few user IDs are inputted
    await shouldRevert(
      Moderator.commitFinalVotes(
        PLGProject.address,
        projectId,
        [51, 52, 53, 54, 55, 56],
        [decryptKey, decryptKey, decryptKey, decryptKey, decryptKey, decryptKey, decryptKey],
        [true, true, true, true, true, true, true],
      ),
      'User IDs length',
    );

    // FAIL --- Votes will not be accepted when too many decryption keys are inputted
    await shouldRevert(
      Moderator.commitFinalVotes(
        PLGProject.address,
        projectId,
        [51, 52, 53, 54, 55, 56, 57],
        [decryptKey, decryptKey, decryptKey, decryptKey, decryptKey,
          decryptKey, decryptKey, decryptKey, decryptKey],
        [false, true, true, true, true, true, true],
      ),
      'Decryption keys length',
    );

    // FAIL --- Votes will not be accepted when too few decryption keys are inputted
    await shouldRevert(
      Moderator.commitFinalVotes(
        PLGProject.address,
        projectId,
        [51, 52, 53, 54, 55, 56, 57],
        [decryptKey, decryptKey, decryptKey, decryptKey, decryptKey],
        [true, true, true, true, true, true, true],
      ),
      'Decryption keys length',
    );

    // FAIL --- Votes will not be accepted when too many votes are inputted
    await shouldRevert(
      Moderator.commitFinalVotes(
        PLGProject.address,
        projectId,
        [51, 52, 53, 54, 55, 56, 57],
        [decryptKey, decryptKey, decryptKey, decryptKey, decryptKey, decryptKey, decryptKey],
        [true, true, true, true, true, true, true, false, false, false, false, false],
      ),
      'User IDs length',
    );

    // FAIL --- Votes will not be accepted when too few votes are inputted
    await shouldRevert(
      Moderator.commitFinalVotes(
        PLGProject.address,
        projectId,
        [51, 52, 53, 54, 55, 56, 57],
        [decryptKey, decryptKey, decryptKey, decryptKey, decryptKey],
        [true, true, true, true, true],
      ),
      'Votes length',
    );

    // PASS --- Test that function will pass as long as there are 7 decrypt-able votes
    // Correct votes = 1, 2, 4, 5, 6, 7, 8
    await Moderator.commitFinalVotes(
      PLGProject.address,
      projectId,
      [51, 52, 62, 54, 55, 56, 57, 58, 59, 72],
      [decryptKey, decryptKey, decryptKey, decryptKey, decryptKey,
        decryptKey, decryptKey, decryptKey, decryptKey, decryptKey],
      [true, true, false, true, true, true, true, false, true, false],
    );

    // PASS --- Ensure that state changes from FUNDED to MODERATIONFAILED when a project is cancelled
    await Moderator.cancelProject(PLGProject.address);

    let projectState = await PLGProject.state();
    assertBN(
      projectState,
      ModerationFailed,
      'Project state incorrect.',
    );

    // Can commit votes multiple times without getting an error
    await Moderator.commitFinalVotes(
      PLGProject.address,
      projectId,
      [51, 52, 53, 54, 55, 56, 57],
      [decryptKey, decryptKey, decryptKey, decryptKey, decryptKey, decryptKey, decryptKey],
      [true, true, true, true, true, true, true],
    );

    // PASS --- Confirm that state hasn't changed
    const prevState = projectState;
    projectState = await PLGProject.state();
    assertBN(
      projectState,
      prevState,
      'Project cancellation failed',
    );

    // FAIL --- Confirm that projects cannot be cancelled more than once
    await shouldRevert(
      Moderator.cancelProject(PLGProject.address),
      'Invalid project state',
    );

    // FAIL --- Check that withdrawals are disabled
    await shouldRevert(
      AccountManager.withdrawFunds(PLGProject.address, creator.accountId),
      'Insufficient withdrawal amount',
    );

    // PASS --- Check that refunds can be processed after cancellation
    const projectBalance = await Token.balanceOf(PLGProject.address);
    const { backerArray } = prepareProjectBackerInformation(runtime);
    let account1Balance = await AccountStorage.balanceOf(account1.accountId);
    const backerCount = backerArray.length;
    const refund = toBN(Number(projectBalance) / backerCount);
    expectedBalance = account1Balance + refund;
    await AccountManager.requestRefund(
      PLGProject.address,
      account1.accountId,
    );
    account1Balance = await AccountStorage.balanceOf(account1.accountId);
    assertBN(
      account1Balance,
      expectedBalance,
      'Refund amount incorrect.',
    );

    // Should be able to process remaining refund after project is cancelled
    for(let accountNo = account2.accountId; accountNo <= account5.accountId; accountNo += 1) {
      await AccountManager.requestRefund(
        PLGProject.address,
        accountNo,
      );
    }
  });

  it('Test whether a CS Holder that has unstaked can restake', async () => {
    const { account12 } = accounts;

    let account12CS = await CampShareManager.getStake(AccountStorage.address, account12.accountId);

    // Fast forward to next interest period
    currentTime = await increaseTime(31, currentTime);

    // Have Account12 restake PLG tokens for CS
    await AccountManager.stakePLG(
      account12.accountId,
      stake,
    );

    // PASS --- Confirm that Account 12 CS conversion was successful
    expectedBalance = account12CS + stake;
    account12CS = await CampShareManager.getStake(AccountStorage.address, account12.accountId);
    assertBN(
      account12CS,
      expectedBalance,
      'Stake failed.',
    );
  });

  it('Test voting in Inactive state', async () => {
    // Create a new project and test moderation works without setting backers
    projectId = 2;

    testProfile = merge({}, testProfile, {
      PLGProject: {
        projectId,
        milestones: 5,
        milestoneInterval: 10,
        deploy: true,
        backerInsurance: 5000n,
        fee: 1000n,
        fundingGoal: 9000n,
        totalRaised: 10000n,
      },
    });
    const newOptions = await setupContract(testProfile, 'PLGProject', deployProject(testProfile));
    const project2 = newOptions.PLGProject;

    // Set new moderation end time
    moderationEndTime = addDaysEth(currentTime, 1);

    // Set first list of moderators
    await CampShareManager.setProjectModerators(
      project2.address,
      managedAccounts,
      moderationEndTime,
    );

    // Submit votes for all 12 moderators
    for(let accountId = startAccount; accountId < (startAccount + 12); accountId += 1) {
      // Submit 6 true and 6 false votes
      if(accountId < 57) {
        vote = true;
      } else {
        vote = false;
      }
      encryptedVote = encryptVotes(
        projectId,
        accountId,
        decryptKey,
        vote,
      );
      await AccountManager.submitVote(
        accountId,
        project2.address,
        encryptedVote,
      );
    }

    // Commit all votes from both batches of moderators
    await Moderator.commitFinalVotes(
      project2.address,
      projectId,
      [51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62],
      [decryptKey, decryptKey, decryptKey, decryptKey, decryptKey, decryptKey, decryptKey,
        decryptKey, decryptKey, decryptKey, decryptKey, decryptKey],
      [true, true, true, true, true, true, false, false, false, false, false, false],
    );

    // Ensure that status remains unchanged since there were not more TRUE votes than FALSE votes
    assertProjectState(project2, Inactive);
    await Moderator.cancelProject(project2.address);
    assertProjectState(project2, Inactive);
  });

  it('Test setting moderators multiple times', async () => {
    const { account12 } = accounts;

    const latestBlock = await ethers.provider.getBlock('latest');
    currentTime = latestBlock.timestamp;

    // Create new project
    projectId = 3;
    testProfile = merge({}, testProfile, {
      PLGProject: {
        projectId,
        milestones: 5,
        milestoneInterval: 10,
        deploy: true,
        backerInsurance: 5000n,
        fee: 1000n,
        fundingGoal: 9000n,
        totalRaised: 10000n,
      },
    });
    const newOptions = await setupContract(testProfile, 'PLGProject', deployProject(testProfile));
    const project3 = newOptions.PLGProject;

    // Set first list of moderators and new moderation time
    moderationEndTime = addDaysEth(currentTime, 1);
    let moderatorList = [51, 52, 53, 54, 55, 56];
    await CampShareManager.setProjectModerators(
      project3.address,
      moderatorList,
      moderationEndTime,
    );

    // Submit moderation votes for first batch of moderators
    vote = true;
    for(let accountId = startAccount; accountId < (startAccount + 6); accountId += 1) {
      encryptedVote = encryptVotes(
        projectId,
        accountId,
        decryptKey,
        vote,
      );
      await AccountManager.submitVote(
        accountId,
        project3.address,
        encryptedVote,
      );
    }

    // Fast forward to end of moderation period
    currentTime = await increaseTime(2, currentTime);

    // Set second list of moderators and new moderation time
    moderationEndTime = addDaysEth(currentTime, 1);
    moderatorList = [57, 58, 59, 60, 61, 62];
    await CampShareManager.setProjectModerators(
      project3.address,
      moderatorList,
      moderationEndTime,
    );

    // Ensure that setting moderators more than once doesn't impact outstanding moderation
    let outstandingModeration = await CampShareStorage.getOutstandingModeration(
      AccountStorage.address,
      account12.accountId,
    );
    let projectModeration = await CampShareStorage.getProjectModerationCount(
      project3.address,
      account12.accountId,
    );

    // Fast forward to end of moderation period
    currentTime = await increaseTime(2, currentTime);

    // Set Account 12 as moderator again
    moderationEndTime = addDaysEth(currentTime, 1);
    moderatorList = [62];
    await CampShareManager.setProjectModerators(
      project3.address,
      moderatorList,
      moderationEndTime,
    );

    // PASS --- Check that outstanding moderation did not change for Account 12
    expectedBalance = outstandingModeration;
    outstandingModeration = await CampShareStorage.getOutstandingModeration(
      AccountStorage.address,
      account12.accountId,
    );
    assertBN(
      outstandingModeration,
      expectedBalance,
      'Outstanding moderation not updating correctly.',
    );

    // PASS --- Check that project moderation did not change for Account 12
    expectedBalance = projectModeration;
    projectModeration = await CampShareStorage.getProjectModerationCount(
      project3.address,
      account12.accountId,
    );
    assertBN(
      projectModeration,
      expectedBalance,
      'Outstanding moderation not updating correctly.',
    );

    // Submit moderation votes for remaining moderators
    vote = false;
    for(let accountId = startAccount + 6; accountId < (startAccount + 12); accountId += 1) {
      encryptedVote = encryptVotes(
        projectId,
        accountId,
        decryptKey,
        vote,
      );
      await AccountManager.submitVote(
        accountId,
        project3.address,
        encryptedVote,
      );
    }

    // Commit all votes from both batches of moderators
    await Moderator.commitFinalVotes(
      project3.address,
      projectId,
      [51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62],
      [decryptKey, decryptKey, decryptKey, decryptKey, decryptKey, decryptKey, decryptKey,
        decryptKey, decryptKey, decryptKey, decryptKey, decryptKey],
      [true, true, true, true, true, true, false, false, false, false, false, false],
    );

    // PASS --- Ensure that status remains unchanged since there were not more TRUE votes than FALSE votes
    expectedBalance = Inactive;
    const projectState = await project3.state();
    assertBN(
      projectState,
      expectedBalance,
      'Project status incorrect.',
    );

    await Moderator.cancelProject(project3.address);

    assertBN(
      projectState,
      expectedBalance,
      'Project state should not change.',
    );

  });

  it('Tests outstanding moderation requirements for moderators', async () => {
    // Create new project
    projectId = 4;
    const { owner, account10 } = accounts;

    testProfile = merge({}, testProfile, {
      PLGProject: {
        projectId,
        milestones: 5,
        milestoneInterval: 10,
        deploy: true,
        backerInsurance: 5000n,
        fee: 1000n,
        fundingGoal: 9000n,
        totalRaised: 10000n,
      },
    });
    let newOptions = await setupContract(testProfile, 'PLGProject', deployProject(testProfile));
    const project4 = newOptions.PLGProject;

    // Set all project moderators
    moderationEndTime = addDaysEth(currentTime, 1);
    await CampShareManager.setProjectModerators(
      project4.address,
      managedAccounts,
      moderationEndTime,
    );

    // Submit votes from the first 7 moderators
    vote = true;
    for(let accountId = startAccount; accountId < (startAccount + 7); accountId += 1) {
      encryptedVote = encryptVotes(
        projectId,
        accountId,
        decryptKey,
        vote,
      );
      await AccountManager.submitVote(
        accountId,
        project4.address,
        encryptedVote,
      );
    }

    // Post interest
    const interest = toBN('1e3');
    await Token.approve(CampShareManager.address, toSafeNumber(interest), { signer: owner.signer });
    await CampShareManager.postInterest(interest, { signer: owner.signer });

    // Account 10 can still reinvest interest because outstanding vote requirement still met (1 votes / 4 total votes) < 30 percent
    await AccountManager.reinvestPLG(account10.accountId);

    // Creation of final project
    projectId = 5;

    testProfile = merge({}, testProfile, {
      PLGProject: {
        projectId,
        milestones: 5,
        milestoneInterval: 10,
        deploy: true,
        backerInsurance: 5000n,
        fee: 1000n,
        fundingGoal: 9000n,
        totalRaised: 10000n,
      },
    });
    newOptions = await setupContract(testProfile, 'PLGProject', deployProject(testProfile));
    const project5 = newOptions.PLGProject;

    // Set all project moderators
    moderationEndTime = addDaysEth(currentTime, 1);
    await CampShareManager.setProjectModerators(
      project5.address,
      managedAccounts,
      moderationEndTime,
    );

    // Submit votes from the first 7 moderators
    vote = true;
    for(let accountId = startAccount; accountId < (startAccount + 7); accountId += 1) {
      encryptedVote = encryptVotes(
        projectId,
        accountId,
        decryptKey,
        vote,
      );
      await AccountManager.submitVote(
        accountId,
        project5.address,
        encryptedVote,
      );
    }

    // Post interest
    await Token.approve(CampShareManager.address, toSafeNumber(interest), { signer: owner.signer });
    await CampShareManager.postInterest(interest, { signer: owner.signer });

    // FAIL --- Account 10 should not receive interest since oustanding vote requirement (2 votes / 5 total votes) > 30 percent
    await shouldRevert(
      AccountManager.reinvestPLG(account10.accountId),
      'Votes exceed allowance',
    );
    // Account 10 should be able to withdraw interest and unstake
    await AccountManager.withdrawInterest(account10.accountId);
    await AccountManager.unstakeCS(account10.accountId);

    // Reset and restake for Account 10
    currentTime = await increaseTime(31, currentTime);
    await CampShareStorage.decreaseOutstandingModeration(1, AccountStorage.address, account10.accountId);
    await AccountManager.stakePLG(
      account10.accountId,
      stake,
    );
  });

  it('Tests the voting time requirements for outstanding moderation votes', async () => {
    // Create new project
    projectId = 7;
    const {
      account1, account2, account3, account4, account5, account11,
    } = accounts;

    testProfile = merge({}, testProfile, {
      PLGProject: {
        projectId,
        milestones: 5,
        milestoneInterval: 10,
        deploy: true,
        backerInsurance: 5000n,
        fee: 1000n,
        fundingGoal: 9000n,
        totalRaised: 10000n,
      },
    });
    const newOptions = await setupContract(testProfile, 'PLGProject', deployProject(testProfile));
    const project7 = newOptions.PLGProject;

    let isModerator = false;
    let totalVotes = 0;
    vote = true;

    // Set first list of moderators
    let moderatorList = [51, 52, 53, 54, 55, 56];
    moderationEndTime = addDaysEth(currentTime, 1);
    await CampShareManager.setProjectModerators(
      project7.address,
      moderatorList,
      moderationEndTime,
    );

    // PASS --- Check the moderator statuses for test accounts
    expectedValue = true;
    isModerator = await Administrator.checkProjectModerator(project7.address, account1.accountId);
    assert.strictEqual(
      isModerator.toString(),
      expectedValue.toString(),
      `Account1 should be a moderator. Expected value of ${expectedValue.toString()}. Got ${isModerator.toString()}`,
    );

    expectedValue = true;
    isModerator = await Administrator.checkProjectModerator(project7.address, account2.accountId);
    assert.strictEqual(
      isModerator.toString(),
      expectedValue.toString(),
      `Account2 should be a moderator. Expected value of ${expectedValue.toString()}. Got ${isModerator.toString()}`,
    );

    expectedValue = true;
    isModerator = await Administrator.checkProjectModerator(project7.address, account3.accountId);
    assert.strictEqual(
      isModerator.toString(),
      expectedValue.toString(),
      `Account3 should be a required moderator. Expected value of ${expectedValue.toString()}. Got ${isModerator.toString()}`,
    );

    expectedValue = false;
    isModerator = await Administrator.checkProjectModerator(project7.address, account11.accountId);
    assert.strictEqual(
      isModerator.toString(),
      expectedValue.toString(),
      `Account11 should not be a moderator yet. Expected value of ${expectedValue.toString()}. Got ${isModerator.toString()}`,
    );

    let outstandingModerationAcc2 = await CampShareStorage.getOutstandingModeration(
      AccountStorage.address,
      account2.accountId,
    );
    let projectModerationAcc2 = await CampShareStorage.getProjectModerationCount(
      project7.address,
      account2.accountId,
    );

    // Account 2 will submit an initial vote
    encryptedVote = encryptVotes(
      projectId,
      account2.accountId,
      decryptKey,
      vote,
    );
    await AccountManager.submitVote(
      account2.accountId,
      project7.address,
      encryptedVote,
    );
    totalVotes += 1;

    // Account 3 will submit an initial vote
    encryptedVote = encryptVotes(
      projectId,
      account3.accountId,
      decryptKey,
      vote,
    );
    await AccountManager.submitVote(
      account3.accountId,
      project7.address,
      encryptedVote,
    );
    totalVotes += 1;

    let outstandingModerationAcc1 = await CampShareStorage.getOutstandingModeration(
      AccountStorage.address,
      account1.accountId,
    );
    let projectModerationAcc1 = await CampShareStorage.getProjectModerationCount(
      project7.address,
      account1.accountId,
    );

    // Skip past the end of the moderation period
    currentTime = await increaseTime(2, currentTime);

    // FAIL --- Ensure votes cannot go through
    encryptedVote = encryptVotes(
      projectId,
      account1.accountId,
      decryptKey,
      vote,
    );
    await shouldRevert(
      AccountManager.submitVote(
        account1.accountId,
        project7.address,
        encryptedVote,
      ),
      'Moderation period inactive',
      'Time allotted for moderation voting has passed',
    );

    // Set second batch of project moderators
    moderatorList = [57, 58, 59, 60, 61, 62, 52];
    moderationEndTime = addDaysEth(currentTime, 1);
    await CampShareManager.setProjectModerators(
      project7.address,
      moderatorList,
      moderationEndTime,
    );

    // Check the moderator statuses for test accounts
    expectedValue = true;
    isModerator = await Administrator.checkProjectModerator(project7.address, account1.accountId);
    assert.strictEqual(
      isModerator.toString(),
      expectedValue.toString(),
      `Account1 should be a moderator. Expected value of ${expectedValue.toString()}. Got ${isModerator.toString()}`,
    );

    expectedValue = true;
    isModerator = await Administrator.checkProjectModerator(project7.address, account2.accountId);
    assert.strictEqual(
      isModerator.toString(),
      expectedValue.toString(),
      `Account2 should be a moderator. Expected value of ${expectedValue.toString()}. Got ${isModerator.toString()}`,
    );

    expectedValue = false;
    isModerator = await Administrator.checkProjectModerator(project7.address, account3.accountId);
    assert.strictEqual(
      isModerator.toString(),
      expectedValue.toString(),
      `Account3 should no longer be a required moderator. Expected value of ${expectedValue.toString()}. Got ${isModerator.toString()}`,
    );

    expectedValue = true;
    isModerator = await Administrator.checkProjectModerator(project7.address, account11.accountId);
    assert.strictEqual(
      isModerator.toString(),
      expectedValue.toString(),
      `Account11 should be a moderator. Expected value of ${expectedValue.toString()}. Got ${isModerator.toString()}`,
    );

    // Ensure that Account 1 can submit missed vote after second round of voting has started
    encryptedVote = encryptVotes(
      projectId,
      account1.accountId,
      decryptKey,
      vote,
    );
    await AccountManager.submitVote(
      account1.accountId,
      project7.address,
      encryptedVote,
    );
    totalVotes += 1;

    // Ensure that Account 2 can submit another vote since it was reassigned as a moderator after first vote
    encryptedVote = encryptVotes(
      projectId,
      account2.accountId,
      decryptKey,
      vote,
    );
    await AccountManager.submitVote(
      account2.accountId,
      project7.address,
      encryptedVote,
    );
    totalVotes += 1;

    // FAIL --- Ensure that Account 3 cannot vote again after voting in the first round
    encryptedVote = encryptVotes(
      projectId,
      account11.accountId,
      decryptKey,
      vote,
    );
    await shouldRevert(
      AccountManager.submitVote(
        account3.accountId,
        project7.address,
        encryptedVote,
      ),
      'Invalid voter',
      'Moderator cannot vote twice unless set as moderator twice',
    );

    // Ensure that Account11 can submit a normal vote
    encryptedVote = encryptVotes(
      projectId,
      account11.accountId,
      decryptKey,
      vote,
    );
    await AccountManager.submitVote(
      account11.accountId,
      project7.address,
      encryptedVote,
    );
    totalVotes += 1;

    // PASS --- Check that the outstanding moderation for Account 1 has been updated after vote
    expectedBalance = outstandingModerationAcc1 - 1n;
    outstandingModerationAcc1 = await CampShareStorage.getOutstandingModeration(
      AccountStorage.address,
      account1.accountId,
    );
    assertBN(
      expectedBalance,
      outstandingModerationAcc1,
      'Account 1 Outstanding Moderation did not get updated.',
    );

    // PASS --- Check that the project moderation for Account 1 has been updated after vote
    expectedBalance = projectModerationAcc1 - 1n;
    projectModerationAcc1 = await CampShareStorage.getProjectModerationCount(
      project7.address,
      account1.accountId,
    );
    assertBN(
      expectedBalance,
      projectModerationAcc1,
      'Account 1 Project Moderation did not get updated.',
    );

    // PASS --- Check that the outstanding moderation for Account 2 has been updated after vote
    expectedBalance = outstandingModerationAcc2 - 1n;
    outstandingModerationAcc2 = await CampShareStorage.getOutstandingModeration(
      AccountStorage.address,
      account2.accountId,
    );
    assertBN(
      expectedBalance,
      outstandingModerationAcc2,
      'Account 2 Outstanding Moderation did not get updated.',
    );

    // PASS --- Check that the project moderation for Account 2 has been updated after vote
    expectedBalance = projectModerationAcc2 - 1n;
    projectModerationAcc2 = await CampShareStorage.getProjectModerationCount(
      project7.address,
      account2.accountId,
    );
    assertBN(
      expectedBalance,
      projectModerationAcc2,
      'Account 2 Project Moderation did not get updated.',
    );

    // PASS --- Check that the correct number of votes have been recorded on the blockchain
    expectedBalance = totalVotes;
    const totalVoteCount = await Moderator.checkNumberVotes(project7.address);
    assertBN(
      totalVoteCount,
      expectedBalance,
      'Incorrect number of total moderation votes.',
    );

    // Account 4 will submit a vote
    encryptedVote = encryptVotes(
      projectId,
      account4.accountId,
      decryptKey,
      vote,
    );
    await AccountManager.submitVote(
      account4.accountId,
      project7.address,
      encryptedVote,
    );

    // Account 5 will submit a vote
    encryptedVote = encryptVotes(
      projectId,
      account5.accountId,
      decryptKey,
      vote,
    );
    await AccountManager.submitVote(
      account5.accountId,
      project7.address,
      encryptedVote,
    );

    // Commit all votes from both batches of moderators (includes both votes from Account 2)
    await Moderator.commitFinalVotes(
      project7.address,
      projectId,
      [52, 53, 51, 52, 61, 54, 55],
      [decryptKey, decryptKey, decryptKey, decryptKey, decryptKey, decryptKey, decryptKey],
      [true, true, true, true, true, true, true],
    );

    // PASS --- Ensure that project was cancelled
    await Moderator.cancelProject(project7.address);
    await assertProjectState(project7, ModerationFailed);
  });

  it('Test setting of moderation vote threshold', async () => {
    // Create new project
    projectId = 8;
    const { owner, account10 } = accounts;

    testProfile = merge({}, testProfile, {
      PLGProject: {
        projectId,
        milestones: 5,
        milestoneInterval: 10,
        deploy: true,
        backerInsurance: 5000n,
        fee: 1000n,
        fundingGoal: 9000n,
        totalRaised: 10000n,
      },
    });
    const newOptions = await setupContract(testProfile, 'PLGProject', deployProject(testProfile));
    const project8 = newOptions.PLGProject;

    // Set all project moderators
    const moderatorList = [51, 52, 53, 54, 55];
    moderationEndTime = addDaysEth(currentTime, 1);
    await CampShareManager.setProjectModerators(
      project8.address,
      moderatorList,
      moderationEndTime,
    );

    let setThreshold = await Moderator.voteThreshold();
    expectedBalance = 7;
    assertBN(
      setThreshold,
      expectedBalance,
      'Default vote threshold was not set properly',
    );

    await Moderator.setVoteThreshold(5);
    setThreshold = await Moderator.voteThreshold();
    const expectedThreshold = 5;

    assertBN(
      setThreshold,
      expectedThreshold,
      'Vote threshold was not set properly',
    );

    await shouldRevert(
      Moderator.setVoteThreshold(2),
      'Vote threshold must be greater than 3',
      'Vote threshold is less than 3',
    );

    // Submit votes from the first 5 moderators
    vote = true;
    for(let accountId = startAccount; accountId < (startAccount + 5); accountId += 1) {
      encryptedVote = encryptVotes(
        projectId,
        accountId,
        decryptKey,
        vote,
      );
      await AccountManager.submitVote(
        accountId,
        project8.address,
        encryptedVote,
      );
}
    // Skip past the end of the moderation period
    currentTime = await increaseTime(2, currentTime);

    // Commit all votes from both batches of moderators (includes both votes from Account 2)
    await Moderator.commitFinalVotes(
      project8.address,
      projectId,
      [51, 52, 53, 54, 55],
      [decryptKey, decryptKey, decryptKey, decryptKey, decryptKey],
      [true, true, true, true, true],
    );

    // PASS --- Ensure that project was cancelled
    await Moderator.cancelProject(project8.address);
    await assertProjectState(project8, ModerationFailed);
  });
});
