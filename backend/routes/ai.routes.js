/**
 * routes/ai.routes.js
 * -------------------
 * AI integration endpoints.
 *
 * GET  /api/ai/report/:cityName → Generates situational map report
 * POST /api/ai/chat             → Conversational chatbot endpoint
 */

const express = require('express');
const router  = express.Router();
const { generateCityReport, chat } = require('../controllers/ai.controller');
const { protect } = require('../middleware/auth.middleware');

router.get('/report/:cityName', generateCityReport);
router.post('/chat', protect, chat);

module.exports = router;
