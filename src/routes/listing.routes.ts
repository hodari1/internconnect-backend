import '../env';
import { Router } from 'express';
import { createListing, getListings, getListingById, updateListing, deleteListing, getSkillsGap } from '../controllers/listing.controller';
import { protect, requireRole } from '../middleware/auth.middleware';

const router = Router();

/**
 * @swagger
 * /api/v1/listings:
 *   get:
 *     summary: Get all open listings with optional filters
 *     tags: [Listings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: location
 *         schema:
 *           type: string
 *       - in: query
 *         name: skills
 *         schema:
 *           type: string
 *       - in: query
 *         name: industry
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of internship listings
 */
router.get('/', protect, getListings);

/**
 * @swagger
 * /api/v1/listings/{id}:
 *   get:
 *     summary: Get a single listing by ID
 *     tags: [Listings]
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
 *         description: Listing details
 */
router.get('/:id', protect, getListingById);

/**
 * @swagger
 * /api/v1/listings:
 *   post:
 *     summary: Create a new internship listing
 *     tags: [Listings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, description]
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               skills:
 *                 type: string
 *               location:
 *                 type: string
 *               duration:
 *                 type: string
 *               stipend:
 *                 type: string
 *               deadline:
 *                 type: string
 *               openings:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Listing created
 */
router.post('/', protect, requireRole('employer'), createListing);

/**
 * @swagger
 * /api/v1/listings/{id}:
 *   put:
 *     summary: Update a listing
 *     tags: [Listings]
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
 *         description: Listing updated
 */
router.put('/:id', protect, requireRole('employer'), updateListing);

/**
 * @swagger
 * /api/v1/listings/{id}:
 *   delete:
 *     summary: Delete a listing
 *     tags: [Listings]
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
 *         description: Listing deleted
 */
router.delete('/:id', protect, requireRole('employer'), deleteListing);

/**
 * @swagger
 * /api/v1/listings/{id}/skills-gap:
 *   get:
 *     summary: Get skills gap analysis for a listing
 *     tags: [Listings]
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
 *         description: Skills gap analysis
 */
router.get('/:id/skills-gap', protect, requireRole('student'), getSkillsGap);

export default router;