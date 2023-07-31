const passport = require('passport');
const BearerStrategy = require('passport-http-bearer');
const config = require('../config');
const logger = require('../utils/logger');

const { admin, backend } = config.auth;

const AuthStrategy = new BearerStrategy((token, done) => {
  if (token === backend) {
    logger.debug('Matched backend auth');
    return done(null, 'backend', { scope: 'backend' });
  }
  if (token === admin) {
    logger.debug('Matched admin auth');
    return done(null, 'admin', { scope: 'admin' });
  }
  return done(null, false);
});

// Middleware for restricting endpoints to the backend or admin
const backendAuth = (req, res, next) => {
  passport.authenticate('bearer', { session: false })(req, res, () => {
    if (req.isAuthenticated() && (req.user === 'backend' || req.user === 'admin')) {
      const request = req.params;
      logger.info({ message: 'Backend request', meta: { request } });

      // Parse known variables to integer for later use
      req.params.user_id = parseInt(request.user_id) || false;
      req.params.project_id = parseInt(request.project_id) || false;
      return next();
    }

    return res.sendStatus(401);
  });
};

// Middleware for restricting endpoints to admin
const adminAuth = (req, res, next) => {
  passport.authenticate('bearer', { session: false })(req, res, () => {
    if (req.isAuthenticated() && req.user === 'admin') {
      return next();
    }
    return res.sendStatus(401);
  });
};

module.exports = {
  AuthStrategy,
  backendAuth,
  adminAuth,
};
