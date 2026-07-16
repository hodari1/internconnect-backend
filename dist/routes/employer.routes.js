"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("../env");
const express_1 = require("express");
const employer_controller_1 = require("../controllers/employer.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const upload_1 = require("../services/upload");
const router = (0, express_1.Router)();
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
router.get('/profile', auth_middleware_1.protect, (0, auth_middleware_1.requireRole)('employer'), employer_controller_1.getProfile);
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
router.put('/profile', auth_middleware_1.protect, (0, auth_middleware_1.requireRole)('employer'), employer_controller_1.updateProfile);
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
router.post('/upload-logo', auth_middleware_1.protect, (0, auth_middleware_1.requireRole)('employer'), upload_1.uploadImage.single('logo'), employer_controller_1.uploadLogo);
/**
 * @swagger
 * /api/v1/employers/listings/{id}/matches:
 *   get:
 *     summary: Get AI match scores for all applicants on a listing
 *     tags: [Employers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Ranked applicants with AI match scores
 */
router.get('/listings/:id/matches', auth_middleware_1.protect, (0, auth_middleware_1.requireRole)('employer'), employer_controller_1.getListingMatches);
exports.default = router;
