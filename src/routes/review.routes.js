const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/review.controller');
const { verifyToken, isCustomer } = require('../middlewares/auth.middleware');

// --- PUBLIC ROUTES ---
// Xem danh sach danh gia cua 1 san pham
router.get('/product/:productId', reviewController.getProductReviews);

// --- CUSTOMER PROTECTED ROUTES ---
// Danh gia san pham tu don hang delivered
router.post('/', verifyToken, isCustomer, reviewController.createReview);

// Xem cac danh gia cua chinh minh
router.get('/my-reviews', verifyToken, isCustomer, reviewController.getMyReviews);

// Xoa danh gia (Customer chu danh gia hoac Admin)
router.delete('/:id', verifyToken, reviewController.deleteReview);

module.exports = router;
