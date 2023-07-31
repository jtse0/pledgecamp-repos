const express = require('express');
const { backendAuth } = require('../utils/authUtil');

const router = express.Router();

const projects = require('../controllers/projects');

router.post('/:project_id(\\d+)', backendAuth, projects.postProject);
router.post('/:project_id(\\d+)/CHECK_MILESTONE', backendAuth, projects.checkMilestones);
router.post('/:project_id(\\d+)/FAILED_FUND_RECOVERY', backendAuth, projects.failedFundRecovery);

module.exports = router;
