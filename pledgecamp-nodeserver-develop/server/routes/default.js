const express = require('express');

const router = express.Router();

const defaultRouter = require('../controllers/default');

// Public endpoints
router.get('/', defaultRouter.healthCheck);
module.exports = router;
