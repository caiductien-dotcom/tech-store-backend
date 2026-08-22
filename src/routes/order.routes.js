const express = require('express');
const router = express.Router();
const orderController = require('../controllers/order.controller');
const { verifyToken, isAdmin, isCustomer } = require('../middlewares/auth.middleware');

// --- CUSTOMER ROUTES ---
// 1. Tao don hang tu gio hang
router.post('/', verifyToken, isCustomer, orderController.createOrderFromCart);

// 2. Lay danh sach don hang cua chinh minh (phai dat truoc /:id)
router.get('/my-orders', verifyToken, isCustomer, orderController.getMyOrders);

// 3. Khach hang tu huy don hang (chi khi pending)
router.put('/:id/cancel', verifyToken, isCustomer, orderController.cancelOrder);

// --- COMMON / DETAIL ROUTE ---
// 4. Xem chi tiet 1 don hang (Customer xem don cua minh, Admin xem tat ca)
router.get('/:id', verifyToken, orderController.getOrderById);

// --- ADMIN ROUTES ---
// 5. Admin xem toan bo danh sach don hang trong he thong
router.get('/', verifyToken, isAdmin, orderController.getAllOrders);

// 6. Admin cap nhat trang thai don hang
router.put('/:id/status', verifyToken, isAdmin, orderController.updateOrderStatus);

// 7. Admin xoa don hang
router.delete('/:id', verifyToken, isAdmin, orderController.deleteOrder);

module.exports = router;
