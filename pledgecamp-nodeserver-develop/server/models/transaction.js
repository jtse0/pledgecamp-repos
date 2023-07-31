const knex = require('../config/database');
const logger = require('../utils/logger');

const tableName = 'transactions';

const insert = async (recordData) => {
  try {
    logger.debug({ message: 'Transaction Model: ', meta: recordData });
    await knex(tableName).insert(recordData);
  } catch (error) {
    console.log(error);
    logger.error('DATABASE_INSERT_FAILED');
    throw error;
  }
};

const update = async (id, updateData) => {
  try {
    logger.debug({ message: 'Transaction Model: ', meta: updateData });
    await knex(tableName).where('transaction_uuid', id).update(updateData).limit(1);
  } catch (error) {
    logger.error('DATABASE_INSERT_FAILED');
    throw error;
  }
};

const getByStatusArray = async (statusArray) => {
  const result = await knex.select().table('transactions').whereIn('transaction_status', statusArray);
  return result;
};

module.exports = {
  getByStatusArray,
  insert,
  update,
};
