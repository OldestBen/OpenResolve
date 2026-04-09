# Rights Content

This directory contains the jurisdiction-aware rights guidance shown in the "Rights & Guidance" tab of each case.

## Structure

```
rights-content/
  <jurisdiction>/
    road-traffic-accident.md
    consumer-rights.md
    insurance-claim.md
    landlord-tenant.md
    financial-complaint.md
    generic.md          ← fallback for unknown case types
```

## Adding a New Jurisdiction

Create a new subdirectory (e.g. `us/`, `au/`, `de/`) and add markdown files following the same naming convention. The backend will serve them automatically; no code changes needed.

## Editing Content

These are plain markdown files — edit them directly. Changes take effect immediately (no restart needed). They are mounted read-only into the Docker container from the host filesystem.

## Contributing

Rights content contributions from lawyers, advisers, and informed citizens are very welcome. Please open a pull request with:
- Accurate, up-to-date legislation references
- Practical escalation paths
- Key contacts and time limits

Content is rendered as HTML in the frontend with basic markdown formatting.
