import axios from 'axios';

const LRS_ENDPOINT = process.env.LRS_ENDPOINT;
const LRS_KEY = process.env.LRS_KEY;
const LRS_SECRET = process.env.LRS_SECRET;

if (!LRS_ENDPOINT || !LRS_KEY || !LRS_SECRET) {
  console.warn('LRS configuration incomplete. xAPI proxy will not work.');
}

const LRS_AUTH = LRS_KEY && LRS_SECRET
  ? Buffer.from(`${LRS_KEY}:${LRS_SECRET}`).toString('base64')
  : null;

export async function proxyToLRS(method, path, query, body) {
  if (!LRS_ENDPOINT || !LRS_AUTH) {
    throw new Error('LRS not configured');
  }

  const url = `${LRS_ENDPOINT}${path}`;

  try {
    const response = await axios({
      method,
      url,
      params: query,
      data: body,
      headers: {
        Authorization: `Basic ${LRS_AUTH}`,
        'Content-Type': 'application/json',
        'X-Experience-API-Version': '1.0.3',
      },
      validateStatus: () => true, // Don't throw on any status
    });

    return {
      status: response.status,
      data: response.data,
      headers: response.headers,
    };
  } catch (error) {
    console.error('LRS proxy error:', error.message);
    throw error;
  }
}


