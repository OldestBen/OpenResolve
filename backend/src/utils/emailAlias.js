function buildAlias(caseReference) {
  const domain = process.env.EMAIL_DOMAIN;
  if (!domain) return null;
  const slug = caseReference.toLowerCase().replace(/[^a-z0-9]/g, '-');
  return `case-${slug}@${domain}`;
}

module.exports = { buildAlias };
