const express = require('express');
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const archiver = require('archiver');
const { getDb } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const UPLOAD_PATH = process.env.UPLOAD_PATH || path.join(__dirname, '../../uploads');

const TYPE_LABELS = {
  road_traffic: 'Road Traffic Accident',
  consumer: 'Consumer Rights Dispute',
  insurance: 'Insurance Claim',
  landlord_tenant: 'Landlord / Tenant Dispute',
  financial: 'Financial Complaint',
  generic: 'General Case',
};

const STATUS_LABELS = {
  open: 'Open', active: 'Active', escalated: 'Escalated', resolved: 'Resolved', closed: 'Closed',
};

const EVENT_LABELS = {
  note: 'Note', call: 'Call Note', document: 'Document Added', email: 'Email',
  status_change: 'Status Change', reminder_set: 'Reminder Set', reminder_done: 'Reminder Completed',
};

// GET /api/export/:caseId/pdf
router.get('/:caseId/pdf', (req, res) => {
  const db = getDb();
  const c = db.prepare('SELECT * FROM cases WHERE id = ?').get(req.params.caseId);
  if (!c) return res.status(404).json({ error: 'Case not found' });

  const events = db.prepare('SELECT * FROM case_events WHERE case_id = ? ORDER BY created_at ASC').all(req.params.caseId);
  const docs = db.prepare('SELECT * FROM documents WHERE case_id = ? ORDER BY uploaded_at DESC').all(req.params.caseId);
  const reminders = db.prepare('SELECT * FROM reminders WHERE case_id = ? ORDER BY due_at ASC').all(req.params.caseId);

  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${c.reference}-case-file.pdf"`);
  doc.pipe(res);

  // Cover
  doc.fontSize(22).font('Helvetica-Bold').text('OpenResolve — Case File', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(16).font('Helvetica').text(c.title, { align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(11).fillColor('#555').text(`Reference: ${c.reference}  |  Status: ${STATUS_LABELS[c.status] || c.status}`, { align: 'center' });
  doc.moveDown(0.2);
  doc.text(`Type: ${TYPE_LABELS[c.type] || c.type}  |  Priority: ${c.priority}  |  Jurisdiction: ${c.jurisdiction.toUpperCase()}`, { align: 'center' });
  doc.fillColor('#000').moveDown(1);

  // Case details
  section(doc, 'Case Details');
  field(doc, 'Created', fmt(c.created_at));
  field(doc, 'Last updated', fmt(c.updated_at));
  if (c.closed_at) field(doc, 'Closed', fmt(c.closed_at));
  if (c.description) field(doc, 'Description', c.description);

  if (c.opposing_party_name) {
    doc.moveDown(0.5);
    section(doc, 'Opposing Party');
    field(doc, 'Name', c.opposing_party_name);
    if (c.opposing_party_address) field(doc, 'Address', c.opposing_party_address);
    if (c.opposing_party_phone) field(doc, 'Phone', c.opposing_party_phone);
    if (c.opposing_party_email) field(doc, 'Email', c.opposing_party_email);
    if (c.opposing_party_ref) field(doc, 'Their Reference', c.opposing_party_ref);
  }

  // Timeline
  doc.addPage();
  section(doc, 'Case Timeline');

  for (const ev of events) {
    const meta = ev.metadata ? JSON.parse(ev.metadata) : {};
    doc.fontSize(10).font('Helvetica-Bold')
      .text(`[${EVENT_LABELS[ev.event_type] || ev.event_type}]  ${fmt(ev.created_at)}`, { continued: false });
    if (ev.body) {
      doc.font('Helvetica').fontSize(10).text(ev.body, { indent: 20 });
    }
    if (ev.event_type === 'call' && meta.caller_name) {
      doc.font('Helvetica').fontSize(9).fillColor('#555')
        .text(`Caller: ${meta.caller_name}  |  Outcome: ${meta.outcome}  |  Follow-up: ${meta.follow_up_required ? 'Yes' : 'No'}`, { indent: 20 });
      doc.fillColor('#000');
    }
    if (ev.event_type === 'email' && meta.from) {
      doc.font('Helvetica').fontSize(9).fillColor('#555')
        .text(`From: ${meta.from}  |  Subject: ${meta.subject || '—'}`, { indent: 20 });
      doc.fillColor('#000');
    }
    doc.moveDown(0.5);
  }

  // Documents
  if (docs.length > 0) {
    doc.addPage();
    section(doc, 'Documents');
    for (const d of docs) {
      doc.fontSize(10).font('Helvetica-Bold').text(d.filename);
      doc.font('Helvetica').fontSize(9).fillColor('#555')
        .text(`Type: ${d.doc_type}  |  Size: ${formatBytes(d.size)}  |  Added: ${fmt(d.uploaded_at)}`);
      if (d.description) doc.text(`Description: ${d.description}`);
      doc.fillColor('#000').moveDown(0.5);
    }
  }

  // Reminders
  if (reminders.length > 0) {
    doc.addPage();
    section(doc, 'Reminders & Deadlines');
    for (const r of reminders) {
      doc.fontSize(10).font('Helvetica-Bold').text(`${r.completed ? '[DONE] ' : ''}${r.title}`);
      doc.font('Helvetica').fontSize(9).fillColor('#555').text(`Due: ${fmt(r.due_at)}`);
      if (r.description) doc.text(r.description);
      doc.fillColor('#000').moveDown(0.5);
    }
  }

  doc.end();
});

// GET /api/export/:caseId/zip
router.get('/:caseId/zip', (req, res) => {
  const db = getDb();
  const c = db.prepare('SELECT * FROM cases WHERE id = ?').get(req.params.caseId);
  if (!c) return res.status(404).json({ error: 'Case not found' });

  const events = db.prepare('SELECT * FROM case_events WHERE case_id = ? ORDER BY created_at ASC').all(req.params.caseId)
    .map(e => ({ ...e, metadata: e.metadata ? JSON.parse(e.metadata) : null }));
  const docs = db.prepare('SELECT * FROM documents WHERE case_id = ? ORDER BY uploaded_at DESC').all(req.params.caseId);
  const reminders = db.prepare('SELECT * FROM reminders WHERE case_id = ? ORDER BY due_at ASC').all(req.params.caseId);

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${c.reference}-case-export.zip"`);

  const archive = archiver('zip', { zlib: { level: 6 } });
  archive.pipe(res);

  // Metadata JSON
  const metadata = { case: c, events, reminders, documents: docs.map(d => ({ ...d, filepath: undefined })) };
  archive.append(JSON.stringify(metadata, null, 2), { name: 'case-metadata.json' });

  // Documents
  for (const d of docs) {
    const filePath = path.join(UPLOAD_PATH, d.filepath);
    if (fs.existsSync(filePath)) {
      archive.file(filePath, { name: `documents/${d.doc_type}/${d.filename}` });
    }
  }

  archive.finalize();
});

function section(doc, title) {
  doc.fontSize(13).font('Helvetica-Bold').fillColor('#1a56db').text(title);
  doc.moveTo(doc.x, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .strokeColor('#1a56db').stroke();
  doc.fillColor('#000').moveDown(0.4);
}

function field(doc, label, value) {
  doc.fontSize(10);
  doc.font('Helvetica-Bold').text(`${label}: `, { continued: true });
  doc.font('Helvetica').text(value || '—');
}

function fmt(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

function formatBytes(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

module.exports = router;
