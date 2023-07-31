const knex = require('../config/database');
const logger = require('../utils/logger');

const tableName = 'projects';

const insert = async (recordData) => {
  try {
    logger.debug({ message: 'Project Model: ', meta: recordData });
    await knex(tableName).insert(recordData);
  } catch (error) {
    console.log(error);
    logger.error('DATABASE_INSERT_FAILED');
    throw error;
  }
};

const update = async (id, updateData) => {
  try {
    logger.debug({ message: 'Project Model: ', meta: updateData });
    await knex(tableName).where('project_id', id).update(updateData).limit(1);
  } catch (error) {
    logger.error('DATABASE_INSERT_FAILED');
    throw error;
  }
};

const getByProjectAddress = async (projectAddress) => {
  const result = await knex.select().table(tableName).where('project_address', projectAddress).limit(1);
  return result;
};

module.exports = {
  getByProjectAddress,
  insert,
  update,
};
