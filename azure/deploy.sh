#!/bin/bash

# Azure xAPI LMS Infrastructure Deployment Script
# This script creates the necessary Azure resources for the LMS

set -e

# Configuration variables (modify these)
RESOURCE_GROUP="lms-rg"
LOCATION="eastus"
STORAGE_ACCOUNT_NAME="lmsstorage$(date +%s | tail -c 5)"  # Unique name
APP_SERVICE_NAME="lms-app-$(date +%s | tail -c 5)"  # Unique name
APP_SERVICE_PLAN="lms-app-plan"
SQL_SERVER_NAME="lms-sql-server-$(date +%s | tail -c 5)"
SQL_DATABASE_NAME="lms_db"
SQL_ADMIN_USER="lmsadmin"
SQL_ADMIN_PASSWORD=""  # Set this or use Azure Key Vault

echo "Creating resource group: $RESOURCE_GROUP"
az group create --name $RESOURCE_GROUP --location $LOCATION

echo "Creating storage account: $STORAGE_ACCOUNT_NAME"
az storage account create \
  --name $STORAGE_ACCOUNT_NAME \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --sku Standard_LRS

echo "Creating private container: lms-content"
az storage container create \
  --name lms-content \
  --account-name $STORAGE_ACCOUNT_NAME \
  --public-access off

echo "Creating App Service Plan: $APP_SERVICE_PLAN"
az appservice plan create \
  --name $APP_SERVICE_PLAN \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --sku B1 \
  --is-linux

echo "Creating Web App: $APP_SERVICE_NAME"
az webapp create \
  --name $APP_SERVICE_NAME \
  --resource-group $RESOURCE_GROUP \
  --plan $APP_SERVICE_PLAN \
  --runtime "NODE|18-lts"

echo "Enabling System-assigned Managed Identity"
PRINCIPAL_ID=$(az webapp identity assign \
  --name $APP_SERVICE_NAME \
  --resource-group $RESOURCE_GROUP \
  --query principalId -o tsv)

echo "Granting Storage Blob Data Reader role to App Service"
STORAGE_ID=$(az storage account show \
  --name $STORAGE_ACCOUNT_NAME \
  --resource-group $RESOURCE_GROUP \
  --query id -o tsv)

az role assignment create \
  --assignee $PRINCIPAL_ID \
  --role "Storage Blob Data Reader" \
  --scope $STORAGE_ID

echo "Creating SQL Server: $SQL_SERVER_NAME"
if [ -z "$SQL_ADMIN_PASSWORD" ]; then
  echo "ERROR: SQL_ADMIN_PASSWORD must be set"
  exit 1
fi

az sql server create \
  --name $SQL_SERVER_NAME \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --admin-user $SQL_ADMIN_USER \
  --admin-password $SQL_ADMIN_PASSWORD

echo "Configuring SQL Server firewall (allow Azure services)"
az sql server firewall-rule create \
  --resource-group $RESOURCE_GROUP \
  --server $SQL_SERVER_NAME \
  --name AllowAzureServices \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0

echo "Creating SQL Database: $SQL_DATABASE_NAME"
az sql db create \
  --resource-group $RESOURCE_GROUP \
  --server $SQL_SERVER_NAME \
  --name $SQL_DATABASE_NAME \
  --service-objective S0 \
  --backup-storage-redundancy Local

echo "=========================================="
echo "Deployment Summary:"
echo "=========================================="
echo "Resource Group: $RESOURCE_GROUP"
echo "Storage Account: $STORAGE_ACCOUNT_NAME"
echo "App Service: $APP_SERVICE_NAME"
echo "SQL Server: $SQL_SERVER_NAME"
echo "SQL Database: $SQL_DATABASE_NAME"
echo ""
echo "Next steps:"
echo "1. Set App Service environment variables:"
echo "   az webapp config appsettings set --name $APP_SERVICE_NAME --resource-group $RESOURCE_GROUP --settings \\"
echo "     AZURE_STORAGE_ACCOUNT_NAME=$STORAGE_ACCOUNT_NAME \\"
echo "     DATABASE_SERVER=$SQL_SERVER_NAME.database.windows.net \\"
echo "     DATABASE_NAME=$SQL_DATABASE_NAME \\"
echo "     DATABASE_USER=$SQL_ADMIN_USER \\"
echo "     DATABASE_PASSWORD='<your-password>' \\"
echo "     LRS_ENDPOINT='<your-lrs-endpoint>' \\"
echo "     LRS_KEY='<your-lrs-key>' \\"
echo "     LRS_SECRET='<your-lrs-secret>' \\"
echo "     JWT_SECRET='<your-jwt-secret>'"
echo ""
echo "2. Deploy your application code to the App Service"
echo "3. Run database migrations"
echo "4. Upload course content to Blob Storage"







