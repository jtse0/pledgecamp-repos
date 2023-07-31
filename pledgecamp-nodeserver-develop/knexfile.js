// Update with your config settings.
require('dotenv').config();

module.exports = {
  development: {
    client: 'sqlite3',
    connection: {
      filename: `${__dirname}/server/db/development_sqlite/database.db`,
    },
    useNullAsDefault: true,
    migrations: {
      directory: `${__dirname}/server/db/migrations`,
      tableName: 'migrations',
    },
  },
  testing: {
    client: 'sqlite3',
    connection: ':memory:',
    useNullAsDefault: true,
    migrations: {
      directory: `${__dirname}/server/db/migrations`,
      tableName: 'migrations',
    },
    // client: 'sqlite3',
    // connection: {
    //   filename: './database/node_server.db',
    // },
    // useNullAsDefault: true,
    // migrations: {
    //   directory: './server/migrations/',
    //   tableName: 'migrations',
    // },
  },
  staging: {
    client: 'postgresql',
    connection: {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
    },
    pool: {
      min: 2,
      max: 10,
    },
    migrations: {
      directory: `${__dirname}/server/db/migrations`,
      tableName: 'migrations',
    },
  },
  production: {
    client: 'postgresql',
    connection: {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
    },
    pool: {
      min: 2,
      max: 10,
    },
    migrations: {
      directory: `${__dirname}/server/db/migrations`,
      tableName: 'migrations',
    },
  },
};
