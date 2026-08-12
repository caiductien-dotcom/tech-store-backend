const jwt = require('jsonwebtoken');

exports.verifyToken = (req, res, next) => {
    // Lay token tu header Authorization
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: "You are not logged in! Please provide your token." });
    }

    try {
        // Giai ma token
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret_key_default');
        
        // Luu payload { userId, email, role } vao req.user
        req.user = decoded; 
        next();
    } catch (error) {
        return res.status(403).json({ message: "Token is invalid or has expired!" });
    }
};

// Bo loc kiem tra quyen admin
exports.isAdmin = (req, res, next) => {
    if (req.user && req.user.role && req.user.role.toUpperCase() === 'ADMIN') {
        next();
    } else {
        return res.status(403).json({ message: "Error: Access denied! This action is only allowed for Admins." });
    }
};