"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("../env");
const express_1 = require("express");
const review_controller_1 = require("../controllers/review.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
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
router.post('/', auth_middleware_1.protect, review_controller_1.createReview);
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
router.get('/:targetType/:targetId', auth_middleware_1.protect, review_controller_1.getReviews);
exports.default = router;
