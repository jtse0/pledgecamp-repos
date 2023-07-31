const amqp = require('amqplib');
const config = require('../config');
const logger = require('./logger');

const { host, pass, port, user } = config.rabbitMq;

/**
 * GET CONNECTION
 * Establish a basic connection handle for internal functions
 */
const getConnection = () => {
  let connectUri = 'amqp://';
  if (user) {
    connectUri = `${connectUri}${user}:${pass}@`;
  }
  connectUri = `${connectUri}${host}:${port}`;
  return amqp.connect(connectUri);
};

const purgeQueue = async (queueReference) => {
  const connection = await getConnection();
  const channel = await connection.createChannel();
  channel.purgeQueue(queueReference);
};

/**
 * PUSH MESSAGE
 * @param {*} queueReference
 * @param {*} message
 */
const pushMessage = async (queueReference, message) => {
  logger.debug(`[func] Push Message -> ${queueReference}: ${message}`);

  // Get Handler code
  const connection = await getConnection();
  const channel = await connection.createChannel();
  channel.assertQueue(queueReference, { durable: false });

  // Construct the message
  channel.sendToQueue(queueReference, Buffer.from(message));
  setTimeout(() => {
    channel.close();
    connection.close();
  }, 1500);

  return true;
};
/**
 * PUSH OBJECT
 * Proxy function for pushMessage which JSON encodes argument
 * @param {*} queueReference
 * @param {*} dataObject
 */
const pushObject = (queueReference, dataObject) => {
  logger.debug(`Pushing object to ${queueReference}`);
  return pushMessage(queueReference, JSON.stringify(dataObject));
};

/**
 * QUEUE READ
 * Given a queue name and callback function, this function acts as a common connection facade
 * @param {*} queueReference
 * @param {*} callbackFunction
 */
const queueRead = async (queueReference, callbackFunction) => {
  logger.info(`[func] Read Queue: ${queueReference}`);
  const connection = await getConnection();
  process.once('SIGINT', () => {
    connection.close();
  });
  const channel = await connection.createChannel();
  await channel.assertQueue(queueReference, { durable: false });
  // Attach channel to the callback function for ACK
  return channel.consume(queueReference, (msg) => {
    callbackFunction(msg, channel);
  });
};

module.exports = {
  purgeQueue,
  pushMessage,
  pushObject,
  queueRead,
};
