const express = require('express');
const { backendAuth } = require('../utils/authUtil');

const router = express.Router();

const moderator = require('../controllers/moderator');

router.post('/projects/:project_id(\\d+)/CANCEL_PROJECT', backendAuth, moderator.cancelProject);
router.post('/projects/:project_id(\\d+)/COMMIT_MODERATION_VOTES', backendAuth, moderator.commitModeratorVotes);

module.exports = router;
