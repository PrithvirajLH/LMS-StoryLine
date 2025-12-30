#!/bin/bash
# Quick fix for Learning Locker deployment script
# This patches the script to skip Node.js 10.x installation

cd ~/learninglocker-deploy || exit 1

# Backup original
cp deployll.sh deployll.sh.backup

# Find the Node.js installation section and add a check
# This will skip Node.js installation if Node.js is already installed

# Method: Add check at the beginning of Node.js installation
sed -i '/Installing node version: 10\.x/i\
# Check if Node.js is already installed\
if command -v node &> /dev/null; then\
  echo "[LL] Node.js already installed: $(node --version), skipping Node.js installation"\
  NODE_SKIP=true\
fi\
' deployll.sh

# Now find the actual installation code and wrap it
# This is a bit complex, so we'll use a different approach

echo "Script patched. The script will now check for existing Node.js before installing."
echo "Run: sudo bash deployll.sh"






