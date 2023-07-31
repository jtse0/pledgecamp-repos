const express = require('express');
const { adminAuth } = require('../utils/authUtil');

const router = express.Router();

const raw = require('../controllers/raw');

// Private endpoints
router.post('/', adminAuth, raw.processRawTx);

module.exports = router;
