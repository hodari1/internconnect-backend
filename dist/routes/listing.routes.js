"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("../env");
const express_1 = require("express");
const listing_controller_1 = require("../controllers/listing.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
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
router.get('/', auth_middleware_1.protect, listing_controller_1.getListings);
/**
 * @swagger
 * /api/v1/listings/my:
 *   get:
 *     summary: Get all listings for the logged-in employer
 *     tags: [Listings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Employer's own listings
 */
router.get('/my', auth_middleware_1.protect, (0, auth_middleware_1.requireRole)('employer'), listing_controller_1.getMyListings);
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
router.get('/:id', auth_middleware_1.protect, listing_controller_1.getListingById);
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
router.post('/', auth_middleware_1.protect, (0, auth_middleware_1.requireRole)('employer'), listing_controller_1.createListing);
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
router.put('/:id', auth_middleware_1.protect, (0, auth_middleware_1.requireRole)('employer'), listing_controller_1.updateListing);
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
router.delete('/:id', auth_middleware_1.protect, (0, auth_middleware_1.requireRole)('employer'), listing_controller_1.deleteListing);
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
router.get('/:id/skills-gap', auth_middleware_1.protect, (0, auth_middleware_1.requireRole)('student'), listing_controller_1.getSkillsGap);
exports.default = router;
