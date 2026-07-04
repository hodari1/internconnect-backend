import '../env';
import { Router } from 'express';
import {
  applyForListing,
  getMyApplications,
  getListingApplications,
  updateApplicationStatus,
  withdrawApplication,
  analyzeApplicant,
} from '../controllers/application.controller';
import { protect, requireRole } from '../middleware/auth.middleware';
import { upload } from '../services/upload';

const router = Router();

router.post('/', protect, requireRole('student'), upload.single('coverLetter'), applyForListing);
router.get('/my', protect, requireRole('student'), getMyApplications);
router.get('/listing/:listingId', protect, requireRole('employer'), getListingApplications);
router.put('/:id/status', protect, requireRole('employer'), updateApplicationStatus);
router.delete('/:id', protect, requireRole('student'), withdrawApplication);
router.post('/:id/analyze', protect, requireRole('employer'), analyzeApplicant);

export default router;