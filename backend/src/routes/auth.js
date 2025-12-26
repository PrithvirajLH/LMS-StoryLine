import express from 'express';
import { getPool, isDatabaseAvailable } from '../config/database.js';
import { hashPassword, comparePassword, generateToken } from '../services/authService.js';
import { createUser, getUserByEmail, updateUser } from '../services/tableService.js';

const router = express.Router();

// Middleware to check database availability
async function requireDatabase(req, res, next) {
  try {
    const available = await isDatabaseAvailable();
    if (!available) {
      return res.status(503).json({ 
        error: 'Database unavailable. Please configure Azure Storage Account.',
        hint: 'Update backend/.env with AZURE_STORAGE_ACCOUNT_NAME and AZURE_STORAGE_ACCOUNT_KEY'
      });
    }
    await getPool(); // Initialize tables
    next();
  } catch (error) {
    return res.status(503).json({ 
      error: 'Database unavailable. Please configure Azure Storage Account.',
      hint: 'Update backend/.env with Azure Storage credentials'
    });
  }
}

// Register new user
router.post('/register', requireDatabase, async (req, res, next) => {
  try {
    const { email, password, firstName, lastName } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Check if user already exists
    const existingUser = await getUserByEmail(email);

    if (existingUser) {
      return res.status(409).json({ error: 'User already exists' });
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create new user
    const user = await createUser({
      email,
      passwordHash,
      firstName,
      lastName,
    });

    // Generate token
    const token = generateToken(user);

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        userId: user.userId,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isAdmin: user.isAdmin || false,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Login
router.post('/login', requireDatabase, async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const user = await getUserByEmail(email);

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const isValid = await comparePassword(password, user.passwordHash);

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login
    await updateUser(user.userId, {
      lastLoginAt: new Date().toISOString(),
    });

    // Generate token
    const token = generateToken(user);

    res.json({
      message: 'Login successful',
      token,
      user: {
        userId: user.userId,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isAdmin: user.isAdmin || false,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;


