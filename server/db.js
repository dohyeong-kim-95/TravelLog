const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'travellog.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS visits (
    city_code TEXT PRIMARY KEY,
    city_name TEXT NOT NULL,
    province  TEXT NOT NULL,
    user1     INTEGER NOT NULL DEFAULT 0,
    user2     INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

const getAll = db.prepare('SELECT * FROM visits');
const upsert = db.prepare(`
  INSERT INTO visits (city_code, city_name, province, user1, user2, updated_at)
  VALUES (@code, @name, @province, @user1, @user2, datetime('now'))
  ON CONFLICT(city_code) DO UPDATE SET
    user1 = @user1,
    user2 = @user2,
    updated_at = datetime('now')
`);
const getOne = db.prepare('SELECT * FROM visits WHERE city_code = ?');

module.exports = { getAll, upsert, getOne };
