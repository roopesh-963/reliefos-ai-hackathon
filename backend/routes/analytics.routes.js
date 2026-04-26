const express = require('express');
const router  = express.Router();
const {
  getOverview,
  getIncidentsTrend,
  getResponseTimes,
  getResourcesUsage,
  getSeverityDistribution,
  getInsights,
  getSummary,
  getSOSByDay,
  getSOSbySeverity,
} = require('../controllers/analytics.controller');

// Analytics is public in this project build so dashboard views work from the
// landing experience without a separate sign-in flow.

router.get('/overview', getOverview);
router.get('/incidents-trend', getIncidentsTrend);
router.get('/response-times', getResponseTimes);
router.get('/resources', getResourcesUsage);
router.get('/severity', getSeverityDistribution);
router.get('/insights', getInsights);

// Backwards-compatible aliases for existing frontend calls
router.get('/summary', getSummary);
router.get('/sos-by-day', getSOSByDay);
router.get('/sos-severity', getSOSbySeverity);

module.exports = router;
