const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');
const { verifyToken, isAdmin } = require('../middlewares/auth.middleware');

// Tat ca cac route Dashboard yeu cau quyen ADMIN
router.use(verifyToken, isAdmin);

// 1. Thong ke tong quan
router.get('/stats', dashboardController.getDashboardStats);

// 2. Top san pham ban chay nhat (sold_count)
router.get('/top-products', dashboardController.getTopSellingProducts);

// 3. Bieu do doanh thu (theo thang / theo 7 ngay gan nhat)
router.get('/revenue-chart', dashboardController.getRevenueChart);

module.exports = router;
