# Ecommerce Payment System with Stripe

A complete ecommerce payment system built with Node.js, Express, and Stripe Checkout API. This system handles cart processing, payment creation, webhook management, and order management.

## Features

- ✅ **Stripe Checkout Integration** - Secure payment processing
- ✅ **Cart Management** - Process cart items with product details
- ✅ **Order Management** - Complete order lifecycle
- ✅ **Tax & Shipping Calculation** - Automatic total calculations
- ✅ **Webhook Handling** - Real-time payment status updates
- ✅ **Order Status Tracking** - Track payment and order status
- ✅ **Address Management** - Shipping and billing addresses
- ✅ **Discount Support** - Apply discounts and coupons
- ✅ **Product Variants** - Handle colors, sizes, and options

## Setup

### Prerequisites

- Node.js (v14 or higher)
- Stripe account with API keys
- Environment variables configured

### Installation

```bash
npm install
```

### Environment Variables

Create a `.env` file in the root directory:

```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Application Configuration
PORT=3000
FRONTEND_URL=http://localhost:3000

# Database (for future Supabase integration)
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Running the Application

```bash
npm start
```
 