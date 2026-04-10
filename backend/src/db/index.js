const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/openresolve.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema();
    seedAdmin();
  }
  return db;
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cases (
      id TEXT PRIMARY KEY,
      reference TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      priority TEXT NOT NULL DEFAULT 'standard',
      description TEXT,
      opposing_party_name TEXT,
      opposing_party_address TEXT,
      opposing_party_phone TEXT,
      opposing_party_email TEXT,
      opposing_party_ref TEXT,
      jurisdiction TEXT NOT NULL DEFAULT 'uk',
      email_alias TEXT UNIQUE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      closed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS case_events (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      body TEXT,
      metadata TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
      event_id TEXT REFERENCES case_events(id) ON DELETE SET NULL,
      filename TEXT NOT NULL,
      filepath TEXT NOT NULL,
      size INTEGER,
      mime_type TEXT,
      doc_type TEXT NOT NULL DEFAULT 'other',
      description TEXT,
      uploaded_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reminders (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      due_at TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      notified_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_case_events_case_id ON case_events(case_id);
    CREATE INDEX IF NOT EXISTS idx_case_events_created_at ON case_events(created_at);
    CREATE INDEX IF NOT EXISTS idx_documents_case_id ON documents(case_id);
    CREATE INDEX IF NOT EXISTS idx_reminders_case_id ON reminders(case_id);
    CREATE INDEX IF NOT EXISTS idx_reminders_due_at ON reminders(due_at);
  `);
}

function seedAdmin() {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'changeme';
  const existing = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!existing) {
    const hash = bcrypt.hashSync(password, 12);
    db.prepare('INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)')
      .run(uuidv4(), username, hash, new Date().toISOString());
    console.log(`Admin user '${username}' created.`);
  } else if (process.env.ADMIN_PASSWORD) {
    // If ADMIN_PASSWORD is explicitly set and doesn't match the stored hash,
    // update it. This ensures that changing ADMIN_PASSWORD in .env and
    // restarting always takes effect (e.g. after a botched first-run).
    // Note: if you change your password via the web UI, also update ADMIN_PASSWORD
    // in .env — otherwise a container restart will revert it to the .env value.
    const matches = bcrypt.compareSync(password, existing.password_hash);
    if (!matches) {
      const hash = bcrypt.hashSync(password, 12);
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, existing.id);
      console.log(`Admin user '${username}' password updated from ADMIN_PASSWORD env var.`);
    }
  }
}

module.exports = { getDb };
