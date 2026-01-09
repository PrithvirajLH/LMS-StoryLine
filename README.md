# xAPI Learning Management System (LMS)

A modern, cloud-based Learning Management System built with React, Node.js, and Azure services. This LMS supports xAPI (Experience API) for tracking learner progress and interactions with e-learning content, including Storyline/Articulate courses.

## 🎯 Project Overview

This LMS is a full-stack application designed to:

- **Host and deliver e-learning courses** stored in Azure Blob Storage
- **Track learner progress** using xAPI (Tin Can API) statements
- **Support SCORM and xAPI-compatible content** including Articulate Storyline courses
- **Provide user authentication and authorization** with role-based access control
- **Offer an admin panel** for course management and user administration
- **Display learner progress dashboards** with detailed analytics

## 🏗️ Architecture

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Routing**: React Router v6
- **HTTP Client**: Axios
- **Key Features**:
  - Course catalog with search and filtering
  - Embedded course player with authentication
  - Progress tracking dashboard
  - Admin panel for course/user management

### Backend
- **Runtime**: Node.js (ES Modules)
- **Framework**: Express.js
- **Authentication**: JWT tokens with cookie support
- **Storage**: Azure Table Storage (for metadata) and Azure Blob Storage (for course content)
- **API**: RESTful API with xAPI endpoint support

### Key Components

1. **Course Content Delivery** (`/content` routes)
   - Serves course files from Azure Blob Storage
   - Injects authentication tokens into course resources
   - Handles dynamic resource loading (CSS, JS, images)
   - Configures LRS endpoints for Storyline courses
   - Fixes common Storyline initialization issues

2. **xAPI Integration** (`/xapi` routes)
   - Receives and proxies xAPI statements to LRS
   - Handles authentication and authorization
   - Tracks course progress and completion

3. **User Management**
   - Registration and login
   - Role-based access (Admin/User)
   - JWT-based authentication

4. **Course Management**
   - Course upload and metadata management
   - Activity ID (xAPI IRI) generation
   - Course catalog with enrollment

## 📋 Prerequisites

Before building this project, ensure you have:

- **Node.js** 18+ installed
- **npm** or **yarn** package manager
- **Azure Account** with:
  - Azure Storage Account (Blob Storage)
  - Azure Table Storage
  - (Optional) Azure SQL Database or use Table Storage
- **LRS (Learning Record Store)** - You can use:
  - A hosted LRS service (Veracity, SCORM Cloud, etc.)
  - Learning Locker (self-hosted)
  - Or configure the backend to proxy to your LRS

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd LMS
```

### 2. Backend Setup

```bash
cd backend
npm install
```

Create a `.env` file in the `backend` directory:

```env
# Server Configuration
PORT=3001
FRONTEND_URL=http://localhost:5173
API_BASE_URL=http://localhost:3001

# Azure Storage Configuration
AZURE_STORAGE_ACCOUNT_NAME=your-storage-account-name
AZURE_STORAGE_ACCOUNT_KEY=your-storage-account-key
AZURE_STORAGE_CONTAINER_NAME=lms-content

# Azure Table Storage Configuration
AZURE_TABLE_STORAGE_ACCOUNT_NAME=your-table-storage-account
AZURE_TABLE_STORAGE_ACCOUNT_KEY=your-table-storage-key
AZURE_TABLE_STORAGE_TABLE_NAME=lms-data

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d

# LRS Configuration (Optional - if using external LRS)
LRS_ENDPOINT=https://your-lrs-endpoint.com/xapi
LRS_KEY=your-lrs-key
LRS_SECRET=your-lrs-secret
```

### 3. Frontend Setup

```bash
cd frontend
npm install
```

Create a `.env` file in the `frontend` directory:

```env
VITE_API_URL=http://localhost:3001
```

### 4. Run the Application

**Option A: Using the root package.json (Recommended)**
```bash
# From the root directory
npm install
npm run install:all  # Install all dependencies
npm run dev          # Start both frontend and backend
```

**Option B: Run separately**

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

**Option C: Linux Quick Setup**
```bash
# Run the setup script (Linux/Mac)
chmod +x setup-linux.sh
./setup-linux.sh

