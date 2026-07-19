const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/category.controller');
// cho middleware auth vao day de kiem tra token va quyen admin
const { verifyToken, isAdmin } = require('../middlewares/auth.middleware');

// lay danh sach tat ca danh muc (khong can dang nhap)
router.get('/', categoryController.getAllCategories);

// tao danh muc moi (chi cho phep admin)
router.post('/', verifyToken, isAdmin, categoryController.createCategory);

module.exports = router;