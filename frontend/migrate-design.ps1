# Migration script to copy learn-swift-hub design to frontend
$source = "..\learn-swift-hub\src"
$dest = "src"

# Create directories
New-Item -ItemType Directory -Force -Path "$dest\components\ui"
New-Item -ItemType Directory -Force -Path "$dest\components\layout"
New-Item -ItemType Directory -Force -Path "$dest\data"
New-Item -ItemType Directory -Force -Path "$dest\hooks"

# Copy UI components
Copy-Item -Path "$source\components\ui\*" -Destination "$dest\components\ui\" -Recurse -Force

# Copy layout components
Copy-Item -Path "$source\components\layout\*" -Destination "$dest\components\layout\" -Recurse -Force

# Copy data
Copy-Item -Path "$source\data\*" -Destination "$dest\data\" -Recurse -Force

# Copy hooks
Copy-Item -Path "$source\hooks\*" -Destination "$dest\hooks\" -Recurse -Force

Write-Host "Migration complete!"




