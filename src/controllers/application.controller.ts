import '../env';
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import prisma from '../services/prisma';
import cloudinary from '../services/cloudinary';
import { Readable } from 'stream';
import { Groq } from 'groq-sdk/index.js';

const groq = new Groq();

// POST /api/v1/applications
export const applyForListing = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    let { listingId, coverLetterUrl } = req.body as { listingId?: string; coverLetterUrl?: string };

    if (req.file) {
      const file = req.file;
      coverLetterUrl = await new Promise<string>((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          { folder: 'internconnect/cover-letters', resource_type: 'raw', format: 'pdf' },
          (error, result) => {
            if (error || !result) return reject(error);
            resolve(result.secure_url);
          }
        );
        Readable.from(file.buffer).pipe(uploadStream);
      });
    }

    if (!listingId) {
      res.status(400).json({ error: 'listingId is required' });
      return;
    }

    const student = await prisma.student.findUnique({
      where: { userId: req.user!.userId }
    });

    if (!student) {
      res.status(404).json({ error: 'Student profile not found' });
      return;
    }

    const listing = await prisma.listing.findUnique({
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

    const existing = await prisma.application.findUnique({
      where: { studentId_listingId: { studentId: student.id, listingId } }
    });

    if (existing) {
      res.status(400).json({ error: 'You have already applied for this listing' });
      return;
    }

    const application = await prisma.application.create({
      data: {
        studentId: student.id,
        listingId,
        coverLetterUrl: coverLetterUrl || null,
      }
    });

    res.status(201).json({ message: 'Application submitted successfully', application });
  } catch (error) {
    console.error('applyForListing error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// GET /api/v1/applications/my
export const getMyApplications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const student = await prisma.student.findUnique({
      where: { userId: req.user!.userId }
    });

    if (!student) {
      res.status(404).json({ error: 'Student profile not found' });
      return;
    }

    const applications = await prisma.application.findMany({
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
  } catch (error) {
    console.error('getMyApplications error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// GET /api/v1/applications/listing/:listingId
export const getListingApplications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const employer = await prisma.employer.findUnique({
      where: { userId: req.user!.userId }
    });

    if (!employer) {
      res.status(404).json({ error: 'Employer profile not found' });
      return;
    }

    const listing = await prisma.listing.findUnique({
      where: { id: req.params.listingId as string }
    });

    if (!listing) {
      res.status(404).json({ error: 'Listing not found' });
      return;
    }

    if (listing.employerId !== employer.id) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const applications = await prisma.application.findMany({
      where: { listingId: req.params.listingId as string },
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
  } catch (error) {
    console.error('getListingApplications error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// PUT /api/v1/applications/:id/status
export const updateApplicationStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status } = req.body;

    const validStatuses = ['applied', 'reviewed', 'shortlisted', 'accepted', 'rejected'];
    if (!status || !validStatuses.includes(status)) {
      res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}` });
      return;
    }

    const employer = await prisma.employer.findUnique({
      where: { userId: req.user!.userId }
    });

    if (!employer) {
      res.status(404).json({ error: 'Employer profile not found' });
      return;
    }

    const application = await prisma.application.findUnique({
      where: { id: req.params.id as string },
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

    const updated = await prisma.application.update({
      where: { id: req.params.id as string },
      data: { status }
    });

    const statusMessages: Record<string, string> = {
      reviewed: 'Your application has been reviewed by the employer.',
      shortlisted: 'Congratulations! You have been shortlisted for an internship.',
      accepted: 'Congratulations! Your internship application has been accepted!',
      rejected: 'Your application was not successful this time. Keep applying!',
    };

    const message = statusMessages[status];
    if (message) {
      await prisma.notification.create({
        data: {
          userId: application.student.user.id,
          type: 'application_status',
          message: `${application.listing.title}: ${message}`,
        }
      });
    }

    res.json({ message: 'Application status updated', application: updated });
  } catch (error) {
    console.error('updateApplicationStatus error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// DELETE /api/v1/applications/:id
export const withdrawApplication = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const student = await prisma.student.findUnique({
      where: { userId: req.user!.userId }
    });

    if (!student) {
      res.status(404).json({ error: 'Student profile not found' });
      return;
    }

    const application = await prisma.application.findUnique({
      where: { id: req.params.id as string }
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

    await prisma.application.delete({
      where: { id: req.params.id as string }
    });

    res.json({ message: 'Application withdrawn successfully' });
  } catch (error) {
    console.error('withdrawApplication error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// POST /api/v1/applications/:id/analyze
export const analyzeApplicant = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const employer = await prisma.employer.findUnique({
      where: { userId: req.user!.userId }
    });

    if (!employer) {
      res.status(404).json({ error: 'Employer profile not found' });
      return;
    }

    const application = await prisma.application.findUnique({
      where: { id: req.params.id as string },
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

  } catch (error) {
    console.error('analyzeApplicant error:', error);
    res.status(500).json({ error: 'AI analysis failed' });
  }
};