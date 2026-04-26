const express = require('express');
const router = express.Router();
const { chat, getContext, clearHistory } = require('../controllers/assistant.controller');
const { protect } = require('../middleware/auth.middleware');

router.use(protect);

router.post('/chat', chat);
router.get('/context', getContext);
router.delete('/history', clearHistory);

module.exports = router;
