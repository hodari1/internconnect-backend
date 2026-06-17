import '../env';
import { Router } from 'express';
import { getProfile, updateProfile, uploadLogo } from '../controllers/employer.controller';
import { protect, requireRole } from '../middleware/auth.middleware';
import { upload, uploadImage } from '../services/upload';

const router = Router();

/**
 * @swagger
 * /api/v1/employers/profile:
 *   get:
 *     summary: Get logged-in employer's profile
 *     tags: [Employers]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Employer profile returned
 */
router.get('/profile', protect, requireRole('employer'), getProfile);

/**
 * @swagger
 * /api/v1/employers/profile:
 *   put:
 *     summary: Update employer profile
 *     tags: [Employers]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               companyName:
 *                 type: string
 *               industry:
 *                 type: string
 *               website:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated
 */
router.put('/profile', protect, requireRole('employer'), updateProfile);

/**
 * @swagger
 * /api/v1/employers/upload-logo:
 *   post:
 *     summary: Upload company logo
 *     tags: [Employers]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               logo:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Logo uploaded successfully
 */
router.post('/upload-logo', protect, requireRole('employer'), uploadImage.single('logo'), uploadLogo);

export default router;