const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /api/reminders/:caseId
router.get('/:caseId', (req, res) => {
  const db = getDb();
  const reminders = db.prepare(
    'SELECT * FROM reminders WHERE case_id = ? ORDER BY due_at ASC'
  ).all(req.params.caseId);
  res.json(reminders);
});

// GET /api/reminders — all overdue reminders across cases
router.get('/', (req, res) => {
  const db = getDb();
  const now = new Date().toISOString();
  const overdue = db.prepare(`
    SELECT r.*, c.title AS case_title, c.reference AS case_reference
    FROM reminders r
    JOIN cases c ON c.id = r.case_id
    WHERE r.completed = 0 AND r.due_at < ?
    ORDER BY r.due_at ASC
  `).all(now);
  res.json(overdue);
});

// POST /api/reminders/:caseId
router.post('/:caseId', (req, res) => {
  const { title, description, due_at } = req.body;
  if (!title || !due_at) return res.status(400).json({ error: 'title and due_at are required' });

  const db = getDb();
  const c = db.prepare('SELECT id FROM cases WHERE id = ?').get(req.params.caseId);
  if (!c) return res.status(404).json({ error: 'Case not found' });

  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(`INSERT INTO reminders (id, case_id, title, description, due_at, created_at)
              VALUES (?, ?, ?, ?, ?, ?)`)
    .run(id, req.params.caseId, title, description || null, due_at, now);

  // Timeline event
  db.prepare(`INSERT INTO case_events (id, case_id, event_type, body, metadata, created_at)
              VALUES (?, ?, 'reminder_set', ?, ?, ?)`)
    .run(uuidv4(), req.params.caseId, `Reminder set: ${title}`,
      JSON.stringify({ reminder_id: id, due_at }), now);

  db.prepare('UPDATE cases SET updated_at = ? WHERE id = ?').run(now, req.params.caseId);

  res.status(201).json(db.prepare('SELECT * FROM reminders WHERE id = ?').get(id));
});

// PATCH /api/reminders/:caseId/:reminderId — complete or update
router.patch('/:caseId/:reminderId', (req, res) => {
  const db = getDb();
  const reminder = db.prepare('SELECT * FROM reminders WHERE id = ? AND case_id = ?')
    .get(req.params.reminderId, req.params.caseId);
  if (!reminder) return res.status(404).json({ error: 'Reminder not found' });

  const { completed, title, description, due_at } = req.body;
  const now = new Date().toISOString();
  const updates = {};

  if (title !== undefined) updates.title = title;
  if (description !== undefined) updates.description = description;
  if (due_at !== undefined) updates.due_at = due_at;
  if (completed !== undefined) {
    updates.completed = completed ? 1 : 0;
    if (completed && !reminder.completed) {
      // Log completion on timeline
      db.prepare(`INSERT INTO case_events (id, case_id, event_type, body, metadata, created_at)
                  VALUES (?, ?, 'reminder_done', ?, ?, ?)`)
        .run(uuidv4(), req.params.caseId, `Reminder completed: ${reminder.title}`,
          JSON.stringify({ reminder_id: reminder.id }), now);
    }
  }

  if (Object.keys(updates).length === 0) return res.json(reminder);

  const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  db.prepare(`UPDATE reminders SET ${setClauses} WHERE id = ?`)
    .run(...Object.values(updates), req.params.reminderId);

  res.json(db.prepare('SELECT * FROM reminders WHERE id = ?').get(req.params.reminderId));
});

// DELETE /api/reminders/:caseId/:reminderId
router.delete('/:caseId/:reminderId', (req, res) => {
  const db = getDb();
  const reminder = db.prepare('SELECT id FROM reminders WHERE id = ? AND case_id = ?')
    .get(req.params.reminderId, req.params.caseId);
  if (!reminder) return res.status(404).json({ error: 'Reminder not found' });
  db.prepare('DELETE FROM reminders WHERE id = ?').run(req.params.reminderId);
  res.json({ ok: true });
});

module.exports = router;
