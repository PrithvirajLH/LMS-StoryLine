# Azure Infrastructure Setup

This directory contains scripts and documentation for setting up Azure infrastructure for the xAPI LMS.

## Prerequisites

- Azure CLI installed and configured
- Azure subscription with appropriate permissions
- Bash shell (for deploy.sh)

## Quick Start

1. Make the deployment script executable:
```bash
chmod +x deploy.sh
```

2. Edit `deploy.sh` and set the `SQL_ADMIN_PASSWORD` variable:
```bash
SQL_ADMIN_PASSWORD="YourSecurePassword123!"
```

3. Run the deployment script:
```bash
./deploy.sh
```

## Manual Setup

If you prefer to set up resources manually, follow these steps:

### 1. Create Resource Group

```bash
az group create --name lms-rg --location eastus
```

### 2. Create Storage Account

```bash
az storage account create \
  --name lmsstorage123 \
  --resource-group lms-rg \
  --location eastus \
  --sku Standard_LRS

az storage container create \
  --name lms-content \
  --account-name lmsstorage123 \
  --public-access off
```

### 3. Create App Service

```bash
az appservice plan create \
  --name lms-app-plan \
  --resource-group lms-rg \
  --sku B1 \
  --is-linux

az webapp create \
  --name lms-app-123 \
  --resource-group lms-rg \
  --plan lms-app-plan \
  --runtime "NODE|18-lts"
```

### 4. Enable Managed Identity

```bash
PRINCIPAL_ID=$(az webapp identity assign \
  --name lms-app-123 \
  --resource-group lms-rg \
  --query principalId -o tsv)

STORAGE_ID=$(az storage account show \
  --name lmsstorage123 \
  --resource-group lms-rg \
  --query id -o tsv)

az role assignment create \
  --assignee $PRINCIPAL_ID \
  --role "Storage Blob Data Reader" \
  --scope $STORAGE_ID
```

### 5. Create SQL Database

```bash
az sql server create \
  --name lms-sql-server \
  --resource-group lms-rg \
  --location eastus \
  --admin-user lmsadmin \
  --admin-password YourSecurePassword123!

az sql server firewall-rule create \
  --resource-group lms-rg \
  --server lms-sql-server \
  --name AllowAzureServices \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0

az sql db create \
  --resource-group lms-rg \
  --server lms-sql-server \
  --name lms_db \
  --service-objective S0
```

### 6. Configure App Service Settings

```bash
az webapp config appsettings set \
  --name lms-app-123 \
  --resource-group lms-rg \
  --settings \
    AZURE_STORAGE_ACCOUNT_NAME="lmsstorage123" \
    DATABASE_SERVER="lms-sql-server.database.windows.net" \
    DATABASE_NAME="lms_db" \
    DATABASE_USER="lmsadmin" \
    DATABASE_PASSWORD="YourSecurePassword123!" \
    DATABASE_ENCRYPT="true" \
    LRS_ENDPOINT="http://your-lrs.com/data/xAPI" \
    LRS_KEY="your-lrs-key" \
    LRS_SECRET="your-lrs-secret" \
    JWT_SECRET="your-super-secret-jwt-key" \
    JWT_EXPIRES_IN="7d" \
    FRONTEND_URL="https://your-frontend-url.com"
```

## Post-Deployment

1. **Run Database Migrations**: Connect to your SQL database and run the migration script from `backend/migrations/001_initial_schema.sql`

2. **Upload Course Content**: Upload your Storyline course files to the `lms-content` container in Blob Storage

3. **Create Admin User**: Use the registration endpoint or directly insert an admin user in the database:
```sql
-- Set a user as admin (replace with actual userId)
UPDATE Users SET isAdmin = 1 WHERE email = 'admin@example.com';
```

4. **Deploy Application Code**: Deploy your backend code to the App Service using:
   - Azure DevOps
   - GitHub Actions
   - VS Code Azure Extension
   - FTP/SCM

## Cost Considerations

- **App Service Plan (B1)**: ~$13/month
- **SQL Database (S0)**: ~$15/month
- **Storage Account**: ~$0.02/GB/month
- **Data Transfer**: Varies based on usage

Consider using Azure Dev/Test pricing or reserved instances for production workloads.

## Security Best Practices

1. Use Azure Key Vault for sensitive configuration
2. Enable HTTPS only on App Service
3. Configure IP restrictions for SQL Server
4. Use Azure AD authentication for SQL (optional)
5. Enable Application Insights for monitoring
6. Set up alerts for unusual activity


