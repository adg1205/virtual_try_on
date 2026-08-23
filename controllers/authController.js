const db = require('../models/Database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const emailService = require('../utils/emailService');
const { JWT_SECRET } = require('../middleware/authMiddleware');

exports.registerUser = async (req, res) => {
    try {
        const { full_name, email, password, phone_number, address } = req.body;
        
        let profile_photo = null;
        if (req.file) {
            profile_photo = '/uploads/profiles/' + req.file.filename;
        }

        if (!full_name || !email || !password || !phone_number) {
            return res.status(400).send("Please provide all required fields.");
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Generate verification token
        const verificationToken = crypto.randomBytes(32).toString('hex');

        const userData = {
            full_name,
            email,
            password: hashedPassword,
            phone_number,
            address,
            profile_photo,
            role: 'customer',
            verification_token: verificationToken
        };

        await db.createUser(userData);
        await emailService.sendVerificationEmail(email, verificationToken);
        
        res.send("Registration successful! Please check your email to verify your account before logging in.");

    } catch (err) {
        console.error("Error registering user:", err);
        if (err.message && err.message.includes("UNIQUE constraint failed")) {
            return res.status(400).send("Email is already registered.");
        }
        res.status(500).send("Internal Server Error.");
    }
};

exports.verifyEmail = async (req, res) => {
    try {
        const { token } = req.params;
        const user = await db.getUserByVerificationToken(token);
        
        if (!user) {
            return res.status(400).send("Invalid or expired verification token.");
        }

        await db.updateUserVerification(user.id);
        res.send("Email verified successfully! You can now <a href='/login'>login</a>.");
    } catch (err) {
        console.error(err);
        res.status(500).send("Internal Server Error");
    }
};

exports.loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).send("Provide email and password");

        const user = await db.getUserByEmail(email);
        if (!user) return res.status(401).send("Invalid email or password");

        if (user.is_verified === 0) {
            return res.status(401).send("Please verify your email before logging in.");
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).send("Invalid email or password");

        // Create JWT
        const token = jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.full_name }, JWT_SECRET, { expiresIn: '1h' });

        // Set cookie
        res.cookie('jwt', token, {
            httpOnly: true,
            maxAge: 3600000 // 1 hour
        });

        if (user.role === 'admin') {
            res.redirect('/admin/dashboard');
        } else {
            res.redirect('/customer/dashboard');
        }

    } catch (err) {
        console.error(err);
        res.status(500).send("Internal Server Error");
    }
};

exports.logoutUser = (req, res) => {
    res.clearCookie('jwt');
    res.redirect('/login');
};

exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await db.getUserByEmail(email);
        
        if (user) {
            const resetToken = crypto.randomBytes(32).toString('hex');
            const expiry = Date.now() + 3600000; // 1 hour
            await db.updateResetToken(email, resetToken, expiry);
            await emailService.sendPasswordResetEmail(email, resetToken);
        }
        
        // Always send same message to prevent email enumeration
        res.send("If an account with that email exists, we sent a password reset link.");
    } catch (err) {
        console.error(err);
        res.status(500).send("Internal Server Error");
    }
};

exports.resetPassword = async (req, res) => {
    try {
        const { token } = req.params;
        const { password } = req.body;

        const user = await db.getUserByResetToken(token);
        if (!user) {
            return res.status(400).send("Invalid or expired reset token.");
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        await db.updateUserPassword(user.id, hashedPassword);
        res.send("Password has been reset successfully! You can now <a href='/login'>login</a>.");
    } catch (err) {
        console.error(err);
        res.status(500).send("Internal Server Error");
    }
};
