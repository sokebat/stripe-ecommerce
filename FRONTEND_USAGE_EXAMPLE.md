# Webhook-Based Order Creation

## How it works:

1. **Frontend**: Creates Stripe checkout session via `/api/payments` endpoint
2. **Stripe**: Processes payment and sends webhook to `/api/payments/webhook`
3. **Backend**: Creates order in database after successful payment confirmation

## Flow:

```
Frontend → Stripe Checkout → Payment Success → Webhook → Order Created in DB
```

## Frontend Implementation:

```javascript
const createPayment = useMutation({
  mutationFn: async (paymentData) => {
    const response = await fetch('/api/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}`
      },
      body: JSON.stringify(paymentData)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create payment');
    }

    return response.json();
  },
  onSuccess: (data) => {
    // Redirect to Stripe checkout
    window.location.href = data.sessionUrl;
  },
  onError: (error) => {
    toast({
      title: "Error",
      description: error.message,
      variant: "destructive",
    });
  },
});
```

## Payment Request Body

```javascript
{
  "userId": "user_123",
  "formatedCartItems": [
    {
      "product_id": "prod_1",
      "name": "Product Name",
      "description": "Product description",
      "price": 1000, // in cents
      "quantity": 2,
      "total": 2000
    }
  ],
  "email": "user@example.com",
  "name": "John Doe"
}
```

## Payment Response

```javascript
{
  "success": true,
  "sessionId": "cs_test_...",
  "sessionUrl": "https://checkout.stripe.com/...",
  "orderId": "order_1234567890_abc123",
  "totalAmount": 2200
}
```

## Usage Example

```javascript
const handleCheckout = () => {
  createPayment.mutate({
    userId: currentUser.id,
    formatedCartItems: cartItems,
    email: currentUser.email,
    name: currentUser.name
  });
};
```

## Database Schema

Make sure your Supabase `orders` table has these columns:

```sql
CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  email TEXT NOT NULL,
  customer_name TEXT,
  status TEXT DEFAULT 'paid',
  total INTEGER,
  items JSONB,
  stripe_session_id TEXT,
  stripe_payment_intent_id TEXT,
  payment_status TEXT DEFAULT 'succeeded',
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Environment Variables

Make sure these are set in your backend:

```env
SUPABASE_URL=your_supabase_url
SUPABASE_SECRET_KEY=your_supabase_secret_key
STRIPE_SECRET_KEY=your_stripe_secret_key
FRONTEND_URL=http://localhost:3000
```

## What happens:

1. **User clicks checkout** → Frontend calls `/api/payments`
2. **Payment succeeds** → Stripe sends webhook to `/api/payments/webhook`
3. **Webhook processes** → Order automatically created in database
4. **User redirected** → Back to your success page

No separate order creation needed - it's all handled automatically! 🎉 