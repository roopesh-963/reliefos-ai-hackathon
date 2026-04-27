/**
 * controllers/auth.controller.js
 * --------------------------------
 * Handles user registration and login.
 * 
 * REGISTER: Creates a new user, returns JWT.
 * LOGIN:    Verifies credentials, returns JWT.
 *
 * The JWT payload contains { id, role } so the frontend
 * can know the user's role without another API call.
 *
 * Frontend integration:
 *   On Register/Login success → store token in localStorage
 *   Add to every request: Authorization: Bearer <token>
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User.model');
const { getRequiredEnv } = require('../config/env');
const VALID_ROLES = new Set(['citizen', 'rescue_team', 'admin']);

// Helper: generate a signed JWT
const generateToken = (id, role) => {
  return jwt.sign(
    { id, role },
    getRequiredEnv('JWT_SECRET'),
    { expiresIn: '7d' } // Token lasts 7 days
  );
};

// ── POST /api/auth/register ───────────────────────────────────────────────────
const register = async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const requestedRole = String(req.body?.role || 'citizen').trim();
    const role = VALID_ROLES.has(requestedRole) ? requestedRole : 'citizen';

    if (!name) {
      return res.status(400).json({ message: 'Name is required' });
    }

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    // Check if user already exists
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    // Create user — password gets hashed by the pre-save hook in User.model.js
    const user = await User.create({ name, email, password, role: role || 'citizen' });

    res.status(201).json({
      message: 'Registration successful',
      token: generateToken(user._id, user.role),
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
};

// ── POST /api/auth/login ──────────────────────────────────────────────────────
const login = async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Compare entered password with stored bcrypt hash
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    res.json({
      message: 'Login successful',
      token: generateToken(user._id, user.role),
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const newPassword = String(req.body?.newPassword || '');

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'No user found for that email address' });
    }

    user.password = newPassword;
    await user.save();

    return res.json({ message: 'Password reset successful. You can now sign in with your new password.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ message: 'Server error while resetting password' });
  }
};

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
// Returns the current logged-in user's profile (requires valid JWT)
const getMe = async (req, res) => {
  try {
    // req.user is set by the protect middleware
    res.json({
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

const updateMe = async (req, res) => {
  try {
    const { name, email } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const trimmedName = String(name || '').trim();
    const normalizedEmail = String(email || '').trim().toLowerCase();

    if (!trimmedName) {
      return res.status(400).json({ message: 'Name is required' });
    }

    if (!normalizedEmail) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const existingUser = await User.findOne({
      email: normalizedEmail,
      _id: { $ne: user._id },
    });

    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    user.name = trimmedName;
    user.email = normalizedEmail;
    await user.save();

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Server error while updating profile' });
  }
};

module.exports = { register, login, forgotPassword, getMe, updateMe };
