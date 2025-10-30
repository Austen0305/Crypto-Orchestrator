
#!/bin/bash

# Create a timestamp for the filename
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="cryptoml-trading-platform_${TIMESTAMP}.zip"

echo "Creating downloadable package: ${FILENAME}"

# Create zip excluding node_modules, dist, and other unnecessary files
zip -r "${FILENAME}" . \
  -x "node_modules/*" \
  -x ".git/*" \
  -x "dist/*" \
  -x ".cache/*" \
  -x "*.log" \
  -x ".replit" \
  -x "replit.nix" \
  -x "attached_assets/*"

echo "Package created successfully: ${FILENAME}"
echo "You can download this file from the file tree on the left"
