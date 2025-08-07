
import express from 'express';
const router = express.Router();
import { createPayment, webhook, verifyPayment, testEmail } from '../controllers/payment.controller.js';

 

/**
 * @swagger
 * /api/payments:
 *   post:
 *     summary: Create a new payment session
 *     tags:
 *       - Payments
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - orders
 *             properties:
 *               userId:
 *                 type: string
 *               orders:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       200:
 *         description: Payment session created successfully
 *       400:
 *         description: Bad request
 *       500:
 *         description: Server error
 */
router.post('/', createPayment);

/**
 * @swagger
 * /api/payments/webhook:
 *   post:
 *     summary: Handle webhook events
 *     tags:
 *       - Payments
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Webhook received successfully
 *       400:
 *         description: Bad request
 *       500:
 *         description: Server error
 */
router.post('/webhook', webhook);

/**
 * @swagger
 * /api/payments/verify/{sessionId}:
 *   get:
 *     summary: Verify payment status
 *     tags:
 *       - Payments
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Payment verification successful
 *       400:
 *         description: Bad request
 *       500:
 *         description: Server error
 */
router.get('/verify/:sessionId', verifyPayment);

/**
 * @swagger
 * /api/payments/test-email:
 *   post:
 *     summary: Test email service
 *     tags:
 *       - Payments
 *     responses:
 *       200:
 *         description: Test email sent successfully
 *       500:
 *         description: Server error
 */
router.post('/test-email', testEmail);

export default router;
