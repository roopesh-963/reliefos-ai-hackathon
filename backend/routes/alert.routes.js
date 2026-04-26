/**
 * routes/alert.routes.js
 * -----------------------
 * Crisis alert routes.
 *
 * GET    /api/alerts           → Get all active alerts (public)
 * POST   /api/alerts           → Create alert (admin only)
 * PATCH  /api/alerts/:id/deactivate → Deactivate alert (admin only)
 */

const express = require('express');
const router  = express.Router();
const { createAlert, getAlerts, deactivateAlert } = require('../controllers/alert.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

// Alerts are public so dashboard-style views can render without a separate login step
router.get('/', getAlerts);

// Only admin can create or deactivate alerts
router.post('/', protect, authorize('admin'), createAlert);
router.patch('/:id/deactivate', protect, authorize('admin'), deactivateAlert);

module.exports = router;
