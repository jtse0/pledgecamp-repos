/* eslint-disable no-irregular-whitespace */
const merge = require('lodash/merge');
const { defaultOptions, testingDeploy } = require('../src/utils/deploy');
const {
  assertBN, shouldRevert, account, toBN, toSafeNumber, increaseTime,
} = require('../src/utils/testing');

/**
 * Uses 40 -> 50 for range of accounts to test
 */
describe('Managed CampShares', async () => {
  let accounts;
  let contribution;
  let AccountStorage;
  let AccountManager;
  let CampShareManager;
  let CampShareStorage;
  let Administrator;
  let Token;
  let runtime;
  let currentTime;
  let account1CS;
  let account1Balance;
  let account1Contribution;
  let account2CS;
  let account2Balance;
  let account2Contribution;
  let account3CS;
  let account3Balance;
  let account3Contribution;
  let account4CS;
  let account4Balance;
  let account4Contribution;
  let expectedBalance;
  let totalContribution;

  // These next few lines set up the blockchain
  const testProfile = merge({}, defaultOptions, {
    meta: {
      name: 'TEST - Managed CampShares',
    },
    accounts: {
      account1: account(40, '10e3'),
      account2: account(41, '10e3'),
      account3: account(42, '10e3'),
      account4: account(43, '10e3'),
    },
  });
  before(async () => {
    runtime = await testingDeploy(testProfile);
    ({
      accounts,
      AccountStorage,
      AccountManager,
      CampShareStorage,
      CampShareManager,
      Administrator,
      Token,
    } = runtime);
  });

  it('Test staking', async () => {
    const { account1 } = accounts;

    // Set current time to the latest block
    const latestBlock = await ethers.provider.getBlock('latest');
    currentTime = latestBlock.timestamp;

    account1Contribution = toBN('2e3');

    contribution = account1Contribution;
    account1Balance = await AccountStorage.balanceOf(account1.accountId);

    // FAIL --- Cannot use amount value of 0
    contribution = toBN('0');
    account1Balance = await AccountStorage.balanceOf(account1.accountId);
    await shouldRevert(
      AccountManager.stakePLG(account1.accountId, toSafeNumber(contribution)),
      'Invalid amount',
      'Inputted amount cannot equal 0',
    );

    // PASS --- Test CS Stake
    contribution = account1Contribution;
    await AccountManager.stakePLG(account1.accountId, toSafeNumber(contribution));
    account1CS = await CampShareManager.getStake(AccountStorage.address, account1.accountId);
    await assertBN(
      account1CS,
      contribution,
      'Balance was not increased as expected.',
    );
    expectedBalance = account1Balance - contribution;
    account1Balance = await AccountStorage.balanceOf(account1.accountId);
    await assertBN(
      account1Balance,
      expectedBalance,
      'Balance was not increased as expected.',
    );

    // Clear out Account1 balance
    await AccountManager.unstakeCS(account1.accountId);
  });

  it('Test unstake mechanism', async () => {
    // Negative testing for unstaking
    const { account3 } = runtime.accounts;

    contribution = toBN('1e3');
    await AccountManager.stakePLG(account3.accountId, toSafeNumber(contribution));
    account3Balance = await AccountStorage.balanceOf(account3.accountId);

    totalContribution = await CampShareStorage.totalCS();

    // PASS --- Unstake CS
    const unstakeAmount = await CampShareManager.getStake(AccountStorage.address, account3.accountId);
    await AccountManager.unstakeCS(account3.accountId);

    const unstakedCS = await CampShareStorage.getUnstakedCS(
      AccountStorage.address,
      account3.accountId,
    );
    expectedBalance = unstakeAmount;
    assertBN(
      unstakedCS,
      expectedBalance,
      'UnstakeCS check failed.',
    );

    const unstakePeriod = await CampShareStorage.unstakePeriod();
    expectedBalance = 30 * 24 * 60 * 60; // Standard 30 days for unstake period
    assertBN(
      unstakePeriod,
      expectedBalance,
      'Please check unstake period settings.',
    );

    // FAIL --- Test multiple unstakes
    await shouldRevert(
      AccountManager.unstakeCS(account3.accountId),
      'No stake',
      'Cannot unstake more than once',
    );

    // FAIL --- Test staking before end of unstake period
    await shouldRevert(
      AccountManager.stakePLG(account3.accountId, toSafeNumber(contribution)),
      'Unstake wait period has not ended',
      'Cannot restake right away',
    );

    // PASS --- Test balances after unstake
    totalContribution -= unstakeAmount;
    const totalCS = await CampShareStorage.totalCS();
    expectedBalance = totalContribution;
    assertBN(
      totalCS,
      expectedBalance,
      'Total CS Contribution is incorrect.',
    );

    expectedBalance = account3Balance + unstakeAmount;
    account3Balance = await AccountStorage.balanceOf(account3.accountId);
    assertBN(
      account3Balance,
      expectedBalance,
      'User balance after unstake is incorrect.',
    );
  });

  it('Should unstake correctly with rewards', async () => {
    const { owner, account1, account2, account3 } = runtime.accounts;

    currentTime = await increaseTime(31, currentTime);

    // Set up stakes and first interest payment
    contribution = toBN('1e3');
    await AccountManager.stakePLG(account1.accountId, toSafeNumber(contribution));
    await AccountManager.stakePLG(account2.accountId, toSafeNumber(contribution));
    await AccountManager.stakePLG(account3.accountId, toSafeNumber(contribution));
    const interest = toBN('1e3');
    await Token.approve(CampShareManager.address, toSafeNumber(interest), { signer: owner.signer });
    await CampShareManager.postInterest(interest, { signer: owner.signer });

    // PASS --- Check that staked CS and gains are allocated correctly
    let totalStaked = await CampShareStorage.totalCS();
    const account1Gains = await AccountManager.unrealizedGains(account1.accountId);
    const account2Gains = await AccountManager.unrealizedGains(account2.accountId);
    let account3Gains = await AccountManager.unrealizedGains(account3.accountId) + toBN(1);
    expectedBalance = totalStaked + account1Gains + account2Gains + account3Gains;
    let totalCS = await Token.balanceOf(CampShareStorage.address);
    assertBN(
      totalCS,
      expectedBalance,
      'User balance after unstake is incorrect.',
    );

    // PASS --- First and second unstaker should get 1/3 of 1000
    account1Balance = await AccountStorage.balanceOf(account1.accountId);
    expectedBalance = account1Balance + (interest * toBN('4')) / toBN('3');
    await AccountManager.unstakeCS(account1.accountId);
    account1Balance = await AccountStorage.balanceOf(account1.accountId);
    assertBN(
      account1Balance,
      expectedBalance,
      'User 1 balance after unstake is incorrect.',
    );

    account2Balance = await AccountStorage.balanceOf(account2.accountId);
    expectedBalance = account2Balance + (interest * toBN('4')) / toBN('3');
    await AccountManager.unstakeCS(account2.accountId);
    account2Balance = await AccountStorage.balanceOf(account2.accountId);
    assertBN(
      account2Balance,
      expectedBalance,
      'User 2 balance after unstake is incorrect.',
    );

    // Second interest payment
    await Token.approve(CampShareManager.address, toSafeNumber(interest), { signer: owner.signer });
    await CampShareManager.postInterest(interest, { signer: owner.signer });

    // PASS --- Check staked PLG and gains after second interest payment
    totalStaked = await CampShareStorage.totalCS();
    account3Gains = await AccountManager.unrealizedGains(account3.accountId);
    expectedBalance = totalStaked + account3Gains;
    totalCS = await Token.balanceOf(CampShareStorage.address);
    assertBN(
      totalCS,
      expectedBalance,
      'Total CS balance after unstakes is incorrect.',
    );

    // PASS --- Last staker should get remainder of pool
    account3Balance = await AccountStorage.balanceOf(account3.accountId);
    account3CS = await CampShareManager.getStake(AccountStorage.address, account3.accountId);
    await AccountManager.unstakeCS(account3.accountId);
    expectedBalance = account3Balance + account3CS + account3Gains;
    account3Balance = await AccountStorage.balanceOf(account3.accountId);
    assertBN(
      account3Balance,
      expectedBalance,
      'Total CS balance after unstake is incorrect.',
    );

    // PASS --- Check that total CS balances are correct
    totalCS = await Token.balanceOf(CampShareStorage.address);
    expectedBalance = 0;
    assertBN(
      totalCS,
      expectedBalance,
      'All of staked PLG in CS Manager contract not cleared after all unstakes.',
    );

    totalStaked = await CampShareStorage.totalCS();
    expectedBalance = 0;
    assertBN(
      totalStaked,
      expectedBalance,
      'Total CS not cleared after all unstakes.',
    );
  });

  it('Handles clearing of unrealized gains', async () => {
    const { owner, account1, account2, account3 } = runtime.accounts;

    currentTime = await increaseTime(31, currentTime);
    contribution = toBN('1e3');

    // First stake
    await AccountManager.stakePLG(account1.accountId, toSafeNumber(contribution));
    await AccountManager.stakePLG(account2.accountId, toSafeNumber(contribution));

    // First interest payment
    const interest = toBN('2e3');
    await Token.approve(CampShareManager.address, toSafeNumber(interest), { signer: owner.signer });
    await CampShareManager.postInterest(interest, { signer: owner.signer });

    // PASS --- Check that unrealized gains are accounted for
    expectedBalance = interest / toBN(2);
    let account2Gains = await AccountManager.unrealizedGains(account2.accountId);
    assertBN(
      account2Gains,
      expectedBalance,
      'Unrealized gains incorrect.',
    );

    // Second stake for account2
    await AccountManager.stakePLG(account2.accountId, toSafeNumber(contribution));

    // PASS --- Check that unrealized gains cleared and automatically reinvested for account2 after second unstaking
    expectedBalance = toBN(0);
    account2Gains = await AccountManager.unrealizedGains(account2.accountId);
    assertBN(
      account2Gains,
      expectedBalance,
      'Unrealized gains incorrect.',
    );

    // PASS --- Check that account1 gets both stake and interest when unstaking
    account1Balance = await AccountStorage.balanceOf(account1.accountId);
    expectedBalance = account1Balance + contribution + (interest / toBN(2));
    await AccountManager.unstakeCS(account1.accountId);
    account1Balance = await AccountStorage.balanceOf(account1.accountId);
    assertBN(
      account1Balance,
      expectedBalance,
      'Unstake proceeds incorrect.',
    );

    // account3 stake
    await AccountManager.stakePLG(account3.accountId, toSafeNumber(contribution));

    // Second interest payment
    const interest2 = toBN('4e3');
    await Token.approve(CampShareManager.address, toSafeNumber(interest2), { signer: owner.signer });
    await CampShareManager.postInterest(interest2, { signer: owner.signer });

    // PASS --- Stake and interest received in unstake
    account2Balance = await AccountStorage.balanceOf(account2.accountId);
    expectedBalance = account2Balance + (contribution * toBN(2)) + (interest / toBN(2)) + ((interest2 * toBN(3)) / toBN(4));
    await AccountManager.unstakeCS(account2.accountId);
    account2Balance = await AccountStorage.balanceOf(account2.accountId);
    assertBN(
      account2Balance,
      expectedBalance,
      'Unstake proceeds incorrect.',
    );

    account3Balance = await AccountStorage.balanceOf(account3.accountId);
    expectedBalance = account3Balance + contribution + (interest2 / toBN(4));
    await AccountManager.unstakeCS(account3.accountId);
    account3Balance = await AccountStorage.balanceOf(account3.accountId);
    assertBN(
      account3Balance,
      expectedBalance,
      'Unstake proceeds incorrect.',
    );
  });

  it('CS transaction error handling', async () => {
    const { owner, account2, account3 } = runtime.accounts;

    currentTime = await increaseTime(31, currentTime);
    let interestCount = await CampShareStorage.getInterestCount();

    // FAIL --- Can't post interest payments if there are no stakers
    const totalStaked = await CampShareStorage.totalCS();
    expectedBalance = toBN(0);
    assertBN(
      totalStaked,
      expectedBalance,
      'Total staked should be 0.',
    );

    account2CS = await CampShareManager.getStake(AccountStorage.address, account2.accountId);
    const interest1 = toBN('1e3');
    await Token.approve(CampShareManager.address, toSafeNumber(interest1), { signer: owner.signer });
    await shouldRevert(CampShareManager.postInterest(interest1, { signer: owner.signer }), 'No stake');

    // FAIL --- Can't reinvest if there is no stake
    await shouldRevert(AccountManager.reinvestPLG(account2.accountId), 'No stake');
    // FAIL --- Can't withdraw if there is no stake
    await shouldRevert(AccountManager.withdrawInterest(account2.accountId), 'No stake');
    // FAIL --- Can't unstake if there is no stake
    await shouldRevert(AccountManager.unstakeCS(account2.accountId), 'No stake');

    // account2 stake
    contribution = toBN('1e3');
    await AccountManager.stakePLG(account2.accountId, toSafeNumber(contribution));

    // Two interest payments without new stakers in between are merged
    let ownerBalance = await Token.balanceOf(owner.address);
    let csBalance = await Token.balanceOf(CampShareStorage.address);

    // PASS --- First interest payment and check transfers between owner and CampShare contract
    await CampShareManager.postInterest(interest1, { signer: owner.signer });
    expectedBalance = ownerBalance - interest1;
    ownerBalance = await Token.balanceOf(owner.address);
    assertBN(
      ownerBalance,
      expectedBalance,
      'Owner balance incorrect.',
    );
    expectedBalance = csBalance + interest1;
    csBalance = await Token.balanceOf(CampShareStorage.address);
    assertBN(
      csBalance,
      expectedBalance,
      'CS balance incorrect.',
    );

    // PASS --- Second interest payment and check transfers between owner and CampShare contract
    const interest2 = toBN('2e3');
    await Token.approve(CampShareManager.address, toSafeNumber(interest2), { signer: owner.signer });
    await CampShareManager.postInterest(interest2, { signer: owner.signer });
    expectedBalance = ownerBalance - interest2;
    ownerBalance = await Token.balanceOf(owner.address);
    assertBN(
      ownerBalance,
      expectedBalance,
      'Owner balance incorrect.',
    );
    expectedBalance = csBalance + interest2;
    csBalance = await Token.balanceOf(CampShareStorage.address);
    assertBN(
      csBalance,
      expectedBalance,
      'CS balance incorrect.',
    );

    // PASS --- Check that interest count hasn't changed
    expectedBalance = interestCount + toBN(1);
    interestCount = await CampShareStorage.getInterestCount();
    assertBN(
      interestCount,
      expectedBalance,
      'Interest count incorrect.',
    );

    // New stake by account3
    await AccountManager.stakePLG(account3.accountId, toSafeNumber(contribution));

    // Third interest payment
    const interest3 = toBN('3e3');
    await Token.approve(CampShareManager.address, toSafeNumber(interest3), { signer: owner.signer });
    await CampShareManager.postInterest(interest3, { signer: owner.signer });

    // PASS --- Interest count increases when the stake pool has changed
    expectedBalance = interestCount + toBN(1);
    interestCount = await CampShareStorage.getInterestCount();
    assertBN(
      interestCount,
      expectedBalance,
      'Interest count incorrect.',
    );
    account2Balance = await AccountStorage.balanceOf(account2.accountId);
    account3Balance = await AccountStorage.balanceOf(account3.accountId);

    // PASS --- account2 gets remainder of second interest payment plus first 2 interest payments
    expectedBalance = account2Balance + contribution + interest1 + interest2 + (interest3 / toBN(2));
    await AccountManager.unstakeCS(account2.accountId);
    account2Balance = await AccountStorage.balanceOf(account2.accountId);
    assertBN(
      account2Balance,
      expectedBalance,
      'Unstake proceeds are incorrect.',
    );

    // PASS --- account3 gets half of second interest payment
    expectedBalance = account3Balance + contribution + (interest3 / toBN(2));
    await AccountManager.unstakeCS(account3.accountId);
    account3Balance = await AccountStorage.balanceOf(account3.accountId);
    assertBN(
      account3Balance,
      expectedBalance,
      'Unstake proceeds are incorrect.',
    );
  });

  it('Can reinvest and withdraw interest payments', async () => {
    const { owner, account1, account2, account3 } = runtime.accounts;

    currentTime = await increaseTime(31, currentTime);
    contribution = toBN('1e3');

    // Prepare initial stakes
    await AccountManager.stakePLG(account1.accountId, toSafeNumber(contribution));
    await AccountManager.stakePLG(account2.accountId, toSafeNumber(contribution));
    let account1Gains = await AccountManager.unrealizedGains(account1.accountId);
    let account2Gains = await AccountManager.unrealizedGains(account2.accountId);

    // First interest payment
    const interest1 = toBN('2e3');
    await Token.approve(CampShareManager.address, toSafeNumber(interest1), { signer: owner.signer });
    await CampShareManager.postInterest(interest1, { signer: owner.signer });

    // PASS --- account1 withdraws and gains are properly accounted for
    expectedBalance = account1Gains + (interest1 / toBN('2'));
    account1Gains = await AccountManager.unrealizedGains(account1.accountId);
    assertBN(
      account1Gains,
      expectedBalance,
      'Unrealized gains are incorrect.',
    );

    account1Balance = await AccountStorage.balanceOf(account1.accountId);
    expectedBalance = account1Balance + account1Gains;

    await AccountManager.withdrawInterest(account1.accountId);

    account1Balance = await AccountStorage.balanceOf(account1.accountId);
    assertBN(
      account1Balance,
      expectedBalance,
      'Withdrawal was incorrect.',
    );

    expectedBalance = toBN(0);
    account1Gains = await AccountManager.unrealizedGains(account1.accountId);
    assertBN(
      account1Gains,
      expectedBalance,
      'Unrealized gains after withdrawal are incorrect.',
    );

    // PASS --- account2 reinvests interest proceeds and gains are properly accounted for
    expectedBalance = account2Gains + (interest1 / toBN('2'));
    account2Gains = await AccountManager.unrealizedGains(account2.accountId);
    assertBN(
      account2Gains,
      expectedBalance,
      'Unrealized gains are incorrect.',
    );

    account2CS = await CampShareManager.getStake(AccountStorage.address, account2.accountId);
    account2Balance = await AccountStorage.balanceOf(account2.accountId);
    expectedBalance = account2Balance;

    await AccountManager.reinvestPLG(account2.accountId);

    account2Balance = await AccountStorage.balanceOf(account2.accountId);
    assertBN(
      account2Balance,
      expectedBalance,
      'Balance after reinvestment was incorrect.',
    );

    expectedBalance = account2CS + account2Gains;
    account2CS = await CampShareManager.getStake(AccountStorage.address, account2.accountId);
    assertBN(
      account2CS,
      expectedBalance,
      'CS balance after reinvestment was incorrect.',
    );

    expectedBalance = toBN(0);
    account2Gains = await AccountManager.unrealizedGains(account2.accountId);
    assertBN(
      account2Gains,
      expectedBalance,
      'Unrealized gains after withdrawal are incorrect.',
    );

    // Another user stakes
    await AccountManager.stakePLG(account3.accountId, toSafeNumber(contribution));

    // Second interest payment
    const interest2 = toBN('4e3');
    await Token.approve(CampShareManager.address, toSafeNumber(interest2), { signer: owner.signer });
    await CampShareManager.postInterest(interest2, { signer: owner.signer });

    // PASS --- Balances transferred at unstake are correct
    expectedBalance = account1Balance + contribution + interest2 / toBN('4');
    await AccountManager.unstakeCS(account1.accountId);
    account1Balance = await AccountStorage.balanceOf(account1.accountId);
    assertBN(
      account1Balance,
      expectedBalance,
      'Unstake proceeds are incorrect.',
    );

    account3Balance = await AccountStorage.balanceOf(account3.accountId);
    expectedBalance = account3Balance + contribution + interest2 / toBN('4');
    await AccountManager.unstakeCS(account3.accountId);
    account3Balance = await AccountStorage.balanceOf(account3.accountId);
    assertBN(
      account3Balance,
      expectedBalance,
      'Unstake proceeds are incorrect.',
    );

    expectedBalance = account2Balance + (contribution * toBN('2')) + (interest2 * toBN('2')) / toBN('4');
    await AccountManager.unstakeCS(account2.accountId);
    account2Balance = await AccountStorage.balanceOf(account2.accountId);
    assertBN(
      account2Balance,
      expectedBalance,
      'Unstake proceeds are incorrect.',
    );
  });

  it('Check behavior if no reinvestments occur', async () => {
    const { owner, account1, account2, account3 } = runtime.accounts;

    currentTime = await increaseTime(31, currentTime);
    contribution = toBN('1e3');

    // Setup initial stakes
    await AccountManager.stakePLG(account1.accountId, toSafeNumber(contribution));
    await AccountManager.stakePLG(account2.accountId, toSafeNumber(contribution));
    let account1Gains = await AccountManager.unrealizedGains(account1.accountId);
    let account2Gains = await AccountManager.unrealizedGains(account2.accountId);

    // First interest payment
    const interest1 = toBN('2e3');
    await Token.approve(CampShareManager.address, toSafeNumber(interest1), { signer: owner.signer });
    await CampShareManager.postInterest(interest1, { signer: owner.signer });

    // PASS --- account1 withdraws and gains are properly accounted for
    expectedBalance = account1Gains + (interest1 / toBN('2'));
    account1Gains = await AccountManager.unrealizedGains(account1.accountId);
    assertBN(
      account1Gains,
      expectedBalance,
      'Unrealized gains are incorrect.',
    );

    account1Balance = await AccountStorage.balanceOf(account1.accountId);
    expectedBalance = account1Balance + account1Gains;

    await AccountManager.withdrawInterest(account1.accountId);

    account1Balance = await AccountStorage.balanceOf(account1.accountId);
    assertBN(
      account1Balance,
      expectedBalance,
      'Withdrawal was incorrect.',
    );

    expectedBalance = toBN(0);
    account1Gains = await AccountManager.unrealizedGains(account1.accountId);
    assertBN(
      account1Gains,
      expectedBalance,
      'Unrealized gains after withdrawal are incorrect.',
    );

    // PASS --- account2 does nothing with gains and gains accrue
    expectedBalance = account2Gains + (interest1 / toBN('2'));
    account2Gains = await AccountManager.unrealizedGains(account2.accountId);
    assertBN(
      account2Gains,
      expectedBalance,
      'Unrealized gains are incorrect.',
    );

    account2CS = await CampShareManager.getStake(AccountStorage.address, account2.accountId);
    account2Balance = await AccountStorage.balanceOf(account2.accountId);
    expectedBalance = account2Balance;

    account2Balance = await AccountStorage.balanceOf(account2.accountId);
    assertBN(
      account2Balance,
      expectedBalance,
      'PLG Balance was incorrect.',
    );

    // Another user stakes
    await AccountManager.stakePLG(account3.accountId, toSafeNumber(contribution));

    // Second interest payment
    const interest2 = toBN('3e3');
    await Token.approve(CampShareManager.address, toSafeNumber(interest2), { signer: owner.signer });
    await CampShareManager.postInterest(interest2, { signer: owner.signer });

    // PASS --- Ensure stake hasn't changed
    expectedBalance = account2CS;
    account2CS = await CampShareManager.getStake(AccountStorage.address, account2.accountId);
    assertBN(
      account2CS,
      expectedBalance,
      'CS balance was incorrect.',
    );

    // PASS --- Gains accrue properly for account2
    expectedBalance = account2Gains + interest2 / toBN('3');
    account2Gains = await AccountManager.unrealizedGains(account2.accountId);
    assertBN(
      account2Gains,
      expectedBalance,
      'Unrealized gains after withdrawal are incorrect.',
    );

    // PASS --- Unstake proceeds for account1 and account3 are calculated the same way
    expectedBalance = account1Balance + contribution + interest2 / toBN('3');
    await AccountManager.unstakeCS(account1.accountId);
    account1Balance = await AccountStorage.balanceOf(account1.accountId);
    assertBN(
      account1Balance,
      expectedBalance,
      'Unstake proceeds are incorrect.',
    );

    account3Balance = await AccountStorage.balanceOf(account3.accountId);
    expectedBalance = account3Balance + contribution + interest2 / toBN('3');
    await AccountManager.unstakeCS(account3.accountId);
    account3Balance = await AccountStorage.balanceOf(account3.accountId);
    assertBN(
      account3Balance,
      expectedBalance,
      'Unstake proceeds are incorrect.',
    );

    // PASS --- Unstake proceeds for account2 should include the contribution and accrued unrealized gains
    expectedBalance = account2Balance + (contribution) + (interest1 / toBN('2')) + (interest2 / toBN('3'));
    await AccountManager.unstakeCS(account2.accountId);
    account2Balance = await AccountStorage.balanceOf(account2.accountId);
    assertBN(
      account2Balance,
      expectedBalance,
      'Unstake proceeds are incorrect.',
    );
  });

  it('Works with complex staking & reward situations', async () => {
    const { owner, account1, account2, account3 } = runtime.accounts;

    currentTime = await increaseTime(31, currentTime);

    // Set up of initial stakes
    account1Balance = await AccountStorage.balanceOf(account1.accountId);
    account3Balance = await AccountStorage.balanceOf(account3.accountId);
    const contribution1 = toBN('1e3');
    await AccountManager.stakePLG(account1.accountId, toSafeNumber(contribution1));
    const contribution2 = toBN('2e3');
    await AccountManager.stakePLG(account2.accountId, toSafeNumber(contribution2));

    // First interest payment
    const interest1 = toBN('3e3');
    await Token.approve(CampShareManager.address, toSafeNumber(interest1), { signer: owner.signer });
    await CampShareManager.postInterest(interest1, { signer: owner.signer });

    // First stake by account3
    const contribution3 = toBN('4e3');
    await AccountManager.stakePLG(account3.accountId, toSafeNumber(contribution3));
    account3Balance = await AccountStorage.balanceOf(account3.accountId);

    // PASS --- account3 unstake should receive original stake with no interest
    expectedBalance = account3Balance + contribution3;
    await AccountManager.unstakeCS(account3.accountId);
    account3Balance = await AccountStorage.balanceOf(account3.accountId);
    assertBN(
      account3Balance,
      expectedBalance,
      'Unstake proceeds are incorrect.',
    );

    // account3 stakes twice
    currentTime = await increaseTime(31, currentTime);

    await AccountManager.stakePLG(account3.accountId, toSafeNumber(contribution3));
    const contribution4 = toBN('4e3');
    await AccountManager.stakePLG(account3.accountId, toSafeNumber(contribution4));

    // PASS --- account3 will receive first and second stake with no interest when unstaking
    expectedBalance = account3Balance;
    await AccountManager.unstakeCS(account3.accountId);
    account3Balance = await AccountStorage.balanceOf(account3.accountId);
    assertBN(
      account3Balance,
      expectedBalance,
      'Unstake proceeds are incorrect.',
    );

    // Another stake by account3
    currentTime = await increaseTime(31, currentTime);
    const contribution5 = toBN('7e3');
    await AccountManager.stakePLG(account3.accountId, toSafeNumber(contribution5));

    // Second interest payment
    const interest2 = toBN('10e3');
    await Token.approve(CampShareManager.address, toSafeNumber(interest2), { signer: owner.signer });
    await CampShareManager.postInterest(interest2, { signer: owner.signer });
    account1Balance = await AccountStorage.balanceOf(account1.accountId);
    account2Balance = await AccountStorage.balanceOf(account2.accountId);
    account3Balance = await AccountStorage.balanceOf(account3.accountId);

    // PASS --- Check unstake proceeds are processed correctly
    const int1StakePool = contribution1 + contribution2;
    const int2StakePool = contribution1 + contribution2 + contribution5;
    expectedBalance = account1Balance + contribution1 + ((contribution1 * interest1) / int1StakePool) + ((contribution1 * interest2) / int2StakePool);
    await AccountManager.unstakeCS(account1.accountId);
    account1Balance = await AccountStorage.balanceOf(account1.accountId);
    assertBN(
      account1Balance,
      expectedBalance,
      'Unstake proceeds are incorrect.',
    );

    expectedBalance = account2Balance + contribution2 + ((contribution2 * interest1) / int1StakePool) + ((contribution2 * interest2) / int2StakePool);
    await AccountManager.unstakeCS(account2.accountId);
    account2Balance = await AccountStorage.balanceOf(account2.accountId);
    assertBN(
      account2Balance,
      expectedBalance,
      'Unstake proceeds are incorrect.',
    );

    expectedBalance = account3Balance + contribution5 + ((contribution5 * interest2) / int2StakePool);
    await AccountManager.unstakeCS(account3.accountId);
    account3Balance = await AccountStorage.balanceOf(account3.accountId);
    assertBN(
      account3Balance,
      expectedBalance,
      'Unstake proceeds are incorrect.',
    );
  });
});
