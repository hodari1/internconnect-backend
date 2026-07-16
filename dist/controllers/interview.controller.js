"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMySlots = exports.bookSlot = exports.getListingSlots = exports.scheduleInterviewForApplication = exports.createSlot = void 0;
require("../env");
const prisma_1 = __importDefault(require("../services/prisma"));
const email_1 = require("../services/email");
// POST /api/v1/interviews
const createSlot = async (req, res) => {
    try {
        const { listingId, datetime } = req.body;
        if (!listingId || !datetime) {
            res.status(400).json({ error: 'listingId and datetime are required' });
            return;
        }
        const employer = await prisma_1.default.employer.findUnique({
            where: { userId: req.user.userId }
        });
        if (!employer) {
            res.status(404).json({ error: 'Employer profile not found' });
            return;
        }
        const listing = await prisma_1.default.listing.findUnique({
            where: { id: listingId }
        });
        if (!listing) {
            res.status(404).json({ error: 'Listing not found' });
            return;
        }
        if (listing.employerId !== employer.id) {
            res.status(403).json({ error: 'You can only create slots for your own listings' });
            return;
        }
        const slot = await prisma_1.default.interviewSlot.create({
            data: {
                listingId,
                datetime: new Date(datetime),
            }
        });
        res.status(201).json({ message: 'Interview slot created', slot });
    }
    catch (error) {
        console.error('createSlot error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};
exports.createSlot = createSlot;
// POST /api/v1/interviews/schedule/:applicationId
// Employer directly schedules an interview for a specific (shortlisted) applicant
const scheduleInterviewForApplication = async (req, res) => {
    try {
        console.log('=== scheduleInterviewForApplication HIT ===');
        console.log('request url:', req.originalUrl);
        console.log('applicationId:', req.params.applicationId);
        console.log('body:', req.body);
        console.log('user:', req.user);
        const { datetime, location, notes } = req.body;
        const { applicationId } = req.params;
        if (!datetime) {
            console.log('❌ datetime missing');
            res.status(400).json({ error: 'datetime is required' });
            return;
        }
        console.log('✅ datetime ok:', datetime);
        const employer = await prisma_1.default.employer.findUnique({
            where: { userId: req.user.userId }
        });
        console.log('employer found:', employer?.id ?? 'NOT FOUND');
        if (!employer) {
            res.status(404).json({ error: 'Employer profile not found' });
            return;
        }
        const application = await prisma_1.default.application.findUnique({
            where: { id: applicationId },
            include: {
                listing: true,
                student: {
                    include: {
                        user: { select: { id: true, name: true, email: true } }
                    }
                }
            }
        });
        console.log('application found:', application?.id ?? 'NOT FOUND');
        console.log('application status:', application?.status);
        if (!application) {
            res.status(404).json({ error: 'Application not found' });
            return;
        }
        if (application.listing.employerId !== employer.id) {
            console.log('❌ access denied - not your listing');
            res.status(403).json({ error: 'Access denied' });
            return;
        }
        if (application.status !== 'shortlisted') {
            console.log('❌ status is not shortlisted, it is:', application.status);
            res.status(400).json({ error: 'You can only schedule interviews for shortlisted applicants' });
            return;
        }
        console.log('✅ all checks passed, creating slot...');
        const interviewDate = new Date(datetime);
        // Create the slot, pre-booked and confirmed directly for this applicant
        const slot = await prisma_1.default.interviewSlot.create({
            data: {
                listingId: application.listingId,
                applicationId: application.id,
                datetime: interviewDate,
                location: location || null,
                notes: notes || null,
                bookedById: application.studentId,
                confirmed: true,
            }
        });
        console.log('✅ slot created:', slot.id);
        // Create in-app notification
        await prisma_1.default.notification.create({
            data: {
                userId: application.student.user.id,
                type: 'interview_scheduled',
                message: `Interview scheduled for ${application.listing.title} on ${interviewDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} at ${interviewDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}.`,
            }
        });
        console.log('✅ notification created');
        // Send email — do not block the response if email fails
        (0, email_1.sendInterviewEmail)(application.student.user.email, application.student.user.name, application.listing.title, employer.companyName, interviewDate, location || null, notes || null).catch((err) => console.error('Failed to send interview email:', err));
        res.status(201).json({ message: 'Interview scheduled successfully', slot });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('scheduleInterviewForApplication error:', errorMessage);
        res.status(500).json({
            error: 'Server error while scheduling interview',
            details: errorMessage,
        });
    }
};
exports.scheduleInterviewForApplication = scheduleInterviewForApplication;
// GET /api/v1/interviews/listing/:listingId
const getListingSlots = async (req, res) => {
    try {
        const slots = await prisma_1.default.interviewSlot.findMany({
            where: {
                listingId: req.params.listingId,
                confirmed: false,
                bookedById: null
            },
            orderBy: { datetime: 'asc' }
        });
        res.json({ total: slots.length, slots });
    }
    catch (error) {
        console.error('getListingSlots error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};
exports.getListingSlots = getListingSlots;
// PUT /api/v1/interviews/:id/book
const bookSlot = async (req, res) => {
    try {
        const student = await prisma_1.default.student.findUnique({
            where: { userId: req.user.userId }
        });
        if (!student) {
            res.status(404).json({ error: 'Student profile not found' });
            return;
        }
        const slot = await prisma_1.default.interviewSlot.findUnique({
            where: { id: req.params.id }
        });
        if (!slot) {
            res.status(404).json({ error: 'Interview slot not found' });
            return;
        }
        if (slot.bookedById) {
            res.status(400).json({ error: 'This slot is already booked' });
            return;
        }
        const application = await prisma_1.default.application.findUnique({
            where: {
                studentId_listingId: {
                    studentId: student.id,
                    listingId: slot.listingId
                }
            }
        });
        if (!application) {
            res.status(400).json({ error: 'You must apply for this listing before booking an interview slot' });
            return;
        }
        const updated = await prisma_1.default.interviewSlot.update({
            where: { id: req.params.id },
            data: {
                bookedById: student.id,
                confirmed: true
            }
        });
        await prisma_1.default.notification.create({
            data: {
                userId: req.user.userId,
                type: 'interview_booked',
                message: `Your interview slot has been booked for ${new Date(slot.datetime).toLocaleString()}`
            }
        });
        res.json({ message: 'Interview slot booked successfully', slot: updated });
    }
    catch (error) {
        console.error('bookSlot error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};
exports.bookSlot = bookSlot;
// GET /api/v1/interviews/my
const getMySlots = async (req, res) => {
    try {
        const student = await prisma_1.default.student.findUnique({
            where: { userId: req.user.userId }
        });
        if (!student) {
            res.status(404).json({ error: 'Student profile not found' });
            return;
        }
        const slots = await prisma_1.default.interviewSlot.findMany({
            where: { bookedById: student.id },
            include: {
                listing: {
                    select: {
                        title: true,
                        employer: {
                            select: { companyName: true }
                        }
                    }
                }
            },
            orderBy: { datetime: 'asc' }
        });
        res.json({ total: slots.length, slots });
    }
    catch (error) {
        console.error('getMySlots error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};
exports.getMySlots = getMySlots;
