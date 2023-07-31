const env = process.env.NODE_ENV || 'production';
const knexModule = require('knex');
const knexfile = require('../../knexfile');

const knex = knexModule(knexfile[env]);

module.exports = knex;
