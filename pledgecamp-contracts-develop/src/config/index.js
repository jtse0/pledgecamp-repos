require('dotenv').config();
const _ = require('lodash');

const defaults = require('./default.js');

let envConfig = {};

const nodeEnv = (process.env.NODE_ENV || false);
console.log(`Using (${nodeEnv || 'default'}) environment`);
if(nodeEnv) {
  console.log(`Reading in env file ./${nodeEnv}.js`);
  try {
    /* eslint-disable */
    envConfig = require(`./${nodeEnv}.js`);
    /* eslint-enable */
  } catch(e) {
    console.log('No environment file to load', e);
  }
}
// eslint-disable-next-line
const config = _.merge({}, defaults, envConfig);
module.exports = config;
