const User = require('../models/userModel');
const jwt = require('jsonwebtoken');

// Fail-fast mechanism: Do not let the server boot if the secret is missing.
if (!process.env.JWT_SECRET) {
    console.error("FATAL ERROR: JWT_SECRET is not defined in environment variables.");
    process.exit(1);
}

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// Basic regex for email validation
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const authController = {
    registerUser: async (req, res) => {
        try {
            // Force type casting to strings to prevent NoSQL injection via object payloads
            const name = String(req.body.name || '').trim();
            const email = String(req.body.email || '').toLowerCase().trim();
            const password = String(req.body.password || '');

            // 1. Strict Input Validation
            if (!name || !email || !password) {
                return res.status(400).json({ success: false, message: "All fields are mandatory." });
            }
            if (!isValidEmail(email)) {
                return res.status(400).json({ success: false, message: "Invalid email format." });
            }
            if (password.length < 6) {
                return res.status(400).json({ success: false, message: "Password must be at least 6 characters." });
            }

            // 2. Check for existing user (Changed to 409 Conflict)
            const userExists = await User.findOne({ email });
            if (userExists) {
                return res.status(409).json({ success: false, message: "User already exists." });
            }

            // 3. Database Insertion
            const user = await User.create({ name, email, password });
            
            res.status(201).json({
                success: true,
                _id: user._id,
                name: user.name,
                email: user.email,
                token: generateToken(user._id)
            });
        } catch (error) {
            // Log the real error for the dev team, send a blank wall to the client.
            console.error(`[Register Error]: ${error.message}`);
            res.status(500).json({ success: false, message: "Internal server error. Please try again later." });
        }
    },

    loginUser: async (req, res) => {
        try {
            // Force type casting
            const email = String(req.body.email || '').toLowerCase().trim();
            const password = String(req.body.password || '');

            if (!email || !password) {
                 return res.status(400).json({ success: false, message: "Email and password are required." });
            }

            const user = await User.findOne({ email });

            // Ensure generic error message so attackers don't know if the email or password was wrong
            if (user && (await user.matchPassword(password))) {
                res.status(200).json({
                    success: true,
                    _id: user._id,
                    name: user.name,
                    email: user.email,
                    token: generateToken(user._id)
                });
            } else {
                res.status(401).json({ success: false, message: "Invalid credentials." });
            }
        } catch (error) {
            console.error(`[Login Error]: ${error.message}`);
            res.status(500).json({ success: false, message: "Internal server error. Please try again later." });
        }
    }
};

module.exports = authController;