"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeApplicant = exports.withdrawApplication = exports.updateApplicationStatus = exports.getListingApplications = exports.getMyApplications = exports.applyForListing = void 0;
require("../env");
const prisma_1 = __importDefault(require("../services/prisma"));
const cloudinary_1 = __importDefault(require("../services/cloudinary"));
const stream_1 = require("stream");
const index_js_1 = require("groq-sdk/index.js");
const groq = new index_js_1.Groq();
// POST /api/v1/applications
const applyForListing = async (req, res) => {
    try {
        let { listingId, coverLetterUrl } = req.body;
        if (req.file) {
            const file = req.file;
            coverLetterUrl = await new Promise((resolve, reject) => {
                const uploadStream = cloudinary_1.default.uploader.upload_stream({ folder: 'internconnect/cover-letters', resource_type: 'raw', format: 'pdf' }, (error, result) => {
                    if (error || !result)
                        return reject(error);
                    resolve(result.secure_url);
                });
                stream_1.Readable.from(file.buffer).pipe(uploadStream);
            });
        }
        if (!listingId) {
            res.status(400).json({ error: 'listingId is required' });
            return;
        }
        const student = await prisma_1.default.student.findUnique({
            where: { userId: req.user.userId }
        });
        if (!student) {
            res.status(404).json({ error: 'Student profile not found' });
            return;
        }
        const listing = await prisma_1.default.listing.findUnique({
            where: { id: listingId }
        });
        if (!listing) {
            res.status(404).json({ error: 'Listing not found' });
            return;
        }
        if (listing.status !== 'open') {
            res.status(400).json({ error: 'This listing is no longer accepting applications' });
            return;
        }
        const existing = await prisma_1.default.application.findUnique({
            where: { studentId_listingId: { studentId: student.id, listingId } }
        });
        if (existing) {
            res.status(400).json({ error: 'You have already applied for this listing' });
            return;
        }
        const application = await prisma_1.default.application.create({
            data: {
                studentId: student.id,
                listingId,
                coverLetterUrl: coverLetterUrl || null,
            }
        });
        res.status(201).json({ message: 'Application submitted successfully', application });
    }
    catch (error) {
        console.error('applyForListing error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};
exports.applyForListing = applyForListing;
// GET /api/v1/applications/my
const getMyApplications = async (req, res) => {
    try {
        const student = await prisma_1.default.student.findUnique({
            where: { userId: req.user.userId }
        });
        if (!student) {
            res.status(404).json({ error: 'Student profile not found' });
            return;
        }
        const applications = await prisma_1.default.application.findMany({
            where: { studentId: student.id },
            include: {
                listing: {
                    select: {
                        title: true,
                        location: true,
                        duration: true,
                        stipend: true,
                        deadline: true,
                        status: true,
                        employer: {
                            select: { companyName: true, logoUrl: true }
                        }
                    }
                }
            },
            orderBy: { appliedAt: 'desc' }
        });
        res.json({ applications });
    }
    catch (error) {
        console.error('getMyApplications error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};
exports.getMyApplications = getMyApplications;
// GET /api/v1/applications/listing/:listingId
const getListingApplications = async (req, res) => {
    try {
        const employer = await prisma_1.default.employer.findUnique({
            where: { userId: req.user.userId }
        });
        if (!employer) {
            res.status(404).json({ error: 'Employer profile not found' });
            return;
        }
        const listing = await prisma_1.default.listing.findUnique({
            where: { id: req.params.listingId }
        });
        if (!listing) {
            res.status(404).json({ error: 'Listing not found' });
            return;
        }
        if (listing.employerId !== employer.id) {
            res.status(403).json({ error: 'Access denied' });
            return;
        }
        const applications = await prisma_1.default.application.findMany({
            where: { listingId: req.params.listingId },
            include: {
                student: {
                    select: {
                        university: true,
                        faculty: true,
                        department: true,
                        year: true,
                        gpa: true,
                        bio: true,
                        skills: true,
                        cvUrl: true,
                        photoUrl: true,
                        user: {
                            select: { name: true, email: true }
                        }
                    }
                }
            },
            orderBy: { appliedAt: 'desc' }
        });
        const result = applications.map((app) => ({
            id: app.id,
            status: app.status,
            appliedAt: app.appliedAt,
            coverLetterUrl: app.coverLetterUrl,
            student: app.student,
        }));
        res.json({ total: result.length, applications: result });
    }
    catch (error) {
        console.error('getListingApplications error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};
exports.getListingApplications = getListingApplications;
// PUT /api/v1/applications/:id/status
const updateApplicationStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const validStatuses = ['applied', 'reviewed', 'shortlisted', 'accepted', 'rejected'];
        if (!status || !validStatuses.includes(status)) {
            res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}` });
            return;
        }
        const employer = await prisma_1.default.employer.findUnique({
            where: { userId: req.user.userId }
        });
        if (!employer) {
            res.status(404).json({ error: 'Employer profile not found' });
            return;
        }
        const application = await prisma_1.default.application.findUnique({
            where: { id: req.params.id },
            include: {
                listing: true,
                student: {
                    include: {
                        user: { select: { id: true } }
                    }
                }
            }
        });
        if (!application) {
            res.status(404).json({ error: 'Application not found' });
            return;
        }
        if (application.listing.employerId !== employer.id) {
            res.status(403).json({ error: 'Access denied' });
            return;
        }
        const updated = await prisma_1.default.application.update({
            where: { id: req.params.id },
            data: { status }
        });
        const statusMessages = {
            reviewed: 'Your application has been reviewed by the employer.',
            shortlisted: 'Congratulations! You have been shortlisted for an internship.',
            accepted: 'Congratulations! Your internship application has been accepted!',
            rejected: 'Your application was not successful this time. Keep applying!',
        };
        const message = statusMessages[status];
        if (message) {
            await prisma_1.default.notification.create({
                data: {
                    userId: application.student.user.id,
                    type: 'application_status',
                    message: `${application.listing.title}: ${message}`,
                }
            });
        }
        res.json({ message: 'Application status updated', application: updated });
    }
    catch (error) {
        console.error('updateApplicationStatus error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};
exports.updateApplicationStatus = updateApplicationStatus;
// DELETE /api/v1/applications/:id
const withdrawApplication = async (req, res) => {
    try {
        const student = await prisma_1.default.student.findUnique({
            where: { userId: req.user.userId }
        });
        if (!student) {
            res.status(404).json({ error: 'Student profile not found' });
            return;
        }
        const application = await prisma_1.default.application.findUnique({
            where: { id: req.params.id }
        });
        if (!application) {
            res.status(404).json({ error: 'Application not found' });
            return;
        }
        if (application.studentId !== student.id) {
            res.status(403).json({ error: 'You can only withdraw your own applications' });
            return;
        }
        if (application.status === 'accepted') {
            res.status(400).json({ error: 'You cannot withdraw an accepted application' });
            return;
        }
        await prisma_1.default.application.delete({
            where: { id: req.params.id }
        });
        res.json({ message: 'Application withdrawn successfully' });
    }
    catch (error) {
        console.error('withdrawApplication error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};
exports.withdrawApplication = withdrawApplication;
// POST /api/v1/applications/:id/analyze
const analyzeApplicant = async (req, res) => {
    try {
        const employer = await prisma_1.default.employer.findUnique({
            where: { userId: req.user.userId }
        });
        if (!employer) {
            res.status(404).json({ error: 'Employer profile not found' });
            return;
        }
        const application = await prisma_1.default.application.findUnique({
            where: { id: req.params.id },
            include: {
                listing: true,
                student: {
                    include: {
                        user: { select: { name: true, email: true } }
                    }
                }
            }
        });
        if (!application) {
            res.status(404).json({ error: 'Application not found' });
            return;
        }
        if (application.listing.employerId !== employer.id) {
            res.status(403).json({ error: 'Access denied' });
            return;
        }
        const { student, listing } = application;
        const prompt = `
You are an expert hiring assistant for internship positions. Analyze this applicant and provide a detailed hiring recommendation.

JOB DETAILS:
- Title: ${listing.title}
- Description: ${listing.description}
- Required Skills: ${listing.skills || 'Not specified'}
- Location: ${listing.location || 'Not specified'}
- Duration: ${listing.duration || 'Not specified'}

APPLICANT PROFILE:
- Name: ${student.user.name}
- University: ${student.university || 'Not provided'}
- Faculty: ${student.faculty || 'Not provided'}
- Department: ${student.department || 'Not provided'}
- Year of Study: ${student.year ? `Year ${student.year}` : 'Not provided'}
- GPA: ${student.gpa || 'Not provided'}
- Skills: ${student.skills || 'Not provided'}
- Bio: ${student.bio || 'Not provided'}
- CV Available: ${student.cvUrl ? 'Yes' : 'No'}
- Cover Letter Available: ${application.coverLetterUrl ? 'Yes' : 'No'}

Return ONLY this JSON with no extra text:
{
  "score": <number 0-100>,
  "decision": "<Hire | Maybe | Pass>",
  "summary": "<2-3 sentence overall summary of the candidate>",
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "gaps": ["<gap 1>", "<gap 2>"],
  "recommendation": "<1-2 sentence final hiring recommendation>"
}
    `;
        const aiResponse = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: [
                { role: 'system', content: 'You are an expert hiring assistant. Respond with valid JSON only, no markdown, no extra text.' },
                { role: 'user', content: prompt }
            ],
            max_tokens: 500,
        });
        const raw = aiResponse.choices[0]?.message?.content?.trim() || '{}';
        const cleaned = raw.replace(/```json|```/g, '').trim();
        const result = JSON.parse(cleaned);
        res.json({
            applicationId: application.id,
            studentName: student.user.name,
            listingTitle: listing.title,
            score: result.score || 0,
            decision: result.decision || 'Maybe',
            summary: result.summary || '',
            strengths: result.strengths || [],
            gaps: result.gaps || [],
            recommendation: result.recommendation || '',
        });
    }
    catch (error) {
        console.error('analyzeApplicant error:', error);
        res.status(500).json({ error: 'AI analysis failed' });
    }
};
exports.analyzeApplicant = analyzeApplicant;
