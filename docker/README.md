# Learning Locker Setup

This directory contains the Docker Compose configuration for running Learning Locker locally or in a development environment.

## Prerequisites

- Docker and Docker Compose installed
- At least 4GB of available RAM
- Ports 27017 (MongoDB), 6379 (Redis), and 8080 (Learning Locker) available

## Quick Start

1. **Start Learning Locker**:
```bash
cd docker
docker-compose up -d
```

2. **Wait for services to start** (may take a few minutes on first run):
```bash
docker-compose logs -f learninglocker
```

3. **Access Learning Locker UI**:
   - Open your browser to `http://localhost:8080`
   - You'll be prompted to create an account (first user becomes admin)

## Initial Setup in Learning Locker

1. **Create Account**: The first user you create will be the admin user

2. **Create Organization**:
   - Go to Organizations → Create Organization
   - Give it a name (e.g., "LMS Organization")

3. **Create Store**:
   - Go to Stores → Create Store
   - Select your organization
   - Give it a name (e.g., "LMS Store")
   - Choose "xAPI" as the store type

4. **Create Client**:
   - Go to Settings → Clients → Create Client
   - Select your organization and store
   - Give it a name (e.g., "LMS Backend")
   - Note the **Basic Auth Key** and **Basic Auth Secret** - you'll need these for your backend `.env` file

5. **Get Endpoint URL**:
   - The xAPI endpoint will be: `http://localhost:8080/data/xAPI`
   - For production, replace `localhost:8080` with your Learning Locker domain

## Configuration

### Update Environment Variables

Edit `docker-compose.yml` and update these values:

- `MONGO_INITDB_ROOT_PASSWORD`: MongoDB root password
- `APP_SECRET`: Application secret key
- `JWT_SECRET`: JWT signing secret
- `APP_URL`: Your Learning Locker URL (for production)

### Production Considerations

For production deployment:

1. **Use Environment-Specific Values**:
   - Store secrets in Azure Key Vault or similar
   - Use strong passwords
   - Enable HTTPS

2. **Persistent Storage**:
   - Volumes are already configured for data persistence
   - Consider backing up MongoDB regularly

3. **Security**:
   - Change all default passwords
   - Restrict network access
   - Use Azure Container Instances or Azure Kubernetes Service for hosting

4. **Scaling**:
   - Learning Locker can be scaled horizontally
   - Consider using Azure Database for MongoDB instead of containerized MongoDB for production

## Backend Integration

Once Learning Locker is running, update your backend `.env` file:

```env
LRS_ENDPOINT=http://localhost:8080/data/xAPI
LRS_KEY=<your-basic-auth-key>
LRS_SECRET=<your-basic-auth-secret>
```

## Troubleshooting

### Services won't start
- Check if ports are already in use
- Ensure Docker has enough resources allocated
- Check logs: `docker-compose logs`

### Can't access Learning Locker UI
- Wait a few minutes for services to fully start
- Check if container is running: `docker-compose ps`
- View logs: `docker-compose logs learninglocker`

### MongoDB connection issues
- Verify MongoDB is running: `docker-compose ps mongo`
- Check MongoDB logs: `docker-compose logs mongo`
- Ensure credentials match in docker-compose.yml

### Reset Everything
```bash
docker-compose down -v
docker-compose up -d
```

This will delete all data and start fresh.

## Alternative: Hosted LRS

If you prefer not to self-host Learning Locker, you can use a hosted LRS service:

- **Veracity LRS**: https://www.veracitylearning.com/
- **SCORM Cloud**: https://cloud.scorm.com/
- **Rustici Software**: https://rusticisoftware.com/

Simply update your backend `.env` with the hosted LRS endpoint and credentials.


