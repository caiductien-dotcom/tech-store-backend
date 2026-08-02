const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

// POST http://localhost:5000/api/auth/register
router.post('/register', authController.register);

// POST http://localhost:5000/api/auth/login
router.post('/login', authController.login);

// GET http://localhost:5000/api/auth/me 
router.get('/me', verifyToken, authController.getMe);

module.exports = router;