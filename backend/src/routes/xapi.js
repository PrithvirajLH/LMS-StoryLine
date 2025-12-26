import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { proxyToLRS } from '../services/lrsProxy.js';

const router = express.Router();

// All xAPI routes require authentication
router.use(authenticate);

// POST /xapi/statements - Store statements
router.post('/statements', async (req, res, next) => {
  try {
    const result = await proxyToLRS('POST', '/statements', req.query, req.body);
    res.status(result.status).json(result.data);
  } catch (error) {
    next(error);
  }
});

// GET /xapi/statements - Query statements
router.get('/statements', async (req, res, next) => {
  try {
    const result = await proxyToLRS('GET', '/statements', req.query, null);
    res.status(result.status).json(result.data);
  } catch (error) {
    next(error);
  }
});

// PUT /xapi/statements - Update statements
router.put('/statements', async (req, res, next) => {
  try {
    const result = await proxyToLRS('PUT', '/statements', req.query, req.body);
    res.status(result.status).json(result.data);
  } catch (error) {
    next(error);
  }
});

// GET /xapi/activities/state - Get state
router.get('/activities/state', async (req, res, next) => {
  try {
    const result = await proxyToLRS('GET', '/activities/state', req.query, null);
    res.status(result.status).json(result.data);
  } catch (error) {
    next(error);
  }
});

// PUT /xapi/activities/state - Store state
router.put('/activities/state', async (req, res, next) => {
  try {
    const result = await proxyToLRS('PUT', '/activities/state', req.query, req.body);
    res.status(result.status).json(result.data);
  } catch (error) {
    next(error);
  }
});

// GET /xapi/activities - Get activity profile
router.get('/activities', async (req, res, next) => {
  try {
    const result = await proxyToLRS('GET', '/activities', req.query, null);
    res.status(result.status).json(result.data);
  } catch (error) {
    next(error);
  }
});

// GET /xapi/activities/profile - Get activity profile
router.get('/activities/profile', async (req, res, next) => {
  try {
    const result = await proxyToLRS('GET', '/activities/profile', req.query, null);
    res.status(result.status).json(result.data);
  } catch (error) {
    next(error);
  }
});

// PUT /xapi/activities/profile - Store activity profile
router.put('/activities/profile', async (req, res, next) => {
  try {
    const result = await proxyToLRS('PUT', '/activities/profile', req.query, req.body);
    res.status(result.status).json(result.data);
  } catch (error) {
    next(error);
  }
});

// DELETE /xapi/activities/profile - Delete activity profile
router.delete('/activities/profile', async (req, res, next) => {
  try {
    const result = await proxyToLRS('DELETE', '/activities/profile', req.query, null);
    res.status(result.status).json(result.data);
  } catch (error) {
    next(error);
  }
});

// GET /xapi/agents/profile - Get agent profile
router.get('/agents/profile', async (req, res, next) => {
  try {
    const result = await proxyToLRS('GET', '/agents/profile', req.query, null);
    res.status(result.status).json(result.data);
  } catch (error) {
    next(error);
  }
});

// PUT /xapi/agents/profile - Store agent profile
router.put('/agents/profile', async (req, res, next) => {
  try {
    const result = await proxyToLRS('PUT', '/agents/profile', req.query, req.body);
    res.status(result.status).json(result.data);
  } catch (error) {
    next(error);
  }
});

// DELETE /xapi/agents/profile - Delete agent profile
router.delete('/agents/profile', async (req, res, next) => {
  try {
    const result = await proxyToLRS('DELETE', '/agents/profile', req.query, null);
    res.status(result.status).json(result.data);
  } catch (error) {
    next(error);
  }
});

export default router;


