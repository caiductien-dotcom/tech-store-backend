const prisma = require("../prisma/prisma");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto"); // bo sung module crypto de tao guestId ngau nhien

// Cap token dinh danh an danh cho  Guest
exports.createGuestSession = async (req, res) => {
    try {
        // Tao guestId duy nhat cho moi phien truy cap cua khach
        const guestId = `guest_${crypto.randomUUID()}`;

        // Tao JWT mang role GUEST
        const token = jwt.sign(
            { 
                userId: guestId, 
                role: "GUEST",
                isGuest: true 
            },
            process.env.JWT_SECRET || 'secret_key_default',
            { expiresIn: "7d" } // Phien guest thuong duy tri 7 ngay
        );

        return res.status(200).json({
            success: true,
            message: "Guest session created successfully",
            data: {
                token,
                guestId,
                role: "GUEST"
            }
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message,
            errorCode: "SYS_500",
            timestamp: new Date().toISOString(),
            path: req.originalUrl
        });
    }
};

// dang ki
exports.register = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "Name, email and password are required",
                errorCode: "AUTH_001",
                timestamp: new Date().toISOString(),
                path: req.originalUrl
            });
        }

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "Email already exists",
                errorCode: "AUTH_003",
                timestamp: new Date().toISOString(),
                path: req.originalUrl
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: { name, email, password: hashedPassword }
        });

        return res.status(201).json({
            success: true,
            message: "Register successfully",
            data: {
                id: user.user_id,
                name: user.name,
                email: user.email
            }
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message,
            errorCode: "SYS_500",
            timestamp: new Date().toISOString(),
            path: req.originalUrl
        });
    }
};

// dang nhap
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required",
                errorCode: "AUTH_001",
                timestamp: new Date().toISOString(),
                path: req.originalUrl
            });
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password",
                errorCode: "AUTH_004",
                timestamp: new Date().toISOString(),
                path: req.originalUrl
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password",
                errorCode: "AUTH_004",
                timestamp: new Date().toISOString(),
                path: req.originalUrl
            });
        }

        const token = jwt.sign(
            { userId: user.user_id, email: user.email, role: user.role },
            process.env.JWT_SECRET || 'secret_key_default',
            { expiresIn: "1d" }
        );

        return res.status(200).json({
            success: true,
            message: "Login successfully",
            data: {
                token,
                user: {
                    id: user.user_id,
                    name: user.name,
                    email: user.email,
                    role: user.role || "CUSTOMER"
                }
            }
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message,
            errorCode: "SYS_500",
            timestamp: new Date().toISOString(),
            path: req.originalUrl
        });
    }
};

// lay thong tin nguoi dung tu token
exports.getMe = async (req, res) => {
    try {
        // Neu token la cua Guest -> Tra ve luon thong tin Guest, khong can query database
        if (req.user && (req.user.isGuest || req.user.role === 'GUEST')) {
            return res.status(200).json({
                success: true,
                data: {
                    id: req.user.userId,
                    name: "Guest User",
                    role: "GUEST",
                    isGuest: true
                }
            });
        }

        // Token cua User chinh thuc -> Query DB
        const user = await prisma.user.findUnique({
            where: { user_id: req.user.userId }
        });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Token missing or invalid",
                errorCode: "AUTH_002",
                timestamp: new Date().toISOString(),
                path: req.originalUrl
            });
        }

        return res.status(200).json({
            success: true,
            data: {
                id: user.user_id,
                name: user.name,
                email: user.email,
                role: user.role || "CUSTOMER"
            }
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message,
            errorCode: "SYS_500",
            timestamp: new Date().toISOString(),
            path: req.originalUrl
        });
    }
};