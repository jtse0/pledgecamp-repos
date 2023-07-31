// eslint-disable-next-line one-var-declaration-per-line, no-underscore-dangle
require('events').EventEmitter.prototype._maxListeners = 100;

require('dotenv').config();
const utils = require('pledgecamp-blockchain-utils');
const sinon = require('sinon');
const assert = require('assert');
const transactionModel = require('../server/models/transaction');
const projectModel = require('../server/models/project');
const functions = require('../server/contracts/project');
const queueHandler = require('../server/utils/queueHandler');

describe('Project Functions', () => {
  let flag = false;
  let insertTxStub;
  let insertProjectStub;
  let serializedTransStub;
  let pushObjectStub;

  const txModel = {
    transaction_parent_id: '933',
    transaction_callback: 'https://oracle.localdev.com:8081/projects/966/callback/',
    transaction_serialized:
      // eslint-disable-next-line
      '0xf9012a2c8509502f90008303011594a616319dd543e57cdf4484d35b03c484cca581a580b8c4937dfc2e0000000000000000000000007eca835fb4524c00aae428fca24361ab9e93ed8d0000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000005ffc16dd00000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000225a0d0bcf5c95cdd43c13b2a3b8726e53d84d991f18d6d4b97409e08dff05337927aa05e791095c23c300343ae9cc8aa908e62d4da2eb2fd6fbce43fee9b5baa901dd6',
    transaction_status: '2',
    transaction_type: 'TRANSACTION_TYPE',
    transaction_uuid: '331ba7fc-a9cb-48bf-8fe0-81eaa17b66c1',
    transaction_retry_attempts: '2',
  };

  beforeEach(() => {
    insertTxStub = sinon.stub(transactionModel, 'insert').callsFake();
    insertProjectStub = sinon.stub(projectModel, 'insert').callsFake();
    serializedTransStub = sinon.stub(utils.ethereum, 'getSerializedTrans').callsFake(() => {
      return txModel;
    });
    pushObjectStub = sinon.stub(queueHandler, 'pushObject').callsFake(() => {
      return 'ok';
    });
  });

  it('Should post a project', async () => {
    const transactionType = 'DEPLOY_PROJECT';
    const projectId = 321;
    const activityId = 123;
    const milestone1 = Math.round(Date.now() / 1000, 0) + 10000;
    const milestone2 = milestone1 + 604800;
    const milestoneTimes = [milestone1, milestone2];
    const releasePercents = [50, 50];
    const urlCallback = 'https://oracle.localdev.com:8081/projects/321/callback/PROJECT_DEPLOY';

    flag = false;
    try {
      await functions.deployProject(
        transactionType,
        projectId,
        activityId,
        milestoneTimes,
        releasePercents,
        urlCallback,
      );
      flag = true;
    } catch (error) {
      flag = false;
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Deploy project should fail if milestone times are not in the right format', async () => {
    const transactionType = 'DEPLOY_PROJECT';
    const projectId = 321;
    const activityId = 123;
    const milestoneTimes = 'hello';
    const releasePercents = [50, 50];
    const urlCallback = 'https://oracle.localdev.com:8081/projects/321/callback/PROJECT_DEPLOY';

    flag = false;
    try {
      await functions.deployProject(
        transactionType,
        projectId,
        activityId,
        milestoneTimes,
        releasePercents,
        urlCallback,
      );
      console.log('Project deployment should fail');
    } catch (error) {
      if (error.msg.includes('Parameter is not in the right format: milestoneTimes')) {
        flag = true;
      } else {
        console.log('Got following error instead:');
        console.log(error);
      }
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Deploy project should fail if milestone times array contains incorrect values', async () => {
    const transactionType = 'DEPLOY_PROJECT';
    const projectId = 321;
    const activityId = 123;
    const milestone1 = Math.round(Date.now() / 1000, 0) + 10000;
    const milestoneTimes = [milestone1, 'a34'];
    const releasePercents = [50, 50];
    const urlCallback = 'https://oracle.localdev.com:8081/projects/321/callback/PROJECT_DEPLOY';

    flag = false;
    try {
      await functions.deployProject(
        transactionType,
        projectId,
        activityId,
        milestoneTimes,
        releasePercents,
        urlCallback,
      );
      console.log('Project deployment should fail');
    } catch (error) {
      if (error.msg.includes('Parameter is not in the right format: milestoneTimes')) {
        flag = true;
      } else {
        console.log('Got following error instead:');
        console.log(error);
      }
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Deploy project should fail if milestone times array contains incorrect values', async () => {
    const transactionType = 'DEPLOY_PROJECT';
    const projectId = 321;
    const activityId = 123;
    const milestone1 = Math.round(Date.now() / 1000, 0) - 10000;
    const milestone2 = Math.round(Date.now() / 1000, 0) + 10000;
    const milestoneTimes = [milestone1, milestone2];
    const releasePercents = [50, 50];
    const urlCallback = 'https://oracle.localdev.com:8081/projects/321/callback/PROJECT_DEPLOY';

    flag = false;
    try {
      await functions.deployProject(
        transactionType,
        projectId,
        activityId,
        milestoneTimes,
        releasePercents,
        urlCallback,
      );
      console.log('Project deployment should fail');
    } catch (error) {
      if (error.msg.includes('Milestone cannot be in the past')) {
        flag = true;
      } else {
        console.log('Got following error instead:');
        console.log(error);
      }
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Deploy project should fail if milestone interval is under minimum', async () => {
    const transactionType = 'DEPLOY_PROJECT';
    const projectId = 321;
    const activityId = 123;
    const milestone1 = Math.round(Date.now() / 1000, 0) + 10000;
    const milestone2 = milestone1 + 604799;
    const milestoneTimes = [milestone1, milestone2];
    const releasePercents = [50, 50];
    const urlCallback = 'https://oracle.localdev.com:8081/projects/321/callback/PROJECT_DEPLOY';

    flag = false;
    try {
      await functions.deployProject(
        transactionType,
        projectId,
        activityId,
        milestoneTimes,
        releasePercents,
        urlCallback,
      );
      console.log('Project deployment should fail');
    } catch (error) {
      if (error.msg.includes('Milestone Interval not large enough.')) {
        flag = true;
      } else {
        console.log('Got following error instead:');
        console.log(error);
      }
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Deploy project should fail if milestone interval exceeds max', async () => {
    const transactionType = 'DEPLOY_PROJECT';
    const projectId = 321;
    const activityId = 123;
    const milestone1 = Math.round(Date.now() / 1000, 0) + 10000;
    const milestone2 = milestone1 + 157680001;
    const milestoneTimes = [milestone1, milestone2];
    const releasePercents = [50, 50];
    const urlCallback = 'https://oracle.localdev.com:8081/projects/321/callback/PROJECT_DEPLOY';

    flag = false;
    try {
      await functions.deployProject(
        transactionType,
        projectId,
        activityId,
        milestoneTimes,
        releasePercents,
        urlCallback,
      );
      console.log('Project deployment should fail');
    } catch (error) {
      if (error.msg.includes('Milestone Interval too large.')) {
        flag = true;
      } else {
        console.log('Got following error instead:');
        console.log(error);
      }
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Deploy project should fail if releasePercents are not in the right format', async () => {
    const transactionType = 'DEPLOY_PROJECT';
    const projectId = 321;
    const activityId = 123;
    const milestone1 = Math.round(Date.now() / 1000, 0) + 10000;
    const milestone2 = milestone1 + 604800;
    const milestoneTimes = [milestone1, milestone2];
    const releasePercents = 'bye';
    const urlCallback = 'https://oracle.localdev.com:8081/projects/321/callback/PROJECT_DEPLOY';

    flag = false;
    try {
      await functions.deployProject(
        transactionType,
        projectId,
        activityId,
        milestoneTimes,
        releasePercents,
        urlCallback,
      );
      console.log('Project deployment should fail');
    } catch (error) {
      if (error.msg.includes('Parameter is not in the right format: releasePercents')) {
        flag = true;
      } else {
        console.log('Got following error instead:');
        console.log(error);
      }
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Deploy project should fail if releasePercents array contains incorrect values', async () => {
    const transactionType = 'DEPLOY_PROJECT';
    const projectId = 321;
    const activityId = 123;
    const milestone1 = Math.round(Date.now() / 1000, 0) + 10000;
    const milestone2 = milestone1 + 604800;
    const milestoneTimes = [milestone1, milestone2];
    const releasePercents = [50, 'abc'];
    const urlCallback = 'https://oracle.localdev.com:8081/projects/321/callback/PROJECT_DEPLOY';

    flag = false;
    try {
      await functions.deployProject(
        transactionType,
        projectId,
        activityId,
        milestoneTimes,
        releasePercents,
        urlCallback,
      );
      console.log('Project deployment should fail');
    } catch (error) {
      if (error.msg.includes('Parameter is not in the right format: releasePercents')) {
        flag = true;
      } else {
        console.log('Got following error instead:');
        console.log(error);
      }
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Deploy project should fail if releasePercents array values do not add up to 100', async () => {
    const transactionType = 'DEPLOY_PROJECT';
    const projectId = 321;
    const activityId = 123;
    const milestone1 = Math.round(Date.now() / 1000, 0) + 10000;
    const milestone2 = milestone1 + 604800;
    const milestoneTimes = [milestone1, milestone2];
    const releasePercents = [50, 30];
    const urlCallback = 'https://oracle.localdev.com:8081/projects/321/callback/PROJECT_DEPLOY';

    flag = false;
    try {
      await functions.deployProject(
        transactionType,
        projectId,
        activityId,
        milestoneTimes,
        releasePercents,
        urlCallback,
      );
      console.log('Project deployment should fail');
    } catch (error) {
      if (error.msg.includes('Release percentages should add up to 100')) {
        flag = true;
      } else {
        console.log('Got following error instead:');
        console.log(error);
      }
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Deploy project should fail if releasePercents array values add up to over 100', async () => {
    const transactionType = 'DEPLOY_PROJECT';
    const projectId = 321;
    const activityId = 123;
    const milestone1 = Math.round(Date.now() / 1000, 0) + 10000;
    const milestone2 = milestone1 + 604800;
    const milestoneTimes = [milestone1, milestone2];
    const releasePercents = [50, 310];
    const urlCallback = 'https://oracle.localdev.com:8081/projects/321/callback/PROJECT_DEPLOY';

    flag = false;
    try {
      await functions.deployProject(
        transactionType,
        projectId,
        activityId,
        milestoneTimes,
        releasePercents,
        urlCallback,
      );
      console.log('Project deployment should fail');
    } catch (error) {
      if (error.msg.includes('Release percentages should add up to 100')) {
        flag = true;
      } else {
        console.log('Got following error instead:');
        console.log(error);
      }
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Should be able to set backers', async () => {
    const transactionType = 'SET_BACKERS';
    const beneficiaries = [1, 2, 3];
    const amounts = [100, 200, 300];
    const fundingComplete = true;
    const totalAmount = 600;
    const contractAddress = '0x1807f24cd3bc08cab1426b9703dfd31b9a9527a2';
    const activityId = 123;
    const urlCallback = 'https://oracle.localdev.com:8081/projects/321/callback/SET_BACKERS';

    flag = false;
    try {
      await functions.setBackersExternal(
        transactionType,
        beneficiaries,
        amounts,
        fundingComplete,
        totalAmount,
        contractAddress,
        activityId,
        urlCallback,
      );
      flag = true;
    } catch (error) {
      flag = false;
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Set backers should fail if beneficiaries are in the wrong format', async () => {
    const transactionType = 'SET_BACKERS';
    const beneficiaries = 123;
    const amounts = [100, 200, 300];
    const fundingComplete = true;
    const totalAmount = 600;
    const contractAddress = '0x1807f24cd3bc08cab1426b9703dfd31b9a9527a2';
    const activityId = 123;
    const urlCallback = 'https://oracle.localdev.com:8081/projects/321/callback/SET_BACKERS';

    flag = false;
    try {
      await functions.setBackersExternal(
        transactionType,
        beneficiaries,
        amounts,
        fundingComplete,
        totalAmount,
        contractAddress,
        activityId,
        urlCallback,
      );
      console.log('Set backers should fail');
    } catch (error) {
      if (error.msg.includes('Parameter is not in the right format: beneficiaries')) {
        flag = true;
      } else {
        console.log('Got following error instead:');
        console.log(error);
      }
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Set backers should fail if beneficiaries array has incorrect values', async () => {
    const transactionType = 'SET_BACKERS';
    const beneficiaries = ['abc', 'def', 'ghi'];
    const amounts = [100, 200, 300];
    const fundingComplete = true;
    const totalAmount = 600;
    const contractAddress = '0x1807f24cd3bc08cab1426b9703dfd31b9a9527a2';
    const activityId = 123;
    const urlCallback = 'https://oracle.localdev.com:8081/projects/321/callback/SET_BACKERS';

    flag = false;
    try {
      await functions.setBackersExternal(
        transactionType,
        beneficiaries,
        amounts,
        fundingComplete,
        totalAmount,
        contractAddress,
        activityId,
        urlCallback,
      );
      console.log('Set backers should fail');
    } catch (error) {
      if (error.msg.includes('Parameter is not in the right format: beneficiaries')) {
        flag = true;
      } else {
        console.log('Got following error instead:');
        console.log(error);
      }
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Set backers should fail if amounts are in the wrong format', async () => {
    const transactionType = 'SET_BACKERS';
    const beneficiaries = [1, 2, 3];
    const amounts = 'amounts';
    const fundingComplete = true;
    const totalAmount = 600;
    const contractAddress = '0x1807f24cd3bc08cab1426b9703dfd31b9a9527a2';
    const activityId = 123;
    const urlCallback = 'https://oracle.localdev.com:8081/projects/321/callback/SET_BACKERS';

    flag = false;
    try {
      await functions.setBackersExternal(
        transactionType,
        beneficiaries,
        amounts,
        fundingComplete,
        totalAmount,
        contractAddress,
        activityId,
        urlCallback,
      );
      console.log('Set backers should fail');
    } catch (error) {
      if (error.msg.includes('Parameter is not in the right format: amounts')) {
        flag = true;
      } else {
        console.log('Got following error instead:');
        console.log(error);
      }
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Set backers should fail if amounts array has incorrect values', async () => {
    const transactionType = 'SET_BACKERS';
    const beneficiaries = [1, 2, 3];
    const amounts = ['abc', 'def', 'ghi'];
    const fundingComplete = true;
    const totalAmount = 600;
    const contractAddress = '0x1807f24cd3bc08cab1426b9703dfd31b9a9527a2';
    const activityId = 123;
    const urlCallback = 'https://oracle.localdev.com:8081/projects/321/callback/SET_BACKERS';

    flag = false;
    try {
      await functions.setBackersExternal(
        transactionType,
        beneficiaries,
        amounts,
        fundingComplete,
        totalAmount,
        contractAddress,
        activityId,
        urlCallback,
      );
      console.log('Set backers should fail');
    } catch (error) {
      if (error.msg.includes('Parameter is not in the right format: amounts')) {
        flag = true;
      } else {
        console.log('Got following error instead:');
        console.log(error);
      }
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Set backers should fail if fundingComplete is in the wrong format', async () => {
    const transactionType = 'SET_BACKERS';
    const beneficiaries = [1, 2, 3];
    const amounts = [100, 200, 300];
    const fundingComplete = '0x203ruf9ijewfj';
    const totalAmount = 600;
    const contractAddress = '0x1807f24cd3bc08cab1426b9703dfd31b9a9527a2';
    const activityId = 123;
    const urlCallback = 'https://oracle.localdev.com:8081/projects/321/callback/SET_BACKERS';

    flag = false;
    try {
      await functions.setBackersExternal(
        transactionType,
        beneficiaries,
        amounts,
        fundingComplete,
        totalAmount,
        contractAddress,
        activityId,
        urlCallback,
      );
      console.log('Set backers should fail');
    } catch (error) {
      if (error.msg.includes('Parameter is not in the right format: fundingComplete')) {
        flag = true;
      } else {
        console.log('Got following error instead:');
        console.log(error);
      }
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Set backers should fail if totalAmount is in the wrong format', async () => {
    const transactionType = 'SET_BACKERS';
    const beneficiaries = [1, 2, 3];
    const amounts = [100, 200, 300];
    const fundingComplete = true;
    const totalAmount = [600];
    const contractAddress = '0x1807f24cd3bc08cab1426b9703dfd31b9a9527a2';
    const activityId = 123;
    const urlCallback = 'https://oracle.localdev.com:8081/projects/321/callback/SET_BACKERS';

    flag = false;
    try {
      await functions.setBackersExternal(
        transactionType,
        beneficiaries,
        amounts,
        fundingComplete,
        totalAmount,
        contractAddress,
        activityId,
        urlCallback,
      );
      console.log('Set backers should fail');
    } catch (error) {
      if (error.msg.includes('An error occurred with the ABI encoding process')) {
        flag = true;
      } else {
        console.log('Got following error instead:');
        console.log(error);
      }
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Set backers should fail if contractAddress is incorrect', async () => {
    const transactionType = 'SET_BACKERS';
    const beneficiaries = [1, 2, 3];
    const amounts = [100, 200, 300];
    const fundingComplete = true;
    const totalAmount = 600;
    const contractAddress = '0x1807f24cd3bc08';
    const activityId = 123;
    const urlCallback = 'https://oracle.localdev.com:8081/projects/321/callback/SET_BACKERS';

    flag = false;
    try {
      await functions.setBackersExternal(
        transactionType,
        beneficiaries,
        amounts,
        fundingComplete,
        totalAmount,
        contractAddress,
        activityId,
        urlCallback,
      );
      console.log('Set backers should fail');
    } catch (error) {
      if (error.msg.includes('Invalid address format')) {
        flag = true;
      } else {
        console.log('Got following error instead:');
        console.log(error);
      }
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Set backers should fail if contractAddress is in the wrong format', async () => {
    const transactionType = 'SET_BACKERS';
    const beneficiaries = [1, 2, 3];
    const amounts = [100, 200, 300];
    const fundingComplete = true;
    const totalAmount = 600;
    const contractAddress = 'word';
    const activityId = 123;
    const urlCallback = 'https://oracle.localdev.com:8081/projects/321/callback/SET_BACKERS';

    flag = false;
    try {
      await functions.setBackersExternal(
        transactionType,
        beneficiaries,
        amounts,
        fundingComplete,
        totalAmount,
        contractAddress,
        activityId,
        urlCallback,
      );
      console.log('Set backers should fail');
    } catch (error) {
      if (error.msg.includes('Invalid address format')) {
        flag = true;
      } else {
        console.log('Got following error instead:');
        console.log(error);
      }
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Submits milestone vote', async () => {
    const transactionType = 'MILESTONE_VOTE';
    const contractAddress = '0x1807f24cd3bc08cab1426b9703dfd31b9a9527a2';
    const userId = 321;
    const vote = true;
    const activityId = 123;
    const urlCallback = 'https://oracle.localdev.com:8081/projects/321/callback/MILESTONE_VOTE';

    try {
      await functions.milestoneVote(transactionType, contractAddress, userId, vote, activityId, urlCallback);
      flag = true;
    } catch (error) {
      console.log(error);
      flag = false;
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Milestone vote should fail if contract address is incorrect', async () => {
    const transactionType = 'MILESTONE_VOTE';
    const contractAddress = '0x1807f24cd3b';
    const userId = 321;
    const vote = true;
    const activityId = 123;
    const urlCallback = 'https://oracle.localdev.com:8081/projects/321/callback/MILESTONE_VOTE';

    flag = false;
    try {
      await functions.milestoneVote(transactionType, contractAddress, userId, vote, activityId, urlCallback);
      console.log('Milestone vote should fail');
    } catch (error) {
      if (error.msg.includes('Invalid address format')) {
        flag = true;
      } else {
        console.log('Got following error instead:');
        console.log(error);
      }
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Milestone vote should fail if contract address is in the wrong format', async () => {
    const transactionType = 'MILESTONE_VOTE';
    const contractAddress = 321;
    const userId = 321;
    const vote = true;
    const activityId = 123;
    const urlCallback = 'https://oracle.localdev.com:8081/projects/321/callback/MILESTONE_VOTE';

    flag = false;
    try {
      await functions.milestoneVote(transactionType, contractAddress, userId, vote, activityId, urlCallback);
      console.log('Milestone vote should fail');
    } catch (error) {
      if (error.msg.includes('Invalid address format')) {
        flag = true;
      } else {
        console.log('Got following error instead:');
        console.log(error);
      }
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Milestone vote should fail if userId is in the wrong format', async () => {
    const transactionType = 'MILESTONE_VOTE';
    const contractAddress = '0x1807f24cd3bc08cab1426b9703dfd31b9a9527a2';
    const userId = 'sfdsfsfs';
    const vote = true;
    const activityId = 123;
    const urlCallback = 'https://oracle.localdev.com:8081/projects/321/callback/MILESTONE_VOTE';

    flag = false;
    try {
      await functions.milestoneVote(transactionType, contractAddress, userId, vote, activityId, urlCallback);
      console.log('Milestone vote should fail');
    } catch (error) {
      if (error.msg.includes('An error occurred with the ABI encoding process.')) {
        flag = true;
      } else {
        console.log('Got following error instead:');
        console.log(error);
      }
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Milestone vote should fail if vote is in the wrong format', async () => {
    const transactionType = 'MILESTONE_VOTE';
    const contractAddress = '0x1807f24cd3bc08cab1426b9703dfd31b9a9527a2';
    const userId = 321;
    const vote = '0xfjwepmwep';
    const activityId = 123;
    const urlCallback = 'https://oracle.localdev.com:8081/projects/321/callback/MILESTONE_VOTE';

    flag = false;
    try {
      await functions.milestoneVote(transactionType, contractAddress, userId, vote, activityId, urlCallback);

      console.log('Milestone vote should fail');
    } catch (error) {
      if (error.msg.includes('Parameter is not in the right format: vote')) {
        flag = true;
      } else {
        console.log('Got following error instead:');
        console.log(error);
      }
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Milestone vote should fail if vote is in the wrong format', async () => {
    const transactionType = 'MILESTONE_VOTE';
    const contractAddress = '0x1807f24cd3bc08cab1426b9703dfd31b9a9527a2';
    const userId = 321;
    const vote = 123234;
    const activityId = 123;
    const urlCallback = 'https://oracle.localdev.com:8081/projects/321/callback/MILESTONE_VOTE';

    flag = false;
    try {
      await functions.milestoneVote(transactionType, contractAddress, userId, vote, activityId, urlCallback);
      console.log('Milestone vote should fail');
    } catch (error) {
      if (error.msg.includes('Parameter is not in the right format: vote')) {
        flag = true;
      } else {
        console.log('Got following error instead:');
        console.log(error);
      }
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Submits moderation votes', async () => {
    const transactionType = 'MODERATION_VOTE';
    const contractAddress = '0x1807f24cd3bc08cab1426b9703dfd31b9a9527a2';
    const userId = 321;
    const encryptedVote = '0x6ba79b6be13a20011b8f5bceca9feaabcd8995cb51d0e0b448a0006123afaafc';
    const activityId = 123;
    const urlCallback = 'https://oracle.localdev.com:8081/projects/321/callback/MODERATION_VOTE';

    try {
      await functions.cancelVote(transactionType, contractAddress, userId, encryptedVote, activityId, urlCallback);
      flag = true;
    } catch (error) {
      console.log(error);
      flag = false;
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Moderation vote should fail if contract address is incorrect', async () => {
    const transactionType = 'MODERATION_VOTE';
    const contractAddress = '0x1807f24cd3b';
    const userId = 321;
    const encryptedVote = '0x6ba79b6be13a20011b8f5bceca9feaabcd8995cb51d0e0b448a0006123afaafc';
    const activityId = 123;
    const urlCallback = 'https://oracle.localdev.com:8081/projects/321/callback/MODERATION_VOTE';

    flag = false;
    try {
      await functions.cancelVote(transactionType, contractAddress, userId, encryptedVote, activityId, urlCallback);
      console.log('Moderation vote should fail');
    } catch (error) {
      if (error.msg.includes('Invalid address format')) {
        flag = true;
      } else {
        console.log('Got following error instead:');
        console.log(error);
      }
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Moderation vote should fail if contract address is in the wrong format', async () => {
    const transactionType = 'MODERATION_VOTE';
    const contractAddress = 321;
    const userId = 321;
    const encryptedVote = '0x6ba79b6be13a20011b8f5bceca9feaabcd8995cb51d0e0b448a0006123afaafc';
    const activityId = 123;
    const urlCallback = 'https://oracle.localdev.com:8081/projects/321/callback/MODERATION_VOTE';

    flag = false;
    try {
      await functions.cancelVote(transactionType, contractAddress, userId, encryptedVote, activityId, urlCallback);
      console.log('Moderation vote should fail');
    } catch (error) {
      if (error.msg.includes('Invalid address format')) {
        flag = true;
      } else {
        console.log('Got following error instead:');
        console.log(error);
      }
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Moderation vote should fail if userId is in the wrong format', async () => {
    const transactionType = 'MODERATION_VOTE';
    const contractAddress = '0x1807f24cd3bc08cab1426b9703dfd31b9a9527a2';
    const userId = 'sfdsfsfs';
    const encryptedVote = '0x6ba79b6be13a20011b8f5bceca9feaabcd8995cb51d0e0b448a0006123afaafc';
    const activityId = 123;
    const urlCallback = 'https://oracle.localdev.com:8081/projects/321/callback/MODERATION_VOTE';

    flag = false;
    try {
      await functions.cancelVote(transactionType, contractAddress, userId, encryptedVote, activityId, urlCallback);
      console.log('Moderation vote should fail');
    } catch (error) {
      if (error.msg.includes('An error occurred with the ABI encoding process')) {
        flag = true;
      } else {
        console.log('Got following error instead:');
        console.log(error);
      }
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Moderation vote should fail if vote is in the wrong format', async () => {
    const transactionType = 'MODERATION_VOTE';
    const contractAddress = '0x1807f24cd3bc08cab1426b9703dfd31b9a9527a2';
    const userId = 321;
    const encryptedVote = 'ceca9feaabcd8995cb51d0e0b448a0006123afaafc';
    const activityId = 123;
    const urlCallback = 'https://oracle.localdev.com:8081/projects/321/callback/MODERATION_VOTE';

    flag = false;
    try {
      await functions.cancelVote(transactionType, contractAddress, userId, encryptedVote, activityId, urlCallback);
      console.log('Moderation vote should fail');
    } catch (error) {
      if (error.msg.includes('An error occurred with the ABI encoding process')) {
        flag = true;
      } else {
        console.log('Got following error instead:');
        console.log(error);
      }
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Stakes PLG Tokens', async () => {
    const transactionType = 'STAKE_PLG';
    const userId = 321;
    const amount = 100;
    const activityId = 123;
    const urlCallback = 'https://oracle.localdev.com:8081/projects/321/callback/STAKE_PLG';

    try {
      await functions.stakePLG(transactionType, userId, amount, activityId, urlCallback);
      flag = true;
    } catch (error) {
      console.log(error);
      flag = false;
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Stake token fails if userId is in the wrong format', async () => {
    const transactionType = 'STAKE_PLG';
    const userId = 'abc';
    const amount = 100;
    const activityId = 123;
    const urlCallback = 'https://oracle.localdev.com:8081/projects/321/callback/STAKE_PLG';

    flag = false;
    try {
      await functions.stakePLG(transactionType, userId, amount, activityId, urlCallback);
      console.log('Stake tokens should fail');
    } catch (error) {
      if (error.msg.includes('An error occurred with the ABI encoding process')) {
        flag = true;
      } else {
        console.log('Got following error instead:');
        console.log(error);
      }
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Stake token fails if amount is in the wrong format', async () => {
    const transactionType = 'STAKE_PLG';
    const userId = 123;
    const amount = 'hello';
    const activityId = 123;
    const urlCallback = 'https://oracle.localdev.com:8081/projects/321/callback/STAKE_PLG';

    flag = false;
    try {
      await functions.stakePLG(transactionType, userId, amount, activityId, urlCallback);
      console.log('Stake tokens should fail');
    } catch (error) {
      if (error.msg.includes('An error occurred with the ABI encoding process')) {
        flag = true;
      } else {
        console.log('Got following error instead:');
        console.log(error);
      }
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Unstakes PLG Tokens', async () => {
    const transactionType = 'UNSTAKE_PLG';
    const userId = 321;
    const activityId = 123;
    const urlCallback = 'https://oracle.localdev.com:8081/projects/321/callback/UNSTAKE_PLG';

    try {
      await functions.unstakePLG(transactionType, userId, activityId, urlCallback);
      flag = true;
    } catch (error) {
      console.log(error);
      flag = false;
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Unstake token fails if userId is in the wrong format', async () => {
    const transactionType = 'UNSTAKE_PLG';
    const userId = 'abc';
    const activityId = 123;
    const urlCallback = 'https://oracle.localdev.com:8081/projects/321/callback/UNSTAKE_PLG';

    flag = false;
    try {
      await functions.unstakePLG(transactionType, userId, activityId, urlCallback);
      console.log('Unstake tokens should fail');
    } catch (error) {
      if (error.msg.includes('An error occurred with the ABI encoding process')) {
        flag = true;
      } else {
        console.log('Got following error instead:');
        console.log(error);
      }
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Withdraw interest in PLG', async () => {
    const transactionType = 'WITHDRAW_INTEREST';
    const userId = 321;
    const activityId = 123;
    const urlCallback = 'https://oracle.localdev.com:8081/projects/321/callback/WITHDRAW INTEREST';

    flag = false;
    try {
      await functions.withdrawInterest(transactionType, userId, activityId, urlCallback);
      flag = true;
    } catch (error) {
      if (error.msg.includes('Invalid address format')) {
        flag = true;
      } else {
        console.log('Got following error instead:');
        console.log(error);
      }
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Withdraw interest fails if userId is in the wrong format', async () => {
    const transactionType = 'WITHDRAW_INTEREST';
    const userId = 'hello';
    const activityId = 123;
    const urlCallback = 'https://oracle.localdev.com:8081/projects/321/callback/WITHDRAW_INTEREST';

    flag = false;
    try {
      await functions.withdrawInterest(transactionType, userId, activityId, urlCallback);
      console.log('Withdraw interest should fail');
    } catch (error) {
      if (error.msg.includes('An error occurred with the ABI encoding process.')) {
        flag = true;
      } else {
        console.log('Got following error instead:');
        console.log(error);
      }
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Reinvests accrued interest', async () => {
    const transactionType = 'REINVEST_PLG';
    const userId = 321;
    const activityId = 123;
    const urlCallback = 'https://oracle.localdev.com:8081/projects/321/callback/REINVEST_PLG';

    try {
      await functions.reinvestPLG(transactionType, userId, activityId, urlCallback);
      flag = true;
    } catch (error) {
      console.log(error);
      flag = false;
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Reinvest PLG fails if userId is in the wrong format', async () => {
    const transactionType = 'REINVEST_PLG';
    const userId = 'hello';
    const activityId = 123;
    const urlCallback = 'https://oracle.localdev.com:8081/projects/321/callback/REINVEST_PLG';

    flag = false;
    try {
      await functions.reinvestPLG(transactionType, userId, activityId, urlCallback);
      console.log('Reinvest PLG should fail');
    } catch (error) {
      if (error.msg.includes('An error occurred with the ABI encoding process.')) {
        flag = true;
      } else {
        console.log('Got following error instead:');
        console.log(error);
      }
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Posts interest', async () => {
    const transactionType = 'POST_INTEREST';
    const userId = 321;
    const activityId = 123;
    const urlCallback = 'https://oracle.localdev.com:8081/projects/321/callback/POST_INTEREST';

    try {
      await functions.postInterest(transactionType, userId, activityId, urlCallback);
      flag = true;
    } catch (error) {
      console.log(error);
      flag = false;
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Post interest fails if userId is in the wrong format', async () => {
    const transactionType = 'POST_INTEREST';
    const amount = 'hello';
    const activityId = 123;
    const urlCallback = 'https://oracle.localdev.com:8081/projects/321/callback/POST_INTEREST';

    flag = false;
    try {
      await functions.postInterest(transactionType, amount, activityId, urlCallback);
      console.log('Post interest should fail');
    } catch (error) {
      if (error.msg.includes('An error occurred with the ABI encoding process.')) {
        flag = true;
      } else {
        console.log('Got following error instead:');
        console.log(error);
      }
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Sets project moderators', async () => {
    const transactionType = 'START_MODERATION';
    const contractAddress = '0x1807f24cd3bc08cab1426b9703dfd31b9a9527a2';
    const moderators = [1, 2, 3];
    const moderationEndTime = 2694649106;
    const activityId = 123;
    const urlCallback = 'https://oracle.localdev.com:8081/projects/321/callback/START_MODERATION';

    try {
      await functions.setProjectModerators(
        transactionType,
        contractAddress,
        moderators,
        moderationEndTime,
        activityId,
        urlCallback,
      );
      flag = true;
    } catch (error) {
      console.log(error);
      flag = false;
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Setting moderators should fail if contract address is incorrect', async () => {
    const transactionType = 'START_MODERATION';
    const contractAddress = '0x1807f24cd3bc08cab';
    const moderators = [1, 2, 3];
    const moderationEndTime = 2694649106;
    const activityId = 123;
    const urlCallback = 'https://oracle.localdev.com:8081/projects/321/callback/START_MODERATION';

    flag = false;
    try {
      await functions.setProjectModerators(
        transactionType,
        contractAddress,
        moderators,
        moderationEndTime,
        activityId,
        urlCallback,
      );
      console.log('Set moderators should fail');
    } catch (error) {
      if (error.msg.includes('Invalid address format')) {
        flag = true;
      } else {
        console.log('Got following error instead:');
        console.log(error);
      }
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Setting moderators should fail if contract address is in the wrong format', async () => {
    const transactionType = 'START_MODERATION';
    const contractAddress = 12323211;
    const moderators = [1, 2, 3];
    const moderationEndTime = 2694649106;
    const activityId = 123;
    const urlCallback = 'https://oracle.localdev.com:8081/projects/321/callback/START_MODERATION';

    flag = false;
    try {
      await functions.setProjectModerators(
        transactionType,
        contractAddress,
        moderators,
        moderationEndTime,
        activityId,
        urlCallback,
      );
      console.log('Set moderators should fail');
    } catch (error) {
      if (error.msg.includes('Invalid address format')) {
        flag = true;
      } else {
        console.log('Got following error instead:');
        console.log(error);
      }
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Setting moderators should fail if moderators is in the wrong format', async () => {
    const transactionType = 'START_MODERATION';
    const contractAddress = '0x1807f24cd3bc08cab1426b9703dfd31b9a9527a2';
    const moderators = 'cool';
    const moderationEndTime = 2694649106;
    const activityId = 123;
    const urlCallback = 'https://oracle.localdev.com:8081/projects/321/callback/START_MODERATION';

    flag = false;
    try {
      await functions.setProjectModerators(
        transactionType,
        contractAddress,
        moderators,
        moderationEndTime,
        activityId,
        urlCallback,
      );
      console.log('Set moderators should fail');
    } catch (error) {
      if (error.msg.includes('Parameter is not in the right format: moderators')) {
        flag = true;
      } else {
        console.log('Got following error instead:');
        console.log(error);
      }
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Setting moderators should fail if moderators array contains incorrect values', async () => {
    const transactionType = 'START_MODERATION';
    const contractAddress = '0x1807f24cd3bc08cab1426b9703dfd31b9a9527a2';
    const moderators = ['cool', 'lol', 'amazing'];
    const moderationEndTime = 2694649106;
    const activityId = 123;
    const urlCallback = 'https://oracle.localdev.com:8081/projects/321/callback/START_MODERATION';

    flag = false;
    try {
      await functions.setProjectModerators(
        transactionType,
        contractAddress,
        moderators,
        moderationEndTime,
        activityId,
        urlCallback,
      );
      console.log('Set moderators should fail');
    } catch (error) {
      if (error.msg.includes('Parameter is not in the right format: moderators')) {
        flag = true;
      } else {
        console.log('Got following error instead:');
        console.log(error);
      }
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Setting moderators should fail if moderationEndTime is in the wrong format', async () => {
    const transactionType = 'START_MODERATION';
    const contractAddress = '0x1807f24cd3bc08cab1426b9703dfd31b9a9527a2';
    const moderators = [1, 2, 3];
    const moderationEndTime = 'program';
    const activityId = 123;
    const urlCallback = 'https://oracle.localdev.com:8081/projects/321/callback/START_MODERATION';

    flag = false;
    try {
      await functions.setProjectModerators(
        transactionType,
        contractAddress,
        moderators,
        moderationEndTime,
        activityId,
        urlCallback,
      );
      console.log('Set moderators should fail');
    } catch (error) {
      if (error.msg.includes('An error occurred with the ABI encoding process')) {
        flag = true;
      } else {
        console.log('Got following error instead:');
        console.log(error);
      }
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Cancels project', async () => {
    const transactionType = 'CANCEL_PROJECT';
    const contractAddress = '0x1807f24cd3bc08cab1426b9703dfd31b9a9527a2';
    const activityId = 123;
    const urlCallback = 'https://oracle.localdev.com:8081/projects/321/callback/CANCEL_PROJECT';

    try {
      await functions.cancelProject(transactionType, contractAddress, activityId, urlCallback);
      flag = true;
    } catch (error) {
      console.log(error);
      flag = false;
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Cancel project should fail if contract address is incorrect', async () => {
    const transactionType = 'CANCEL_PROJECT';
    const contractAddress = '0x1807f24cd3bc08';
    const activityId = 123;
    const urlCallback = 'https://oracle.localdev.com:8081/projects/321/callback/CANCEL_PROJECT';

    flag = false;
    try {
      await functions.cancelProject(transactionType, contractAddress, activityId, urlCallback);
      console.log('Cancel project should fail');
    } catch (error) {
      if (error.msg.includes('Invalid address format')) {
        flag = true;
      } else {
        console.log('Got following error instead:');
        console.log(error);
      }
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Cancel project should fail if contract address is in the wrong format', async () => {
    const transactionType = 'CANCEL_PROJECT';
    const contractAddress = 3423242;
    const activityId = 123;
    const urlCallback = 'https://oracle.localdev.com:8081/projects/321/callback/CANCEL_PROJECT';

    flag = false;
    try {
      await functions.cancelProject(transactionType, contractAddress, activityId, urlCallback);
      console.log('Cancel project should fail');
    } catch (error) {
      if (error.msg.includes('Invalid address format')) {
        flag = true;
      } else {
        console.log('Got following error instead:');
        console.log(error);
      }
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Check milestones', async () => {
    const transactionType = 'CHECK_MILESTONES';
    const contractAddress = '0x1807f24cd3bc08cab1426b9703dfd31b9a9527a2';
    const activityId = 123;
    const urlCallback = 'https://oracle.localdev.com:8081/projects/321/callback/CHECK_MILESTONES';

    try {
      await functions.checkMilestones(transactionType, contractAddress, activityId, urlCallback);
      flag = true;
    } catch (error) {
      flag = false;
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Check milestones should fail if contract address is incorrect', async () => {
    const transactionType = 'CHECK_MILESTONES';
    const contractAddress = '0x1807f24cd3bc';
    const activityId = 123;
    const urlCallback = 'https://oracle.localdev.com:8081/projects/321/callback/CHECK_MILESTONES';

    flag = false;
    try {
      await functions.checkMilestones(transactionType, contractAddress, activityId, urlCallback);
      console.log('Check milestones should fail');
    } catch (error) {
      if (error.msg.includes('Invalid address format')) {
        flag = true;
      } else {
        console.log('Got following error instead:');
        console.log(error);
      }
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Check milestones should fail if contract address is in the wrong format', async () => {
    const transactionType = 'CHECK_MILESTONES';
    const contractAddress = 34423;
    const activityId = 123;
    const urlCallback = 'https://oracle.localdev.com:8081/projects/321/callback/CHECK_MILESTONES';

    flag = false;
    try {
      await functions.checkMilestones(transactionType, contractAddress, activityId, urlCallback);
      console.log('Check milestones should fail');
    } catch (error) {
      if (error.msg.includes('Invalid address format')) {
        flag = true;
      } else {
        console.log('Got following error instead:');
        console.log(error);
      }
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Requests refund', async () => {
    const transactionType = 'REQUEST_REFUND';
    const contractAddress = '0x1807f24cd3bc08cab1426b9703dfd31b9a9527a2';
    const userId = 321;
    const activityId = 123;
    const urlCallback = 'https://oracle.localdev.com:8081/projects/321/callback/REQUEST_REFUND';

    try {
      await functions.requestRefund(transactionType, contractAddress, userId, activityId, urlCallback);
      flag = true;
    } catch (error) {
      flag = false;
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Request refund should fail if contract address is incorrect', async () => {
    const transactionType = 'REQUEST_REFUND';
    const contractAddress = '0x1807f24cd3bc';
    const userId = 321;
    const activityId = 123;
    const urlCallback = 'https://oracle.localdev.com:8081/projects/321/callback/REQUEST_REFUND';

    flag = false;
    try {
      await functions.requestRefund(transactionType, contractAddress, userId, activityId, urlCallback);
      console.log('Request refund should fail');
    } catch (error) {
      if (error.msg.includes('Invalid address format')) {
        flag = true;
      } else {
        console.log('Got following error instead:');
        console.log(error);
      }
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Request refund should fail if contract address is in the wrong format', async () => {
    const transactionType = 'REQUEST_REFUND';
    const contractAddress = 45343;
    const userId = 321;
    const activityId = 123;
    const urlCallback = 'https://oracle.localdev.com:8081/projects/321/callback/REQUEST_REFUND';

    flag = false;
    try {
      await functions.requestRefund(transactionType, contractAddress, userId, activityId, urlCallback);
      console.log('Request refund should fail');
    } catch (error) {
      if (error.msg.includes('Invalid address format')) {
        flag = true;
      } else {
        console.log('Got following error instead:');
        console.log(error);
      }
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Request refund should fail if userId is in the wrong format', async () => {
    const transactionType = 'REQUEST_REFUND';
    const contractAddress = '0x1807f24cd3bc08cab1426b9703dfd31b9a9527a2';
    const userId = 'hello';
    const activityId = 123;
    const urlCallback = 'https://oracle.localdev.com:8081/projects/321/callback/REQUEST_REFUND';

    flag = false;
    try {
      await functions.requestRefund(transactionType, contractAddress, userId, activityId, urlCallback);
      console.log('Request refund should fail');
    } catch (error) {
      if (error.msg.includes('An error occurred with the ABI encoding process')) {
        flag = true;
      } else {
        console.log('Got following error instead:');
        console.log(error);
      }
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Withdraw funds', async () => {
    const transactionType = 'WITHDRAW_FUNDS';
    const contractAddress = '0x1807f24cd3bc08cab1426b9703dfd31b9a9527a2';
    const userId = 321;
    const activityId = 123;
    const urlCallback = 'https://oracle.localdev.com:8081/projects/321/callback/WITHDRAW_FUNDS';

    try {
      await functions.withdrawFunds(transactionType, contractAddress, userId, activityId, urlCallback);
      flag = true;
    } catch (error) {
      flag = false;
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Withdraw funds should fail if contract address is incorrect', async () => {
    const transactionType = 'WITHDRAW_FUNDS';
    const contractAddress = '0x1807f24cd3bc';
    const userId = 321;
    const activityId = 123;
    const urlCallback = 'https://oracle.localdev.com:8081/projects/321/callback/WITHDRAW_FUNDS';

    flag = false;
    try {
      await functions.withdrawFunds(transactionType, contractAddress, userId, activityId, urlCallback);
      console.log('Withdraw funds should fail');
    } catch (error) {
      if (error.msg.includes('Invalid address format')) {
        flag = true;
      } else {
        console.log('Got following error instead:');
        console.log(error);
      }
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Withdraw funds should fail if contract address is in the wrong format', async () => {
    const transactionType = 'WITHDRAW_FUNDS';
    const contractAddress = 45343;
    const userId = 321;
    const activityId = 123;
    const urlCallback = 'https://oracle.localdev.com:8081/projects/321/callback/WITHDRAW_FUNDS';

    flag = false;
    try {
      await functions.withdrawFunds(transactionType, contractAddress, userId, activityId, urlCallback);
      console.log('Withdraw funds should fail');
    } catch (error) {
      if (error.msg.includes('Invalid address format')) {
        flag = true;
      } else {
        console.log('Got following error instead:');
        console.log(error);
      }
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Withdraw funds should fail if userId is in the wrong format', async () => {
    const transactionType = 'WITHDRAW_FUNDS';
    const contractAddress = '0x1807f24cd3bc08cab1426b9703dfd31b9a9527a2';
    const userId = 'hello';
    const activityId = 123;
    const urlCallback = 'https://oracle.localdev.com:8081/projects/321/callback/WITHDRAW_FUNDS';

    flag = false;
    try {
      await functions.withdrawFunds(transactionType, contractAddress, userId, activityId, urlCallback);
      console.log('Withdraw funds should fail');
    } catch (error) {
      if (error.msg.includes('An error occurred with the ABI encoding process')) {
        flag = true;
      } else {
        console.log('Got following error instead:');
        console.log(error);
      }
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Commits moderator votes', async () => {
    const transactionType = 'COMMIT_MODERATION_VOTES';
    const votes = [true, false, true, true, false, true, true];
    const decryptionKeys = [
      '0x8f4a0d1940bbb011db54926c65572b03fd379cfc3c2da3d5765043dd682dc353',
      '0x8f4a0d1940bbb011db54926c65572b03fd379cfc3c2da3d5765043dd682dc353',
      '0x8f4a0d1940bbb011db54926c65572b03fd379cfc3c2da3d5765043dd682dc353',
      '0x8f4a0d1940bbb011db54926c65572b03fd379cfc3c2da3d5765043dd682dc353',
      '0x8f4a0d1940bbb011db54926c65572b03fd379cfc3c2da3d5765043dd682dc353',
      '0x8f4a0d1940bbb011db54926c65572b03fd379cfc3c2da3d5765043dd682dc353',
      '0x8f4a0d1940bbb011db54926c65572b03fd379cfc3c2da3d5765043dd682dc353',
    ];
    const userIds = [123, 843, 423, 874, 982, 314, 745];
    const contractAddress = '0x1807f24cd3bc08cab1426b9703dfd31b9a9527a2';
    const projectId = 321;
    const activityId = 123;
    const urlCallback = 'https://oracle.localdev.com:8081/projects/321/callback/COMMIT_MODERATOR_VOTES';

    try {
      await functions.commitModeratorVotes(
        transactionType,
        votes,
        decryptionKeys,
        userIds,
        contractAddress,
        projectId,
        activityId,
        urlCallback,
      );
      flag = true;
    } catch (error) {
      flag = false;
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Commit votes should fail if contractAddress is incorrect', async () => {
    const transactionType = 'COMMIT_MODERATION_VOTES';
    const votes = [true, false, true, true, false, true, true];
    const decryptionKeys = [
      '0x8f4a0d1940bbb011db54926c65572b03fd379cfc3c2da3d5765043dd682dc353',
      '0x8f4a0d1940bbb011db54926c65572b03fd379cfc3c2da3d5765043dd682dc353',
      '0x8f4a0d1940bbb011db54926c65572b03fd379cfc3c2da3d5765043dd682dc353',
      '0x8f4a0d1940bbb011db54926c65572b03fd379cfc3c2da3d5765043dd682dc353',
      '0x8f4a0d1940bbb011db54926c65572b03fd379cfc3c2da3d5765043dd682dc353',
      '0x8f4a0d1940bbb011db54926c65572b03fd379cfc3c2da3d5765043dd682dc353',
      '0x8f4a0d1940bbb011db54926c65572b03fd379cfc3c2da3d5765043dd682dc353',
    ];
    const userIds = [123, 843, 423, 874, 982, 314, 745];
    const contractAddress = '0x1807f24cd3';
    const projectId = 321;
    const activityId = 123;
    const urlCallback = 'https://oracle.localdev.com:8081/projects/321/callback/COMMIT_MODERATOR_VOTES';

    flag = false;
    try {
      await functions.commitModeratorVotes(
        transactionType,
        votes,
        decryptionKeys,
        userIds,
        contractAddress,
        projectId,
        activityId,
        urlCallback,
      );
      console.log('Commit moderator votes should fail');
    } catch (error) {
      if (error.msg.includes('Invalid address format')) {
        flag = true;
      } else {
        console.log('Got following error instead:');
        console.log(error);
      }
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Commit votes should fail if contractAddress is in the wrong format', async () => {
    const transactionType = 'COMMIT_MODERATION_VOTES';
    const votes = [true, false, true, true, false, true, true];
    const decryptionKeys = [
      '0x8f4a0d1940bbb011db54926c65572b03fd379cfc3c2da3d5765043dd682dc353',
      '0x8f4a0d1940bbb011db54926c65572b03fd379cfc3c2da3d5765043dd682dc353',
      '0x8f4a0d1940bbb011db54926c65572b03fd379cfc3c2da3d5765043dd682dc353',
      '0x8f4a0d1940bbb011db54926c65572b03fd379cfc3c2da3d5765043dd682dc353',
      '0x8f4a0d1940bbb011db54926c65572b03fd379cfc3c2da3d5765043dd682dc353',
      '0x8f4a0d1940bbb011db54926c65572b03fd379cfc3c2da3d5765043dd682dc353',
      '0x8f4a0d1940bbb011db54926c65572b03fd379cfc3c2da3d5765043dd682dc353',
    ];
    const userIds = [123, 843, 423, 874, 982, 314, 745];
    const contractAddress = 2342341;
    const projectId = 321;
    const activityId = 123;
    const urlCallback = 'https://oracle.localdev.com:8081/projects/321/callback/COMMIT_MODERATOR_VOTES';

    flag = false;
    try {
      await functions.commitModeratorVotes(
        transactionType,
        votes,
        decryptionKeys,
        userIds,
        contractAddress,
        projectId,
        activityId,
        urlCallback,
      );
      console.log('Commit moderator votes should fail');
    } catch (error) {
      if (error.msg.includes('Invalid address format')) {
        flag = true;
      } else {
        console.log('Got following error instead:');
        console.log(error);
      }
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Commit votes should fail if projectId is in the wrong format', async () => {
    const transactionType = 'COMMIT_MODERATION_VOTES';
    const votes = [true, false, true, true, false, true, true];
    const decryptionKeys = [
      '0x8f4a0d1940bbb011db54926c65572b03fd379cfc3c2da3d5765043dd682dc353',
      '0x8f4a0d1940bbb011db54926c65572b03fd379cfc3c2da3d5765043dd682dc353',
      '0x8f4a0d1940bbb011db54926c65572b03fd379cfc3c2da3d5765043dd682dc353',
      '0x8f4a0d1940bbb011db54926c65572b03fd379cfc3c2da3d5765043dd682dc353',
      '0x8f4a0d1940bbb011db54926c65572b03fd379cfc3c2da3d5765043dd682dc353',
      '0x8f4a0d1940bbb011db54926c65572b03fd379cfc3c2da3d5765043dd682dc353',
      '0x8f4a0d1940bbb011db54926c65572b03fd379cfc3c2da3d5765043dd682dc353',
    ];
    const userIds = [123, 843, 423, 874, 982, 314, 745];
    const contractAddress = '0x1807f24cd3bc08cab1426b9703dfd31b9a9527a2';
    const projectId = 'hello';
    const activityId = 123;
    const urlCallback = 'https://oracle.localdev.com:8081/projects/321/callback/COMMIT_MODERATOR_VOTES';

    flag = false;
    try {
      await functions.commitModeratorVotes(
        transactionType,
        votes,
        decryptionKeys,
        userIds,
        contractAddress,
        projectId,
        activityId,
        urlCallback,
      );
      console.log('Commit moderator votes should fail');
    } catch (error) {
      if (error.msg.includes('An error occurred with the ABI encoding process')) {
        flag = true;
      } else {
        console.log('Got following error instead:');
        console.log(error);
      }
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Commit votes should fail if userIds is in the wrong format', async () => {
    const transactionType = 'COMMIT_MODERATION_VOTES';
    const votes = [true, false, true, true, false, true, true];
    const decryptionKeys = [
      '0x8f4a0d1940bbb011db54926c65572b03fd379cfc3c2da3d5765043dd682dc353',
      '0x8f4a0d1940bbb011db54926c65572b03fd379cfc3c2da3d5765043dd682dc353',
      '0x8f4a0d1940bbb011db54926c65572b03fd379cfc3c2da3d5765043dd682dc353',
      '0x8f4a0d1940bbb011db54926c65572b03fd379cfc3c2da3d5765043dd682dc353',
      '0x8f4a0d1940bbb011db54926c65572b03fd379cfc3c2da3d5765043dd682dc353',
      '0x8f4a0d1940bbb011db54926c65572b03fd379cfc3c2da3d5765043dd682dc353',
      '0x8f4a0d1940bbb011db54926c65572b03fd379cfc3c2da3d5765043dd682dc353',
    ];
    const userIds = false;
    const contractAddress = '0x1807f24cd3bc08cab1426b9703dfd31b9a9527a2';
    const projectId = 321;
    const activityId = 123;
    const urlCallback = 'https://oracle.localdev.com:8081/projects/321/callback/COMMIT_MODERATOR_VOTES';

    flag = false;
    try {
      await functions.commitModeratorVotes(
        transactionType,
        votes,
        decryptionKeys,
        userIds,
        contractAddress,
        projectId,
        activityId,
        urlCallback,
      );
      console.log('Commit moderator votes should fail');
    } catch (error) {
      if (error.msg.includes('Parameter is not in the right format: userIdsArray')) {
        flag = true;
      } else {
        console.log('Got following error instead:');
        console.log(error);
      }
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Commit votes should fail if userIds array contains incorrect values', async () => {
    const transactionType = 'COMMIT_MODERATION_VOTES';
    const votes = [true, false, true, true, false, true, true];
    const decryptionKeys = [
      '0x8f4a0d1940bbb011db54926c65572b03fd379cfc3c2da3d5765043dd682dc353',
      '0x8f4a0d1940bbb011db54926c65572b03fd379cfc3c2da3d5765043dd682dc353',
      '0x8f4a0d1940bbb011db54926c65572b03fd379cfc3c2da3d5765043dd682dc353',
      '0x8f4a0d1940bbb011db54926c65572b03fd379cfc3c2da3d5765043dd682dc353',
      '0x8f4a0d1940bbb011db54926c65572b03fd379cfc3c2da3d5765043dd682dc353',
      '0x8f4a0d1940bbb011db54926c65572b03fd379cfc3c2da3d5765043dd682dc353',
      '0x8f4a0d1940bbb011db54926c65572b03fd379cfc3c2da3d5765043dd682dc353',
    ];
    const userIds = ['aloha', 'hello', 'hola', 'adios', 'sayonara', 'ciao'];
    const contractAddress = '0x1807f24cd3bc08cab1426b9703dfd31b9a9527a2';
    const projectId = 321;
    const activityId = 123;
    const urlCallback = 'https://oracle.localdev.com:8081/projects/321/callback/COMMIT_MODERATOR_VOTES';

    flag = false;
    try {
      await functions.commitModeratorVotes(
        transactionType,
        votes,
        decryptionKeys,
        userIds,
        contractAddress,
        projectId,
        activityId,
        urlCallback,
      );
      console.log('Commit moderator votes should fail');
    } catch (error) {
      if (error.msg.includes('Parameter is not in the right format: id')) {
        flag = true;
      } else {
        console.log('Got following error instead:');
        console.log(error);
      }
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Commit votes should fail if decryptionKeys is in the wrong format', async () => {
    const transactionType = 'COMMIT_MODERATION_VOTES';
    const votes = [true, false, true, true, false, true, true];
    const decryptionKeys = 453224;
    const userIds = [123, 843, 423, 874, 982, 314, 745];
    const contractAddress = '0x1807f24cd3bc08cab1426b9703dfd31b9a9527a2';
    const projectId = 321;
    const activityId = 123;
    const urlCallback = 'https://oracle.localdev.com:8081/projects/321/callback/COMMIT_MODERATOR_VOTES';

    flag = false;
    try {
      await functions.commitModeratorVotes(
        transactionType,
        votes,
        decryptionKeys,
        userIds,
        contractAddress,
        projectId,
        activityId,
        urlCallback,
      );
      console.log('Commit moderator votes should fail');
    } catch (error) {
      if (error.msg.includes('Parameter is not in the right format: decryptionKeysArray')) {
        flag = true;
      } else {
        console.log('Got following error instead:');
        console.log(error);
      }
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Commit votes should fail if decryptionKeys array contains incorrect values', async () => {
    const transactionType = 'COMMIT_MODERATION_VOTES';
    const votes = [true, false, true, true, false, true, true];
    const decryptionKeys = [453224, 54343, 56756, 8866, 242, 987, 143];
    const userIds = [123, 843, 423, 874, 982, 314, 745];
    const contractAddress = '0x1807f24cd3bc08cab1426b9703dfd31b9a9527a2';
    const projectId = 321;
    const activityId = 123;
    const urlCallback = 'https://oracle.localdev.com:8081/projects/321/callback/COMMIT_MODERATOR_VOTES';

    flag = false;
    try {
      await functions.commitModeratorVotes(
        transactionType,
        votes,
        decryptionKeys,
        userIds,
        contractAddress,
        projectId,
        activityId,
        urlCallback,
      );
      console.log('Commit moderator votes should fail');
    } catch (error) {
      if (error.msg.includes('Parameter is not in the right format: key')) {
        flag = true;
      } else {
        console.log('Got following error instead:');
        console.log(error);
      }
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Commit votes should fail if votes is in the wrong format', async () => {
    const transactionType = 'COMMIT_MODERATION_VOTES';
    const votes = true;
    const decryptionKeys = [
      '0x8f4a0d1940bbb011db54926c65572b03fd379cfc3c2da3d5765043dd682dc353',
      '0x8f4a0d1940bbb011db54926c65572b03fd379cfc3c2da3d5765043dd682dc353',
      '0x8f4a0d1940bbb011db54926c65572b03fd379cfc3c2da3d5765043dd682dc353',
      '0x8f4a0d1940bbb011db54926c65572b03fd379cfc3c2da3d5765043dd682dc353',
      '0x8f4a0d1940bbb011db54926c65572b03fd379cfc3c2da3d5765043dd682dc353',
      '0x8f4a0d1940bbb011db54926c65572b03fd379cfc3c2da3d5765043dd682dc353',
      '0x8f4a0d1940bbb011db54926c65572b03fd379cfc3c2da3d5765043dd682dc353',
    ];
    const userIds = [123, 843, 423, 874, 982, 314, 745];
    const contractAddress = '0x1807f24cd3bc08cab1426b9703dfd31b9a9527a2';
    const projectId = 321;
    const activityId = 123;
    const urlCallback = 'https://oracle.localdev.com:8081/projects/321/callback/COMMIT_MODERATOR_VOTES';

    flag = false;
    try {
      await functions.commitModeratorVotes(
        transactionType,
        votes,
        decryptionKeys,
        userIds,
        contractAddress,
        projectId,
        activityId,
        urlCallback,
      );
      console.log('Commit moderator votes should fail');
    } catch (error) {
      if (error.msg.includes('Parameter is not in the right format: votesStr')) {
        flag = true;
      } else {
        console.log('Got following error instead:');
        console.log(error);
      }
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Commit votes should fail if votes array contains incorrect values', async () => {
    const transactionType = 'COMMIT_MODERATION_VOTES';
    const votes = [213, 23423, 435, 543, 663, 6654, 767];
    const decryptionKeys = [
      '0x8f4a0d1940bbb011db54926c65572b03fd379cfc3c2da3d5765043dd682dc353',
      '0x8f4a0d1940bbb011db54926c65572b03fd379cfc3c2da3d5765043dd682dc353',
      '0x8f4a0d1940bbb011db54926c65572b03fd379cfc3c2da3d5765043dd682dc353',
      '0x8f4a0d1940bbb011db54926c65572b03fd379cfc3c2da3d5765043dd682dc353',
      '0x8f4a0d1940bbb011db54926c65572b03fd379cfc3c2da3d5765043dd682dc353',
      '0x8f4a0d1940bbb011db54926c65572b03fd379cfc3c2da3d5765043dd682dc353',
      '0x8f4a0d1940bbb011db54926c65572b03fd379cfc3c2da3d5765043dd682dc353',
    ];
    const userIds = [123, 843, 423, 874, 982, 314, 745];
    const contractAddress = '0x1807f24cd3bc08cab1426b9703dfd31b9a9527a2';
    const projectId = 321;
    const activityId = 123;
    const urlCallback = 'https://oracle.localdev.com:8081/projects/321/callback/COMMIT_MODERATOR_VOTES';

    flag = false;
    try {
      await functions.commitModeratorVotes(
        transactionType,
        votes,
        decryptionKeys,
        userIds,
        contractAddress,
        projectId,
        activityId,
        urlCallback,
      );
      console.log('Commit moderator votes should fail');
    } catch (error) {
      if (error.msg.includes('Parameter is not in the right format: votes')) {
        flag = true;
      } else {
        console.log('Got following error instead:');
        console.log(error);
      }
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Recover failed funds', async () => {
    const transactionType = 'FAILED_FUND_RECOVERY';
    const contractAddress = '0x1807f24cd3bc08cab1426b9703dfd31b9a9527a2';
    const activityId = 123;
    const urlCallback = 'https://oracle.localdev.com:8081/projects/321/callback/FAILED_FUND_RECOVERY';

    try {
      await functions.failedFundRecovery(transactionType, contractAddress, activityId, urlCallback);
      flag = true;
    } catch (error) {
      console.log(error);
      flag = false;
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Recovery of funds should fail if contract address is incorrect', async () => {
    const transactionType = 'FAILED_FUND_RECOVERY';
    const contractAddress = '0x1807f24cd3bc';
    const activityId = 123;
    const urlCallback = 'https://oracle.localdev.com:8081/projects/321/callback/FAILED_FUND_RECOVERY';

    flag = false;
    try {
      await functions.failedFundRecovery(transactionType, contractAddress, activityId, urlCallback);
      console.log('Fund recovery should fail');
    } catch (error) {
      if (error.msg.includes('Invalid address format')) {
        flag = true;
      } else {
        console.log('Got following error instead:');
        console.log(error);
      }
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Recovery of funds should fail if contract address is in the wrong format', async () => {
    const transactionType = 'FAILED_FUND_RECOVERY';
    const contractAddress = 534323;
    const activityId = 123;
    const urlCallback = 'https://oracle.localdev.com:8081/projects/321/callback/FAILED_FUND_RECOVERY';

    flag = false;
    try {
      await functions.failedFundRecovery(transactionType, contractAddress, activityId, urlCallback);
      console.log('Fund recovery should fail');
    } catch (error) {
      if (error.msg.includes('Invalid address format')) {
        flag = true;
      } else {
        console.log('Got following error instead:');
        console.log(error);
      }
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Sets project info', async () => {
    const transactionType = 'SET_PROJECT_INFO';
    const contractAddress = '0x1807f24cd3bc08cab1426b9703dfd31b9a9527a2';
    const listingFee = 2000;
    const activityId = 123;
    const urlCallback = 'https://oracle.localdev.com:8081/projects/321/callback/SET_PROJECT_INFO';

    try {
      await functions.setProjectInfo(transactionType, contractAddress, listingFee, activityId, urlCallback);
      flag = true;
    } catch (error) {
      console.log(error);
      flag = false;
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Set project info should fail if contract address is incorrect', async () => {
    const transactionType = 'SET_PROJECT_INFO';
    const contractAddress = '0x1807f24cd3bc';
    const listingFee = 2000;
    const activityId = 123;
    const urlCallback = 'https://oracle.localdev.com:8081/projects/321/callback/SET_PROJECT_INFO';

    flag = false;
    try {
      await functions.setProjectInfo(transactionType, contractAddress, listingFee, activityId, urlCallback);
      console.log('Set project info should fail');
    } catch (error) {
      if (error.msg.includes('Invalid address format')) {
        flag = true;
      } else {
        console.log('Got following error instead:');
        console.log(error);
      }
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Set project info should fail if contract address is in the wrong format', async () => {
    const transactionType = 'SET_PROJECT_INFO';
    const contractAddress = 35433;
    const listingFee = 2000;
    const activityId = 123;
    const urlCallback = 'https://oracle.localdev.com:8081/projects/321/callback/SET_PROJECT_INFO';

    flag = false;
    try {
      await functions.setProjectInfo(transactionType, contractAddress, listingFee, activityId, urlCallback);
      console.log('Set project info should fail');
    } catch (error) {
      if (error.msg.includes('Invalid address format')) {
        flag = true;
      } else {
        console.log('Got following error instead:');
        console.log(error);
      }
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Set project info should fail if listing fee is in the wrong format', async () => {
    const transactionType = 'SET_PROJECT_INFO';
    const contractAddress = '0x1807f24cd3bc08cab1426b9703dfd31b9a9527a2';
    const listingFee = 'abc';
    const activityId = 123;
    const urlCallback = 'https://oracle.localdev.com:8081/projects/321/callback/SET_PROJECT_INFO';

    flag = false;
    try {
      await functions.setProjectInfo(transactionType, contractAddress, listingFee, activityId, urlCallback);
      console.log('Set project info should fail');
    } catch (error) {
      if (error.msg.includes('An error occurred with the ABI encoding process.')) {
        flag = true;
      } else {
        console.log('Got following error instead:');
        console.log(error);
      }
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Receive funds from external wallet', async () => {
    const transactionType = 'RECEIVE_FROM_PRIVATE';
    const senderAddress = '0x1807f24cd3bc08cab1426b9703dfd31b9a9527a2';
    const userId = 321;
    const activityId = 123;
    const urlCallback = '';

    try {
      await functions.receiveFromPrivate(transactionType, senderAddress, userId, activityId, urlCallback);
      flag = true;
    } catch (error) {
      console.log(error);
      flag = false;
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Receive funds from external wallet should fail if contract address is incorrect', async () => {
    const transactionType = 'RECEIVE_FROM_PRIVATE';
    const senderAddress = '0x1807f24cd3bc';
    const userId = 321;
    const activityId = 123;
    const urlCallback = '';

    flag = false;
    try {
      await functions.receiveFromPrivate(transactionType, senderAddress, userId, activityId, urlCallback);
      console.log('Transfer should fail');
    } catch (error) {
      if (error.msg.includes('Invalid address format')) {
        flag = true;
      } else {
        console.log('Got following error instead:');
        console.log(error);
      }
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Receive funds from external wallet should fail if contract address is in the wrong format', async () => {
    const transactionType = 'RECEIVE_FROM_PRIVATE';
    const senderAddress = 64568;
    const userId = 321;
    const activityId = 123;
    const urlCallback = '';

    flag = false;
    try {
      await functions.receiveFromPrivate(transactionType, senderAddress, userId, activityId, urlCallback);
      console.log('Transfer should fail');
    } catch (error) {
      if (error.msg.includes('Invalid address format')) {
        flag = true;
      } else {
        console.log('Got following error instead:');
        console.log(error);
      }
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Receive funds from external wallet should fail if userId is in the wrong format', async () => {
    const transactionType = 'RECEIVE_FROM_PRIVATE';
    const senderAddress = '0x1807f24cd3bc08cab1426b9703dfd31b9a9527a2';
    const userId = 'abc';
    const activityId = 123;
    const urlCallback = '';

    flag = false;
    try {
      await functions.receiveFromPrivate(transactionType, senderAddress, userId, activityId, urlCallback);
      console.log('Transfer should fail');
    } catch (error) {
      if (error.msg.includes('An error occurred with the ABI encoding process.')) {
        flag = true;
      } else {
        console.log('Got following error instead:');
        console.log(error);
      }
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Transfer funds between accounts', async () => {
    const transactionType = 'TRANSFER_BETWEEN_ACCOUNTS';
    const senderAccount = 123;
    const receiverAccount = 321;
    const transferAmount = 200;
    const activityId = 123;
    const urlCallback = '';

    try {
      await functions.transferBetweenAccounts(
        transactionType,
        senderAccount,
        receiverAccount,
        transferAmount,
        activityId,
        urlCallback,
      );
      flag = true;
    } catch (error) {
      console.log(error);
      flag = false;
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Transfer funds between accounts should fail if senderAccount is in the wrong format', async () => {
    const transactionType = 'TRANSFER_BETWEEN_ACCOUNTS';
    const senderAccount = 'hello';
    const receiverAccount = 321;
    const transferAmount = 200;
    const activityId = 123;
    const urlCallback = '';

    flag = false;
    try {
      await functions.transferBetweenAccounts(
        transactionType,
        senderAccount,
        receiverAccount,
        transferAmount,
        activityId,
        urlCallback,
      );
      console.log('Transfer should fail');
    } catch (error) {
      if (error.msg.includes('An error occurred with the ABI encoding process.')) {
        flag = true;
      } else {
        console.log('Got following error instead:');
        console.log(error);
      }
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Transfer funds between accounts should fail if receiverAccount is in the wrong format', async () => {
    const transactionType = 'TRANSFER_BETWEEN_ACCOUNTS';
    const senderAccount = 123;
    const receiverAccount = 'hello';
    const transferAmount = 200;
    const activityId = 123;
    const urlCallback = '';

    flag = false;
    try {
      await functions.transferBetweenAccounts(
        transactionType,
        senderAccount,
        receiverAccount,
        transferAmount,
        activityId,
        urlCallback,
      );
      console.log('Transfer should fail');
    } catch (error) {
      if (error.msg.includes('An error occurred with the ABI encoding process.')) {
        flag = true;
      } else {
        console.log('Got following error instead:');
        console.log(error);
      }
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Transfer funds between accounts should fail if transferAmount is in the wrong format', async () => {
    const transactionType = 'TRANSFER_BETWEEN_ACCOUNTS';
    const senderAccount = 123;
    const receiverAccount = 321;
    const transferAmount = 'hello';
    const activityId = 123;
    const urlCallback = '';

    flag = false;
    try {
      await functions.transferBetweenAccounts(
        transactionType,
        senderAccount,
        receiverAccount,
        transferAmount,
        activityId,
        urlCallback,
      );
      flag = false;
      console.log('Transfer should fail');
    } catch (error) {
      if (error.msg.includes('An error occurred with the ABI encoding process.')) {
        flag = true;
      } else {
        console.log('Got following error instead:');
        console.log(error);
      }
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Transfer funds from an external wallet to an account', async () => {
    const transactionType = 'TRANSFER_TO_PRIVATE';
    const userId = 123;
    const receiverAddress = '0x1807f24cd3bc08cab1426b9703dfd31b9a9527a2';
    const transferAmount = 200;
    const activityId = 123;
    const urlCallback = '';

    try {
      await functions.transferToPrivate(
        transactionType,
        userId,
        receiverAddress,
        transferAmount,
        activityId,
        urlCallback,
      );
      flag = true;
    } catch (error) {
      console.log(error);
      flag = false;
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Transfer funds should fail if userId is in the wrong format', async () => {
    const transactionType = 'TRANSFER_TO_PRIVATE';
    const userId = 'abc';
    const receiverAddress = '0x1807f24cd3bc08cab1426b9703dfd31b9a9527a2';
    const transferAmount = 200;
    const activityId = 123;
    const urlCallback = '';

    flag = false;
    try {
      await functions.transferToPrivate(
        transactionType,
        userId,
        receiverAddress,
        transferAmount,
        activityId,
        urlCallback,
      );
      console.log('Transfer should fail');
    } catch (error) {
      if (error.msg.includes('An error occurred with the ABI encoding process.')) {
        flag = true;
      } else {
        console.log('Got following error instead:');
        console.log(error);
      }
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Transfer funds should fail if receiverAddress is incorrect', async () => {
    const transactionType = 'TRANSFER_TO_PRIVATE';
    const userId = 123;
    const receiverAddress = '0x1807f24cd3bc';
    const transferAmount = 200;
    const activityId = 123;
    const urlCallback = '';

    flag = false;
    try {
      await functions.transferToPrivate(
        transactionType,
        userId,
        receiverAddress,
        transferAmount,
        activityId,
        urlCallback,
      );
      console.log('Transfer should fail');
    } catch (error) {
      if (error.msg.includes('Invalid address format')) {
        flag = true;
      } else {
        console.log('Got following error instead:');
        console.log(error);
      }
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Transfer funds should fail if userId is in the wrong format', async () => {
    const transactionType = 'TRANSFER_TO_PRIVATE';
    const userId = false;
    const receiverAddress = '0x1807f24cd3bc08cab1426b9703dfd31b9a9527a2';
    const transferAmount = 200;
    const activityId = 123;
    const urlCallback = '';

    flag = false;
    try {
      await functions.transferToPrivate(
        transactionType,
        userId,
        receiverAddress,
        transferAmount,
        activityId,
        urlCallback,
      );
      console.log('Transfer should fail');
    } catch (error) {
      if (error.msg.includes('An error occurred with the ABI encoding process.')) {
        flag = true;
      } else {
        console.log('Got following error instead:');
        console.log(error);
      }
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Transfer funds should fail if transferAmount is in the wrong format', async () => {
    const transactionType = 'TRANSFER_TO_PRIVATE';
    const userId = 123;
    const receiverAddress = '0x1807f24cd3bc08cab1426b9703dfd31b9a9527a2';
    const transferAmount = 'hello';
    const activityId = 123;
    const urlCallback = '';

    flag = false;
    try {
      await functions.transferToPrivate(
        transactionType,
        userId,
        receiverAddress,
        transferAmount,
        activityId,
        urlCallback,
      );
      console.log('Transfer should fail');
    } catch (error) {
      if (error.msg.includes('An error occurred with the ABI encoding process.')) {
        flag = true;
      } else {
        console.log('Got following error instead:');
        console.log(error);
      }
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Get balance should return the proper balance', async () => {
    const userId = 123;

    try {
      await functions.getBalance(userId);
      flag = true;
    } catch (error) {
      flag = false;
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Get balance should fail if userId is not not in the right format', async () => {
    const userId = false;

    flag = false;
    try {
      await functions.getBalance(userId);
    } catch (error) {
      flag = true;
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Get gains should return the proper balance', async () => {
    const userId = 123;

    try {
      await functions.getGains(userId);
      flag = true;
    } catch (error) {
      flag = false;
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Get gains should fail if userId is not not in the right format', async () => {
    const userId = false;

    flag = false;
    try {
      await functions.getGains(userId);
    } catch (error) {
      flag = true;
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Process raw transactions', async () => {
    const transactionType = 'RAW_TX';
    const transactionSerialized =
      // eslint-disable-next-line
      '0xf8a82682b2ce840401b12694bb1a5b197b37da53eb1cd74d4fa52ac06f86bc1380b844095ea7b3000000000000000000000000c35dde7e276766baac1e767df6da57675e6390b50000000000000000000000000000000000000000000000000000000000001f4025a005448695a9e7093d9aa496312c2a64225509e58353c7ef14c7fb46d9d3ffbddca06b7b2f98c76df5abe8be0478474d647ce4a4f50322f1dc3f846010d4e611f823';
    const senderAddress = '0x1807f24cd3bc08cab1426b9703dfd31b9a9527a2';
    const receiverAddress = '0xeE315Db1006a929D11324442BD9eFE641B8A76da';
    const urlCallback = '';

    try {
      await functions.prepareRawTx(transactionType, transactionSerialized, senderAddress, receiverAddress, urlCallback);
      flag = true;
    } catch (error) {
      flag = false;
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Raw transactions should fail if transactionSerialized is in the wrong format', async () => {
    const transactionType = 'RAW_TX';
    const transactionSerialized = 12312;
    const senderAddress = '0x1807f24cd3bc08cab1426b9703dfd31b9a9527a2';
    const receiverAddress = '0xeE315Db1006a929D11324442BD9eFE641B8A76da';
    const urlCallback = '';

    flag = false;
    try {
      await functions.prepareRawTx(transactionType, transactionSerialized, senderAddress, receiverAddress, urlCallback);
      console.log('Raw Tx should fail');
    } catch (error) {
      if (error.msg.includes('Parameter is not in the right format: transactionSerialized')) {
        flag = true;
      } else {
        console.log('Got following error instead:');
        console.log(error);
      }
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Raw transactions should fail if senderAddress is incorrect', async () => {
    const transactionType = 'RAW_TX';
    const transactionSerialized =
      // eslint-disable-next-line
      '0xf8a82682b2ce840401b12694bb1a5b197b37da53eb1cd74d4fa52ac06f86bc1380b844095ea7b3000000000000000000000000c35dde7e276766baac1e767df6da57675e6390b50000000000000000000000000000000000000000000000000000000000001f4025a005448695a9e7093d9aa496312c2a64225509e58353c7ef14c7fb46d9d3ffbddca06b7b2f98c76df5abe8be0478474d647ce4a4f50322f1dc3f846010d4e611f823';
    const senderAddress = '0x60E3ee943F';
    const receiverAddress = '0x1807f24cd3bc08cab1426b9703dfd31b9a9527a2';
    const urlCallback = '';

    flag = false;
    try {
      await functions.prepareRawTx(transactionType, transactionSerialized, senderAddress, receiverAddress, urlCallback);
      console.log('Raw Tx should fail');
    } catch (error) {
      if (error.msg.includes('Invalid address format')) {
        flag = true;
      } else {
        console.log('Got following error instead:');
        console.log(error);
      }
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Raw transactions should fail if senderAddress is in the wrong format', async () => {
    const transactionType = 'RAW_TX';
    const transactionSerialized =
      // eslint-disable-next-line
      '0xf8a82682b2ce840401b12694bb1a5b197b37da53eb1cd74d4fa52ac06f86bc1380b844095ea7b3000000000000000000000000c35dde7e276766baac1e767df6da57675e6390b50000000000000000000000000000000000000000000000000000000000001f4025a005448695a9e7093d9aa496312c2a64225509e58353c7ef14c7fb46d9d3ffbddca06b7b2f98c76df5abe8be0478474d647ce4a4f50322f1dc3f846010d4e611f823';
    const senderAddress = 1234324;
    const receiverAddress = '0x1807f24cd3bc08cab1426b9703dfd31b9a9527a2';
    const urlCallback = '';

    flag = false;
    try {
      await functions.prepareRawTx(transactionType, transactionSerialized, senderAddress, receiverAddress, urlCallback);
      console.log('Raw Tx should fail');
    } catch (error) {
      if (error.msg.includes('Invalid address format')) {
        flag = true;
      } else {
        console.log('Got following error instead:');
        console.log(error);
      }
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Raw transactions should fail if senderAddress is incorrect', async () => {
    const transactionType = 'RAW_TX';
    const transactionSerialized =
      // eslint-disable-next-line
      '0xf8a82682b2ce840401b12694bb1a5b197b37da53eb1cd74d4fa52ac06f86bc1380b844095ea7b3000000000000000000000000c35dde7e276766baac1e767df6da57675e6390b50000000000000000000000000000000000000000000000000000000000001f4025a005448695a9e7093d9aa496312c2a64225509e58353c7ef14c7fb46d9d3ffbddca06b7b2f98c76df5abe8be0478474d647ce4a4f50322f1dc3f846010d4e611f823';
    const senderAddress = '0x60E3ee943F7045f7fb7348841aa710C129c58667s';
    const receiverAddress = '0x1807f24cd3bc';
    const urlCallback = '';

    flag = false;
    try {
      await functions.prepareRawTx(transactionType, transactionSerialized, senderAddress, receiverAddress, urlCallback);
      console.log('Raw Tx should fail');
    } catch (error) {
      if (error.msg.includes('Invalid address format')) {
        flag = true;
      } else {
        console.log('Got following error instead:');
        console.log(error);
      }
    }

    assert.equal(flag, true);
  }).timeout(8000);

  it('Raw transactions should fail if senderAddress is incorrect', async () => {
    const transactionType = 'RAW_TX';
    const transactionSerialized =
      // eslint-disable-next-line
      '0xf8a82682b2ce840401b12694bb1a5b197b37da53eb1cd74d4fa52ac06f86bc1380b844095ea7b3000000000000000000000000c35dde7e276766baac1e767df6da57675e6390b50000000000000000000000000000000000000000000000000000000000001f4025a005448695a9e7093d9aa496312c2a64225509e58353c7ef14c7fb46d9d3ffbddca06b7b2f98c76df5abe8be0478474d647ce4a4f50322f1dc3f846010d4e611f823';
    const senderAddress = '0x60E3ee943F7045f7fb7348841aa710C129c58667s';
    const receiverAddress = 6765432;
    const urlCallback = '';

    flag = false;
    try {
      await functions.prepareRawTx(transactionType, transactionSerialized, senderAddress, receiverAddress, urlCallback);
      console.log('Raw Tx should fail');
    } catch (error) {
      if (error.msg.includes('Invalid address format')) {
        flag = true;
      } else {
        console.log('Got following error instead:');
        console.log(error);
      }
    }

    assert.equal(flag, true);
  }).timeout(8000);

  afterEach(() => {
    insertTxStub.restore();
    insertProjectStub.restore();
    serializedTransStub.restore();
    pushObjectStub.restore();
  });
});
