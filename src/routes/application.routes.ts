import '../env';
import { Router } from 'express';
import { applyForListing, getMyApplications, getListingApplications, updateApplicationStatus, withdrawApplication } from '../controllers/application.controller';
import { protect, requireRole } from '../middleware/auth.middleware';

const router = Router();

/**
 * @swagger
 * /api/v1/applications:
 *   post:
 *     summary: Apply for an internship listing
 *     tags: [Applications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [listingId]
 *             properties:
 *               listingId:
 *                 type: string
 *               coverLetterUrl:
 *                 type: string
 *     responses:
 *       201:
 *         description: Application submitted
 */
router.post('/', protect, requireRole('student'), applyForListing);

/**
 * @swagger
 * /api/v1/applications/my:
 *   get:
 *     summary: Get all applications for logged-in student
 *     tags: [Applications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of applications
 */
router.get('/my', protect, requireRole('student'), getMyApplications);

/**
 * @swagger
 * /api/v1/applications/listing/{listingId}:
 *   get:
 *     summary: Get all applicants for a listing
 *     tags: [Applications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: listingId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of applicants
 */
router.get('/listing/:listingId', protect, requireRole('employer'), getListingApplications);

/**
 * @swagger
 * /api/v1/applications/{id}/status:
 *   put:
 *     summary: Update application status
 *     tags: [Applications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [applied, reviewed, shortlisted, accepted, rejected]
 *     responses:
 *       200:
 *         description: Status updated
 */
router.put('/:id/status', protect, requireRole('employer'), updateApplicationStatus);

/**
 * @swagger
 * /api/v1/applications/{id}:
 *   delete:
 *     summary: Withdraw an application
 *     tags: [Applications]
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
 *         description: Application withdrawn
 */
router.delete('/:id', protect, requireRole('student'), withdrawApplication);

export default router;