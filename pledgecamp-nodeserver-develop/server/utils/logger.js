const { createLogger, addColors, format, transports } = require('winston');
const config = require('../config/index');
require('winston-daily-rotate-file');

const { combine, timestamp, colorize, printf } = format;

const myFormat = printf(({ level, message, timestamp: timeValue, meta }) => {
  const msg = message || '';
  const metaJSON = meta && Object.keys(meta).length ? `${JSON.stringify(meta, null, 2)}` : '';
  return `${timeValue}: [${level}] ${msg} ${metaJSON}`;
});

const consoleTransport = new transports.Console({
  level: config.logLevel,
  format: combine(timestamp(), colorize(), myFormat),
});
const fileTransport = new transports.DailyRotateFile({
  filename: 'nodeserver-%DATE%.log',
  dirname: 'logs',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  level: config.logLevel,
  format: combine(timestamp(), myFormat),
});
const myTransports = process.env.NODE_ENV === 'development' ? [consoleTransport] : [fileTransport];

const logger = createLogger({
  transports: myTransports,
  silent: process.env.NODE_ENV === 'testing',
});

addColors({
  info: 'green bold',
  debug: 'cyan bold',
  warn: 'yellow bold',
  error: 'redBG white bold',
  http: 'magenta bold',
});

module.exports = logger;
