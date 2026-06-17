import '../env';
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import prisma from '../services/prisma';

// POST /api/v1/reviews
export const createReview = async (req: AuthRequest, res: Response): Promise<void> => {
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

    const review = await prisma.review.create({
      data: {
        authorId: req.user!.userId,
        targetId,
        targetType,
        rating: Number(rating),
        comment: comment || null
      }
    });

    res.status(201).json({ message: 'Review submitted successfully', review });
  } catch (error) {
    console.error('createReview error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// GET /api/v1/reviews/:targetType/:targetId
export const getReviews = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { targetType, targetId } = req.params;

    const reviews = await prisma.review.findMany({
      where: {
        targetId: targetId as string,
        targetType: targetType as string
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
  } catch (error) {
    console.error('getReviews error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};