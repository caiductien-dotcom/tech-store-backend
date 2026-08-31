const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

router.post('/create-vnpay-url', verifyToken, paymentController.createVNPayUrl);
router.get('/vnpay-return', paymentController.vnpayReturn);

module.exports = router;