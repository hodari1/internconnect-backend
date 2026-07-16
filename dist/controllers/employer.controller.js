"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getListingMatches = exports.uploadLogo = exports.updateProfile = exports.getProfile = void 0;
require("../env");
const prisma_1 = __importDefault(require("../services/prisma"));
const cloudinary_1 = __importDefault(require("../services/cloudinary"));
const stream_1 = require("stream");
const groq_sdk_1 = __importDefault(require("groq-sdk"));
const groq = new groq_sdk_1.default();
// GET /api/v1/employers/profile
const getProfile = async (req, res) => {
    try {
        const employer = await prisma_1.default.employer.findUnique({
            where: { userId: req.user.userId },
            include: {
                user: {
                    select: { id: true, name: true, email: true, createdAt: true }
                }
            }
        });
        if (!employer) {
            res.status(404).json({ error: 'Employer profile not found' });
            return;
        }
        res.json({ employer });
    }
    catch (error) {
        console.error('getProfile error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};
exports.getProfile = getProfile;
// PUT /api/v1/employers/profile
const updateProfile = async (req, res) => {
    try {
        const { companyName, industry, website, description } = req.body;
        const updated = await prisma_1.default.employer.update({
            where: { userId: req.user.userId },
            data: {
                ...(companyName !== undefined && { companyName }),
                ...(industry !== undefined && { industry }),
                ...(website !== undefined && { website }),
                ...(description !== undefined && { description }),
            }
        });
        res.json({ message: 'Profile updated', employer: updated });
    }
    catch (error) {
        console.error('updateProfile error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};
exports.updateProfile = updateProfile;
// POST /api/v1/employers/upload-logo
const uploadLogo = async (req, res) => {
    try {
        if (!req.file) {
            res.status(400).json({ error: 'No file uploaded' });
            return;
        }
        const logoUrl = await new Promise((resolve, reject) => {
            const uploadStream = cloudinary_1.default.uploader.upload_stream({ folder: 'internconnect/logos', resource_type: 'image' }, (error, result) => {
                if (error || !result)
                    return reject(error);
                resolve(result.secure_url);
            });
            stream_1.Readable.from(req.file.buffer).pipe(uploadStream);
        });
        const updated = await prisma_1.default.employer.update({
            where: { userId: req.user.userId },
            data: { logoUrl }
        });
        res.json({ message: 'Logo uploaded successfully', logoUrl, employer: updated });
    }
    catch (error) {
        console.error('uploadLogo error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};
exports.uploadLogo = uploadLogo;
// GET /api/v1/employers/listings/:id/matches
const getListingMatches = async (req, res) => {
    try {
        // 1. Get employer and verify listing ownership
        const employer = await prisma_1.default.employer.findUnique({
            where: { userId: req.user.userId }
        });
        if (!employer) {
            res.status(404).json({ error: 'Employer profile not found' });
            return;
        }
        const listing = await prisma_1.default.listing.findUnique({
            where: { id: req.params.id }
        });
        if (!listing) {
            res.status(404).json({ error: 'Listing not found' });
            return;
        }
        if (listing.employerId !== employer.id) {
            res.status(403).json({ error: 'Access denied' });
            return;
        }
        // 2. Get all applicants for this listing
        const applications = await prisma_1.default.application.findMany({
            where: { listingId: listing.id },
            include: {
                student: {
                    include: {
                        user: { select: { name: true, email: true } }
                    }
                }
            }
        });
        if (applications.length === 0) {
            res.json({
                listing: { id: listing.id, title: listing.title },
                totalApplicants: 0,
                matches: []
            });
            return;
        }
        // 3. Score each applicant using Groq
        const matches = [];
        for (const app of applications) {
            if (!app.student.skills) {
                matches.push({
                    applicationId: app.id,
                    studentName: app.student.user.name,
                    studentEmail: app.student.user.email,
                    status: app.status,
                    matchScore: 0,
                    matchReason: 'No skills extracted yet — student needs to upload CV',
                    skills: null,
                    cvUrl: app.student.cvUrl,
                });
                continue;
            }
            try {
                const aiResponse = await groq.chat.completions.create({
                    model: 'llama-3.3-70b-versatile',
                    messages: [
                        {
                            role: 'system',
                            content: 'You are an internship matching assistant. Respond with valid JSON only.'
                        },
                        {
                            role: 'user',
                            content: `
Job title: ${listing.title}
Required skills: ${listing.skills || 'Not specified'}
Job description: ${listing.description}

Applicant skills: ${app.student.skills}

Return ONLY this JSON:
{ "score": <number 0-100>, "reason": "<one sentence explanation>" }
              `
                        }
                    ],
                    max_tokens: 150,
                });
                const raw = aiResponse.choices[0]?.message?.content?.trim() || '{}';
                const cleaned = raw.replace(/```json|```/g, '').trim();
                const result = JSON.parse(cleaned);
                matches.push({
                    applicationId: app.id,
                    studentName: app.student.user.name,
                    studentEmail: app.student.user.email,
                    status: app.status,
                    matchScore: result.score || 0,
                    matchReason: result.reason || '',
                    skills: app.student.skills,
                    university: app.student.university,
                    cvUrl: app.student.cvUrl,
                });
            }
            catch (err) {
                console.warn(`AI scoring failed for ${app.student.user.name}:`, err);
                matches.push({
                    applicationId: app.id,
                    studentName: app.student.user.name,
                    studentEmail: app.student.user.email,
                    status: app.status,
                    matchScore: 0,
                    matchReason: 'AI scoring unavailable',
                    skills: app.student.skills,
                    university: app.student.university,
                    cvUrl: app.student.cvUrl,
                });
            }
        }
        // 4. Sort by match score highest first
        matches.sort((a, b) => b.matchScore - a.matchScore);
        res.json({
            listing: {
                id: listing.id,
                title: listing.title,
                requiredSkills: listing.skills,
            },
            totalApplicants: matches.length,
            topMatch: matches[0] || null,
            matches,
        });
    }
    catch (error) {
        console.error('getListingMatches error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};
exports.getListingMatches = getListingMatches;
