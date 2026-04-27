/**
 * routes/auth.routes.js
 * ----------------------
 * Authentication routes.
 *
 * POST /api/auth/register  → Register new user
 * POST /api/auth/login     → Login and get JWT
 * GET  /api/auth/me        → Get current user profile (protected)
 * PUT  /api/auth/me        → Update current user profile (protected)
 */

const express = require('express');
const router  = express.Router();
const { register, login, forgotPassword, getMe, updateMe } = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');

// Public routes — no token needed
router.post('/register', register);
router.post('/login',    login);
router.post('/forgot-password', forgotPassword);

// Protected route — requires valid JWT
router.get('/me', protect, getMe);
router.put('/me', protect, updateMe);

module.exports = router;
