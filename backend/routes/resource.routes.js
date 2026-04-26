/**
 * routes/resource.routes.js
 * --------------------------
 * Resource inventory management routes.
 *
 * GET    /api/resources             → List all resources
 * POST   /api/resources             → Add resource (admin only)
 * PUT    /api/resources/:id         → Update resource (admin, rescue_team)
 * DELETE /api/resources/:id         → Delete resource (admin only)
 * PATCH  /api/resources/:id/deploy  → Deploy resource to target (admin, rescue_team)
 */

const express = require('express');
const router  = express.Router();
const {
  getResources,
  addResource,
  updateResource,
  deleteResource,
  deployResource,
  allocateResource,
  getResourceAnalytics,
} = require('../controllers/resource.controller');
const { protect, protectOrAllowDemo, authorize } = require('../middleware/auth.middleware');
// Read access stays public in demo mode, but requires an authenticated ops role otherwise.
router.get('/', protectOrAllowDemo('admin', 'rescue_team'), getResources);
router.get('/analytics', protectOrAllowDemo('admin', 'rescue_team'), getResourceAnalytics);

// Write operations
router.post('/', protect, authorize('admin'), addResource);
router.delete('/:id', protect, authorize('admin'), deleteResource);
router.post('/allocate', protect, authorize('admin', 'rescue_team'), allocateResource);

// Update and deployment operations
router.put('/:id', protect, authorize('admin', 'rescue_team'), updateResource);
router.patch('/:id/deploy', protect, authorize('admin', 'rescue_team'), deployResource);

module.exports = router;