# Then start the application
npm run dev
```

The application will be available at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001 (changed from 3000 to avoid conflicts)

## 📦 Building for Production

### Backend

```bash
cd backend
npm install --production
npm start
```

### Frontend

```bash
cd frontend
npm run build
```

The production build will be in `frontend/dist/`. You can preview it with:

```bash
npm run preview
```

## 🔧 Configuration

### Azure Storage Setup

1. **Create Storage Account**:
   ```bash
   az storage account create \
     --name your-storage-account \
     --resource-group your-resource-group \
     --location eastus \
     --sku Standard_LRS
   ```

2. **Create Container**:
   ```bash
   az storage container create \
     --name lms-content \
     --account-name your-storage-account \
     --public-access off
   ```

3. **Get Access Keys**:
   ```bash
   az storage account keys list \
     --account-name your-storage-account \
     --resource-group your-resource-group
   ```

### Azure Table Storage Setup

1. **Create Table Storage Account** (or use the same storage account):
   ```bash
   az storage account create \
     --name your-table-storage \
     --resource-group your-resource-group \
     --location eastus \
     --sku Standard_LRS \
     --kind StorageV2
   ```

2. **Create Tables** (automatically created on first use):
   - `Courses`
   - `Users`
   - `Enrollments`
   - `Attempts`

### Uploading Courses

Use the provided script to upload courses:

```bash
cd backend
node scripts/upload-single-course.js <path-to-course-folder>
```

The script will:
- Upload course files to Azure Blob Storage
- Parse `tincan.xml` and `meta.xml` for course metadata
- Create course record in Table Storage
- Generate Activity ID if not provided

## 🎓 Course Format Support

This LMS supports:

- **Articulate Storyline** courses (xAPI/SCORM)
- **SCORM 1.2/2004** packages
- **xAPI (Tin Can API)** content
- **HTML5** courses with xAPI integration

### Course Structure

Courses should follow this structure:
```
course-folder/
├── index_lms.html (or index.html)
├── tincan.xml
├── meta.xml
├── html5/
│   ├── data/
│   │   ├── js/
│   │   │   ├── data.js
│   │   │   ├── paths.js
│   │   │   └── frame.js
│   └── lib/
│       └── scripts/
│           ├── bootstrapper.min.js
│           ├── slides.min.js
│           └── frame.desktop.min.js
└── story_content/
    └── (media files)
```

## 🔐 Authentication

The system uses JWT tokens for authentication:

- Tokens are sent via:
  - HTTP headers: `Authorization: Bearer <token>`
  - Query parameters: `?token=<token>`
  - Cookies: `lms_auth_token=<token>`

- Course content automatically includes authentication tokens in all resource requests

## 📊 xAPI Integration

The LMS includes a built-in xAPI endpoint at `/xapi` that:

- Receives xAPI statements from courses
- Validates and stores statements
- Proxies to external LRS if configured
- Tracks learner progress and completion

### LRS Configuration

Configure your LRS endpoint in the backend `.env`:

```env
LRS_ENDPOINT=https://your-lrs.com/xapi
LRS_KEY=your-key
LRS_SECRET=your-secret
```

Or use the backend's built-in xAPI proxy (no external LRS required for basic functionality).

## 🛠️ Development Scripts

### Backend Scripts

```bash
# Start development server with auto-reload
npm run dev

# Start production server
npm start

# Run database migrations
npm run migrate

# Generate Activity ID for course
node scripts/generate-activity-id.js "Course Title"

# List all courses
node scripts/list-courses.js

# Upload a course
node scripts/upload-single-course.js <course-path>
```

### Frontend Scripts

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 🐳 Docker Deployment (Optional)

For local development with LRS:

```bash
cd docker
docker-compose -f docker-compose-simple.yml up -d
```

This starts:
- MongoDB (for LRS data)
- Simple xAPI LRS endpoint

## ☁️ Azure Deployment

See `azure/README.md` for detailed Azure deployment instructions.

The deployment script creates:
- Resource Group
- Storage Account (Blob + Table)
- App Service Plan
- Web App
- SQL Database (optional)

## 📁 Project Structure

```
LMS/
├── backend/                 # Node.js/Express backend
│   ├── src/
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business logic
│   │   ├── middleware/     # Auth, error handling
│   │   └── config/         # Azure, database config
│   ├── scripts/            # Utility scripts
│   └── package.json
├── frontend/               # React/TypeScript frontend
│   ├── src/
│   │   ├── pages/         # Page components
│   │   ├── components/    # Reusable components
│   │   └── services/      # API clients
│   └── package.json
├── xapi/                  # Sample course content
├── azure/                 # Azure deployment scripts
├── docker/                # Docker configurations
└── README.md
```

## 🔍 Key Features

### Course Player
- Embedded iframe player with authentication
- Automatic token injection into course resources
- Support for dynamic resource loading
- LRS configuration for Storyline courses
- Progress tracking and bookmarking

### Admin Panel
- Course creation and management
- User administration
- Activity ID generation
- Course upload interface

### Progress Dashboard
- Learner progress visualization
- Course completion tracking
- xAPI statement history

## 🐛 Troubleshooting

### Common Issues

1. **401 Unauthorized errors when loading course resources**
   - Ensure authentication tokens are being passed correctly
   - Check that cookies are enabled
   - Verify token hasn't expired

2. **Course not initializing**
   - Check browser console for errors
   - Verify `data.js` and `paths.js` are loading
   - Ensure LRS configuration is correct

3. **Azure Storage connection errors**
   - Verify storage account name and key in `.env`
   - Check container name matches configuration
   - Ensure storage account is accessible

## 📝 License

[Specify your license here]

## 🤝 Contributing

[Add contribution guidelines if applicable]

## 📞 Support

[Add support contact information if applicable]





