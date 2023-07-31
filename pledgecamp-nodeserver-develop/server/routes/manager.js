const express = require('express');
const { backendAuth } = require('../utils/authUtil');

const router = express.Router();

const manager = require('../controllers/manager');

router.get('users/:user_id(\\d+)/GET_BALANCE', backendAuth, manager.getBalance);
router.get('/cs/:user_id(\\d+)/GET_GAINS', backendAuth, manager.getGains);

router.post('/projects/:project_id(\\d+)/SET_BACKERS', backendAuth, manager.setBackerListExternal);
router.post('/projects/:project_id(\\d+)/MILESTONE_VOTE/:user_id(\\d+)', backendAuth, manager.milestoneVote);
router.post('/projects/:project_id(\\d+)/MODERATION_VOTE/:user_id(\\d+)', backendAuth, manager.cancelVote);
router.post('/projects/:project_id(\\d+)/WITHDRAW_FUNDS', backendAuth, manager.withdrawFunds);
router.post('/projects/:project_id(\\d+)/REQUEST_REFUND', backendAuth, manager.requestRefund);
router.post('/cs/:user_id(\\d+)/STAKE_PLG', backendAuth, manager.stakePLG);
router.post('/cs/:user_id(\\d+)/UNSTAKE_PLG', backendAuth, manager.unstakePLG);
router.post('/cs/:user_id(\\d+)/WITHDRAW_INTEREST', backendAuth, manager.withdrawInterest);
router.post('/cs/:user_id(\\d+)/REINVEST_PLG', backendAuth, manager.reinvestPLG);
router.post('/raw/:user_id(\\d+)/RECEIVE_FROM_PRIVATE', backendAuth, manager.receiveFromPrivate);
router.post('/raw/:user_id(\\d+)/TRANSFER_BETWEEN_ACCOUNTS', backendAuth, manager.transferBetweenAccounts);
router.post('/raw/:user_id(\\d+)/TRANSFER_TO_PRIVATE', backendAuth, manager.transferToPrivate);

module.exports = router;
