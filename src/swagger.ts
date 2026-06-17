import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'InternConnect API',
      version: '1.0.0',
      description: 'API documentation for InternConnect — AI-powered internship platform for Rwanda',
    },
    servers: [
      {
        url: 'http://localhost:5000',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [{ bearerAuth: [] }],
    tags: [
      { name: 'Auth', description: 'Authentication endpoints' },
      { name: 'Students', description: 'Student profile endpoints' },
      { name: 'Employers', description: 'Employer profile endpoints' },
      { name: 'Listings', description: 'Internship listing endpoints' },
      { name: 'Applications', description: 'Application endpoints' },
      { name: 'Notifications', description: 'Notification endpoints' },
      { name: 'Interviews', description: 'Interview slot endpoints' },
      { name: 'Reviews', description: 'Review endpoints' },
    ],
  },
  apis: ['./src/routes/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);