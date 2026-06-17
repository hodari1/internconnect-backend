import '../env';
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import prisma from '../services/prisma';

// POST /api/v1/interviews
export const createSlot = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { listingId, datetime } = req.body;

    if (!listingId || !datetime) {
      res.status(400).json({ error: 'listingId and datetime are required' });
      return;
    }

    const employer = await prisma.employer.findUnique({
      where: { userId: req.user!.userId }
    });

    if (!employer) {
      res.status(404).json({ error: 'Employer profile not found' });
      return;
    }

    // Verify listing belongs to this employer
    const listing = await prisma.listing.findUnique({
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

    const slot = await prisma.interviewSlot.create({
      data: {
        listingId,
        datetime: new Date(datetime),
      }
    });

    res.status(201).json({ message: 'Interview slot created', slot });
  } catch (error) {
    console.error('createSlot error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// GET /api/v1/interviews/listing/:listingId
export const getListingSlots = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const slots = await prisma.interviewSlot.findMany({
      where: {
        listingId: req.params.listingId as string,
        confirmed: false,
        bookedById: null // only show available slots
      },
      orderBy: { datetime: 'asc' }
    });

    res.json({ total: slots.length, slots });
  } catch (error) {
    console.error('getListingSlots error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// PUT /api/v1/interviews/:id/book
export const bookSlot = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const student = await prisma.student.findUnique({
      where: { userId: req.user!.userId }
    });

    if (!student) {
      res.status(404).json({ error: 'Student profile not found' });
      return;
    }

    const slot = await prisma.interviewSlot.findUnique({
      where: { id: req.params.id as string }
    });

    if (!slot) {
      res.status(404).json({ error: 'Interview slot not found' });
      return;
    }

    if (slot.bookedById) {
      res.status(400).json({ error: 'This slot is already booked' });
      return;
    }

    // Check student has applied for this listing
    const application = await prisma.application.findUnique({
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

    const updated = await prisma.interviewSlot.update({
      where: { id: req.params.id as string },
      data: {
        bookedById: student.id,
        confirmed: true
      }
    });

    // Notify the student
    await prisma.notification.create({
      data: {
        userId: req.user!.userId,
        type: 'interview_booked',
        message: `Your interview slot has been booked for ${new Date(slot.datetime).toLocaleString()}`
      }
    });

    res.json({ message: 'Interview slot booked successfully', slot: updated });
  } catch (error) {
    console.error('bookSlot error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// GET /api/v1/interviews/my
export const getMySlots = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const student = await prisma.student.findUnique({
      where: { userId: req.user!.userId }
    });

    if (!student) {
      res.status(404).json({ error: 'Student profile not found' });
      return;
    }

    const slots = await prisma.interviewSlot.findMany({
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
  } catch (error) {
    console.error('getMySlots error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};