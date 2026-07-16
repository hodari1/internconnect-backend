"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("../env");
const express_1 = require("express");
const interview_controller_1 = require("../controllers/interview.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
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
router.post('/', auth_middleware_1.protect, (0, auth_middleware_1.requireRole)('employer'), interview_controller_1.createSlot);
/**
 * @swagger
 * /api/v1/interviews/schedule/{applicationId}:
 *   post:
 *     summary: Directly schedule an interview for a shortlisted applicant
 *     tags: [Interviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: applicationId
 *         required: true
 *         schema:
 *           type: string
 *         description: The application ID to schedule interview for
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [datetime]
 *             properties:
 *               datetime:
 *                 type: string
 *                 format: date-time
 *                 example: "2026-07-20T10:00:00.000Z"
 *               location:
 *                 type: string
 *                 example: "Kigali Office, Floor 2"
 *               notes:
 *                 type: string
 *                 example: "Please bring your ID"
 *     responses:
 *       201:
 *         description: Interview scheduled and student notified
 *       400:
 *         description: datetime missing or applicant not shortlisted
 *       403:
 *         description: Access denied
 *       404:
 *         description: Application or employer not found
 */
router.post('/schedule/:applicationId', auth_middleware_1.protect, (0, auth_middleware_1.requireRole)('employer'), interview_controller_1.scheduleInterviewForApplication);
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
router.get('/listing/:listingId', auth_middleware_1.protect, interview_controller_1.getListingSlots);
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
router.get('/my', auth_middleware_1.protect, (0, auth_middleware_1.requireRole)('student'), interview_controller_1.getMySlots);
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
router.put('/:id/book', auth_middleware_1.protect, (0, auth_middleware_1.requireRole)('student'), interview_controller_1.bookSlot);
exports.default = router;
