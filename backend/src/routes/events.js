const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /api/events/:caseId — timeline for a case
router.get('/:caseId', (req, res) => {
  const db = getDb();
  const { type } = req.query;
  let sql = 'SELECT * FROM case_events WHERE case_id = ?';
  const params = [req.params.caseId];
  if (type) { sql += ' AND event_type = ?'; params.push(type); }
  sql += ' ORDER BY created_at ASC';
  const events = db.prepare(sql).all(...params);
  res.json(events.map(e => ({
    ...e,
    metadata: e.metadata ? JSON.parse(e.metadata) : null,
  })));
});

// POST /api/events/:caseId/note
router.post('/:caseId/note', (req, res) => {
  const { body, tags } = req.body;
  if (!body) return res.status(400).json({ error: 'body is required' });
  const db = getDb();
  ensureCase(db, req.params.caseId, res);
  const id = uuidv4();
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO case_events (id, case_id, event_type, body, metadata, created_at)
              VALUES (?, ?, 'note', ?, ?, ?)`)
    .run(id, req.params.caseId, body, JSON.stringify({ tags: tags || [] }), now);
  touchCase(db, req.params.caseId, now);
  res.status(201).json(getEvent(db, id));
});

// POST /api/events/:caseId/call
router.post('/:caseId/call', (req, res) => {
  const { caller_name, caller_number, duration_minutes, outcome, follow_up_required, notes } = req.body;
  if (!outcome) return res.status(400).json({ error: 'outcome is required' });
  const db = getDb();
  ensureCase(db, req.params.caseId, res);
  const id = uuidv4();
  const now = new Date().toISOString();
  const meta = { caller_name, caller_number, duration_minutes, outcome, follow_up_required: !!follow_up_required };
  db.prepare(`INSERT INTO case_events (id, case_id, event_type, body, metadata, created_at)
              VALUES (?, ?, 'call', ?, ?, ?)`)
    .run(id, req.params.caseId, notes || null, JSON.stringify(meta), now);
  touchCase(db, req.params.caseId, now);
  res.status(201).json(getEvent(db, id));
});

// POST /api/events/:caseId/email
router.post('/:caseId/email', (req, res) => {
  const { from, subject, date_sent, body } = req.body;
  if (!body) return res.status(400).json({ error: 'body is required' });
  const db = getDb();
  ensureCase(db, req.params.caseId, res);
  const id = uuidv4();
  const now = new Date().toISOString();
  const meta = { from, subject, date_sent, source: 'manual' };
  db.prepare(`INSERT INTO case_events (id, case_id, event_type, body, metadata, created_at)
              VALUES (?, ?, 'email', ?, ?, ?)`)
    .run(id, req.params.caseId, body, JSON.stringify(meta), now);
  touchCase(db, req.params.caseId, now);
  res.status(201).json(getEvent(db, id));
});

// DELETE /api/events/:caseId/:eventId
router.delete('/:caseId/:eventId', (req, res) => {
  const db = getDb();
  const event = db.prepare('SELECT id FROM case_events WHERE id = ? AND case_id = ?')
    .get(req.params.eventId, req.params.caseId);
  if (!event) return res.status(404).json({ error: 'Event not found' });
  db.prepare('DELETE FROM case_events WHERE id = ?').run(req.params.eventId);
  res.json({ ok: true });
});

function ensureCase(db, caseId, res) {
  const c = db.prepare('SELECT id FROM cases WHERE id = ?').get(caseId);
  if (!c) { res.status(404).json({ error: 'Case not found' }); throw new Error('abort'); }
}

function touchCase(db, caseId, now) {
  db.prepare('UPDATE cases SET updated_at = ? WHERE id = ?').run(now, caseId);
}

function getEvent(db, id) {
  const e = db.prepare('SELECT * FROM case_events WHERE id = ?').get(id);
  return { ...e, metadata: e.metadata ? JSON.parse(e.metadata) : null };
}

module.exports = router;
