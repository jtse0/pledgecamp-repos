const express = require('express');
const { backendAuth } = require('../utils/authUtil');

const router = express.Router();

const admin = require('../controllers/admin');

router.post('/projects/:project_id(\\d+)/SET_PROJECT_INFO', backendAuth, admin.setProjectInfo);

module.exports = router;
