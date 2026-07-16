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

// Always-allowed local dev origins, plus whatever is configured via env for deployed frontends.
// Optionally set ALLOWED_ORIGINS on Render as a comma-separated list, e.g.:
//   ALLOWED_ORIGINS=https://internconnect.vercel.app,https://your-custom-domain.com
const localOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:8081',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:8081',
];
const envOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
const allowedOrigins = [...localOrigins, ...envOrigins];

app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests (curl, Postman, server-to-server) which send no Origin header
    if (!origin) return callback(null, true);

    if (
      allowedOrigins.includes(origin) ||
      origin.startsWith('http://localhost:') ||
      origin.startsWith('http://127.0.0.1:') ||
      origin.startsWith('http://192.168.')
    ) {
      return callback(null, true);
    }

    // Allow any Vercel deployment (production + preview URLs) for this project
    // without having to list each one manually.
    if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin)) {
      return callback(null, true);
    }

    console.warn(`CORS blocked request from origin: ${origin}`);
    return callback(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Log every incoming request
app.use((req, res, next) => {
  console.log(`Incoming request: ${req.method} ${req.originalUrl}`);
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