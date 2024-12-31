const mysql = require('mysql2');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: 'root',
  password: '',
  database: 'FishStoreDB',
});

const promisePool = pool.promise();

module.exports = promisePool;
