const express = require('express');
const fs = require('fs');
const path = require('path');
const { marked } = require('marked');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const RIGHTS_PATH = process.env.RIGHTS_PATH || path.join(__dirname, '../../../rights-content');

const TYPE_TO_FILE = {
  road_traffic: 'road-traffic-accident',
  consumer: 'consumer-rights',
  insurance: 'insurance-claim',
  landlord_tenant: 'landlord-tenant',
  financial: 'financial-complaint',
  generic: 'generic',
};

// GET /api/rights/:jurisdiction/:caseType
router.get('/:jurisdiction/:caseType', (req, res) => {
  const { jurisdiction, caseType } = req.params;
  const filename = TYPE_TO_FILE[caseType];
  if (!filename) return res.status(404).json({ error: 'Unknown case type' });

  const mdPath = path.join(RIGHTS_PATH, jurisdiction, `${filename}.md`);

  if (!fs.existsSync(mdPath)) {
    // Fall back to generic
    const genericPath = path.join(RIGHTS_PATH, jurisdiction, 'generic.md');
    if (!fs.existsSync(genericPath)) {
      return res.status(404).json({ error: 'No rights content found for this jurisdiction' });
    }
    const md = fs.readFileSync(genericPath, 'utf8');
    return res.json({ html: marked(md), raw: md, jurisdiction, caseType: 'generic', fallback: true });
  }

  const md = fs.readFileSync(mdPath, 'utf8');
  res.json({ html: marked(md), raw: md, jurisdiction, caseType });
});

// GET /api/rights — list available jurisdictions
router.get('/', (req, res) => {
  if (!fs.existsSync(RIGHTS_PATH)) return res.json([]);
  const dirs = fs.readdirSync(RIGHTS_PATH, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);
  res.json(dirs);
});

module.exports = router;
