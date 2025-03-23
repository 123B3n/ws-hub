#!/bin/bash
# Create docs directory and move documentation files there

# Create directories
mkdir -p docs

# Move existing documentation files to docs directory
mv iis-guide.md docs/
mv cloudflare-guide.md docs/
mv configuration-guide.md docs/
mv client-integration.md docs/
mv api-documentation.md docs/
mv troubleshooting.md docs/
mv src/socket/client-data.md docs/

# Keep only the README.md in the root directory
echo "Documentation files moved to docs directory for Wiki synchronization"
