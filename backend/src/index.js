require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// ── JWT_SECRET guard ──────────────────────────────────────────────────────────
// A missing or placeholder secret means tokens would be signed with a known
// value — anyone could forge them. Generate a random one and warn loudly.
const WEAK_PATTERNS = ['please_run', 'change_me', 'dev_secret', 'changeme'];
if (!process.env.JWT_SECRET || WEAK_PATTERNS.some(p => process.env.JWT_SECRET.includes(p))) {
  const generated = crypto.randomBytes(48).toString('hex');
  process.env.JWT_SECRET = generated;
  console.warn('');
  console.warn('  ⚠  WARNING: JWT_SECRET is missing or insecure.');
  console.warn('     A temporary secret has been generated for this session.');
  console.warn('     All existing sessions will be invalidated on next restart.');
  console.warn('     Run ./setup.sh (or set JWT_SECRET in .env) to fix this.');
  console.warn('');
}

// Ensure data dirs exist
const uploadPath = process.env.UPLOAD_PATH || path.join(__dirname, '../uploads');
fs.mkdirSync(uploadPath, { recursive: true });

const { getDb } = require('./db');
getDb(); // initialise DB and seed admin on startup

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));
app.use(cors({ origin: process.env.CORS_ORIGIN || true }));
app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/cases', require('./routes/cases'));
app.use('/api/events', require('./routes/events'));
app.use('/api/documents', require('./routes/documents'));
app.use('/api/reminders', require('./routes/reminders'));
app.use('/api/rights', require('./routes/rights'));
app.use('/api/export', require('./routes/export'));
app.use('/api/webhook', require('./routes/webhook'));

// Serve uploaded files (auth protected via route)
app.use('/uploads', express.static(uploadPath));

app.get('/api/health', (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`OpenResolve backend listening on :${PORT}`));
