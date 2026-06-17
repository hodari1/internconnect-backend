import '../env';
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import prisma from '../services/prisma';
import cloudinary from '../services/cloudinary';
import { Readable } from 'stream';
import Groq from 'groq-sdk';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PDFParse } = require('pdf-parse');

// GET /api/v1/students/profile
export const getProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const student = await prisma.student.findUnique({
      where: { userId: req.user!.userId },
      include: {
        user: {
          select: { id: true, name: true, email: true, createdAt: true }
        }
      }
    });

    if (!student) {
      res.status(404).json({ error: 'Student profile not found' });
      return;
    }

    res.json({ student });
  } catch (error) {
    console.error('getProfile error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// PUT /api/v1/students/profile
export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { university, faculty, department, year, gpa, bio, skills } = req.body;

    const updated = await prisma.student.update({
      where: { userId: req.user!.userId },
      data: {
        ...(university !== undefined && { university }),
        ...(faculty !== undefined && { faculty }),
        ...(department !== undefined && { department }),
        ...(year !== undefined && { year: Number(year) }),
        ...(gpa !== undefined && { gpa: Number(gpa) }),
        ...(bio !== undefined && { bio }),
        ...(skills !== undefined && { skills }),
      }
    });

    res.json({ message: 'Profile updated', student: updated });
  } catch (error) {
    console.error('updateProfile error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// POST /api/v1/students/upload-cv
export const uploadCV = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    // 1. Upload PDF to Cloudinary
    const cvUrl = await new Promise<string>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: 'internconnect/cvs', resource_type: 'raw', format: 'pdf' },
        (error, result) => {
          if (error || !result) return reject(error);
          resolve(result.secure_url);
        }
      );
      Readable.from(req.file!.buffer).pipe(uploadStream);
    });

    // 2. Extract real text from PDF using PDFParse
    let extractedSkills = '';
    let extractionMethod = 'none';

    try {
      console.log('Reading PDF text...');
      const parser = new PDFParse({ data: req.file.buffer });
      const pdfData = await parser.getText();
      const cvText = pdfData.text;

      console.log('PDF text extracted, sending to Groq...');
      console.log('CV preview:', cvText.substring(0, 200));

      // 3. Send real CV text to Groq for skill extraction
      const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

      const aiResponse = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: 'You are a CV parser. Extract only the skills that are explicitly mentioned in the CV. Return a comma-separated list, nothing else. No explanation, no numbering, no bullet points.'
          },
          {
            role: 'user',
            content: `Extract all technical and professional skills from this CV:\n\n${cvText}`
          }
        ],
        max_tokens: 512,
      });

      const result = aiResponse.choices[0]?.message?.content?.trim() || '';

      if (result) {
        extractedSkills = result;
        extractionMethod = 'groq+pdf-parse';
        console.log('✓ Skills extracted successfully:', extractedSkills);
      } else {
        throw new Error('Groq returned empty response');
      }

    } catch (extractionError) {
      console.warn('Skill extraction failed:', extractionError);
      extractedSkills = '';
      extractionMethod = 'none';
    }

    // 4. Save cvUrl and skills to database
    const updated = await prisma.student.update({
      where: { userId: req.user!.userId },
      data: { cvUrl, skills: extractedSkills },
    });

    res.json({
      message: 'CV uploaded successfully',
      cvUrl,
      skills: extractedSkills,
      extractionMethod,
      student: updated,
    });

  } catch (error) {
    console.error('uploadCV error:', error);
    res.status(500).json({ error: 'Server error during CV upload' });
  }
};

// GET /api/v1/students/recommendations
export const getRecommendations = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // 1. Get student's skills
    const student = await prisma.student.findUnique({
      where: { userId: req.user!.userId }
    });

    if (!student) {
      res.status(404).json({ error: 'Student profile not found' });
      return;
    }

    if (!student.skills) {
      res.status(400).json({ error: 'Please upload your CV first so we can extract your skills' });
      return;
    }

    // 2. Get all open listings
    const listings = await prisma.listing.findMany({
      where: { status: 'open' },
      include: {
        employer: {
          select: { companyName: true, industry: true, logoUrl: true }
        }
      }
    });

    if (listings.length === 0) {
      res.json({ message: 'No open listings available', recommendations: [] });
      return;
    }

    // 3. Build the prompt for Groq
    const listingsSummary = listings.map((l, index) => 
      `${index + 1}. ID: ${l.id} | Title: ${l.title} | Company: ${l.employer.companyName} | Skills needed: ${l.skills || 'Not specified'} | Location: ${l.location || 'Not specified'}`
    ).join('\n');

    const prompt = `You are an internship matching assistant.

Student skills: ${student.skills}

Available internships:
${listingsSummary}

Rank these internships from best to worst match for this student based on their skills.
Return ONLY a valid JSON array, nothing else. No explanation outside the array.
Format:
[
  { "id": "listing_id_here", "score": 95, "reason": "One sentence explanation" },
  { "id": "listing_id_here", "score": 70, "reason": "One sentence explanation" }
]`;

    // 4. Send to Groq
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const aiResponse = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: 'You are an internship matching assistant. Always respond with valid JSON only. No markdown, no explanation outside the JSON array.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 1024,
    });

    const rawResult = aiResponse.choices[0]?.message?.content?.trim() || '[]';

    // 5. Parse Groq response
    let ranking: { id: string; score: number; reason: string }[] = [];
    try {
      // Strip markdown code blocks if Groq adds them
      const cleaned = rawResult.replace(/```json|```/g, '').trim();
      ranking = JSON.parse(cleaned);
    } catch {
      console.warn('Failed to parse Groq ranking response:', rawResult);
      // If parsing fails, just return listings in default order
      res.json({
        message: 'Recommendations returned in default order (AI ranking unavailable)',
        recommendations: listings.map(l => ({ ...l, score: null, reason: null }))
      });
      return;
    }

    // 6. Merge AI ranking with actual listing data
    const listingMap = new Map(listings.map(l => [l.id, l]));

    const recommendations = ranking
      .filter(r => listingMap.has(r.id))
      .map(r => ({
        ...listingMap.get(r.id),
        matchScore: r.score,
        matchReason: r.reason
      }));

    res.json({
      message: `Found ${recommendations.length} recommendations based on your skills`,
      studentSkills: student.skills,
      recommendations
    });

  } catch (error) {
    console.error('getRecommendations error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// PUT /api/v1/students/job-alerts
export const toggleJobAlerts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      res.status(400).json({ error: 'enabled must be true or false' });
      return;
    }

    const updated = await prisma.student.update({
      where: { userId: req.user!.userId },
      data: { jobAlertsEnabled: enabled }
    });

    res.json({
      message: `Job alerts ${enabled ? 'enabled' : 'disabled'} successfully`,
      jobAlertsEnabled: updated.jobAlertsEnabled
    });
  } catch (error) {
    console.error('toggleJobAlerts error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};