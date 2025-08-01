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

## API Endpoints

### 1. Create Payment Session
**POST** `/api/payments`

Creates a Stripe checkout session for cart items.

**Request Body:**
```json
{
  "cartItems": [
    {
      "cart_id": "cart_123",
      "delivery_option": "standard",
      "selected_color": "red",
      "selected_size": "M",
      "product_id": "prod_123",
      "quantity": 2,
      "products": {
        "name": "T-Shirt",
        "description": "Cotton T-Shirt",
        "sale_price": 29.99,
        "price": 39.99,
        "images": ["https://example.com/image.jpg"]
      }
    }
  ],
  "userId": "user_123",
  "userEmail": "user@example.com",
  "businessId": "business_123",
  "shippingAddress": {
    "line1": "123 Main St",
    "city": "New York",
    "state": "NY",
    "postal_code": "10001",
    "country": "US"
  },
  "billingAddress": {
    "line1": "123 Main St",
    "city": "New York",
    "state": "NY",
    "postal_code": "10001",
    "country": "US"
  },
  "taxRate": 0.08,
  "shippingCost": 5.99,
  "discountAmount": 10.00
}
```

**Response:**
```json
{
  "success": true,
  "sessionId": "cs_test_123456789",
  "sessionUrl": "https://checkout.stripe.com/pay/cs_test_123456789",
  "orderId": "order_1234567890_abc123",
  "order": {
    "orderId": "order_1234567890_abc123",
    "userId": "user_123",
    "userEmail": "user@example.com",
    "totalAmount": 89.97,
    "subtotal": 59.98,
    "tax": 4.80,
    "shipping": 5.99,
    "discount": 10.00,
    "status": "pending",
    "paymentStatus": "pending"
  },
  "totals": {
    "subtotal": 59.98,
    "tax": 4.80,
    "shipping": 5.99,
    "discount": 10.00,
    "total": 89.97
  },
  "items": [...]
}
```

### 2. Calculate Totals
**POST** `/api/payments/calculate-totals`

Calculate order totals without creating a payment session.

**Request Body:**
```json
{
  "cartItems": [...],
  "taxRate": 0.08,
  "shippingCost": 5.99,
  "discountAmount": 10.00
}
```

### 3. Get Payment Status
**GET** `/api/payments/{sessionId}`

Get the status of a payment session.

**Response:**
```json
{
  "sessionId": "cs_test_123456789",
  "status": "paid",
  "amount": 89.97,
  "customerEmail": "user@example.com",
  "orderId": "order_1234567890_abc123"
}
```

### 4. Get Order Details
**GET** `/api/payments/orders/{orderId}`

Get detailed information about an order.

### 5. Webhook Endpoint
**POST** `/api/payments/webhook`

Stripe webhook endpoint for real-time payment updates.

## Cart Items Format

The system expects cart items in this format:

```javascript
const cartItems = [
  {
    cart_id: "cart_123",
    delivery_option: "standard",
    selected_color: "red",
    selected_size: "M",
    product_id: "prod_123",
    quantity: 2,
    products: {
      name: "Product Name",
      description: "Product Description",
      sale_price: 29.99,  // Use sale_price if available
      price: 39.99,       // Fallback to regular price
      images: ["https://example.com/image.jpg"]
    }
  }
]
```

## Webhook Events

The system handles these Stripe webhook events:

- `checkout.session.completed` - Payment successful
- `payment_intent.succeeded` - Payment intent succeeded
- `payment_intent.payment_failed` - Payment failed

## Order Status Flow

1. **Pending** - Order created, payment pending
2. **Paid** - Payment successful (webhook)
3. **Failed** - Payment failed (webhook)
4. **Cancelled** - Order cancelled by user

## Future Enhancements

### Supabase Integration
Replace mock models with actual Supabase database:

```javascript
// Example Supabase integration
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Save order to Supabase
async function saveOrder(orderData) {
  const { data, error } = await supabase
    .from('orders')
    .insert([orderData]);
  
  if (error) throw error;
  return data;
}
```

### Additional Features
- Inventory management
- Email notifications
- Order tracking
- Refund processing
- Subscription payments
- Multi-currency support

## Error Handling

The system includes comprehensive error handling:

- Input validation
- Stripe API errors
- Webhook signature verification
- Database errors
- Network timeouts

## Security

- Webhook signature verification
- Input sanitization
- Environment variable protection
- HTTPS enforcement (production)

## Testing

Test the API endpoints using tools like Postman or curl:

```bash
# Create payment session
curl -X POST http://localhost:3000/api/payments \
  -H "Content-Type: application/json" \
  -d @payment-request.json

# Get payment status
curl http://localhost:3000/api/payments/cs_test_123456789
```

## Production Deployment

1. Set up environment variables
2. Configure Stripe webhook endpoint
3. Set up database (Supabase)
4. Deploy to your hosting platform
5. Test webhook functionality

## Support

For issues or questions, please refer to:
- [Stripe Documentation](https://stripe.com/docs)
- [Node.js Documentation](https://nodejs.org/docs)
- [Express.js Documentation](https://expressjs.com/)
