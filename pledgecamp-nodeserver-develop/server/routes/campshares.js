const express = require('express');
const { backendAuth } = require('../utils/authUtil');

const router = express.Router();

const cs = require('../controllers/campshares');

router.post('/projects/:project_id(\\d+)/START_MODERATION', backendAuth, cs.setProjectModerators);
router.post('/POST_INTEREST', backendAuth, cs.postInterest);

module.exports = router;
