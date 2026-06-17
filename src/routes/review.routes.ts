import '../env';
import { Router } from 'express';
import { createReview, getReviews } from '../controllers/review.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

/**
 * @swagger
 * /api/v1/reviews:
 *   post:
 *     summary: Submit a review
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [targetId, targetType, rating]
 *             properties:
 *               targetId:
 *                 type: string
 *               targetType:
 *                 type: string
 *                 enum: [student, employer]
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *               comment:
 *                 type: string
 *     responses:
 *       201:
 *         description: Review submitted
 */
router.post('/', protect, createReview);

/**
 * @swagger
 * /api/v1/reviews/{targetType}/{targetId}:
 *   get:
 *     summary: Get reviews for a student or employer
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: targetType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [student, employer]
 *       - in: path
 *         name: targetId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of reviews with average rating
 */
router.get('/:targetType/:targetId', protect, getReviews);

export default router;