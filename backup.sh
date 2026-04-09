#!/usr/bin/env bash
# OpenResolve backup script
# Creates a timestamped .tar.gz of all your case data and uploads.
# Usage: ./backup.sh [output-directory]

set -euo pipefail

OUTPUT_DIR="${1:-.}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="${OUTPUT_DIR}/openresolve-backup-${TIMESTAMP}.tar.gz"

echo "  → Backing up OpenResolve data..."

docker run --rm \
  -v openresolve-data:/data:ro \
  -v "$(realpath "$OUTPUT_DIR"):/backup" \
  alpine \
  tar czf "/backup/openresolve-backup-${TIMESTAMP}.tar.gz" /data

echo "  ✓ Backup saved to: ${BACKUP_FILE}"
echo ""
echo "  To restore:"
echo "    docker compose down"
echo "    docker run --rm -v openresolve-data:/data -v \$(pwd):/backup alpine \\"
echo "      tar xzf /backup/$(basename "$BACKUP_FILE") -C /"
echo "    docker compose up -d"
