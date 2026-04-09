const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { generateCaseRef } = require('../utils/caseRef');
const { buildAlias } = require('../utils/emailAlias');

const router = express.Router();
router.use(requireAuth);

const VALID_TYPES = ['road_traffic', 'consumer', 'insurance', 'landlord_tenant', 'financial', 'generic'];
const VALID_STATUSES = ['open', 'active', 'escalated', 'resolved', 'closed'];
const VALID_PRIORITIES = ['urgent', 'standard', 'low'];

router.get('/', (req, res) => {
  const db = getDb();
  const { status, type, priority, q } = req.query;

  let sql = 'SELECT * FROM cases WHERE 1=1';
  const params = [];

  if (status) { sql += ' AND status = ?'; params.push(status); }
  if (type) { sql += ' AND type = ?'; params.push(type); }
  if (priority) { sql += ' AND priority = ?'; params.push(priority); }
  if (q) { sql += ' AND (title LIKE ? OR reference LIKE ? OR opposing_party_name LIKE ?)'; params.push(`%${q}%`, `%${q}%`, `%${q}%`); }

  sql += ' ORDER BY updated_at DESC';

  const cases = db.prepare(sql).all(...params);
  res.json(cases);
});

router.get('/stats', (req, res) => {
  const db = getDb();
  const now = new Date().toISOString();

  const total = db.prepare("SELECT COUNT(*) AS n FROM cases WHERE status NOT IN ('resolved','closed')").get().n;
  const byStatus = db.prepare("SELECT status, COUNT(*) AS n FROM cases GROUP BY status").all();
  const byType = db.prepare("SELECT type, COUNT(*) AS n FROM cases WHERE status NOT IN ('resolved','closed') GROUP BY type").all();
  const overdueReminders = db.prepare("SELECT COUNT(*) AS n FROM reminders WHERE completed = 0 AND due_at < ?").get(now).n;
  const recentEvents = db.prepare(`
    SELECT ce.*, c.title AS case_title, c.reference AS case_reference
    FROM case_events ce
    JOIN cases c ON c.id = ce.case_id
    ORDER BY ce.created_at DESC LIMIT 10
  `).all();

  res.json({ total, byStatus, byType, overdueReminders, recentEvents });
});

router.get('/:id', (req, res) => {
  const db = getDb();
  const c = db.prepare('SELECT * FROM cases WHERE id = ?').get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Case not found' });
  res.json(c);
});

router.post('/', (req, res) => {
  const { title, type, priority, description, jurisdiction,
          opposing_party_name, opposing_party_address, opposing_party_phone,
          opposing_party_email, opposing_party_ref } = req.body;

  if (!title || !type) return res.status(400).json({ error: 'title and type are required' });
  if (!VALID_TYPES.includes(type)) return res.status(400).json({ error: 'Invalid case type' });

  const db = getDb();
  const id = uuidv4();
  const reference = generateCaseRef();
  const now = new Date().toISOString();
  const emailAlias = process.env.EMAIL_INGESTION_ENABLED === 'true' ? buildAlias(reference) : null;

  db.prepare(`
    INSERT INTO cases (id, reference, title, type, status, priority, description, jurisdiction,
      opposing_party_name, opposing_party_address, opposing_party_phone,
      opposing_party_email, opposing_party_ref, email_alias, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, reference, title, type,
    priority || 'standard', description || null, jurisdiction || 'uk',
    opposing_party_name || null, opposing_party_address || null,
    opposing_party_phone || null, opposing_party_email || null,
    opposing_party_ref || null, emailAlias, now, now);

  // Log creation event
  db.prepare(`INSERT INTO case_events (id, case_id, event_type, body, metadata, created_at)
              VALUES (?, ?, 'status_change', ?, ?, ?)`)
    .run(uuidv4(), id, 'Case created', JSON.stringify({ from: null, to: 'open' }), now);

  const created = db.prepare('SELECT * FROM cases WHERE id = ?').get(id);
  res.status(201).json(created);
});

router.patch('/:id', (req, res) => {
  const db = getDb();
  const c = db.prepare('SELECT * FROM cases WHERE id = ?').get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Case not found' });

  const allowed = ['title', 'type', 'status', 'priority', 'description', 'jurisdiction',
    'opposing_party_name', 'opposing_party_address', 'opposing_party_phone',
    'opposing_party_email', 'opposing_party_ref'];

  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  if (updates.status && !VALID_STATUSES.includes(updates.status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  if (updates.type && !VALID_TYPES.includes(updates.type)) {
    return res.status(400).json({ error: 'Invalid type' });
  }

  const now = new Date().toISOString();
  updates.updated_at = now;
  if (updates.status && ['resolved', 'closed'].includes(updates.status) && !c.closed_at) {
    updates.closed_at = now;
  }

  const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  db.prepare(`UPDATE cases SET ${setClauses} WHERE id = ?`)
    .run(...Object.values(updates), req.params.id);

  // Log status change event
  if (updates.status && updates.status !== c.status) {
    db.prepare(`INSERT INTO case_events (id, case_id, event_type, body, metadata, created_at)
                VALUES (?, ?, 'status_change', ?, ?, ?)`)
      .run(uuidv4(), req.params.id,
        `Status changed from ${c.status} to ${updates.status}`,
        JSON.stringify({ from: c.status, to: updates.status }), now);
  }

  res.json(db.prepare('SELECT * FROM cases WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  const c = db.prepare('SELECT id FROM cases WHERE id = ?').get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Case not found' });
  db.prepare('DELETE FROM cases WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
