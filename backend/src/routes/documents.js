const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const UPLOAD_PATH = process.env.UPLOAD_PATH || path.join(__dirname, '../../uploads');
const VALID_DOC_TYPES = ['evidence', 'correspondence', 'medical', 'legal', 'other'];

const storage = multer.diskStorage({
  destination(_req, _file, cb) { cb(null, UPLOAD_PATH); },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter(_req, file, cb) {
    const allowed = [
      'application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain', 'message/rfc822',
    ];
    cb(null, allowed.includes(file.mimetype));
  },
});

// GET /api/documents/:caseId
router.get('/:caseId', (req, res) => {
  const db = getDb();
  const docs = db.prepare('SELECT * FROM documents WHERE case_id = ? ORDER BY uploaded_at DESC')
    .all(req.params.caseId);
  res.json(docs);
});

// POST /api/documents/:caseId
router.post('/:caseId', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded or unsupported type' });

  const db = getDb();
  const c = db.prepare('SELECT id FROM cases WHERE id = ?').get(req.params.caseId);
  if (!c) {
    fs.unlinkSync(req.file.path);
    return res.status(404).json({ error: 'Case not found' });
  }

  const { doc_type, description } = req.body;
  const docType = VALID_DOC_TYPES.includes(doc_type) ? doc_type : 'other';
  const id = uuidv4();
  const now = new Date().toISOString();

  // Create a timeline event for the upload
  const eventId = uuidv4();
  db.prepare(`INSERT INTO case_events (id, case_id, event_type, body, metadata, created_at)
              VALUES (?, ?, 'document', ?, ?, ?)`)
    .run(eventId, req.params.caseId,
      description || req.file.originalname,
      JSON.stringify({ doc_type: docType, filename: req.file.originalname, size: req.file.size }),
      now);

  db.prepare(`INSERT INTO documents (id, case_id, event_id, filename, filepath, size, mime_type, doc_type, description, uploaded_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, req.params.caseId, eventId,
      req.file.originalname, req.file.filename, req.file.size,
      req.file.mimetype, docType, description || null, now);

  db.prepare('UPDATE cases SET updated_at = ? WHERE id = ?').run(now, req.params.caseId);

  res.status(201).json(db.prepare('SELECT * FROM documents WHERE id = ?').get(id));
});

// GET /api/documents/:caseId/:docId/download
router.get('/:caseId/:docId/download', (req, res) => {
  const db = getDb();
  const doc = db.prepare('SELECT * FROM documents WHERE id = ? AND case_id = ?')
    .get(req.params.docId, req.params.caseId);
  if (!doc) return res.status(404).json({ error: 'Document not found' });

  const filePath = path.join(UPLOAD_PATH, doc.filepath);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File missing on disk' });

  res.download(filePath, doc.filename);
});

// DELETE /api/documents/:caseId/:docId
router.delete('/:caseId/:docId', (req, res) => {
  const db = getDb();
  const doc = db.prepare('SELECT * FROM documents WHERE id = ? AND case_id = ?')
    .get(req.params.docId, req.params.caseId);
  if (!doc) return res.status(404).json({ error: 'Document not found' });

  const filePath = path.join(UPLOAD_PATH, doc.filepath);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  db.prepare('DELETE FROM documents WHERE id = ?').run(req.params.docId);
  res.json({ ok: true });
});

module.exports = router;
