const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db');

const router = express.Router();

// POST /api/webhook/email
// Receives inbound email from Cloudflare Email Workers or similar.
// Payload (JSON):
//   { to, from, subject, date, text, html, attachments: [{filename, content (base64), contentType}] }
// Header: X-Webhook-Secret: <WEBHOOK_SECRET>
router.post('/email', (req, res) => {
  if (process.env.EMAIL_INGESTION_ENABLED !== 'true') {
    return res.status(404).json({ error: 'Email ingestion not enabled' });
  }

  const secret = req.headers['x-webhook-secret'];
  if (!secret || secret !== process.env.WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Unauthorised' });
  }

  const { to, from, subject, date, text } = req.body;
  if (!to || !text) return res.status(400).json({ error: 'to and text are required' });

  const db = getDb();

  // Find case by email alias
  const c = db.prepare('SELECT * FROM cases WHERE email_alias = ?').get(to.toLowerCase().trim());
  if (!c) {
    // Accept with 200 so the mail server doesn't retry, just ignore unknown addresses
    return res.json({ ok: true, ignored: true });
  }

  const now = new Date().toISOString();
  const eventId = uuidv4();

  db.prepare(`INSERT INTO case_events (id, case_id, event_type, body, metadata, created_at)
              VALUES (?, ?, 'email', ?, ?, ?)`)
    .run(eventId, c.id, text,
      JSON.stringify({ from, subject, date_sent: date, source: 'alias', to }),
      now);

  db.prepare('UPDATE cases SET updated_at = ? WHERE id = ?').run(now, c.id);

  console.log(`Inbound email for case ${c.reference} from ${from}: "${subject}"`);
  res.json({ ok: true, case_id: c.id, event_id: eventId });
});

module.exports = router;
