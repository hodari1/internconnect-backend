"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getReviews = exports.createReview = void 0;
require("../env");
const prisma_1 = __importDefault(require("../services/prisma"));
// POST /api/v1/reviews
const createReview = async (req, res) => {
    try {
        const { targetId, targetType, rating, comment } = req.body;
        if (!targetId || !targetType || !rating) {
            res.status(400).json({ error: 'targetId, targetType and rating are required' });
            return;
        }
        const validTargetTypes = ['student', 'employer'];
        if (!validTargetTypes.includes(targetType)) {
            res.status(400).json({ error: 'targetType must be student or employer' });
            return;
        }
        if (rating < 1 || rating > 5) {
            res.status(400).json({ error: 'Rating must be between 1 and 5' });
            return;
        }
        const review = await prisma_1.default.review.create({
            data: {
                authorId: req.user.userId,
                targetId,
                targetType,
                rating: Number(rating),
                comment: comment || null
            }
        });
        res.status(201).json({ message: 'Review submitted successfully', review });
    }
    catch (error) {
        console.error('createReview error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};
exports.createReview = createReview;
// GET /api/v1/reviews/:targetType/:targetId
const getReviews = async (req, res) => {
    try {
        const { targetType, targetId } = req.params;
        const reviews = await prisma_1.default.review.findMany({
            where: {
                targetId: targetId,
                targetType: targetType
            },
            orderBy: { createdAt: 'desc' }
        });
        // Calculate average rating
        const avgRating = reviews.length > 0
            ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
            : 0;
        res.json({
            total: reviews.length,
            averageRating: Math.round(avgRating * 10) / 10,
            reviews
        });
    }
    catch (error) {
        console.error('getReviews error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};
exports.getReviews = getReviews;
