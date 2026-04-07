const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
};

async function init() {
  // 1. Создание БД если нет
  const client = new Client({ ...dbConfig, database: 'postgres' });
  try {
    await client.connect();
    const res = await client.query(`SELECT 1 FROM pg_database WHERE datname = '${process.env.DB_NAME || 'ludo_db'}'`);
    if (res.rowCount === 0) {
      console.log(`Создание базы данных ${process.env.DB_NAME || 'ludo_db'}...`);
      await client.query(`CREATE DATABASE ${process.env.DB_NAME || 'ludo_db'}`);
    } else {
      console.log(`База данных ${process.env.DB_NAME || 'ludo_db'} уже существует.`);
    }
  } catch (err) {
    console.error('Ошибка при проверке/создании БД:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }

  // 2. Выполнение schema.sql
  const dbClient = new Client({ ...dbConfig, database: process.env.DB_NAME || 'ludo_db' });
  try {
    await dbClient.connect();
    console.log('Подключено к ludo_db. Выполнение schema.sql...');
    const schemaSql = fs.readFileSync(path.join(__dirname, 'db', 'schema.sql'), 'utf8');
    await dbClient.query(schemaSql);
    console.log('Схема успешно инициализирована!');
  } catch (err) {
    console.error('Ошибка при выполнении schema.sql:', err.message);
    process.exit(1);
  } finally {
    await dbClient.end();
  }
}

init();
