/* eslint-disable no-irregular-whitespace */
const assert = require('assert');
const merge = require('lodash/merge');
const { defaultOptions, testingDeploy, deployProject, setupContract } = require('../src/utils/deploy');
const {
  assertBN, account, prepareProjectBackerInformation, toBN, increaseTime, shouldRevert,
} = require('../src/utils/testing');

// eslint-disable-next-line no-unused-vars
const [Inactive, Failed, Funded, MilestoneFailed, ModerationFailed, Complete] = [0, 1, 2, 3, 4, 5];

/**
 * Uses 80 -> 90 for range of accounts to test
 */
describe('Test PLGProject - Milestone veto', async () => {
  let runtime;
  let AccountStorage;
  let AccountManager;
  let Administrator;
  let PLGProject;
  let Token;
  let accounts;
  let currentTime;
  let projectState;
  let expectedValue;
  let expectedBalance;
  let vote;
  let projectId;
  let projectBalance;
  let creatorBalance;
  let account1Bal;
  let account2Bal;

  let testProfile = merge({}, defaultOptions, {
    meta: {
      name: 'TEST - PLGProject Milestone Veto',
    },
    CampShareStorage: {
      unstakePeriod: 90,
    },
    PLGProject: {
      deploy: true,
      backers: [81, 82, 83, 84, 85],
      backerAccounts: 'backers',
      backerInsurance: toBN('5e3'),
      milestones: 5,
      fee: toBN('1e3'),
      fundingGoal: toBN('10e3'),
      totalRaised: toBN('11e3'),
    },
    accounts: {
      account1: account(81, '10e3'),
      account2: account(82, '10e3'),
      account3: account(83, '10e3'),
      account4: account(84, '10e3'),
      account5: account(85, '10e3'),
      platform: account(86, '10e3'),
      creator: account(87, '100e3'),
      reserve: account(88, '100e3'),
      funding: account(89, '100e3'),
    },
  });
  before(async () => {
    runtime = await testingDeploy(testProfile);
    ({
      AccountStorage,
      AccountManager,
      Administrator,
      PLGProject,
      Token,
      accounts,
    } = runtime);
  });

  it('First milestone, one veto, still passes', async () => {
    const { fee, fundingGoal, totalRaised, backerInsurance } = PLGProject;
    const { owner, creator, reserve, funding, account3 } = accounts;

    // Set current time to the latest block
    const latestBlock = await ethers.provider.getBlock('latest');
    currentTime = latestBlock.timestamp;

    // Keep track of allocation of total funds from funds raised
    const remainingFunds = totalRaised;
    const creatorFunds = totalRaised - backerInsurance - fee;
    let accountStorageBalance = await Token.balanceOf(AccountStorage.address);

    expectedBalance = totalRaised - fee;
    assertBN(
      fundingGoal,
      expectedBalance,
      'Funding Goal incorrectly set.',
    );

    // PASS --- Check prepare allowance for transfer to creator from reserve
    await Token.increaseAllowance(AccountStorage.address, creatorFunds, { signer: reserve.signer });
    const reserveStorageAllowance = await Token.allowance(reserve.address, AccountStorage.address);
    assertBN(
      creatorFunds,
      reserveStorageAllowance,
      'Reserve -> Storage allowance not set properly.',
    );

    // PASS --- Transfer initial creator funds to AccountStorage
    await Token.transfer(AccountStorage.address, creatorFunds, { signer: owner.signer });

    expectedBalance = accountStorageBalance + creatorFunds;
    accountStorageBalance = await Token.balanceOf(AccountStorage.address);
    assertBN(
      accountStorageBalance,
      expectedBalance,
      'Transfer to creator failed.',
    );

    // PASS --- Allocate funds to creator within AccountStorage
    creatorBalance = await AccountStorage.balanceOf(creator.accountId);
    await AccountStorage.increaseBalance(creator.accountId, creatorFunds);
    expectedBalance = creatorBalance + creatorFunds;
    creatorBalance = await AccountStorage.balanceOf(creator.accountId);
    assertBN(
      creatorBalance,
      expectedBalance,
      'AccountStorage allocation to creator failed.',
    );

    let adminBalance = await Token.balanceOf(Administrator.address);
    creatorBalance = await AccountStorage.balanceOf(creator.accountId);

    // PASS --- Set the allowance for the transfer of backer insurance funds + listing fees from reserve wallet to project contract
    const { backerArray, backerAmountsArray } = prepareProjectBackerInformation(runtime);
    const totalAmount = backerAmountsArray.reduce((a, b) => a + b, 0n);
    const totalBacked = totalAmount;

    expectedBalance = backerInsurance;
    assertBN(
      totalBacked,
      expectedBalance,
      'Transfer to creator failed.',
    );

    const transferToProject = remainingFunds - creatorFunds;
    await Token.approve(PLGProject.address, transferToProject, { signer: owner.signer });
    const projectAllowance = await Token.allowance(owner.address, PLGProject.address);
    expectedBalance = backerInsurance + fee;
    assertBN(
      projectAllowance,
      expectedBalance,
      'Reserve -> Project allowance not set properly.',
    );
    await AccountManager.setBackers(
      PLGProject.address,
      backerArray,
      backerAmountsArray,
      true,
      backerInsurance,
    );

    // PASS --- Check that Admin contract got funds
    expectedBalance = adminBalance + fee;
    adminBalance = await Token.balanceOf(Administrator.address);
    assertBN(
      adminBalance,
      expectedBalance,
      'Listing fees were not sent to Administrator.',
    );

    // PASS --- Fast forward to first milestone date
    currentTime = await increaseTime(30, currentTime);
    await ethers.provider.send('evm_mine');

    // PASS --- Ensure project is in Funded state
    projectState = await PLGProject.state();
    expectedBalance = Funded;
    assertBN(
      projectState,
      expectedBalance,
      'Project set backers failed.',
    );

    // PASS --- Submit one milestone failure vote & check vote
    vote = true;
    await AccountManager.milestoneVote(PLGProject.address, account3.accountId, vote);
    let backerVote = await PLGProject.getBackerVote(AccountStorage.address, account3.accountId);
    expectedValue = vote;
    assert.strictEqual(
      backerVote.toString(),
      expectedValue.toString(),
      `Backer vote value incorrect. Expected value of ${expectedValue.toString()}. Got ${backerVote.toString()}`,
    );

    // PASS --- Change milestone vote to a passing vote
    vote = false;
    await AccountManager.milestoneVote(PLGProject.address, account3.accountId, vote);
    backerVote = await PLGProject.getBackerVote(AccountStorage.address, account3.accountId);
    expectedValue = vote;
    assert.strictEqual(
      backerVote.toString(),
      expectedValue.toString(),
      `Backer vote resubmission incorrect. Expected value of ${expectedValue.toString()}. Got ${backerVote.toString()}`,
    );

    // PASS --- Resubmit milestone failure vote
    vote = true;
    await AccountManager.milestoneVote(PLGProject.address, account3.accountId, vote);
    backerVote = await PLGProject.getBackerVote(AccountStorage.address, account3.accountId);
    expectedValue = vote;
    assert.strictEqual(
      backerVote.toString(),
      expectedValue.toString(),
      `Backer vote second resubmission incorrect. Expected value of ${expectedValue.toString()}. Got ${backerVote.toString()}`,
    );

    // PASS --- Multiple submissions of the same vote don't do anything
    await AccountManager.milestoneVote(PLGProject.address, account3.accountId, vote);
    await AccountManager.milestoneVote(PLGProject.address, account3.accountId, vote);
    const user3Vote = await PLGProject.getBackerVote(AccountStorage.address, account3.accountId);
    const weightedVote = await PLGProject.refundVoteCount();
    expectedValue = vote;
    assert.strictEqual(
      user3Vote.toString(),
      expectedValue.toString(),
      'Refund vote not registered',
    );
    const account3Pledge = backerAmountsArray[2];
    expectedBalance = account3Pledge;
    assertBN(
      weightedVote,
      expectedBalance,
      'Weighted refund vote incorrect.',
    );

    // Check milestone and confirm that owner can withdraw funds
    currentTime = await increaseTime(30, currentTime);
    await ethers.provider.send('evm_mine');

    // PASS --- Check that owner can withdraw funds
    await PLGProject.checkMilestones();
    creatorBalance = await AccountStorage.balanceOf(creator.accountId);
    projectBalance = await Token.balanceOf(PLGProject.address);
    await AccountManager.withdrawFunds(PLGProject.address, creator.accountId);

    const milestones = 5; // Number of project milestones
    const releasePercent = toBN(100 / milestones);
    expectedBalance = creatorBalance + ((projectBalance * releasePercent) / 100n);
    creatorBalance = await AccountStorage.balanceOf(creator.accountId);
    assertBN(
      creatorBalance,
      expectedBalance,
      'Milestone withdrawal to creator inaccurate.',
    );

    // PASS --- Check current milestone
    const currentMilestone = await PLGProject.currentMilestone();
    expectedBalance = 1n;
    assertBN(
      currentMilestone,
      expectedBalance,
      'Did not move to the next milestone.',
    );

    // PASS --- Check reserve percents
    // releasePercents [80, 20]
    const reservePercent = await PLGProject.reservePercent();
    expectedBalance = 80n;
    assert.strictEqual(
      reservePercent,
      expectedBalance,
      `Incorrect reserve percentage. Expected balance of ${expectedBalance}. Got ${reservePercent}`,
    );
  });

  it('Second milestone, seven vetos, one switch to approval, project fails', async () => {
    const {
      creator, account1, account2, account3, account4, account5,
    } = accounts;

    // PASS --- Submit milestone vote for one account
    vote = false;
    await AccountManager.milestoneVote(PLGProject.address, account3.accountId, vote);
    const user3Vote = await PLGProject.getBackerVote(AccountStorage.address, account3.accountId);
    let weightedVote = await PLGProject.refundVoteCount();
    expectedValue = false;
    assert.strictEqual(
      user3Vote.toString(),
      expectedValue.toString(),
      `Approval vote not registered. Expected value of of ${expectedValue.toString()}. Got ${user3Vote.toString()}`,
    );
    expectedBalance = 0;
    assertBN(
      weightedVote,
      expectedBalance,
      'Weighted vote incorrect.',
    );

    // Submit milestone votes for remaining accounts
    vote = true;
    await AccountManager.milestoneVote(PLGProject.address, account1.accountId, vote);
    await AccountManager.milestoneVote(PLGProject.address, account2.accountId, vote);
    await AccountManager.milestoneVote(PLGProject.address, account4.accountId, vote);
    await AccountManager.milestoneVote(PLGProject.address, account5.accountId, vote);

    // PASS - Check that weighted votes equals sum of account pledges
    expectedBalance = await PLGProject.getBackerPledge(AccountStorage.address, account1.accountId)
      + await PLGProject.getBackerPledge(AccountStorage.address, account2.accountId)
      + await PLGProject.getBackerPledge(AccountStorage.address, account4.accountId)
      + await PLGProject.getBackerPledge(AccountStorage.address, account5.accountId);
    weightedVote = await PLGProject.refundVoteCount();
    assertBN(
      weightedVote,
      expectedBalance,
      'Weighted votes incorrect.',
    );

    // Fast forward to next milestone
    currentTime = await increaseTime(10, currentTime);
    await ethers.provider.send('evm_mine');

    // PASS --- Check that milestone has failed
    await PLGProject.checkMilestones({ signer: account1.signer });
    expectedBalance = MilestoneFailed;
    projectState = await PLGProject.state();
    assertBN(
      projectState,
      expectedBalance,
      'Incorrect project state.',
    );

    // FAIL --- Make sure withdrawals not allowed
    await shouldRevert(
      AccountManager.withdrawFunds(PLGProject.address, creator.accountId),
      'Insufficient withdrawal amount',
      'Project has failed, no withdrawals allowed',
    );

    // PASS --- Verify refund balances
    account1Bal = await AccountStorage.balanceOf(account1.accountId);
    projectBalance = await Token.balanceOf(PLGProject.address);
    const reserve = await PLGProject.reserve();
    const totalPledge = await PLGProject.totalPledges();
    const reservePercent = await PLGProject.reservePercent();
    let pledge = await PLGProject.getBackerPledge(AccountStorage.address, account1.accountId);
    await AccountManager.requestRefund(PLGProject.address, account1.accountId);
    let refund = ((reserve * pledge * reservePercent) / totalPledge) / 100n;
    expectedBalance = account1Bal + refund;
    account1Bal = await AccountStorage.balanceOf(account1.accountId);
    assertBN(
      account1Bal,
      expectedBalance,
      `Incorrect refund (managed) amount for ${account1.accountId}.`,
    );

    account2Bal = await AccountStorage.balanceOf(account2.accountId);
    pledge = await PLGProject.getBackerPledge(AccountStorage.address, account2.accountId);
    refund = ((reserve * pledge * reservePercent) / totalPledge) / 100n;
    expectedBalance = account2Bal + refund;
    await AccountManager.requestRefund(PLGProject.address, account2.accountId);
    account2Bal = await AccountStorage.balanceOf(account2.accountId);
    assertBN(
      account2Bal,
      expectedBalance,
      `Incorrect refund (managed) amount for ${account2.accountId}.`,
    );

    // FAIL --- Should not be able to check milestones after project has failed
    await shouldRevert(
      PLGProject.checkMilestones(),
      'Invalid project state',
      'Project has failed, no more milestones',
    );
  });

  it('Let 90 days go and admin collects the rest', async () => {
    const { owner } = accounts;
    let fundingBal = await Token.balanceOf(owner.address);

    // Fast foward to next milestone
    currentTime = await increaseTime(91, currentTime);
    await ethers.provider.send('evm_mine');

    // PASS - Test that failed funds were successfully recovered in funding wallet
    fundingBal = await Token.balanceOf(owner.address);
    projectBalance = await Token.balanceOf(PLGProject.address);
    await PLGProject.failedFundRecovery();
    expectedBalance = fundingBal + projectBalance;
    fundingBal = await Token.balanceOf(owner.address);
    assertBN(
      fundingBal,
      expectedBalance,
      'Funding wallet did not get remaining PLG.',
    );

    // PASS --- Project should have no tokens left
    projectBalance = await Token.balanceOf(PLGProject.address);
    expectedBalance = 0;
    assertBN(
      projectBalance,
      expectedBalance,
      'Project balance still has Tokens.',
    );
  });

  it('Backer that pledged a majority of project funds can fail project', async () => {
    const { owner, creator, account1, account2 } = accounts;
    // Create and setup a new project
    projectId = 2;

    testProfile = merge({}, testProfile, {
      PLGProject: {
        projectId,
        milestones: 5,
        milestoneInterval: 10,
        deploy: true,
        backers: [account1.accountId, account2.accountId],
        backerAccounts: 'backers',
        backerInsurance: 10000n,
        fee: 1000n,
        fundingGoal: 10000n,
        totalRaised: 11000n,
      },
    });

    const newOptions = await setupContract(testProfile, 'PLGProject', deployProject(testProfile));
    const project2 = newOptions.PLGProject;

    // Prepare approval for transfer from reserve address to project
    const totalRaised = testProfile.PLGProject.fundingGoal;
    const total = totalRaised + testProfile.PLGProject.fee;

    await Token.approve(project2.address, total, { signer: owner.signer });

    // Set backers and transfer of fees into Admin contract and funds into Project contract
    const account1Pledge = toBN('4e3');
    const account2Pledge = toBN('6e3');
    await AccountManager.setBackers(
      project2.address,
      [account1.accountId, account2.accountId],
      [account1Pledge, account2Pledge],
      true,
      totalRaised,
    );

    // Have the biggest backer vote to fail milestone
    vote = true;
    await AccountManager.milestoneVote(
      project2.address,
      account2.accountId,
      vote,
    );

    const account2Vote = await project2.getBackerVote(
      AccountStorage.address,
      account2.accountId,
    );
    const weightedVote = await project2.refundVoteCount();

    // PASS --- Ensure that milestone vote count and weighted vote values are calculated correctly
    expectedValue = vote;
    assert.strictEqual(
      account2Vote.toString(),
      expectedValue.toString(),
      `Vote value incorrect. Expected value of ${expectedValue.toString()}. Got ${account2Vote.toString()}`,
    );
    expectedBalance = account2Pledge;
    assertBN(
      weightedVote,
      expectedBalance,
      'Weighted vote incorrect.',
    );

    // Check that milestone has failed as a result of that vote
    currentTime = await increaseTime(62, currentTime);
    await ethers.provider.send('evm_mine');

    await project2.checkMilestones();

    projectBalance = await Token.balanceOf(project2.address);

    // FAIL --- Check that the owner cannot withdraw funds
    await shouldRevert(
      AccountManager.withdrawFunds(PLGProject.address, creator.accountId),
      'Insufficient withdrawal amount',
      'No withdrawals are available for a failed project',
    );

    // PASS --- Check that balance hasn't changed
    account1Bal = await AccountStorage.balanceOf(account1.accountId);
    account2Bal = await AccountStorage.balanceOf(account2.accountId);
    expectedBalance = account1Bal;
    assertBN(
      account1Bal,
      expectedBalance,
      'Refund for Account 1 not supposed to be processed.',
    );

    // PASS --- Check that refunds are able to be processed
    await AccountManager.requestRefund(
      project2.address,
      account1.accountId,
    );

    expectedBalance = account1Bal + ((account1Pledge * projectBalance) / totalRaised);
    account1Bal = await AccountStorage.balanceOf(account1.accountId);
    assertBN(
      account1Bal,
      expectedBalance,
      'Refund for Account 1 was not processed.',
    );

    // PASS --- Check that refunds are able to be processed
    await AccountManager.requestRefund(
      project2.address,
      account2.accountId,
    );

    expectedBalance = account2Bal + ((account2Pledge * projectBalance) / totalRaised);
    account2Bal = await AccountStorage.balanceOf(account2.accountId);
    assertBN(
      account2Bal,
      expectedBalance,
      'Refund for Account 2 was not processed.',
    );

    const reserveAmount = await project2.reserve();
    expectedBalance = 0;
    assertBN(
      reserveAmount,
      expectedBalance,
      'Project reserve not cleared properly.',
    );

    projectState = await PLGProject.state();
    expectedBalance = MilestoneFailed;
    assertBN(
      projectState,
      expectedBalance,
      'Project should have failed through milestone vote.',
    );
  });

  it('Projects created by external addresses run accordingly', async () => {
    const { creator, owner, account1, account2 } = accounts;

    // Create a new project
    projectId = 3;

    testProfile = merge({}, testProfile, {
      PLGProject: {
        projectId,
        milestones: 2,
        milestoneInterval: 10,
        releasePercents: [20, 80],
        deploy: true,
        creatorAddress: creator.address,
        backers: [account1.accountId, account2.accountId],
        backerAccounts: 'backers',
        backerInsurance: 10000n,
        fee: 1000n,
        fundingGoal: 10000n,
        totalRaised: 11000n,
      },
    });

    const newOptions = await setupContract(testProfile, 'PLGProject', deployProject(testProfile));
    const project3 = newOptions.PLGProject;

    // Prepare approval for transfer from reserve address to project & set backers
    await Token.approve(project3.address, testProfile.PLGProject.totalRaised, { signer: owner.signer });
    const account1Pledge = toBN('6e3');
    const account2Pledge = toBN('4e3');
    await AccountManager.setBackers(
      project3.address,
      [account1.accountId, account2.accountId],
      [account1Pledge, account2Pledge],
      true,
      testProfile.PLGProject.backerInsurance,
    );

    projectBalance = await Token.balanceOf(project3.address);
    account1Bal = await AccountStorage.balanceOf(account1.accountId);

    // Submit milestone vote
    vote = true;
    await AccountManager.milestoneVote(
      project3.address,
      account1.accountId,
      vote,
    );

    // Fast forward to next milestone
    currentTime = await increaseTime(10, currentTime);
    await ethers.provider.send('evm_mine');
    await project3.checkMilestones();

    // PASS --- Check that refunds are able to be processed
    await AccountManager.requestRefund(
      project3.address,
      account1.accountId,
    );

    // FAIL --- Check that increaseReserve cannot be run when project is processing refunds
    const reserveIncrement = 1000;
    await shouldRevert(
      AccountManager.increaseReserve(project3.address, reserveIncrement, { signer: owner.signer }),
      'Cannot modify reserves during refunds',
      'Reserve cannot be modified during the refund process',
    );

    // Check refund balances and project state
    expectedBalance = account1Pledge + account1Bal;
    account1Bal = await AccountStorage.balanceOf(account1.accountId);
    assertBN(
      account1Bal,
      expectedBalance,
      'Refund for Account1 incorrect',
    );

    projectState = await PLGProject.state();
    expectedBalance = MilestoneFailed;
    assertBN(
      projectState,
      expectedBalance,
      'Project should have failed through milestone vote',
    );
  });
});
