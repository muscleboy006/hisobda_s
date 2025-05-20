const express = require('express');
const router = express.Router()
const { authMiddleware } = require('../middleware/auth');
const getStatistics = require('../controllers/statsController');
const {
    authTelegram,
    userProfile,
    wallet,
    verify,
    accessStatus
} = require('../controllers/userController')

router.post('/auth/telegram', authTelegram)
router.get('/user/profile', authMiddleware, userProfile)
router.get('/stats', authMiddleware, getStatistics)
router.get('/wallet', authMiddleware, wallet)
router.get('/verify', authMiddleware, verify)
router.get('/access-status', authMiddleware, accessStatus);

module.exports = router;