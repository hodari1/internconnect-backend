"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMyListings = exports.getSkillsGap = exports.deleteListing = exports.updateListing = exports.getListingById = exports.getListings = exports.createListing = void 0;
require("../env");
const prisma_1 = __importDefault(require("../services/prisma"));
const jobAlerts_1 = require("../services/jobAlerts");
const groq_sdk_1 = __importDefault(require("groq-sdk"));
// Helper: compute display status (does NOT touch the DB status column)
const withDisplayStatus = (listing) => {
    const isExpired = listing.deadline &&
        new Date(listing.deadline) < new Date() &&
        listing.status === 'open';
    return {
        ...listing,
        displayStatus: isExpired ? 'expired' : listing.status,
    };
};
// POST /api/v1/listings
const createListing = async (req, res) => {
    try {
        const { title, description, skills, location, duration, stipend, deadline, openings } = req.body;
        if (!title || !description) {
            res.status(400).json({ error: 'Title and description are required' });
            return;
        }
        const employer = await prisma_1.default.employer.findUnique({
            where: { userId: req.user.userId }
        });
        if (!employer) {
            res.status(404).json({ error: 'Employer profile not found' });
            return;
        }
        const listing = await prisma_1.default.listing.create({
            data: {
                employerId: employer.id,
                title,
                description,
                skills: skills || null,
                location: location || null,
                duration: duration || null,
                stipend: stipend || null,
                deadline: deadline ? new Date(deadline) : null,
                openings: openings ? Number(openings) : 1,
            }
        });
        // Trigger job alerts in background
        (0, jobAlerts_1.checkAndNotifyStudents)(listing.id).catch(console.error);
        res.status(201).json({ message: 'Listing created', listing: withDisplayStatus(listing) });
    }
    catch (error) {
        console.error('createListing error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};
exports.createListing = createListing;
// GET /api/v1/listings
const getListings = async (req, res) => {
    try {
        const { search, location, skills, stipend, industry } = req.query;
        const role = req.user.role;
        // If employer, return only their own listings (with displayStatus, including 'expired')
        if (role === 'employer') {
            const employer = await prisma_1.default.employer.findUnique({
                where: { userId: req.user.userId }
            });
            if (!employer) {
                res.status(404).json({ error: 'Employer profile not found' });
                return;
            }
            const listings = await prisma_1.default.listing.findMany({
                where: { employerId: employer.id },
                orderBy: { createdAt: 'desc' }
            });
            const listingsWithStatus = listings.map(withDisplayStatus);
            res.json({ total: listingsWithStatus.length, listings: listingsWithStatus });
            return;
        }
        // Students see only open, non-expired listings
        const listings = await prisma_1.default.listing.findMany({
            where: {
                status: 'open',
                AND: [
                    { OR: [{ deadline: null }, { deadline: { gte: new Date() } }] }
                ],
                ...(search && { OR: [
                        { title: { contains: search, mode: 'insensitive' } },
                        { description: { contains: search, mode: 'insensitive' } },
                    ] }),
                ...(location && { location: { contains: location, mode: 'insensitive' } }),
                ...(skills && { skills: { contains: skills, mode: 'insensitive' } }),
                ...(industry && { employer: { industry: { contains: industry, mode: 'insensitive' } } }),
                ...(stipend && { stipend: { contains: stipend, mode: 'insensitive' } }),
            },
            include: {
                employer: {
                    select: { companyName: true, industry: true, logoUrl: true, verified: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json({ total: listings.length, listings });
    }
    catch (error) {
        console.error('getListings error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};
exports.getListings = getListings;
// GET /api/v1/listings/:id
const getListingById = async (req, res) => {
    try {
        const listing = await prisma_1.default.listing.findUnique({
            where: { id: req.params.id },
            include: {
                employer: {
                    select: { companyName: true, industry: true, website: true, logoUrl: true, verified: true, description: true }
                }
            }
        });
        if (!listing) {
            res.status(404).json({ error: 'Listing not found' });
            return;
        }
        const isEmployer = req.user.role === 'employer';
        const isExpired = listing.deadline ? new Date(listing.deadline) < new Date() : false;
        // Students (and anyone who isn't the owning employer) can't view closed or expired listings
        if (!isEmployer && (listing.status !== 'open' || isExpired)) {
            res.status(404).json({ error: 'Listing not found' });
            return;
        }
        res.json({ listing: withDisplayStatus(listing) });
    }
    catch (error) {
        console.error('getListingById error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};
exports.getListingById = getListingById;
// PUT /api/v1/listings/:id
const updateListing = async (req, res) => {
    try {
        const { title, description, skills, location, duration, stipend, deadline, openings, status } = req.body;
        const employer = await prisma_1.default.employer.findUnique({
            where: { userId: req.user.userId }
        });
        if (!employer) {
            res.status(404).json({ error: 'Employer profile not found' });
            return;
        }
        const existing = await prisma_1.default.listing.findUnique({
            where: { id: req.params.id }
        });
        if (!existing) {
            res.status(404).json({ error: 'Listing not found' });
            return;
        }
        if (existing.employerId !== employer.id) {
            res.status(403).json({ error: 'You can only edit your own listings' });
            return;
        }
        const updated = await prisma_1.default.listing.update({
            where: { id: req.params.id },
            data: {
                ...(title !== undefined && { title }),
                ...(description !== undefined && { description }),
                ...(skills !== undefined && { skills }),
                ...(location !== undefined && { location }),
                ...(duration !== undefined && { duration }),
                ...(stipend !== undefined && { stipend }),
                ...(deadline !== undefined && { deadline: new Date(deadline) }),
                ...(openings !== undefined && { openings: Number(openings) }),
                ...(status !== undefined && { status }),
            }
        });
        res.json({ message: 'Listing updated', listing: withDisplayStatus(updated) });
    }
    catch (error) {
        console.error('updateListing error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};
exports.updateListing = updateListing;
// DELETE /api/v1/listings/:id
const deleteListing = async (req, res) => {
    try {
        const employer = await prisma_1.default.employer.findUnique({
            where: { userId: req.user.userId }
        });
        if (!employer) {
            res.status(404).json({ error: 'Employer profile not found' });
            return;
        }
        const existing = await prisma_1.default.listing.findUnique({
            where: { id: req.params.id }
        });
        if (!existing) {
            res.status(404).json({ error: 'Listing not found' });
            return;
        }
        if (existing.employerId !== employer.id) {
            res.status(403).json({ error: 'You can only delete your own listings' });
            return;
        }
        await prisma_1.default.listing.delete({
            where: { id: req.params.id }
        });
        res.json({ message: 'Listing deleted successfully' });
    }
    catch (error) {
        console.error('deleteListing error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};
exports.deleteListing = deleteListing;
// GET /api/v1/listings/:id/skills-gap
const getSkillsGap = async (req, res) => {
    try {
        // 1. Get student skills
        const student = await prisma_1.default.student.findUnique({
            where: { userId: req.user.userId }
        });
        if (!student) {
            res.status(404).json({ error: 'Student profile not found' });
            return;
        }
        if (!student.skills) {
            res.status(400).json({ error: 'Please upload your CV first to extract your skills' });
            return;
        }
        // 2. Get listing
        const listing = await prisma_1.default.listing.findUnique({
            where: { id: req.params.id },
            include: {
                employer: { select: { companyName: true } }
            }
        });
        if (!listing) {
            res.status(404).json({ error: 'Listing not found' });
            return;
        }
        if (!listing.skills) {
            res.status(400).json({ error: 'This listing has no required skills specified' });
            return;
        }
        // 3. Send to Groq for analysis
        const groq = new groq_sdk_1.default({ apiKey: process.env.GROQ_API_KEY });
        const aiResponse = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: [
                {
                    role: 'system',
                    content: 'You are a career advisor. Analyze skill gaps and suggest learning resources. Always respond with valid JSON only. No markdown, no explanation outside the JSON.'
                },
                {
                    role: 'user',
                    content: `
Student current skills: ${student.skills}

Job required skills: ${listing.skills}

Analyze the gap and return ONLY this JSON format:
{
  "matchedSkills": ["skill1", "skill2"],
  "missingSkills": [
    {
      "skill": "skill name",
      "importance": "high/medium/low",
      "resource": "specific free resource to learn it (with URL if possible)"
    }
  ],
  "matchPercentage": 85,
  "summary": "One sentence summary of the student's readiness"
}
          `
                }
            ],
            max_tokens: 1024,
        });
        const raw = aiResponse.choices[0]?.message?.content?.trim() || '{}';
        const cleaned = raw.replace(/```json|```/g, '').trim();
        const analysis = JSON.parse(cleaned);
        res.json({
            listing: {
                id: listing.id,
                title: listing.title,
                company: listing.employer.companyName,
                requiredSkills: listing.skills
            },
            studentSkills: student.skills,
            gapAnalysis: analysis
        });
    }
    catch (error) {
        console.error('getSkillsGap error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};
exports.getSkillsGap = getSkillsGap;
// GET /api/v1/listings/my
const getMyListings = async (req, res) => {
    try {
        const employer = await prisma_1.default.employer.findUnique({
            where: { userId: req.user.userId }
        });
        if (!employer) {
            res.status(404).json({ error: 'Employer profile not found' });
            return;
        }
        const listings = await prisma_1.default.listing.findMany({
            where: { employerId: employer.id },
            orderBy: { createdAt: 'desc' }
        });
        const listingsWithStatus = listings.map(withDisplayStatus);
        res.json({ total: listingsWithStatus.length, listings: listingsWithStatus });
    }
    catch (error) {
        console.error('getMyListings error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};
exports.getMyListings = getMyListings;
