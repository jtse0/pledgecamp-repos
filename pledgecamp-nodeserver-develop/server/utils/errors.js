const logger = require('./logger');

class Error500 extends Error {
  constructor(...args) {
    super(...args);
    logger.error({ message: 'Error500', meta: args });
    Object.assign(this, ...args);
    this.code = 500;
  }
}

class Error404 extends Error {
  constructor(...args) {
    super(...args);
    // /create log entry
    this.code = 404;
  }
}

class Error401 extends Error {
  constructor(...args) {
    super(...args);
    Object.assign(this, ...args);
    this.code = 401;
  }
}

class Error400 extends Error {
  constructor(...args) {
    super(...args);
    logger.info({ message: 'Error400', meta: args });
    Object.assign(this, ...args);
    this.code = 400;
  }
}

module.exports = {
  Error500,
  Error404,
  Error401,
  Error400,
};
