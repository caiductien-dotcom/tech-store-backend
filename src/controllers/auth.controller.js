exports.register = (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({
            message: "Username, email and password are required"
        });
    }
    res.status(201).json({
        message: "Sign up successfully",
        user: {
            username,
            email
        }
    });
};

exports.login = (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            message: "Email and password are required"
        });
    }
    res.status(200).json({
        message: "Login successfully",
        email
    });
};