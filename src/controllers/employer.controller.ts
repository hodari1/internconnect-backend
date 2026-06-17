import '../env';
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import prisma from '../services/prisma';
import cloudinary from '../services/cloudinary';
import { Readable } from 'stream';

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