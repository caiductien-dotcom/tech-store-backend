const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');

// duong dan: POST http://localhost:5000/api/auth/register
router.post('/register', authController.register);

// duong dan: POST http://localhost:5000/api/auth/login
router.post('/login', authController.login);

module.exports = router;