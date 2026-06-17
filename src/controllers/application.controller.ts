import '../env';
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import prisma from '../services/prisma';
import { Groq } from 'groq-sdk/index.js';

// POST /api/v1/applications
export const applyForListing = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { listingId, coverLetterUrl } = req.body;

    if (!listingId) {
      res.status(400).json({ error: 'listingId is required' });
      return;
    }

    // Get student profile
    const student = await prisma.student.findUnique({
      where: { userId: req.user!.userId }
    });

    if (!student) {
      res.status(404).json({ error: 'Student profile not found' });
      return;
    }

    // Check listing exists and is open
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

    // Check if already applied
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

    // Make sure this listing belongs to this employer
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

    res.json({ total: applications.length, applications });
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

    // Get application and verify ownership
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

// Auto-notify the student
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

    // Make sure this application belongs to this student
    if (application.studentId !== student.id) {
      res.status(403).json({ error: 'You can only withdraw your own applications' });
      return;
    }

    // Can't withdraw if already accepted
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

