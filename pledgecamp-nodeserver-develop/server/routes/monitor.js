const express = require('express');

const router = express.Router();

const monitor = require('../controllers/monitor');

// uptime robot check
router.get('/', monitor.getMonitor);

module.exports = router;
