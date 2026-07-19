const jwt = require('jsonwebtoken');

exports.verifyToken = (req, res, next) => {
    // lay token tu header Authorization
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: "You are not logged in! Please provide your token." });
    }

    try {
        // giai ma token va kiem tra tinh hop le
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret_key_default');
        
        // luu thong tin nguoi dung vao req de su dung trong cac controller tiep theo
        req.user = decoded; 
        next(); // cho phep di tiep den controller tiep theo
    } catch (error) {
        return res.status(403).json({ message: "Token is invalid or has expired!" });
    }
};

// bo loc kiem tra quyen admin
exports.isAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        return res.status(403).json({ message: "Error: Access denied! This action is only allowed for Admins." });
    }
};