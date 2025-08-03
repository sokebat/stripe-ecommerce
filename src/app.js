import cors from 'cors';
import express from 'express';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './docs/swagger.js';
 
const app = express();

// Middlewares
app.use(cors());
app.use(morgan('dev'));

// Handle webhook route with raw body BEFORE any other body parsing
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

// Handle all other routes with JSON parsing, but EXCLUDE the webhook route
app.use((req, res, next) => {
  if (req.path === '/api/payments/webhook') {
    return next();  
  }
  express.json()(req, res, next);
});

 
import paymentRoutes from './routes/payment.route.js';

app.use('/api/payments', paymentRoutes);

// Swagger docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Health check
app.get('/', (req, res) => res.send('API is running'));

export default app;
