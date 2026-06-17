import '../env';
import { Router } from 'express';
import { createSlot, getListingSlots, bookSlot, getMySlots } from '../controllers/interview.controller';
import { protect, requireRole } from '../middleware/auth.middleware';

const router = Router();

/**
 * @swagger
 * /api/v1/interviews:
 *   post:
 *     summary: Create an interview slot
 *     tags: [Interviews]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [listingId, datetime]
 *             properties:
 *               listingId:
 *                 type: string
 *               datetime:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Slot created
 */
router.post('/', protect, requireRole('employer'), createSlot);

/**
 * @swagger
 * /api/v1/interviews/listing/{listingId}:
 *   get:
 *     summary: Get available interview slots for a listing
 *     tags: [Interviews]
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
 *         description: List of available slots
 */
router.get('/listing/:listingId', protect, getListingSlots);

/**
 * @swagger
 * /api/v1/interviews/my:
 *   get:
 *     summary: Get student's booked interview slots
 *     tags: [Interviews]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of booked slots
 */
router.get('/my', protect, requireRole('student'), getMySlots);

/**
 * @swagger
 * /api/v1/interviews/{id}/book:
 *   put:
 *     summary: Book an interview slot
 *     tags: [Interviews]
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
 *         description: Slot booked successfully
 */
router.put('/:id/book', protect, requireRole('student'), bookSlot);

export default router;