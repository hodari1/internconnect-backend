import '../env';
import { Router } from 'express';
import { getProfile, updateProfile, uploadCV, getRecommendations, toggleJobAlerts } from '../controllers/student.controller';
import { protect, requireRole } from '../middleware/auth.middleware';
import { upload } from '../services/upload';

const router = Router();

/**
 * @swagger
 * /api/v1/students/profile:
 *   get:
 *     summary: Get logged-in student's profile
 *     tags: [Students]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Student profile returned
 */
router.get('/profile', protect, requireRole('student'), getProfile);

/**
 * @swagger
 * /api/v1/students/profile:
 *   put:
 *     summary: Update student profile
 *     tags: [Students]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               university:
 *                 type: string
 *               faculty:
 *                 type: string
 *               department:
 *                 type: string
 *               year:
 *                 type: integer
 *               gpa:
 *                 type: number
 *               bio:
 *                 type: string
 *               skills:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated
 */
router.put('/profile', protect, requireRole('student'), updateProfile);

/**
 * @swagger
 * /api/v1/students/upload-cv:
 *   post:
 *     summary: Upload CV and extract skills with AI
 *     tags: [Students]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               cv:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: CV uploaded and skills extracted
 */
router.post('/upload-cv', protect, requireRole('student'), upload.single('cv'), uploadCV);

/**
 * @swagger
 * /api/v1/students/recommendations:
 *   get:
 *     summary: Get AI-powered internship recommendations based on student skills
 *     tags: [Students]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Ranked list of matching internships
 */
router.get('/recommendations', protect, requireRole('student'), getRecommendations);

/**
 * @swagger
 * /api/v1/students/job-alerts:
 *   put:
 *     summary: Enable or disable job alerts
 *     tags: [Students]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               enabled:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Job alerts updated
 */
router.put('/job-alerts', protect, requireRole('student'), toggleJobAlerts);

export default router;