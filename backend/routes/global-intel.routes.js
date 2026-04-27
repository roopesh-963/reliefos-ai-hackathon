const express = require('express');
const router = express.Router();
const { getGlobalOverview } = require('../controllers/globalIntel.controller');

router.get('/overview', getGlobalOverview);

module.exports = router;
