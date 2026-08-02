const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/category.controller');
const { verifyToken, isAdmin } = require('../middlewares/auth.middleware');

// public routes(ai cung xem duoc)
router.get('/', categoryController.getAllCategories);
router.get('/:id', categoryController.getCategoryById);

// protected routes(chi co admin moi duoc phep tao, cap nhat, xoa danh muc)
router.post('/', verifyToken, isAdmin, categoryController.createCategory);
router.put('/:id', verifyToken, isAdmin, categoryController.updateCategory);
router.delete('/:id', verifyToken, isAdmin, categoryController.deleteCategory);

module.exports = router;