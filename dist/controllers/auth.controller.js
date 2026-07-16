"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetPassword = exports.forgotPassword = exports.verifyEmail = exports.login = exports.register = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = __importDefault(require("../services/prisma"));
const crypto_1 = __importDefault(require("crypto"));
const email_1 = require("../services/email");
// REGISTER
const register = async (req, res) => {
    try {
        const { name, email, password, role, companyName } = req.body;
        // Validate required fields
        if (!name || !email || !password || !role) {
            res.status(400).json({ error: 'All fields are required' });
            return;
        }
        // Validate role
        const validRoles = ['student', 'employer', 'admin'];
        if (!validRoles.includes(role)) {
            res.status(400).json({ error: 'Role must be student, employer, or admin' });
            return;
        }
        // Check if email already taken
        const existing = await prisma_1.default.user.findUnique({ where: { email } });
        if (existing) {
            res.status(409).json({ error: 'Email already registered' });
            return;
        }
        // Hash password — never store plain text
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        // Create user
        const user = await prisma_1.default.user.create({
            data: { name, email, password: hashedPassword, role }
        });
        // Send verification email
        const verificationToken = crypto_1.default.randomBytes(32).toString('hex');
        await prisma_1.default.user.update({
            where: { id: user.id },
            data: { verificationToken }
        });
        await (0, email_1.sendVerificationEmail)(user.email, user.name, verificationToken).catch(console.error);
        // Auto-create profile based on role
        if (role === 'student') {
            await prisma_1.default.student.create({ data: { userId: user.id } });
        }
        if (role === 'employer') {
            await prisma_1.default.employer.create({
                data: {
                    userId: user.id,
                    companyName: companyName || 'My Company'
                }
            });
        }
        res.status(201).json({
            message: 'Account created successfully',
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    }
    catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Something went wrong' });
    }
};
exports.register = register;
// LOGIN
const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            res.status(400).json({ error: 'Email and password are required' });
            return;
        }
        console.log(`[LOGIN] Attempting login for email: ${email}`);
        // Find user
        const user = await prisma_1.default.user.findUnique({ where: { email } });
        if (!user) {
            console.log(`[LOGIN] User not found for email: ${email}`);
            res.status(401).json({ error: 'Invalid email or password' });
            return;
        }
        console.log(`[LOGIN] User found: ${user.id}, checking password...`);
        // Check password
        const passwordMatch = await bcryptjs_1.default.compare(password, user.password);
        console.log(`[LOGIN] Password match result: ${passwordMatch}, stored hash starts with: ${user.password.substring(0, 20)}`);
        if (!passwordMatch) {
            console.log(`[LOGIN] Password mismatch for user: ${user.email}`);
            res.status(401).json({ error: 'Invalid email or password' });
            return;
        }
        console.log(`[LOGIN] Password matched! Generating JWT for user: ${user.id}`);
        // Sign JWT
        const token = jsonwebtoken_1.default.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '24h' });
        console.log(`[LOGIN] JWT generated successfully for user: ${user.id}`);
        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    }
    catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Something went wrong' });
    }
};
exports.login = login;
// GET /api/v1/auth/verify-email?token=...
const verifyEmail = async (req, res) => {
    try {
        const { token } = req.query;
        if (!token) {
            res.status(400).json({ error: 'Token is required' });
            return;
        }
        const user = await prisma_1.default.user.findFirst({
            where: { verificationToken: token }
        });
        if (!user) {
            res.status(400).json({ error: 'Invalid or expired verification token' });
            return;
        }
        await prisma_1.default.user.update({
            where: { id: user.id },
            data: { emailVerified: true, verificationToken: null }
        });
        res.json({ message: 'Email verified successfully! You can now log in.' });
    }
    catch (error) {
        console.error('verifyEmail error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};
exports.verifyEmail = verifyEmail;
// POST /api/v1/auth/forgot-password
const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            res.status(400).json({ error: 'Email is required' });
            return;
        }
        const user = await prisma_1.default.user.findUnique({ where: { email } });
        // Always return success to prevent email enumeration
        if (!user) {
            res.json({ message: 'If that email exists, an OTP has been sent.' });
            return;
        }
        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
        await prisma_1.default.user.update({
            where: { id: user.id },
            data: { resetOtp: otp, resetOtpExpiry: otpExpiry }
        });
        await (0, email_1.sendPasswordResetEmail)(user.email, user.name, otp).catch(console.error);
        res.json({ message: 'If that email exists, an OTP has been sent.' });
    }
    catch (error) {
        console.error('forgotPassword error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};
exports.forgotPassword = forgotPassword;
// POST /api/v1/auth/reset-password
const resetPassword = async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;
        if (!email || !otp || !newPassword) {
            res.status(400).json({ error: 'Email, OTP, and new password are required' });
            return;
        }
        const user = await prisma_1.default.user.findUnique({ where: { email } });
        if (!user || !user.resetOtp || !user.resetOtpExpiry) {
            res.status(400).json({ error: 'Invalid or expired OTP' });
            return;
        }
        if (user.resetOtp !== otp) {
            res.status(400).json({ error: 'Invalid OTP' });
            return;
        }
        if (new Date() > user.resetOtpExpiry) {
            res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
            return;
        }
        const hashedPassword = await bcryptjs_1.default.hash(newPassword, 10);
        await prisma_1.default.user.update({
            where: { id: user.id },
            data: {
                password: hashedPassword,
                resetOtp: null,
                resetOtpExpiry: null
            }
        });
        res.json({ message: 'Password reset successfully! You can now log in.' });
    }
    catch (error) {
        console.error('resetPassword error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};
exports.resetPassword = resetPassword;
