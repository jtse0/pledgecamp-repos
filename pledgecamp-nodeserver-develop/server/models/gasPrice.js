const knex = require('../config/database');
const logger = require('../utils/logger');

const tableName = 'gas_price';

const insert = async (recordData) => {
  try {
    logger.debug({ message: 'Gas Price Model: ', meta: recordData });
    await knex(tableName).insert(recordData);
  } catch (error) {
    logger.error('DATABASE_INSERT_FAILED');
    throw error;
  }
};

const update = async (id, updateData) => {
  try {
    logger.debug({ message: 'Gas Price Model: ', meta: updateData });
    await knex(tableName).where('price_id', id).update(updateData).limit(1);
  } catch (error) {
    logger.error('DATABASE_UPDATE_FAILED');
    throw error;
  }
};

const getData = async () => {
  let result;
  try {
    logger.debug({ message: 'Gas Price Model getData()' });
    result = await knex.select().table(tableName).orderBy('price_timestamp', 'desc').limit(1);
  } catch (error) {
    logger.error('DATABASE_SELECT_FAILED');
    throw error;
  }
  return result;
};

module.exports = {
  insert,
  update,
  getData,
};
