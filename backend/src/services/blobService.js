import { getBlobServiceClient, getContainerName } from '../config/azure.js';
import path from 'path';

const CONTENT_TYPE_MAP = {
  html: 'text/html',
  htm: 'text/html',
  js: 'application/javascript',
  css: 'text/css',
  json: 'application/json',
  xml: 'application/xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  eot: 'application/vnd.ms-fontobject',
  pdf: 'application/pdf',
  mp4: 'video/mp4',
  webm: 'video/webm',
};

export function getContentType(filename) {
  const ext = path.extname(filename).toLowerCase().substring(1);
  return CONTENT_TYPE_MAP[ext] || 'application/octet-stream';
}

export async function streamBlobContent(blobPath, res) {
  try {
    const blobServiceClient = getBlobServiceClient();
    const containerName = getContainerName();
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blobClient = containerClient.getBlobClient(blobPath);

    // Check if blob exists
    const exists = await blobClient.exists();
    if (!exists) {
      throw new Error('Blob not found');
    }

    // Get blob properties
    const properties = await blobClient.getProperties();

    // Set headers
    res.setHeader('Content-Type', getContentType(blobPath));
    res.setHeader('Content-Length', properties.contentLength);
    res.setHeader('Cache-Control', 'public, max-age=3600');

    // Stream blob to response
    const downloadResponse = await blobClient.download();
    
    if (downloadResponse.readableStreamBody) {
      downloadResponse.readableStreamBody.pipe(res);
    } else {
      throw new Error('Blob stream not available');
    }
  } catch (error) {
    throw error;
  }
}

export async function listBlobs(prefix) {
  try {
    const blobServiceClient = getBlobServiceClient();
    const containerName = getContainerName();
    const containerClient = blobServiceClient.getContainerClient(containerName);

    const blobs = [];
    for await (const blob of containerClient.listBlobsFlat({ prefix })) {
      blobs.push(blob.name);
    }
    return blobs;
  } catch (error) {
    throw error;
  }
}


