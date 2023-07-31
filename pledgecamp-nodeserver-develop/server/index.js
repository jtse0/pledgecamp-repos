const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const http = require('http');
const passport = require('passport');
const { AuthStrategy } = require('./utils/authUtil');
const logger = require('./utils/logger');
const routeInitialize = require('./routes');

const app = express();
passport.use(AuthStrategy);
app.use(passport.initialize());
app.logger = logger;
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: 'GET,PUT,POST,DELETE,OPTIONS',
  }),
);

const server = http.createServer(app);

routeInitialize(app);

module.exports = {
  server,
  app,
};
