/* eslint-disable no-irregular-whitespace */
const merge = require('lodash/merge');
const assert = require('assert');
const { defaultOptions, testingDeploy } = require('../src/utils/deploy');
const {
  assertBN, shouldRevert, account, toBN, toSafeNumber, increaseTime,
} = require('../src/utils/testing');

/**
 * Uses 30 -> 40 for range of accounts to test
 */
describe('CampShares', () => {
  let runtime;
  let accounts;
  let CampShareManager;
  let CampShareStorage;
  let Token;
  let totalContribution;
  let contribution;
  let currentTime;
  let signerAccounts;
  let address1;
  let address1Id;
  let address1Balance;
  let address1CS;
  let address1Contribution;
  let address2;
  let address2Id;
  let address2Balance;
  let address2CS;
  let address3;
  let address3Id;
  let address3Balance;
  let address3CS;
  let expectedBalance;
  let expectedValue;
  // const zeroAddress = '0x0000000000000000000000000000000000000000';

  const testProfile = merge({}, defaultOptions, {
    meta: {
      name: 'TEST - CampShares',
    },
    accounts: {
      account1: account(30, '10e3'),
      account2: account(31, '10e3'),
      account3: account(32, '10e3'),
      account4: account(33, '10e3'),
    },
  });
  // These next few lines are what actually setup the blockchain
  before(async () => {
    runtime = await testingDeploy(testProfile);
    ({ accounts, CampShareManager, CampShareStorage, Token } = runtime);
  });

  it('Test staking', async () => {
    // Set current time to the latest block
    const latestBlock = await ethers.provider.getBlock('latest');
    currentTime = latestBlock.timestamp;

    signerAccounts = await ethers.getSigners();
    address1Contribution = toBN('2e3');
    const { account1, account2 } = accounts;
    address1 = signerAccounts[account1.bipIndex];
    address1Id = await CampShareManager.getID(address1.address, { signer: address1.signer });
    address2 = signerAccounts[account2.bipIndex];
    address2Id = await CampShareManager.getID(address2.address, { signer: address2.signer });

    contribution = address1Contribution;
    address1Balance = await Token.balanceOf(address1.address);

    // FAIL --- Test that staking doesn't work until allowance approval made
    await shouldRevert(
      CampShareManager.stake(toSafeNumber(address1Id), toSafeNumber(contribution), { signer: account1.signer }),
      'Allowance low',
      'Allowance approval required before user can stake PLG',
    );

    // Approve transaction then stake PLG
    await Token.approve(CampShareManager.address, toSafeNumber(contribution), { signer: account1.signer });

    // FAIL --- Cannot use amount value of 0
    contribution = toBN('0');
    address1Balance = await Token.balanceOf(address1.address);
    await shouldRevert(
      CampShareManager.stake(address1Id, toSafeNumber(contribution), { signer: address1.signer }),
      'Invalid amount',
      'Inputted amount cannot equal 0',
    );

    // FAIL --- Cannot use an invalid receiver address
    contribution = address1Contribution;
    await shouldRevert(
      CampShareManager.stake(address2.address, toSafeNumber(contribution), { signer: account1.signer }),
      'Unauthorized access',
      'Cannot stake for another address',
    );

    // PASS --- Test CS Stake
    contribution = address1Contribution;
    await CampShareManager.stake(toSafeNumber(address1Id), toSafeNumber(contribution), { signer: account1.signer });
    address1CS = await CampShareStorage.getStake(address1.address, address1Id);
    expectedBalance = contribution;
    assertBN(
      address1CS,
      contribution,
      'Balance was not increased as expected.',
    );
    expectedBalance = address1Balance - contribution;
    address1Balance = await Token.balanceOf(address1.address);
    assertBN(
      address1Balance,
      expectedBalance,
      'Balance was not increased as expected.',
    );
  });

  it('Test unstake mechanism', async () => {
    const { account1 } = runtime.accounts;

    totalContribution = await CampShareStorage.totalCS();
    address1Balance = await Token.balanceOf(address1.address);

    // PASS --- Unstake CS
    const unstakeAmount = await CampShareManager.getStake(address1.address, address1Id);
    await CampShareManager.unstake(address1Id, { signer: account1.signer });

    const unstakedCS = await CampShareStorage.getUnstakedAmount(
      address1.address,
      address1Id,
      0,
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
      CampShareManager.unstake(address1Id, { signer: account1.signer }),
      'No stake',
      'Cannot unstake more than once',
    );

    await Token.approve(CampShareManager.address, toSafeNumber(contribution), { signer: account1.signer });

    // FAIL --- Test staking before end of unstake period
    await shouldRevert(
      CampShareManager.stake(address1Id, toSafeNumber(contribution), { signer: account1.signer }),
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

    expectedBalance = address1Balance + unstakeAmount;
    address1Balance = await Token.balanceOf(address1.address);
    assertBN(
      address1Balance,
      expectedBalance,
      'User balance after unstake is incorrect.',
    );
  });

  it('Should unstake correctly with rewards', async () => {
    const { owner, account1, account2, account3 } = runtime.accounts;
    address3 = signerAccounts[account3.bipIndex];
    address3Id = await CampShareManager.getID(address3.address, { signer: address3.signer });

    currentTime = await increaseTime(31, currentTime);

    // Set up stakes and first interest payment
    contribution = toBN('1e3');
    await Token.approve(CampShareManager.address, toSafeNumber(contribution), { signer: account1.signer });
    await Token.approve(CampShareManager.address, toSafeNumber(contribution), { signer: account2.signer });
    await Token.approve(CampShareManager.address, toSafeNumber(contribution), { signer: account3.signer });
    await CampShareManager.stake(toSafeNumber(address1Id), toSafeNumber(contribution), { signer: account1.signer });
    await CampShareManager.stake(toSafeNumber(address2Id), toSafeNumber(contribution), { signer: account2.signer });
    await CampShareManager.stake(toSafeNumber(address3Id), toSafeNumber(contribution), { signer: account3.signer });
    const interest = toBN('1e3');
    await Token.approve(CampShareManager.address, toSafeNumber(interest), { signer: owner.signer });
    await CampShareManager.postInterest(interest, { signer: owner.signer });

    // PASS --- Check that staked CS and gains are allocated correctly
    let totalStaked = await CampShareStorage.totalCS();
    const address1Gains = await CampShareManager.unrealizedGains(account1.address, toSafeNumber(address1Id));
    const address2Gains = await CampShareManager.unrealizedGains(account2.address, toSafeNumber(address2Id));
    let address3Gains = await CampShareManager.unrealizedGains(account3.address, toSafeNumber(address3Id)) + toBN(1);
    expectedBalance = totalStaked + address1Gains + address2Gains + address3Gains;
    let totalCS = await Token.balanceOf(CampShareStorage.address);
    assertBN(
      totalCS,
      expectedBalance,
      'User balance after unstake is incorrect.',
    );

    // PASS --- First and second unstaker should get 1/3 of 1000
    address1Balance = await Token.balanceOf(address1.address);
    expectedBalance = address1Balance + (interest * toBN('4')) / toBN('3');
    await CampShareManager.unstake(address1Id, { signer: account1.signer });
    address1Balance = await Token.balanceOf(address1.address);
    assertBN(
      address1Balance,
      expectedBalance,
      'User 1 balance after unstake is incorrect.',
    );

    address2Balance = await Token.balanceOf(address2.address);
    expectedBalance = address2Balance + (interest * toBN('4')) / toBN('3');
    await CampShareManager.unstake(address2Id, { signer: account2.signer });
    address2Balance = await Token.balanceOf(address2.address);
    assertBN(
      address2Balance,
      expectedBalance,
      'User 2 balance after unstake is incorrect.',
    );

    // Second interest payment
    await Token.approve(CampShareManager.address, toSafeNumber(interest), { signer: owner.signer });
    await CampShareManager.postInterest(interest, { signer: owner.signer });

    // PASS --- Check staked PLG and gains after second interest payment
    totalStaked = await CampShareStorage.totalCS();
    address3Gains = await CampShareManager.unrealizedGains(account3.address, toSafeNumber(address3Id));
    expectedBalance = totalStaked + address3Gains;
    totalCS = await Token.balanceOf(CampShareStorage.address);
    assertBN(
      totalCS,
      expectedBalance,
      'Total CS balance after unstakes is incorrect.',
    );

    // PASS --- Last staker should get remainder of pool
    address3Balance = await Token.balanceOf(account3.address);
    address3CS = await CampShareStorage.getStake(address3.address, address3Id);
    await CampShareManager.unstake(address3Id, { signer: account3.signer });
    expectedBalance = address3Balance + address3CS + address3Gains;
    address3Balance = await Token.balanceOf(account3.address);
    assertBN(
      address3Balance,
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
    await Token.approve(CampShareManager.address, toSafeNumber(contribution), { signer: account1.signer });
    await Token.approve(CampShareManager.address, toSafeNumber(contribution), { signer: account2.signer });
    await CampShareManager.stake(toSafeNumber(address1Id), toSafeNumber(contribution), { signer: account1.signer });
    await CampShareManager.stake(toSafeNumber(address2Id), toSafeNumber(contribution), { signer: account2.signer });

    // First interest payment
    const interest = toBN('2e3');
    await Token.approve(CampShareManager.address, toSafeNumber(interest), { signer: owner.signer });
    await CampShareManager.postInterest(interest, { signer: owner.signer });

    // PASS --- Check that unrealized gains are accounted for
    expectedBalance = interest / toBN(2);
    let address2Gains = await CampShareManager.unrealizedGains(account2.address, toSafeNumber(address2Id));
    assertBN(
      address2Gains,
      expectedBalance,
      'Unrealized gains incorrect.',
    );

    // Second stake for address2Id
    await Token.approve(CampShareManager.address, toSafeNumber(contribution), { signer: account2.signer });
    await CampShareManager.stake(toSafeNumber(address2Id), toSafeNumber(contribution), { signer: account2.signer });

    // PASS --- Check that unrealized gains cleared and automatically reinvested for address2 after second unstaking
    expectedBalance = toBN(0);
    address2Gains = await CampShareManager.unrealizedGains(account2.address, toSafeNumber(address2Id));
    assertBN(
      address2Gains,
      expectedBalance,
      'Unrealized gains incorrect.',
    );

    // PASS --- Check that address1 gets both stake and interest when unstaking
    address1Balance = await Token.balanceOf(address1.address);
    expectedBalance = address1Balance + contribution + (interest / toBN(2));
    await CampShareManager.unstake(address1Id, { signer: account1.signer });
    address1Balance = await Token.balanceOf(address1.address);
    assertBN(
      address1Balance,
      expectedBalance,
      'Unstake proceeds incorrect.',
    );

    // address3 stake
    await Token.approve(CampShareManager.address, toSafeNumber(contribution), { signer: account3.signer });
    await CampShareManager.stake(toSafeNumber(address3Id), toSafeNumber(contribution), { signer: account3.signer });

    // Second interest payment
    const interest2 = toBN('4e3');
    await Token.approve(CampShareManager.address, toSafeNumber(interest2), { signer: owner.signer });
    await CampShareManager.postInterest(interest2, { signer: owner.signer });

    // PASS --- Stake and interest received in unstake
    address2Balance = await Token.balanceOf(address2.address);
    expectedBalance = address2Balance + (contribution * toBN(2)) + (interest / toBN(2)) + ((interest2 * toBN(3)) / toBN(4));
    await CampShareManager.unstake(address2Id, { signer: account2.signer });
    address2Balance = await Token.balanceOf(address2.address);
    assertBN(
      address2Balance,
      expectedBalance,
      'Unstake proceeds incorrect.',
    );

    address3Balance = await Token.balanceOf(address3.address);
    expectedBalance = address3Balance + contribution + (interest2 / toBN(4));
    await CampShareManager.unstake(address3Id, { signer: account3.signer });
    address3Balance = await Token.balanceOf(address3.address);
    assertBN(
      address3Balance,
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
    address2CS = await CampShareManager.getStake(address2.address, address2Id);
    const interest1 = toBN('1e3');
    await Token.approve(CampShareManager.address, toSafeNumber(interest1), { signer: owner.signer });
    await shouldRevert(CampShareManager.postInterest(interest1, { signer: owner.signer }), 'No stake');

    // FAIL --- Can't reinvest if there is no stake
    await shouldRevert(CampShareManager.reinvest(address2Id, { signer: account2.signer }), 'No stake');
    // FAIL --- Can't withdraw if there is no stake
    await shouldRevert(CampShareManager.withdrawInterest(address2Id, { signer: account2.signer }), 'No stake');
    // FAIL --- Can't unstake if there is no stake
    await shouldRevert(CampShareManager.unstake(address2Id, { signer: account2.signer }), 'No stake');

    // address2 stake
    contribution = toBN('1e3');
    await Token.approve(CampShareManager.address, toSafeNumber(contribution), { signer: account2.signer });
    await CampShareManager.stake(toSafeNumber(address2Id), toSafeNumber(contribution), { signer: account2.signer });

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

    // New stake by address3
    await Token.approve(CampShareManager.address, toSafeNumber(contribution), { signer: account3.signer });
    await CampShareManager.stake(toSafeNumber(address3Id), toSafeNumber(contribution), { signer: account3.signer });

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
    address2Balance = await Token.balanceOf(account2.address);
    address3Balance = await Token.balanceOf(account3.address);

    // PASS --- address2 gets remainder of second interest payment plus first 2 interest payments
    expectedBalance = address2Balance + contribution + interest1 + interest2 + (interest3 / toBN(2));
    await CampShareManager.unstake(address2Id, { signer: account2.signer });
    address2Balance = await Token.balanceOf(account2.address);
    assertBN(
      address2Balance,
      expectedBalance,
      'Unstake proceeds are incorrect.',
    );

    // PASS --- address3 gets half of second interest payment
    expectedBalance = address3Balance + contribution + (interest3 / toBN(2));
    await CampShareManager.unstake(address3Id, { signer: account3.signer });
    address3Balance = await Token.balanceOf(account3.address);
    assertBN(
      address3Balance,
      expectedBalance,
      'Unstake proceeds are incorrect.',
    );
  });

  it('Can reinvest and withdraw interest payments', async () => {
    const { owner, account1, account2, account3 } = runtime.accounts;

    currentTime = await increaseTime(31, currentTime);
    contribution = toBN('1e3');

    // Prepare initial stakes
    await Token.approve(CampShareManager.address, toSafeNumber(contribution), { signer: account1.signer });
    await Token.approve(CampShareManager.address, toSafeNumber(contribution), { signer: account2.signer });
    await CampShareManager.stake(toSafeNumber(address1Id), toSafeNumber(contribution), { signer: account1.signer });
    await CampShareManager.stake(toSafeNumber(address2Id), toSafeNumber(contribution), { signer: account2.signer });
    let address1Gains = await CampShareManager.unrealizedGains(account1.address, toSafeNumber(address1Id));
    let address2Gains = await CampShareManager.unrealizedGains(account2.address, toSafeNumber(address2Id));

    // First interest payment
    const interest1 = toBN('2e3');
    await Token.approve(CampShareManager.address, toSafeNumber(interest1), { signer: owner.signer });
    await CampShareManager.postInterest(interest1, { signer: owner.signer });

    // PASS --- address1 withdraws and gains are properly accounted for
    expectedBalance = address1Gains + (interest1 / toBN('2'));
    address1Gains = await CampShareManager.unrealizedGains(account1.address, toSafeNumber(address1Id));
    assertBN(
      address1Gains,
      expectedBalance,
      'Unrealized gains are incorrect.',
    );

    address1Balance = await Token.balanceOf(account1.address);
    expectedBalance = address1Balance + address1Gains;

    await CampShareManager.withdrawInterest(address1Id, { signer: account1.signer });

    address1Balance = await Token.balanceOf(account1.address);
    assertBN(
      address1Balance,
      expectedBalance,
      'Withdrawal was incorrect.',
    );

    expectedBalance = toBN(0);
    address1Gains = await CampShareManager.unrealizedGains(account1.address, toSafeNumber(address1Id));
    assertBN(
      address1Gains,
      expectedBalance,
      'Unrealized gains after withdrawal are incorrect.',
    );

    // PASS --- address2 reinvests interest proceeds and gains are properly accounted for
    expectedBalance = address2Gains + (interest1 / toBN('2'));
    address2Gains = await CampShareManager.unrealizedGains(account2.address, toSafeNumber(address2Id));
    assertBN(
      address2Gains,
      expectedBalance,
      'Unrealized gains are incorrect.',
    );

    address2CS = await CampShareManager.getStake(address2.address, address2Id);
    address2Balance = await Token.balanceOf(account2.address);
    expectedBalance = address2Balance;

    await CampShareManager.reinvest(address2Id, { signer: account2.signer });

    address2Balance = await Token.balanceOf(account2.address);
    assertBN(
      address2Balance,
      expectedBalance,
      'Balance after reinvestment was incorrect.',
    );

    expectedBalance = address2CS + address2Gains;
    address2CS = await CampShareManager.getStake(address2.address, address2Id);
    assertBN(
      address2CS,
      expectedBalance,
      'CS balance after reinvestment was incorrect.',
    );

    expectedBalance = toBN(0);
    address2Gains = await CampShareManager.unrealizedGains(account2.address, toSafeNumber(address2Id));
    assertBN(
      address2Gains,
      expectedBalance,
      'Unrealized gains after withdrawal are incorrect.',
    );

    // Another user stakes
    await Token.approve(CampShareManager.address, toSafeNumber(contribution), { signer: account3.signer });
    await CampShareManager.stake(toSafeNumber(address3Id), toSafeNumber(contribution), { signer: account3.signer });

    // Second interest payment
    const interest2 = toBN('4e3');
    await Token.approve(CampShareManager.address, toSafeNumber(interest2), { signer: owner.signer });
    await CampShareManager.postInterest(interest2, { signer: owner.signer });

    // PASS --- Balances transferred at unstake are correct
    expectedBalance = address1Balance + contribution + interest2 / toBN('4');
    await CampShareManager.unstake(address1Id, { signer: account1.signer });
    address1Balance = await Token.balanceOf(account1.address);
    assertBN(
      address1Balance,
      expectedBalance,
      'Unstake proceeds are incorrect.',
    );

    address3Balance = await Token.balanceOf(account3.address);
    expectedBalance = address3Balance + contribution + interest2 / toBN('4');
    await CampShareManager.unstake(address3Id, { signer: account3.signer });
    address3Balance = await Token.balanceOf(account3.address);
    assertBN(
      address3Balance,
      expectedBalance,
      'Unstake proceeds are incorrect.',
    );

    expectedBalance = address2Balance + (contribution * toBN('2')) + (interest2 * toBN('2')) / toBN('4');
    await CampShareManager.unstake(address2Id, { signer: account2.signer });
    address2Balance = await Token.balanceOf(account2.address);
    assertBN(
      address2Balance,
      expectedBalance,
      'Unstake proceeds are incorrect.',
    );
  });

  it('Check behavior if no reinvestments occur', async () => {
    const { owner, account1, account2, account3 } = runtime.accounts;

    currentTime = await increaseTime(31, currentTime);
    contribution = toBN('1e3');

    // Setup initial stakes
    await Token.approve(CampShareManager.address, toSafeNumber(contribution), { signer: account1.signer });
    await Token.approve(CampShareManager.address, toSafeNumber(contribution), { signer: account2.signer });
    await CampShareManager.stake(toSafeNumber(address1Id), toSafeNumber(contribution), { signer: account1.signer });
    await CampShareManager.stake(toSafeNumber(address2Id), toSafeNumber(contribution), { signer: account2.signer });
    let address1Gains = await CampShareManager.unrealizedGains(account1.address, toSafeNumber(address1Id));
    let address2Gains = await CampShareManager.unrealizedGains(account2.address, toSafeNumber(address2Id));

    // First interest payment
    const interest1 = toBN('2e3');
    await Token.approve(CampShareManager.address, toSafeNumber(interest1), { signer: owner.signer });
    await CampShareManager.postInterest(interest1, { signer: owner.signer });

    // PASS --- address1 withdraws and gains are properly accounted for
    expectedBalance = address1Gains + (interest1 / toBN('2'));
    address1Gains = await CampShareManager.unrealizedGains(account1.address, toSafeNumber(address1Id));
    assertBN(
      address1Gains,
      expectedBalance,
      'Unrealized gains are incorrect.',
    );

    address1Balance = await Token.balanceOf(account1.address);
    expectedBalance = address1Balance + address1Gains;

    await CampShareManager.withdrawInterest(address1Id, { signer: account1.signer });

    address1Balance = await Token.balanceOf(account1.address);
    assertBN(
      address1Balance,
      expectedBalance,
      'Withdrawal was incorrect.',
    );

    expectedBalance = toBN(0);
    address1Gains = await CampShareManager.unrealizedGains(account1.address, toSafeNumber(address1Id));
    assertBN(
      address1Gains,
      expectedBalance,
      'Unrealized gains after withdrawal are incorrect.',
    );

    // PASS --- address2 does nothing with gains and gains accrue
    expectedBalance = address2Gains + (interest1 / toBN('2'));
    address2Gains = await CampShareManager.unrealizedGains(account2.address, toSafeNumber(address2Id));
    assertBN(
      address2Gains,
      expectedBalance,
      'Unrealized gains are incorrect.',
    );

    address2CS = await CampShareManager.getStake(address2.address, address2Id);
    address2Balance = await Token.balanceOf(account2.address);
    expectedBalance = address2Balance;

    address2Balance = await Token.balanceOf(account2.address);
    assertBN(
      address2Balance,
      expectedBalance,
      'PLG Balance was incorrect.',
    );

    // Another user stakes
    await Token.approve(CampShareManager.address, toSafeNumber(contribution), { signer: account3.signer });
    await CampShareManager.stake(toSafeNumber(address3Id), toSafeNumber(contribution), { signer: account3.signer });

    // Second interest payment
    const interest2 = toBN('3e3');
    await Token.approve(CampShareManager.address, toSafeNumber(interest2), { signer: owner.signer });
    await CampShareManager.postInterest(interest2, { signer: owner.signer });

    // PASS --- Ensure stake hasn't changed
    expectedBalance = address2CS;
    address2CS = await CampShareManager.getStake(address2.address, address2Id);
    assertBN(
      address2CS,
      expectedBalance,
      'CS balance was incorrect.',
    );

    // PASS --- Gains accrue properly for address2
    expectedBalance = address2Gains + interest2 / toBN('3');
    address2Gains = await CampShareManager.unrealizedGains(account2.address, toSafeNumber(address2Id));
    assertBN(
      address2Gains,
      expectedBalance,
      'Unrealized gains after withdrawal are incorrect.',
    );

    // PASS --- Unstake proceeds for address1 and address3 are calculated the same way
    expectedBalance = address1Balance + contribution + interest2 / toBN('3');
    await CampShareManager.unstake(address1Id, { signer: account1.signer });
    address1Balance = await Token.balanceOf(account1.address);
    assertBN(
      address1Balance,
      expectedBalance,
      'Unstake proceeds are incorrect.',
    );

    address3Balance = await Token.balanceOf(account3.address);
    expectedBalance = address3Balance + contribution + interest2 / toBN('3');
    await CampShareManager.unstake(address3Id, { signer: account3.signer });
    address3Balance = await Token.balanceOf(account3.address);
    assertBN(
      address3Balance,
      expectedBalance,
      'Unstake proceeds are incorrect.',
    );

    // PASS --- Unstake proceeds for address2 should include the contribution and accrued unrealized gains
    expectedBalance = address2Balance + (contribution) + (interest1 / toBN('2')) + (interest2 / toBN('3'));
    await CampShareManager.unstake(address2Id, { signer: account2.signer });
    address2Balance = await Token.balanceOf(account2.address);
    assertBN(
      address2Balance,
      expectedBalance,
      'Unstake proceeds are incorrect.',
    );
  });

  it('Works with complex staking & reward situations', async () => {
    const { owner, account1, account2, account3 } = runtime.accounts;

    currentTime = await increaseTime(31, currentTime);

    // Set up of initial stakes
    address1Balance = await Token.balanceOf(account1.address);
    address3Balance = await Token.balanceOf(account3.address);
    const contribution1 = toBN('1e3');
    await Token.approve(CampShareManager.address, toSafeNumber(contribution1), { signer: account1.signer });
    await CampShareManager.stake(toSafeNumber(address1Id), toSafeNumber(contribution1), { signer: account1.signer });
    const contribution2 = toBN('2e3');
    await Token.approve(CampShareManager.address, toSafeNumber(contribution2), { signer: account2.signer });
    await CampShareManager.stake(toSafeNumber(address2Id), toSafeNumber(contribution2), { signer: account2.signer });

    // First interest payment
    const interest1 = toBN('3e3');
    await Token.approve(CampShareManager.address, toSafeNumber(interest1), { signer: owner.signer });
    await CampShareManager.postInterest(interest1, { signer: owner.signer });

    // First stake by address3
    const contribution3 = toBN('4e3');
    await Token.approve(CampShareManager.address, toSafeNumber(contribution3), { signer: account3.signer });
    await CampShareManager.stake(toSafeNumber(address3Id), toSafeNumber(contribution3), { signer: account3.signer });
    address3Balance = await Token.balanceOf(account3.address);

    // PASS --- address3 unstake should receive original stake with no interest
    expectedBalance = address3Balance + contribution3;
    await CampShareManager.unstake(address3Id, { signer: account3.signer });
    address3Balance = await Token.balanceOf(account3.address);
    assertBN(
      address3Balance,
      expectedBalance,
      'Unstake proceeds are incorrect.',
    );

    // address3 stakes twice
    currentTime = await increaseTime(31, currentTime);

    await Token.approve(CampShareManager.address, toSafeNumber(contribution3), { signer: account3.signer });
    await CampShareManager.stake(toSafeNumber(address3Id), toSafeNumber(contribution3), { signer: account3.signer });
    const contribution4 = toBN('4e3');
    await Token.approve(CampShareManager.address, toSafeNumber(contribution4), { signer: account3.signer });
    await CampShareManager.stake(toSafeNumber(address3Id), toSafeNumber(contribution4), { signer: account3.signer });

    // PASS --- address3 will receive first and second stake with no interest when unstaking
    expectedBalance = address3Balance;
    await CampShareManager.unstake(address3Id, { signer: account3.signer });
    address3Balance = await Token.balanceOf(account3.address);
    assertBN(
      address3Balance,
      expectedBalance,
      'Unstake proceeds are incorrect.',
    );

    // Another stake by address3
    currentTime = await increaseTime(31, currentTime);
    const contribution5 = toBN('7e3');
    await Token.approve(CampShareManager.address, toSafeNumber(contribution5), { signer: account3.signer });
    await CampShareManager.stake(toSafeNumber(address3Id), toSafeNumber(contribution5), { signer: account3.signer });

    // Second interest payment
    const interest2 = toBN('10e3');
    await Token.approve(CampShareManager.address, toSafeNumber(interest2), { signer: owner.signer });
    await CampShareManager.postInterest(interest2, { signer: owner.signer });
    address1Balance = await Token.balanceOf(account1.address);
    address2Balance = await Token.balanceOf(account2.address);
    address3Balance = await Token.balanceOf(account3.address);

    // PASS --- Check unstake proceeds are processed correctly
    const int1StakePool = contribution1 + contribution2;
    const int2StakePool = contribution1 + contribution2 + contribution5;
    expectedBalance = address1Balance + contribution1 + ((contribution1 * interest1) / int1StakePool) + ((contribution1 * interest2) / int2StakePool);
    await CampShareManager.unstake(address1Id, { signer: account1.signer });
    address1Balance = await Token.balanceOf(account1.address);
    assertBN(
      address1Balance,
      expectedBalance,
      'Unstake proceeds are incorrect.',
    );

    expectedBalance = address2Balance + contribution2 + ((contribution2 * interest1) / int1StakePool) + ((contribution2 * interest2) / int2StakePool);
    await CampShareManager.unstake(address2Id, { signer: account2.signer });
    address2Balance = await Token.balanceOf(account2.address);
    assertBN(
      address2Balance,
      expectedBalance,
      'Unstake proceeds are incorrect.',
    );

    expectedBalance = address3Balance + contribution5 + ((contribution5 * interest2) / int2StakePool);
    await CampShareManager.unstake(address3Id, { signer: account3.signer });
    address3Balance = await Token.balanceOf(account3.address);
    assertBN(
      address3Balance,
      expectedBalance,
      'Unstake proceeds are incorrect.',
    );
  });

  it('Correctly uses the CampShare Storage functions', async () => {
    const { owner } = runtime.accounts;
    signerAccounts = await ethers.getSigners();

    // PASS --- Test the setting of unstakePeriod
    const newUnstakePeriod = 5;
    await CampShareStorage.setUnstakePeriod(newUnstakePeriod);

    const unstakePeriod = await CampShareStorage.unstakePeriod();
    expectedBalance = newUnstakePeriod;
    assertBN(
      unstakePeriod,
      expectedBalance,
      'Unstake period not set properly.',
    );

    // PASS --- Test the increasing and decreasing of stake amount
    let stakeAmount = await CampShareStorage.getStake(address1.address, address1Id);
    let amount = toBN('2000');
    expectedBalance = stakeAmount + amount;
    await CampShareStorage.increaseStakeAmount(address1.address, address1Id, amount);
    stakeAmount = await CampShareStorage.getStake(address1.address, address1Id);
    assertBN(
      stakeAmount,
      expectedBalance,
      'Increase stake amount not working properly.',
    );

    amount = toBN(1000);
    expectedBalance -= amount;
    await CampShareStorage.decreaseStakeAmount(address1.address, address1Id, amount);
    stakeAmount = await CampShareStorage.getStake(address1.address, address1Id);
    assertBN(
      stakeAmount,
      expectedBalance,
      'Decrease stake amount not working properly.',
    );

    // PASS --- Test the setting of interest index of a stake record
    const divIndex = 3;
    expectedBalance = divIndex;
    await CampShareStorage.setStakeInterestIndex(address1.address, address1Id, divIndex);
    const stakeDivIndex = await CampShareStorage.getStakeInterestIndex(address1.address, address1Id);
    assertBN(
      stakeDivIndex,
      expectedBalance,
      'Set interest index not working properly.',
    );

    // PASS --- Test pushing of interest info record
    let interestCount = await CampShareStorage.getInterestCount();
    await CampShareStorage.pushInterestInfo(100, 100, 1000);
    expectedBalance = interestCount + toBN(1);
    interestCount = await CampShareStorage.getInterestCount();
    assertBN(
      interestCount,
      expectedBalance,
      'Push interest info not working properly.',
    );

    // PASS --- Test updating of interest info record
    await CampShareStorage.updateInterestInfo(0, 1, 2, 3);
    expectedBalance = 1;
    let interestOriginalAmount = await CampShareStorage.getInterestOriginalAmount(0);
    assertBN(
      interestOriginalAmount,
      expectedBalance,
      'Update interest info not working properly.',
    );

    // PASS --- Test the increasing and decreasing of interest original amount
    amount = 999;
    expectedBalance += amount;
    await CampShareStorage.increaseInterestOriginalAmount(0, amount);
    interestOriginalAmount = await CampShareStorage.getInterestOriginalAmount(0);
    assertBN(
      interestOriginalAmount,
      expectedBalance,
      'Update interest info not working properly.',
    );

    amount = 300;
    expectedBalance -= amount;
    await CampShareStorage.decreaseInterestOriginalAmount(0, amount);
    interestOriginalAmount = await CampShareStorage.getInterestOriginalAmount(0);
    assertBN(
      interestOriginalAmount,
      expectedBalance,
      'Update interest info not working properly.',
    );

    // PASS --- Test getting of interest amount
    expectedBalance = 2;
    let interestAmount = await CampShareStorage.getInterestAmount(0);
    assertBN(
      interestAmount,
      expectedBalance,
      'Update interest info not working properly.',
    );

    // PASS --- Test the increasing and decreasing of interest amount
    amount = 199;
    expectedBalance += amount;
    await CampShareStorage.increaseInterestAmount(0, amount);
    interestAmount = await CampShareStorage.getInterestAmount(0);
    assertBN(
      interestAmount,
      expectedBalance,
      'Update interest info not working properly.',
    );

    amount = 100;
    expectedBalance -= amount;
    await CampShareStorage.decreaseInterestAmount(0, amount);
    interestAmount = await CampShareStorage.getInterestAmount(0);
    assertBN(
      interestAmount,
      expectedBalance,
      'Update interest info not working properly.',
    );

    // PASS --- Test getting of stake snapshot
    expectedBalance = 3;
    let interestStakeSnapshot = await CampShareStorage.getInterestStakeSnapshot(0);
    assertBN(
      interestStakeSnapshot,
      expectedBalance,
      'Update interest info not working properly.',
    );

    // PASS --- Test the increasing and decreasing of interest stake snapshot
    amount = 399;
    expectedBalance += amount;
    await CampShareStorage.increaseInterestStakeSnapshot(0, amount);
    interestStakeSnapshot = await CampShareStorage.getInterestStakeSnapshot(0);
    assertBN(
      interestStakeSnapshot,
      expectedBalance,
      'Update interest info not working properly.',
    );

    amount = 200;
    expectedBalance -= amount;
    await CampShareStorage.decreaseInterestStakeSnapshot(0, amount);
    interestStakeSnapshot = await CampShareStorage.getInterestStakeSnapshot(0);
    assertBN(
      interestStakeSnapshot,
      expectedBalance,
      'Update interest info not working properly.',
    );

    // PASS --- Check impact of deleting interest info record
    interestCount = await CampShareStorage.getInterestCount();
    await CampShareStorage.deleteInterestInfo(0);
    expectedBalance = interestCount;
    interestCount = await CampShareStorage.getInterestCount();
    assertBN(
      interestCount,
      expectedBalance,
      'Delete interest info not working properly.',
    );
    expectedBalance = 0;
    interestAmount = await CampShareStorage.getInterestAmount(0);
    assertBN(
      interestAmount,
      expectedBalance,
      'Delete interest info not working properly.',
    );

    // PASS --- Test the increasing of outstanding moderation
    let outstandingMod = await CampShareStorage.getOutstandingModeration(address3.address, address3Id);

    let increaseObligation = 3n;
    await CampShareStorage.increaseOutstandingModeration(
      increaseObligation,
      address3.address,
      address3Id,
    );

    expectedBalance = outstandingMod + increaseObligation;
    outstandingMod = await CampShareStorage.getOutstandingModeration(address3.address, address3Id);

    assertBN(
      outstandingMod,
      expectedBalance,
      'IncreaseOutstandingModeration() not set properly.',
    );

    // PASS --- Test the decreasing of outstanding moderation
    let decreaseObligation = 2n;
    await CampShareStorage.decreaseOutstandingModeration(
      decreaseObligation,
      address3.address,
      address3Id,
    );

    expectedBalance = outstandingMod - decreaseObligation;
    outstandingMod = await CampShareStorage.getOutstandingModeration(address3.address, address3Id);

    assertBN(
      outstandingMod,
      expectedBalance,
      'DecreaseOutstandingModeration() not set properly.',
    );

    // PASS --- Test the increasing of project moderation
    const projectAddress = '0xc054ec1e92ac8f631072d4f1e17f25f25c52395c';
    let projectModeration = await CampShareStorage.getProjectModerationCount(projectAddress, address3Id);

    increaseObligation = 3n;
    await CampShareStorage.increaseProjectModerationCount(
      increaseObligation,
      projectAddress,
      address3Id,
    );

    expectedBalance = projectModeration + increaseObligation;
    projectModeration = await CampShareStorage.getProjectModerationCount(projectAddress, address3Id);

    assertBN(
      projectModeration,
      expectedBalance,
      'IncreaseOutstandingModeration() not set properly.',
    );

    // PASS --- Test the decreasing of project moderation
    decreaseObligation = 2n;
    await CampShareStorage.decreaseProjectModerationCount(
      decreaseObligation,
      projectAddress,
      address3Id,
    );

    expectedBalance = projectModeration - decreaseObligation;
    projectModeration = await CampShareStorage.getProjectModerationCount(projectAddress, address3Id);

    assertBN(
      projectModeration,
      expectedBalance,
      'DecreaseOutstandingModeration() not set properly.',
    );

    // PASS --- Test increasing of totalCS
    let totalCS = await CampShareStorage.totalCS();

    const increaseCS = toBN('2e3');
    await CampShareStorage.increaseTotalCS(increaseCS);

    expectedBalance = totalCS + increaseCS;
    totalCS = await CampShareStorage.totalCS();

    assertBN(
      totalCS,
      expectedBalance,
      'IncreaseTotalCS() not set properly.',
    );

    // PASS --- Test decreasing of totalCS
    const decreaseCS = toBN('1e3');
    await CampShareStorage.decreaseTotalCS(decreaseCS);

    expectedBalance = totalCS - decreaseCS;
    totalCS = await CampShareStorage.totalCS();

    assertBN(
      totalCS,
      expectedBalance,
      'DecreaseTotalCS() not set properly.',
    );

    // PASS --- Test pushing a new value into unstakedCSInfo
    let unstakedCS = await CampShareStorage.getUnstakedCS(
      address3.address,
      address3Id,
    );
    let unstakeAmount = toBN('2e3');
    const originalStakeAmount = unstakeAmount;
    block = await ethers.provider.getBlock('latest');
    let unstakedCount = await CampShareStorage.getUnstakeCount(address3.address, address3Id);

    await CampShareStorage.pushUnstakedCSInfo(
      address3.address,
      address3Id,
      unstakeAmount,
      block.timestamp,
    );

    expectedBalance = unstakedCount + 1n;
    unstakedCount = await CampShareStorage.getUnstakeCount(address3.address, address3Id);

    assertBN(
      unstakedCount,
      expectedBalance,
      'Unstake count not set properly.',
    );

    const unstakeCount = await CampShareStorage.getUnstakeCount(address3.address, address3Id);
    let unstakedTime = await CampShareStorage.getUnstakedTime(
      address3.address,
      address3Id,
      unstakeCount - toBN(1),
    );
    block = await ethers.provider.getBlock('latest');
    let unstakedTimeFlag = false;
    let unstakedTimeDiff = unstakedTime - toBN(block.timestamp);
    if(Math.abs(Number(unstakedTimeDiff)) <= 5) {
      unstakedTimeFlag = true;
    }
    expectedValue = true;
    assert.strictEqual(
      unstakedTimeFlag.toString(),
      expectedValue.toString(),
      `Incorrect time set in UnstakedCSInfo. Expected value of ${expectedValue.toString()}. Got ${unstakedTimeFlag.toString()}`,
    );

    expectedBalance = unstakeAmount;
    let unstakedAmount = await CampShareStorage.getUnstakedAmount(
      address3.address,
      address3Id,
      unstakeCount - toBN(1),
    );
    assertBN(
      unstakedAmount,
      expectedBalance,
      'Unstaked amount not set properly.',
    );

    expectedBalance = unstakedCS + unstakeAmount;
    unstakedCS = await CampShareStorage.getUnstakedCS(
      address3.address,
      address3Id,
    );
    assertBN(
      unstakedCS,
      expectedBalance,
      'Unstaked CS not set properly.',
    );

    // PASS --- Test updating a value into unstakedCSInfo
    unstakeAmount = toBN('3e3');
    const updateDiff = unstakeAmount - originalStakeAmount;
    block = await ethers.provider.getBlock('latest');

    const infoIndex = unstakedCount - 1n;
    await CampShareStorage.updateUnstakedCSInfo(
      address3.address,
      address3Id,
      infoIndex,
      unstakeAmount,
      block.timestamp,
    );

    // Unstake count shouldn't change
    expectedBalance = unstakedCount;
    unstakedCount = await CampShareStorage.getUnstakeCount(address3.address, address3Id);

    assertBN(
      unstakedCount,
      expectedBalance,
      'Unstake count not set properly.',
    );

    unstakedTime = await CampShareStorage.getUnstakedTime(
      address3.address,
      address3Id,
      unstakedCount - toBN(1),
    );
    block = await ethers.provider.getBlock('latest');
    unstakedTimeFlag = false;
    unstakedTimeDiff = unstakedTime - toBN(block.timestamp);
    if(Math.abs(Number(unstakedTimeDiff)) <= 5) {
      unstakedTimeFlag = true;
    }
    expectedValue = true;
    assert.strictEqual(
      unstakedTimeFlag.toString(),
      expectedValue.toString(),
      `Incorrect time set in UnstakedCSInfo. Expected value of ${expectedValue.toString()}. Got ${unstakedTimeFlag.toString()}`,
    );

    unstakedAmount = await CampShareStorage.getUnstakedAmount(
      address3.address,
      address3Id,
      unstakedCount - toBN(1),
    );
    expectedBalance = unstakeAmount;
    assertBN(
      unstakedAmount,
      expectedBalance,
      'Unstaked amount not set properly.',
    );

    expectedBalance = unstakedCS + updateDiff;
    unstakedCS = await CampShareStorage.getUnstakedCS(
      address3.address,
      address3Id,
    );
    assertBN(
      unstakedCS,
      expectedBalance,
      'Unstaked CS not set properly.',
    );

    // PASS --- Test deleting unstaked info
    expectedBalance = unstakedCS - unstakeAmount;
    await CampShareStorage.deleteUnstakedCSInfo(
      address3.address,
      address3Id,
      unstakedCount - toBN(1),
    );
    unstakedCS = await CampShareStorage.getUnstakedCS(
      address3.address,
      address3Id,
    );
    assertBN(
      unstakedCS,
      expectedBalance,
      'Unstaked CS not set properly.',
    );
    expectedBalance = toBN(0);
    unstakedAmount = await CampShareStorage.getUnstakedAmount(
      address3.address,
      address3Id,
      unstakedCount - toBN(1),
    );
    assertBN(
      unstakedAmount,
      expectedBalance,
      'Unstaked amount not set properly.',
    );

    // PASS --- Check that funds are able to be sent by the CS Storage contract
    const transfer = toBN('1e3');
    await Token.transfer(CampShareStorage.address, toSafeNumber(transfer), { signer: owner.signer });
    const receiverAddress = address3.address;
    const transferAmount = toBN('100');

    let receiverBalance = await Token.balanceOf(receiverAddress);
    expectedBalance = receiverBalance + transferAmount;
    await CampShareStorage.sendFunds(receiverAddress, transferAmount);
    receiverBalance = await Token.balanceOf(receiverAddress);
    assertBN(
      receiverBalance,
      expectedBalance,
      'Funds were not sent to receiver.',
    );
  });
});
