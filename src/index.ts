import './env';

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import type { Express } from 'express';
import { swaggerSpec } from './swagger';
import authRoutes from './routes/auth.routes';
import studentRoutes from './routes/student.routes';
import listingRoutes from './routes/listing.routes';
import applicationRoutes from './routes/application.routes';
import notificationRoutes from './routes/notification.routes';
import employerRoutes from './routes/employer.routes';
import interviewRoutes from './routes/interview.routes';
import reviewRoutes from './routes/review.routes';

const app: Express = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Log every incoming request
app.use((req, res, next) => {
  console.log(`Incoming: ${req.method} ${req.originalUrl}`);
  next();
});

// Swagger docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/students', studentRoutes);
app.use('/api/v1/listings', listingRoutes);
app.use('/api/v1/applications', applicationRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/employers', employerRoutes);
app.use('/api/v1/interviews', interviewRoutes);
app.use('/api/v1/reviews', reviewRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'InternConnect API is running' });
});

// 404 handler — catches any unmatched route
app.use((req, res) => {
  console.warn(`No route matched: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ error: 'Not found', path: req.originalUrl });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});