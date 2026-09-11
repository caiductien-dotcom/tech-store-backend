const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cart.controller');
const { verifyToken, isCustomer } = require('../middlewares/auth.middleware');

// Lay gio hang
router.get('/', verifyToken, isCustomer, cartController.getCart);

// Them san pham vao gio
router.post('/items', verifyToken, isCustomer, cartController.addToCart);

// Cap nhat so luong hoac is_selected
router.put('/items/:id', verifyToken, isCustomer, cartController.updateCartItem);

// Xoa 1 san pham khoi gio
router.delete('/items/:id', verifyToken, isCustomer, cartController.deleteCartItem);

// Xoa sach gio hang
router.delete('/', verifyToken, isCustomer, cartController.clearCart);

module.exports = router;