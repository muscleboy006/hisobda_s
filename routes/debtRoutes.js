const express = require('express');
const router = express.Router();
const debtController = require('../controllers/debtController');
const { authMiddleware } = require('../middleware/auth');
const { checkAccess } = require('../middleware/checkAccess');

router.use(authMiddleware);

router.post('/', checkAccess, debtController.createDebt);
router.get('/', debtController.getDebts);
router.get('/stats', debtController.getDebtStats);
router.get('/:id', debtController.getDebtById);
router.put('/:id', checkAccess, debtController.updateDebt); // << YANGI
router.patch('/:id/paid', checkAccess, debtController.markAsPaid);
router.delete('/:id', checkAccess, debtController.deleteDebt);

module.exports = router;