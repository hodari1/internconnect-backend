import '../env';
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import prisma from '../services/prisma';
import { checkAndNotifyStudents } from '../services/jobAlerts';
import Groq from 'groq-sdk';

// Helper: compute display status (does NOT touch the DB status column)
const withDisplayStatus = (listing: any) => {
  const isExpired =
    listing.deadline &&
    new Date(listing.deadline) < new Date() &&
    listing.status === 'open';

  return {
    ...listing,
    displayStatus: isExpired ? 'expired' : listing.status,
  };
};

// POST /api/v1/listings
export const createListing = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, description, skills, location, duration, stipend, deadline, openings } = req.body;

    if (!title || !description) {
      res.status(400).json({ error: 'Title and description are required' });
      return;
    }

    const employer = await prisma.employer.findUnique({
      where: { userId: req.user!.userId }
    });

    if (!employer) {
      res.status(404).json({ error: 'Employer profile not found' });
      return;
    }

    const listing = await prisma.listing.create({
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
    checkAndNotifyStudents(listing.id).catch(console.error);

    res.status(201).json({ message: 'Listing created', listing: withDisplayStatus(listing) });
  } catch (error) {
    console.error('createListing error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// GET /api/v1/listings
// Public route (optionalAuth): req.user may be undefined for guests.
export const getListings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { search, location, skills, stipend, industry } = req.query;
    const role = req.user?.role; // may be undefined for guests (public browsing)

    // If employer, return only their own listings (with displayStatus, including 'expired')
    if (role === 'employer') {
      const employer = await prisma.employer.findUnique({
        where: { userId: req.user!.userId }
      });

      if (!employer) {
        res.status(404).json({ error: 'Employer profile not found' });
        return;
      }

      const listings = await prisma.listing.findMany({
        where: { employerId: employer.id },
        orderBy: { createdAt: 'desc' }
      });

      const listingsWithStatus = listings.map(withDisplayStatus);

      res.json({ total: listingsWithStatus.length, listings: listingsWithStatus });
      return;
    }

    // Guests and students see only open, non-expired listings
    const listings = await prisma.listing.findMany({
      where: {
        status: 'open',
        AND: [
          { OR: [{ deadline: null }, { deadline: { gte: new Date() } }] }
        ],
        ...(search && { OR: [
          { title: { contains: search as string, mode: 'insensitive' } },
          { description: { contains: search as string, mode: 'insensitive' } },
        ]}),
        ...(location && { location: { contains: location as string, mode: 'insensitive' } }),
        ...(skills && { skills: { contains: skills as string, mode: 'insensitive' } }),
        ...(industry && { employer: { industry: { contains: industry as string, mode: 'insensitive' } } }),
        ...(stipend && { stipend: { contains: stipend as string, mode: 'insensitive' } }),
      },
      include: {
        employer: {
          select: { companyName: true, industry: true, logoUrl: true, verified: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ total: listings.length, listings });
  } catch (error) {
    console.error('getListings error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// GET /api/v1/listings/:id
// Public route (optionalAuth): req.user may be undefined for guests.
export const getListingById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const listing = await prisma.listing.findUnique({
      where: { id: req.params.id as string },
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

    const isEmployer = req.user?.role === 'employer';
    const isExpired = listing.deadline ? new Date(listing.deadline) < new Date() : false;

    // Guests, students, and anyone who isn't the owning employer can't view closed or expired listings
    if (!isEmployer && (listing.status !== 'open' || isExpired)) {
      res.status(404).json({ error: 'Listing not found' });
      return;
    }

    res.json({ listing: withDisplayStatus(listing) });
  } catch (error) {
    console.error('getListingById error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// PUT /api/v1/listings/:id
export const updateListing = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, description, skills, location, duration, stipend, deadline, openings, status } = req.body;

    const employer = await prisma.employer.findUnique({
      where: { userId: req.user!.userId }
    });

    if (!employer) {
      res.status(404).json({ error: 'Employer profile not found' });
      return;
    }

    const existing = await prisma.listing.findUnique({
      where: { id: req.params.id as string }
    });

    if (!existing) {
      res.status(404).json({ error: 'Listing not found' });
      return;
    }

    if (existing.employerId !== employer.id) {
      res.status(403).json({ error: 'You can only edit your own listings' });
      return;
    }

    const updated = await prisma.listing.update({
      where: { id: req.params.id as string },
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
  } catch (error) {
    console.error('updateListing error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// DELETE /api/v1/listings/:id
export const deleteListing = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const employer = await prisma.employer.findUnique({
      where: { userId: req.user!.userId }
    });

    if (!employer) {
      res.status(404).json({ error: 'Employer profile not found' });
      return;
    }

    const existing = await prisma.listing.findUnique({
      where: { id: req.params.id as string }
    });

    if (!existing) {
      res.status(404).json({ error: 'Listing not found' });
      return;
    }

    if (existing.employerId !== employer.id) {
      res.status(403).json({ error: 'You can only delete your own listings' });
      return;
    }

    await prisma.listing.delete({
      where: { id: req.params.id as string }
    });

    res.json({ message: 'Listing deleted successfully' });
  } catch (error) {
    console.error('deleteListing error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// GET /api/v1/listings/:id/skills-gap
export const getSkillsGap = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // 1. Get student skills
    const student = await prisma.student.findUnique({
      where: { userId: req.user!.userId }
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
    const listing = await prisma.listing.findUnique({
      where: { id: req.params.id as string },
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
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

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

  } catch (error) {
    console.error('getSkillsGap error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// GET /api/v1/listings/my
export const getMyListings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const employer = await prisma.employer.findUnique({
      where: { userId: req.user!.userId }
    });

    if (!employer) {
      res.status(404).json({ error: 'Employer profile not found' });
      return;
    }

    const listings = await prisma.listing.findMany({
      where: { employerId: employer.id },
      orderBy: { createdAt: 'desc' }
    });

    const listingsWithStatus = listings.map(withDisplayStatus);

    res.json({ total: listingsWithStatus.length, listings: listingsWithStatus });
  } catch (error) {
    console.error('getMyListings error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};