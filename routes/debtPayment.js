const express = require('express');
const router = express.Router();
const debtPaymentController = require('../controllers/payDebtController');
const { authMiddleware } = require('../middleware/auth');
const { checkAccess } = require('../middleware/checkAccess');
router.use(authMiddleware)

router.post('/:debtId',  debtPaymentController.createPayment);
router.get('/', checkAccess, debtPaymentController.getPayments);
router.get('/:id', checkAccess, debtPaymentController.getPayment);
router.delete('/:id', debtPaymentController.deletePayment);

module.exports = router;