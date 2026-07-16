import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../services/prisma';
import crypto from 'crypto';
import { sendVerificationEmail, sendPasswordResetEmail } from '../services/email';

// REGISTER
export const register = async (req: Request, res: Response): Promise<void> => {
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
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    // Hash password — never store plain text
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: { name, email, password: hashedPassword, role }
    });

    // Send verification email
const verificationToken = crypto.randomBytes(32).toString('hex');

await prisma.user.update({
  where: { id: user.id },
  data: { verificationToken }
});

await sendVerificationEmail(user.email, user.name, verificationToken).catch(console.error);

    // Auto-create profile based on role
    if (role === 'student') {
      await prisma.student.create({ data: { userId: user.id } });
    }

    if (role === 'employer') {
      await prisma.employer.create({
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

  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Something went wrong' });
  }
};

// LOGIN
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    console.log(`[LOGIN] Attempting login for email: ${email}`);

    // Find user
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.log(`[LOGIN] User not found for email: ${email}`);
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    console.log(`[LOGIN] User found: ${user.id}, checking password...`);

    // Check password
    const passwordMatch = await bcrypt.compare(password, user.password);
    console.log(`[LOGIN] Password match result: ${passwordMatch}, stored hash starts with: ${user.password.substring(0, 20)}`);
    
    if (!passwordMatch) {
      console.log(`[LOGIN] Password mismatch for user: ${user.email}`);
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    console.log(`[LOGIN] Password matched! Generating JWT for user: ${user.id}`);

    // Sign JWT
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET as string,
      { expiresIn: '24h' }
    );

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

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Something went wrong' });
  }
};

// GET /api/v1/auth/verify-email?token=...
export const verifyEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.query;

    if (!token) {
      res.status(400).json({ error: 'Token is required' });
      return;
    }

    const user = await prisma.user.findFirst({
      where: { verificationToken: token as string }
    });

    if (!user) {
      res.status(400).json({ error: 'Invalid or expired verification token' });
      return;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, verificationToken: null }
    });

    res.json({ message: 'Email verified successfully! You can now log in.' });
  } catch (error) {
    console.error('verifyEmail error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// POST /api/v1/auth/forgot-password
export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ error: 'Email is required' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email } });

    // Always return success to prevent email enumeration
    if (!user) {
      res.json({ message: 'If that email exists, an OTP has been sent.' });
      return;
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await prisma.user.update({
      where: { id: user.id },
      data: { resetOtp: otp, resetOtpExpiry: otpExpiry }
    });

    await sendPasswordResetEmail(user.email, user.name, otp).catch(console.error);

    res.json({ message: 'If that email exists, an OTP has been sent.' });
  } catch (error) {
    console.error('forgotPassword error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// POST /api/v1/auth/reset-password
export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      res.status(400).json({ error: 'Email, OTP, and new password are required' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.resetOtp || !user.resetOtpExpiry) {
      res.status(400).json({ error: 'Invalid or expired OTP' });
      return;
    }

    if (user.resetOtp !== otp) {
      res.status(400).json({ error: 'Invalid OTP' });
      return;
    }

    if (new Date() > (user.resetOtpExpiry as Date)) {
      res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
      return;
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetOtp: null,
        resetOtpExpiry: null
      }
    });

    res.json({ message: 'Password reset successfully! You can now log in.' });
  } catch (error) {
    console.error('resetPassword error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};