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
 * Uses 90-100 for range of accounts to test
 */
describe('Test PLGProject - Milestone success', async () => {
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
  let creatorBalance;
  let totalBacked;
  let account3Pledge;
  let projectBalance;

  let testProfile = merge({}, defaultOptions, {
    meta: {
      name: 'TEST - PLGProject Milestone Success',
    },
    PLGProject: {
      deploy: true,
      backers: [91, 92],
      backerAccounts: 'backers',
      backerInsurance: toBN('5e3'),
      milestoneInterval: 10,
      fee: toBN('1e3'),
      milestones: 2,
      releasePercents: [80, 20],
      fundingGoal: toBN('10e3'),
      totalRaised: toBN('11e3'),
    },
    accounts: {
      account1: account(91, '10e3'),
      account2: account(92, '10e3'),
      account3: account(93, '10e3'),
      account4: account(94, '10e3'),
      account5: account(95, '10e3'),
      platform: account(96, '10e3'),
      creator: account(97, '100e3'),
      reserve: account(98, '100e3'),
      funding: account(99, '100e3'),
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

  it('Accept backings from 3 accounts', async () => {
    const { fee, fundingGoal, totalRaised, backerInsurance } = PLGProject;
    const {
      owner, creator, reserve, account1, account3, account4,
    } = accounts;

    // Set current time to the latest block
    const latestBlock = await ethers.provider.getBlock('latest');
    currentTime = latestBlock.timestamp;

    // Keep track of allocation of total funds from funds raised
    const remainingFunds = totalRaised;
    const creatorFunds = totalRaised - backerInsurance - fee;
    let accountStorageBalance = await Token.balanceOf(AccountStorage.address);

    // PASS --- Check that funding goal balance was correctly set
    expectedBalance = totalRaised - fee;
    assertBN(
      fundingGoal,
      expectedBalance,
      'Funding Goal incorrectly set.',
    );

    // PASS --- Prepare allowance for transfer to creator from reserve
    await Token.increaseAllowance(AccountStorage.address, creatorFunds, { signer: reserve.signer });
    const reserveStorageAllowance = await Token.allowance(reserve.address, AccountStorage.address);
    expectedBalance = creatorFunds;
    assertBN(
      reserveStorageAllowance,
      expectedBalance,
      'Reserve -> Storage allowance not set properly.',
    );

    // Transfer initial creator funds to AccountStorage
    await Token.transfer(AccountStorage.address, creatorFunds, { signer: owner.signer });

    // PASS --- Check that transfer to AccountStorage succeeded
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
    totalBacked = totalAmount;

    expectedBalance = backerInsurance;
    assertBN(
      totalBacked,
      expectedBalance,
      'Backer insurance should equal sum of backer pledge array.',
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

    // Set backers
    await AccountManager.setBackers(
      PLGProject.address,
      backerArray,
      backerAmountsArray,
      false,
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

    // FAIL --- Check that totalBacked should equal sum of backer pledges in array
    let total = toBN('0.25e3');
    account3Pledge = total;
    totalBacked += total;

    await Token.approve(PLGProject.address, total, { signer: owner.signer });

    await shouldRevert(
      AccountManager.setBackers(
        PLGProject.address,
        [account3.accountId],
        [total],
        false,
        totalBacked,
      ),
      'Reserve per pledge doesn\'t match total PLG held in reserve',
      'totalAmount must equal total amount of funds contributed by the backers in current batch',
    );

    // Set backer with appropriate parameters
    await AccountManager.setBackers(
      PLGProject.address,
      [account3.accountId],
      [total],
      false,
      total,
    );

    // Check that backers can pledge more than once
    total = toBN('1e3');
    totalBacked += total;

    await Token.approve(PLGProject.address, total, { signer: owner.signer });
    await AccountManager.setBackers(
      PLGProject.address,
      [account1.accountId],
      [total],
      true,
      total,
    );

    // PASS --- Ensure that admin fee is collected only once even after setting
    // backers multiple times & project reserve balance is reflected accurately
    const projectReserve = await PLGProject.reserve();
    projectBalance = await Token.balanceOf(PLGProject.address);
    expectedBalance = projectBalance;
    assertBN(
      projectReserve,
      expectedBalance,
      'Project reserve should equal project balance.',
    );
    expectedBalance = totalBacked;
    assertBN(
      projectReserve,
      expectedBalance,
      'Project reserve balance incorrect.',
    );

    // FAIL --- Check that backers cannot be set if fundingComplete flag set to true in previous run of setBackers
    await Token.approve(PLGProject.address, total, { signer: owner.signer });
    await shouldRevert(
      AccountManager.setBackers(
        PLGProject.address,
        [account4.accountId],
        [total],
        false,
        total,
      ),
      'Invalid project state',
      'Backers cannot be set when project status changed to funding',
    );

    // FAIL --- Negative testing for withdrawal and refund retrieval
    await shouldRevert(
      AccountManager.withdrawFunds(PLGProject.address, creator.accountId),
      'Insufficient withdrawal amount',
      'Cannot withdraw funds until milestone has passed',
    );

    await shouldRevert(
      AccountManager.requestRefund(
        PLGProject.address,
        account3.accountId,
      ),
      'No refunds available',
      'Cannot request refund until project has failed',
    );
  });

  it('First milestone, no vetos', async () => {
    const { creator, account1 } = accounts;

    // Check that a milestone without milestone votes processes successfully
    creatorBalance = await AccountStorage.balanceOf(creator.accountId);

    // FAIL --- Cannot set milestones until milestone time has passed
    await shouldRevert(
      PLGProject.checkMilestones(),
      'Milestone time must have passed',
      'We cannot check the first milestone as not enough time has passed!',
    );

    // PASS --- Benchmark for later milestone check
    let currentMilestone = await PLGProject.currentMilestone();
    expectedBalance = 0;
    assertBN(
      currentMilestone,
      expectedBalance,
      'Not the correct milestone index.',
    );

    // Fast forward to next milestone & check milestones
    currentTime = await increaseTime(10, currentTime);
    await ethers.provider.send('evm_mine');

    await PLGProject.checkMilestones();

    // FAIL --- Ensure that requests are disabled
    await shouldRevert(
      AccountManager.requestRefund(
        PLGProject.address,
        account1.accountId,
      ),
      'No refunds available',
      'Cannot request refund until project has failed',
    );

    // FAIL --- Ensure that funds can only be withdrawn once
    await AccountManager.withdrawFunds(PLGProject.address, creator.accountId);

    await shouldRevert(
      AccountManager.withdrawFunds(PLGProject.address, creator.accountId),
      'Insufficient withdrawal amount',
      'No withdrawals are available',
    );

    // PASS --- Check that withdrawals were successfully processed
    expectedBalance = creatorBalance + ((totalBacked * toBN(PLGProject.releasePercents[0])) / 100n);
    creatorBalance = await AccountStorage.balanceOf(creator.accountId);
    assertBN(
      creatorBalance,
      expectedBalance,
      'Milestone 1 withdrawal to creator inaccurate.',
    );

    // PASS --- Ensure that the milestone moved to the next count
    expectedBalance = currentMilestone + 1n;
    currentMilestone = await PLGProject.currentMilestone();
    assertBN(
      currentMilestone,
      expectedBalance,
      'Did not move to the next milestone.',
    );
  });

  it('Cannot accept milestone vote from random account', async () => {
    const { account4 } = accounts;

    // FAIL --- Ensure that users who are not backers cannot vote on milestone
    vote = true;
    await shouldRevert(
      AccountManager.milestoneVote(
        PLGProject.address,
        account4.accountId,
        true,
      ),
      'No pledge found',
      'Cannot accept milestone vote from random accounts!',
    );
  });

  it('Second milestone, one veto but still successful', async () => {
    const { creator, account3 } = accounts;

    // Have one voter vote to fail the milestone
    vote = true;
    await AccountManager.milestoneVote(
      PLGProject.address,
      account3.accountId,
      vote,
    );

    // PASS --- Check vote value and weighted votes for Account 3
    const account3Vote = await PLGProject.getBackerVote(
      AccountStorage.address,
      account3.accountId,
    );
    const weightedVote = await PLGProject.refundVoteCount();

    expectedValue = vote;
    assert.strictEqual(
      account3Vote.toString(),
      vote.toString(),
      `Vote value incorrect. Expected value of ${expectedValue.toString()}. Got ${account3Vote.toString()}`,
    );
    expectedBalance = account3Pledge;
    assertBN(
      weightedVote,
      expectedBalance,
      'Weighted vote incorrect.',
    );

    // Check that milestone has not failed as a result of that vote
    currentTime = await increaseTime(10, currentTime);
    await ethers.provider.send('evm_mine');
    await PLGProject.checkMilestones();

    // PASS --- Check that the owner can still withdraw funds
    await AccountManager.withdrawFunds(PLGProject.address, creator.accountId);

    expectedBalance = creatorBalance + ((totalBacked * toBN(PLGProject.releasePercents[1])) / 100n);
    creatorBalance = await AccountStorage.balanceOf(creator.accountId);
    assertBN(
      creatorBalance,
      expectedBalance,
      'Milestone 2 withdrawal amount to creator incorrect.',
    );

    // PASS --- Check that project state is set to COMPLETE
    projectState = await PLGProject.state();
    expectedBalance = Complete;
    assertBN(
      projectState,
      expectedBalance,
      'Project should be complete.',
    );

    // FAIL --- Should not be able to check milestones when project is complete
    await shouldRevert(
      PLGProject.checkMilestones(),
      'Invalid project state',
      'Cannot check milestones since project is over!',
    );
  });

  it('External addresses are able to create projects and withdraw funds', async () => {
    const { totalRaised, backerInsurance } = PLGProject;
    const { creator, owner } = accounts;

    // Create a new project
    const projectId = 2;
    testProfile = merge({}, testProfile, {
      PLGProject: {
        projectId,
        milestones: 2,
        milestoneInterval: 10,
        releasePercents: [20, 80],
        deploy: true,
        creatorAddress: creator.address,
        backers: [91, 92],
        backerAccounts: 'backers',
        backerInsurance: 1000n,
        fee: 1000n,
        fundingGoal: 10000n,
        totalRaised: 11000n,
      },
    });

    const newOptions = await setupContract(testProfile, 'PLGProject', deployProject(testProfile));
    const project2 = newOptions.PLGProject;

    // Set approval for transfer to project and set backers
    const { backerArray, backerAmountsArray } = prepareProjectBackerInformation(runtime);

    await Token.approve(project2.address, totalRaised, { signer: owner.signer });
    await AccountManager.setBackers(
      project2.address,
      backerArray,
      backerAmountsArray,
      true,
      backerInsurance,
    );

    projectBalance = await Token.balanceOf(project2.address);
    creatorBalance = await Token.balanceOf(creator.address);

    // Fast forward to the end of the project milestones & process fund withdrawal
    currentTime = await increaseTime(20, currentTime);
    await ethers.provider.send('evm_mine');
    await project2.checkMilestones();
    await project2.checkMilestones();
    await project2.withdrawFunds({ signer: creator.signer });

    // PASS --- Ensure project state is set to COMPLETE
    projectState = await PLGProject.state();
    expectedBalance = Complete;
    assertBN(
      projectState,
      expectedBalance,
      'Project should be complete',
    );

    // PASS --- Test that creator can withdraw all funds at the end after skipping through all milestones
    expectedBalance = projectBalance + creatorBalance;
    creatorBalance = await Token.balanceOf(creator.address);
    assertBN(
      creatorBalance,
      expectedBalance,
      'Project milestones failed to complete.',
    );
  });

  it('Reserve can be increased by owner', async () => {
    const { totalRaised, backerInsurance } = PLGProject;
    const { creator, owner } = accounts;

    // Create a new project
    const projectId = 3;
    testProfile = merge({}, testProfile, {
      PLGProject: {
        projectId,
        milestones: 2,
        milestoneInterval: 10,
        releasePercents: [20, 80],
        deploy: true,
        creatorAddress: creator.address,
        backers: [91, 92],
        backerAccounts: 'backers',
        backerInsurance: 1000n,
        fee: 1000n,
        fundingGoal: 10000n,
        totalRaised: 11000n,
      },
    });

    const newOptions = await setupContract(testProfile, 'PLGProject', deployProject(testProfile));
    const project3 = newOptions.PLGProject;

    // Set approval for transfer to project and set backers
    const { backerArray, backerAmountsArray } = prepareProjectBackerInformation(runtime);

    await Token.approve(project3.address, totalRaised, { signer: owner.signer });
    await AccountManager.setBackers(
      project3.address,
      backerArray,
      backerAmountsArray,
      true,
      backerInsurance,
    );

    let ownerBalance = await Token.balanceOf(owner.address);
    projectBalance = await Token.balanceOf(project3.address);
    let reserveBalance = await project3.reserve();
    assertBN(
      projectBalance,
      reserveBalance,
      'Project balance should equal amount recorded as reserve.',
    );

    const reserveIncrement = 1000;

    await AccountManager.increaseReserve(project3.address, reserveIncrement, { signer: owner.signer });
    reserveBalance = await project3.reserve();
    projectBalance = await Token.balanceOf(project3.address);
    assertBN(
      projectBalance,
      reserveBalance,
      'Project balance should equal amount recorded as reserve.',
    );
    expectedBalance = ownerBalance - toBN(reserveIncrement);
    ownerBalance = await Token.balanceOf(owner.address);
    assertBN(
      ownerBalance,
      expectedBalance,
      'Funds were transferred from the correct wallet.',
    );
  });

  it('Test setting of recovery wait period', async () => {
    const { totalRaised, backerInsurance } = PLGProject;
    const { creator, owner } = accounts;

    // Create a new project
    const projectId = 4;
    testProfile = merge({}, testProfile, {
      PLGProject: {
        projectId,
        milestones: 2,
        milestoneInterval: 10,
        releasePercents: [20, 80],
        deploy: true,
        creatorAddress: creator.address,
        backers: [91, 92],
        backerAccounts: 'backers',
        backerInsurance: 1000n,
        fee: 1000n,
        fundingGoal: 10000n,
        totalRaised: 11000n,
      },
    });

    const newOptions = await setupContract(testProfile, 'PLGProject', deployProject(testProfile));
    const project4 = newOptions.PLGProject;

    // Set approval for transfer to project and set backers
    const { backerArray, backerAmountsArray } = prepareProjectBackerInformation(runtime);

    await Token.approve(project4.address, totalRaised, { signer: owner.signer });
    await AccountManager.setBackers(
      project4.address,
      backerArray,
      backerAmountsArray,
      true,
      backerInsurance,
    );

    let setWaitPeriod = await project4.recoveryWaitPeriod();
    let expectedWaitPeriod = 7776000;
    assertBN(
      setWaitPeriod,
      expectedWaitPeriod,
      'Default recovery wait period was not set properly',
    );

    expectedWaitPeriod = 5000;
    await AccountManager.setRecoveryWaitPeriod(project4.address, expectedWaitPeriod);
    setWaitPeriod = await project4.recoveryWaitPeriod();

    assertBN(
      setWaitPeriod,
      expectedWaitPeriod,
      'Recovery wait period was not set properly',
    );
  });
});
