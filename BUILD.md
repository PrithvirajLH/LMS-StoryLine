# Build Instructions

## Quick Build Guide

### Step 1: Install Dependencies

**Backend:**
```bash
cd backend
npm install
```

**Frontend:**
```bash
cd frontend
npm install
```

### Step 2: Configure Environment Variables

**Backend `.env` file** (`backend/.env`):
```env
PORT=3000
FRONTEND_URL=http://localhost:5173
API_BASE_URL=http://localhost:3000

# Azure Storage
AZURE_STORAGE_ACCOUNT_NAME=your-storage-account
AZURE_STORAGE_ACCOUNT_KEY=your-storage-key
AZURE_STORAGE_CONTAINER_NAME=lms-content

# Azure Table Storage
AZURE_TABLE_STORAGE_ACCOUNT_NAME=your-table-storage
AZURE_TABLE_STORAGE_ACCOUNT_KEY=your-table-key
AZURE_TABLE_STORAGE_TABLE_NAME=lms-data

# JWT
JWT_SECRET=change-this-to-a-random-secret-key
JWT_EXPIRES_IN=7d

# LRS (Optional)
LRS_ENDPOINT=https://your-lrs.com/xapi
LRS_KEY=your-lrs-key
LRS_SECRET=your-lrs-secret
```

**Frontend `.env` file** (`frontend/.env`):
```env
VITE_API_URL=http://localhost:3000
```

### Step 3: Run Development Servers

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

### Step 4: Access the Application

- Frontend: http://localhost:5173
- Backend API: http://localhost:3000
- Health Check: http://localhost:3000/health

## Production Build

### Build Frontend

```bash
cd frontend
npm run build
```

Output will be in `frontend/dist/`

### Run Backend in Production

```bash
cd backend
npm install --production
npm start
```

## Azure Setup (First Time)

### 1. Create Storage Account

```bash
az storage account create \
  --name lmsstorage$(date +%s | tail -c 5) \
  --resource-group lms-rg \
  --location eastus \
  --sku Standard_LRS
```

### 2. Create Container

```bash
az storage container create \
  --name lms-content \
  --account-name YOUR_STORAGE_ACCOUNT \
  --public-access off
```

### 3. Get Access Keys

```bash
az storage account keys list \
  --account-name YOUR_STORAGE_ACCOUNT \
  --resource-group lms-rg
```

Copy the `key1` value to your `.env` file.

## Upload Your First Course

```bash
cd backend
node scripts/upload-single-course.js ../xapi
```

This will upload the sample course from the `xapi` folder.

## Verify Installation

1. Open http://localhost:5173
2. Register a new user
3. Login
4. You should see the course catalog
5. Click on a course to launch it

## Troubleshooting

### Port Already in Use

If port 3000 or 5173 is in use:

**Backend:**
```bash
PORT=3001 npm run dev
```

**Frontend:**
Update `frontend/.env`:
```env
VITE_API_URL=http://localhost:3001
```

Then run:
```bash
npm run dev -- --port 5174
```

### Azure Connection Issues

- Verify storage account name and key are correct
- Check that the container exists
- Ensure your Azure account has proper permissions

### Module Not Found Errors

```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
```





