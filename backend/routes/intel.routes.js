const express = require('express');
const router = express.Router();
const { getOverview, getSourceStatus, getLocationReport } = require('../controllers/intel.controller');

router.get('/overview', getOverview);
router.get('/sources', getSourceStatus);
router.get('/report', getLocationReport);

module.exports = router;
