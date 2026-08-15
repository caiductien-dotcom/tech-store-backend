const express = require('express');
const router = express.Router();
const productController = require('../controllers/product.controller');
const { verifyToken, isAdmin } = require('../middlewares/auth.middleware');

// public routes (ai cung xem duoc)
router.get('/', productController.getAllProducts);
router.get('/:id', productController.getProductById);

// protected routes (chi co admin moi duoc phep tao, cap nhat, xoa san pham)
router.post('/', verifyToken, isAdmin, productController.createProduct);
router.put('/:id', verifyToken, isAdmin, productController.updateProduct);
router.delete('/:id', verifyToken, isAdmin, productController.deleteProduct);

module.exports = router;
