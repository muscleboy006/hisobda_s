const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');
const { authMiddleware } = require('../middleware/auth');
const { checkAccess } = require('../middleware/checkAccess');

router.post('/add', authMiddleware, checkAccess, transactionController.addTransaction);
router.get('/', authMiddleware, transactionController.getAllTransactions);
// router.get('/:id', authMiddleware, transactionController.getTransaction);
router.put('/:id', authMiddleware, checkAccess, transactionController.updateTransaction);
router.delete('/:id', authMiddleware, checkAccess, transactionController.deleteTransaction);
router.get('/summary', authMiddleware, transactionController.getSummary);

module.exports = router;    