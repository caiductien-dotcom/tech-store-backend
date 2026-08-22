const express = require('express');
const router = express.Router();
const shippingController = require('../controllers/shipping.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

// Public/Guest/Customer deu goi duoc de tinh phi truoc khi checkout
router.post('/calculate', shippingController.calculateShipping);
router.get('/carriers', shippingController.getShippingCarriers);

module.exports = router;