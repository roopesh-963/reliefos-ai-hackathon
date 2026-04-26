/**
 * routes/sos.routes.js
 * ---------------------
 * SOS emergency request routes.
 *
 * POST  /api/sos              → Submit SOS (citizen, logged in)
 * GET   /api/sos              → Get all SOS (rescue_team, admin)
 * GET   /api/sos/:id          → Get single SOS
 * PATCH /api/sos/:id/status   → Update status (rescue_team, admin)
 */

const express = require('express');
const router  = express.Router();
const {
  submitSOS,
  getAllSOS,
  getSOSById,
  updateSOSStatus,
} = require('../controllers/sos.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

// All SOS routes require login
router.use(protect);

// Any logged-in user can submit SOS (citizen presses SOS button)
router.post('/', submitSOS);

// Only rescue teams and admins see all SOS requests (dashboard)
router.get('/', authorize('rescue_team', 'admin'), getAllSOS);
router.get('/:id', authorize('rescue_team', 'admin'), getSOSById);

// Update SOS lifecycle status
router.patch('/:id/status', authorize('rescue_team', 'admin'), updateSOSStatus);

module.exports = router;
