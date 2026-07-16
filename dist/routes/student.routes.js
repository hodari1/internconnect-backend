"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("../env");
const express_1 = require("express");
const student_controller_1 = require("../controllers/student.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const upload_1 = require("../services/upload");
const router = (0, express_1.Router)();
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
router.get('/profile', auth_middleware_1.protect, (0, auth_middleware_1.requireRole)('student'), student_controller_1.getProfile);
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
router.put('/profile', auth_middleware_1.protect, (0, auth_middleware_1.requireRole)('student'), student_controller_1.updateProfile);
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
router.post('/upload-cv', auth_middleware_1.protect, (0, auth_middleware_1.requireRole)('student'), upload_1.upload.single('cv'), student_controller_1.uploadCV);
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
router.get('/recommendations', auth_middleware_1.protect, (0, auth_middleware_1.requireRole)('student'), student_controller_1.getRecommendations);
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
router.put('/job-alerts', auth_middleware_1.protect, (0, auth_middleware_1.requireRole)('student'), student_controller_1.toggleJobAlerts);
exports.default = router;
