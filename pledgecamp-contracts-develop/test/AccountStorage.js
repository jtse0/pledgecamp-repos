const merge = require('lodash/merge');
const { defaultOptions, testingDeploy } = require('../src/utils/deploy');
const { assertBN, shouldRevert, account, toBN, toSafeNumber } = require('../src/utils/testing');

const defaultAmount = toBN('1e3');

/**
 * Uses 20 -> 30 for range of accounts to test
 */
describe('Account Storage', () => {
  let runtime;
  let accounts;
  let AccountStorage;
  let Token;
  const testProfile = merge({}, defaultOptions, {
    meta: {
      name: 'TEST - Account Storage',
    },
    accounts: {
      balanceDecrease: account(20, '1e3'),
      balanceIncrease: account(21, '1'),
      sender: account(22, '3e3'),
      receiver: account(23, '1e3'),
      delegate: account(24, '1e3', 23, true),
    },
  });
  before(async () => {
    runtime = await testingDeploy(testProfile);
    ({ accounts, AccountStorage, Token } = runtime);
  });

  it('Check increase balance', async () => {
    const { balanceIncrease } = accounts;
    let addAmount;

    // totalStorageBal = 40,000PLG
    const totalStorageBal = await Token.balanceOf(AccountStorage.address);
    let currentBalance = await AccountStorage.balanceOf(balanceIncrease.accountId);

    // FAIL --- Cannot use accountId value of 0
    addAmount = defaultAmount;
    const zeroAccount = 0;
    await shouldRevert(
      AccountStorage.increaseBalance(zeroAccount, toSafeNumber(addAmount)),
      'Invalid account',
      'Input accountId cannot equal 0',
    );

    // FAIL --- Cannot use amount value of 0
    currentBalance = await AccountStorage.balanceOf(balanceIncrease.accountId);
    await shouldRevert(
      AccountStorage.increaseBalance(balanceIncrease.accountId, toSafeNumber(0)),
      'Invalid amount',
      'Input amount cannot equal 0',
    );

    // addAmount = 6,000,000PLG (addAmount > totalStorageBal)
    addAmount = toBN('6000e3');
    currentBalance = await AccountStorage.balanceOf(balanceIncrease.accountId);
    await shouldRevert(
      AccountStorage.increaseBalance(balanceIncrease.accountId, toSafeNumber(addAmount)),
      'Insufficient balance',
      `Cannot increase balance by an amount: ${addAmount} greater than AccountStorage: ${totalStorageBal}`,
    );

    // PASS --- Check that balance is correct after balanceIncrease()
    addAmount = defaultAmount;
    const totalManagedAmount = toBN(addAmount);
    currentBalance = await AccountStorage.balanceOf(balanceIncrease.accountId);
    const expectedBalance = currentBalance + addAmount;

    await AccountStorage.increaseBalance(balanceIncrease.accountId, addAmount);
    currentBalance = await AccountStorage.balanceOf(balanceIncrease.accountId);
    assertBN(
      currentBalance,
      expectedBalance,
      'Balance was not increased as expected.',
    );

    // FAIL ---  Not enough tokens available
    // addAmount = 4,000,000PLG (addAmount + totalManagedAmount > totalStorageBal)
    addAmount = toBN('4200e3');
    currentBalance = await AccountStorage.balanceOf(balanceIncrease.accountId);

    await shouldRevert(
      AccountStorage.increaseBalance(balanceIncrease.accountId, toSafeNumber(addAmount)),
      'Insufficient balance',
      `Total of amount of managed accounts: ${totalManagedAmount} and
      balanceIncrease balance: ${addAmount} cannot exceed AccountStorage: ${totalStorageBal}`,
    );
  });

  it('Check decrease balance', async () => {
    const { balanceDecrease } = accounts;
    let currentBalance = await AccountStorage.balanceOf(balanceDecrease.accountId);
    let subAmount;
    let expectedBalance;

    // FAIL --- Cannot use accountId value of 0
    subAmount = defaultAmount;
    const zeroAccount = 0;
    await shouldRevert(
      AccountStorage.increaseBalance(zeroAccount, toSafeNumber(subAmount)),
      'Invalid account',
      'Input accountId cannot equal 0',
    );

    // FAIL --- Cannot use amount value of 0
    subAmount = toBN('0');
    currentBalance = await AccountStorage.balanceOf(balanceDecrease.accountId);

    await shouldRevert(
      AccountStorage.decreaseBalance(balanceDecrease.accountId, toSafeNumber(subAmount)),
      'Invalid amount',
      'Input amount cannot equal 0',
    );
    currentBalance = await AccountStorage.balanceOf(balanceDecrease.accountId);

    // FAIL --- Cannot add more tokens than available in account
    subAmount = toBN('20e3');
    // currentBalance = 10,000PLG
    currentBalance = await AccountStorage.balanceOf(balanceDecrease.accountId);
    expectedBalance = currentBalance;

    await AccountStorage.decreaseBalance(balanceDecrease.accountId, toSafeNumber(subAmount));
    currentBalance = await AccountStorage.balanceOf(balanceDecrease.accountId);
    assertBN(
      currentBalance,
      expectedBalance,
      'Cannot decrease balance',
    );

    // PASS --- Check that balance is correct after balanceDecrease()
    subAmount = defaultAmount;
    currentBalance = await AccountStorage.balanceOf(balanceDecrease.accountId);
    expectedBalance = currentBalance - subAmount;

    await AccountStorage.decreaseBalance(balanceDecrease.accountId, toSafeNumber(subAmount));
    currentBalance = await AccountStorage.balanceOf(balanceDecrease.accountId);
    assertBN(
      currentBalance,
      expectedBalance,
      'Balance was not reduced as expected.',
    );
  });

  it('Check internal transfer', async () => {
    const transferAmount = defaultAmount;
    const { sender, receiver } = accounts;
    const initialSenderBalance = await AccountStorage.balanceOf(sender.accountId);
    const initialReceiverBalance = await AccountStorage.balanceOf(receiver.accountId);
    const expectedSenderBalance = initialSenderBalance - transferAmount;
    const expectedReceiverBalance = initialReceiverBalance + transferAmount;

    // FAIL --- Cannot use accountId value of 0
    const zeroAccount = 0;
    await shouldRevert(
      AccountStorage.transferInternal(
        zeroAccount,
        receiver.accountId,
        toSafeNumber(transferAmount),
      ),
      'Invalid account',
      'accountId cannot equal 0',
    );

    await shouldRevert(
      AccountStorage.transferInternal(
        sender.accountId,
        zeroAccount,
        toSafeNumber(transferAmount),
      ),
      'Invalid account',
      'accountId cannot equal 0',
    );

    // FAIL --- Cannot use amount value of 0
    const invalidAmount = toBN('0');
    await shouldRevert(
      AccountStorage.transferInternal(
        sender.accountId,
        receiver.accountId,
        toSafeNumber(invalidAmount),
      ),
      'Invalid amount',
      'accountId cannot equal 0',
    );

    // FAIL --- Cannot transfer more than available in sender account
    const moreThanAvailable = toBN('10e3');
    await shouldRevert(
      AccountStorage.transferInternal(
        sender.accountId,
        receiver.accountId,
        toSafeNumber(moreThanAvailable),
      ),
      'Failed transfer',
      'Cannot transfer more than account balance',
    );

    // PASS --- Normal case
    const normalAmount = defaultAmount;
    let currentSenderBalance = await AccountStorage.balanceOf(sender.accountId);
    let currentReceiverBalance = await AccountStorage.balanceOf(receiver.accountId);
    await AccountStorage.transferInternal(
      sender.accountId,
      receiver.accountId,
      toSafeNumber(normalAmount),
    );

    // PASS --- Check if sender/receiver balances adjusted as expected
    currentSenderBalance = await AccountStorage.balanceOf(sender.accountId);
    currentReceiverBalance = await AccountStorage.balanceOf(receiver.accountId);
    assertBN(
      currentSenderBalance,
      expectedSenderBalance,
      'Sender balance not adjusted as expected.',
    );
    assertBN(
      currentReceiverBalance,
      expectedReceiverBalance,
      'Receiver balance not adjusted as expected.',
    );
  });

  it('Check send external', async () => {
    const { sender, receiver } = accounts;
    let transferAmount;
    const initialSenderBalance = await AccountStorage.balanceOf(sender.accountId);
    const initialReceiverBalance = await Token.balanceOf(receiver.address);

    // FAIL --- Cannot use accountId value of 0
    const zeroAccount = 0;
    transferAmount = defaultAmount;
    await shouldRevert(
      AccountStorage.sendExternal(
        zeroAccount,
        receiver.address,
        toSafeNumber(transferAmount),
      ),
      'Invalid account',
      'Input accountId cannot equal 0',
    );

    // FAIL --- Cannot use an invalid receiver address
    const zeroAddress = '0x0000000000000000000000000000000000000000';
    transferAmount = defaultAmount;
    await shouldRevert(
      AccountStorage.sendExternal(
        sender.accountId,
        zeroAddress,
        toSafeNumber(transferAmount),
      ),
      'Zero addr',
      'Receiver address cannot equal address(0)',
    );

    // FAIL --- Cannot use amount value of 0
    transferAmount = toBN('0');
    await shouldRevert(
      AccountStorage.sendExternal(
        sender.accountId,
        receiver.address,
        toSafeNumber(transferAmount),
      ),
      'Invalid amount',
      'Input accountId cannot equal 0',
    );

    // FAIL --- Cannot transfer more than available in sender account
    transferAmount = toBN('10e3');
    await shouldRevert(
      AccountStorage.sendExternal(
        sender.accountId,
        receiver.address,
        toSafeNumber(transferAmount),
      ),
      'Failed transfer',
      'Cannot transfer more than account balance',
    );

    // PASS --- Check that sender and receiver balances are correct after sendExternal()
    transferAmount = defaultAmount;
    const expectedSenderBalance = initialSenderBalance - transferAmount;
    const expectedReceiverBalance = initialReceiverBalance + transferAmount;
    await AccountStorage.sendExternal(
      sender.accountId,
      receiver.address,
      toSafeNumber(transferAmount),
    );

    const currentSenderBalance = await AccountStorage.balanceOf(sender.accountId);
    const currentReceiverBalance = await Token.balanceOf(receiver.address);
    assertBN(
      expectedSenderBalance,
      currentSenderBalance,
      'Sender balance not adjusted as expected.',
    );
    assertBN(
      expectedReceiverBalance,
      currentReceiverBalance,
      'Receive balance not adjusted as expected.',
    );
  });

  it('Check allow external', async () => {
    let transferAmount;

    const { delegate, receiver } = accounts;
    const initialSenderBalance = await AccountStorage.balanceOf(delegate.accountId);
    const initialReceiverBalance = await Token.balanceOf(receiver.address);
    let currentSenderBalance;
    let currentReceiverBalance;

    // FAIL --- Cannot use accountId value of 0
    transferAmount = defaultAmount;
    const zeroAccount = 0;
    await shouldRevert(
      AccountStorage.allowExternal(
        zeroAccount,
        delegate.address,
        toSafeNumber(transferAmount),
      ),
      'Invalid account',
      'Input accountId cannot equal 0',
    );

    // FAIL --- Cannot use an invalid receiver address
    transferAmount = defaultAmount;
    const zeroAddress = '0x0000000000000000000000000000000000000000';
    await shouldRevert(
      AccountStorage.allowExternal(
        delegate.accountId,
        zeroAddress,
        toSafeNumber(transferAmount),
      ),
      'Zero addr',
      'Delegate address cannot equal address(0)',
    );

    // FAIL --- Cannot use amount value of 0
    transferAmount = toBN('0');
    await shouldRevert(
      AccountStorage.allowExternal(
        delegate.accountId,
        delegate.address,
        toSafeNumber(transferAmount),
      ),
      'Invalid amount',
      'Input accountId cannot equal 0',
    );

    // FAIL --- Cannot transfer more than available in sender account
    transferAmount = toBN('10e3');
    await shouldRevert(
      AccountStorage.allowExternal(
        delegate.accountId,
        delegate.address,
        toSafeNumber(transferAmount),
      ),
      'Failed transfer',
      'Cannot transfer more than account balance',
    );

    // PASS --- Check that sender and receiver balances are correct after transferFrom()
    transferAmount = defaultAmount;
    const expectedSenderBalance = initialSenderBalance - transferAmount;
    const expectedReceiverBalance = initialReceiverBalance + transferAmount;
    currentSenderBalance = await AccountStorage.balanceOf(delegate.accountId);
    currentReceiverBalance = await Token.balanceOf(receiver.address);

    await AccountStorage.allowExternal(
      delegate.accountId,
      delegate.address,
      toSafeNumber(transferAmount),
    );

    await Token.transferFrom(
      AccountStorage.address,
      receiver.address,
      toSafeNumber(transferAmount),
      { signer: delegate.signer },
    );

    currentSenderBalance = await AccountStorage.balanceOf(delegate.accountId);
    currentReceiverBalance = await Token.balanceOf(receiver.address);
    assertBN(
      expectedSenderBalance,
      currentSenderBalance,
      'Sender balance not adjusted as expected.',
    );
    assertBN(
      expectedReceiverBalance,
      currentReceiverBalance,
      'Receive balance not adjusted as expected.',
    );
  });

  it('Check receive external', async () => {
    let transferAmount;

    const { sender, receiver } = accounts;
    const initialSenderBalance = await Token.balanceOf(sender.address);
    const initialReceiverBalance = await AccountStorage.balanceOf(receiver.accountId);

    // FAIL --- Cannot use accountId value of 0
    transferAmount = toBN('1e3');
    const zeroAccount = 0;
    await Token.approve(
      AccountStorage.address,
      toSafeNumber(transferAmount),
      { signer: sender.signer },
    );

    await shouldRevert(
      AccountStorage.receiveExternal(
        sender.address,
        zeroAccount,
      ),
      'Invalid account',
      'Input accountId cannot equal 0',
    );

    // FAIL --- Cannot use an invalid receiver address
    transferAmount = defaultAmount;
    const zeroAddress = '0x0000000000000000000000000000000000000000';
    await Token.approve(
      AccountStorage.address,
      toSafeNumber(transferAmount),
      { signer: sender.signer },
    );

    await shouldRevert(
      AccountStorage.receiveExternal(
        zeroAddress,
        receiver.accountId,
      ),
      'Zero addr',
      'Receiver address cannot equal address(0)',
    );

    // PASS --- Check that sender and receiver balances are correct after receiveExternal()
    transferAmount = defaultAmount;
    const expectedSenderBalance = initialSenderBalance - transferAmount;
    const expectedReceiverBalance = initialReceiverBalance + transferAmount;
    await Token.approve(
      AccountStorage.address,
      toSafeNumber(transferAmount),
      { signer: sender.signer },
    );

    await AccountStorage.receiveExternal(
      sender.address,
      receiver.accountId,
    );

    const currentSenderBalance = await Token.balanceOf(sender.address);
    const currentReceiverBalance = await AccountStorage.balanceOf(receiver.accountId);
    assertBN(
      expectedSenderBalance,
      currentSenderBalance,
      'Sender balance not adjusted as expected.',
    );
    assertBN(
      expectedReceiverBalance,
      currentReceiverBalance,
      'Receive balance not adjusted as expected.',
    );
  });
});
