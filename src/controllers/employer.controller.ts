import '../env';
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import prisma from '../services/prisma';
import cloudinary from '../services/cloudinary';
import { Readable } from 'stream';
import Groq from 'groq-sdk';

const groq = new Groq();

// GET /api/v1/employers/profile
export const getProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const employer = await prisma.employer.findUnique({
      where: { userId: req.user!.userId },
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
  } catch (error) {
    console.error('getProfile error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// PUT /api/v1/employers/profile
export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { companyName, industry, website, description } = req.body;

    const updated = await prisma.employer.update({
      where: { userId: req.user!.userId },
      data: {
        ...(companyName !== undefined && { companyName }),
        ...(industry !== undefined && { industry }),
        ...(website !== undefined && { website }),
        ...(description !== undefined && { description }),
      }
    });

    res.json({ message: 'Profile updated', employer: updated });
  } catch (error) {
    console.error('updateProfile error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// POST /api/v1/employers/upload-logo
export const uploadLogo = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const logoUrl = await new Promise<string>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: 'internconnect/logos', resource_type: 'image' },
        (error, result) => {
          if (error || !result) return reject(error);
          resolve(result.secure_url);
        }
      );
      Readable.from(req.file!.buffer).pipe(uploadStream);
    });

    const updated = await prisma.employer.update({
      where: { userId: req.user!.userId },
      data: { logoUrl }
    });

    res.json({ message: 'Logo uploaded successfully', logoUrl, employer: updated });
  } catch (error) {
    console.error('uploadLogo error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
// GET /api/v1/employers/listings/:id/matches
export const getListingMatches = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // 1. Get employer and verify listing ownership
    const employer = await prisma.employer.findUnique({
      where: { userId: req.user!.userId }
    });

    if (!employer) {
      res.status(404).json({ error: 'Employer profile not found' });
      return;
    }

    const listing = await prisma.listing.findUnique({
      where: { id: req.params.id as string }
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
    const applications = await prisma.application.findMany({
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

      } catch (err) {
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

  } catch (error) {
    console.error('getListingMatches error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};