const { getDb } = require('../db');

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomChars(n) {
  let s = '';
  for (let i = 0; i < n; i++) {
    s += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return s;
}

function generateCaseRef() {
  const db = getDb();
  const year = new Date().getFullYear();
  let ref;
  let attempts = 0;
  do {
    ref = `OR-${year}-${randomChars(6)}`;
    attempts++;
    if (attempts > 100) throw new Error('Could not generate unique case reference');
  } while (db.prepare('SELECT id FROM cases WHERE reference = ?').get(ref));
  return ref;
}

module.exports = { generateCaseRef };
