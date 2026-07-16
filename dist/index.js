"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("./env");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const swagger_1 = require("./swagger");
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const student_routes_1 = __importDefault(require("./routes/student.routes"));
const listing_routes_1 = __importDefault(require("./routes/listing.routes"));
const application_routes_1 = __importDefault(require("./routes/application.routes"));
const notification_routes_1 = __importDefault(require("./routes/notification.routes"));
const employer_routes_1 = __importDefault(require("./routes/employer.routes"));
const interview_routes_1 = __importDefault(require("./routes/interview.routes"));
const review_routes_1 = __importDefault(require("./routes/review.routes"));
const app = (0, express_1.default)();
app.use((0, helmet_1.default)());
const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:8081',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:8081',
    'https://her-project.vercel.app',
    'https://internconnect-backend-3lck.onrender.com',
];
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        if (!origin ||
            allowedOrigins.includes(origin) ||
            origin.startsWith('http://localhost:') ||
            origin.startsWith('http://127.0.0.1:') ||
            origin.startsWith('http://192.168.')) {
            callback(null, true);
        }
        else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
}));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Log every incoming request
app.use((req, res, next) => {
    console.log(`Incoming: ${req.method} ${req.originalUrl}`);
    next();
});
// Swagger docs
app.use('/api-docs', swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swagger_1.swaggerSpec));
// Routes
app.use('/api/v1/auth', auth_routes_1.default);
app.use('/api/v1/students', student_routes_1.default);
app.use('/api/v1/listings', listing_routes_1.default);
app.use('/api/v1/applications', application_routes_1.default);
app.use('/api/v1/notifications', notification_routes_1.default);
app.use('/api/v1/employers', employer_routes_1.default);
app.use('/api/v1/interviews', interview_routes_1.default);
app.use('/api/v1/reviews', review_routes_1.default);
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
