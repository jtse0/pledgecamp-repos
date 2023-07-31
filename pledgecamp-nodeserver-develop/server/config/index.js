require('dotenv').config();
const _ = require('lodash');
const defaults = require('./default.js');

let envConfig = {};

const nodeEnv = process.env.NODE_ENV || false;
console.log(`Using (${nodeEnv}) environment`);
if (nodeEnv) {
  try {
    /* eslint-disable */
    envConfig = require(`./${nodeEnv}.js`);
    /* eslint-enable */
  } catch (e) {
    console.log('No environment file to load');
  }
}
// eslint-disable-next-line
const config = _.merge({}, defaults, envConfig);
// TODO Refactor config check to utility function that takes array and throws error
module.exports = config;
