import stripeService from "../services/stripe.service.js";
import orderService from "../services/order.service.js";
import emailService from "../services/email.service.js";
import { createAuthenticatedClient } from "../config/supabase.js";

export const createPayment = async (req, res) => {
  try {
    const { userId, formatedCartItems, userEmail, userName, address } =
      req.body;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    if (
      !formatedCartItems ||
      !Array.isArray(formatedCartItems) ||
      formatedCartItems.length === 0
    ) {
      return res.status(400).json({ error: "Orders are required" });
    }
    const cartid = formatedCartItems[0].cart_id;
    const stripeItems = formatedCartItems.map((order) => ({
      name: order.name || `Product ${order.product_id}`,
      description: order.description || `Product ${order.product_id}`,
      price: order.price,
      deliveryOption: order.delivery_option,
      size: order.selected_size,
      color: order.selected_color,
      quantity: order.quantity,
      image: order.image,
    }));

    // Calculate total amount from cart items
    const totalAmount = formatedCartItems.reduce(
      (sum, item) => sum + item.total,
      0
    );
    // Create order data for Stripe
    const orderData = {
      id: `order_${userEmail}_${userId}`,
      amount: totalAmount,
      customerEmail: userEmail,
      customerName: userName,
      items: stripeItems,
      address: address,
    };
    // Create checkout session
    const result = await stripeService.createCheckoutSession(
      orderData,
      cartid,
      userId,
      `${process.env.FRONTEND_URL?.replace(/\/$/, "")}/success`,
      `${process.env.FRONTEND_URL?.replace(/\/$/, "")}/cancel`
    );

    res.json({
      success: true,
      sessionId: result.sessionId,
      sessionUrl: result.sessionUrl,
      orderId: `order_${userEmail}_${userId}`,
      totalAmount: totalAmount,
      orders: formatedCartItems,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to create payment session",
      details: error.message,
    });
  }
};

export const webhook = async (req, res) => {
  try {
    const signature = req.headers["stripe-signature"];
    if (!signature) {
      return res.status(400).json({ error: "Stripe signature missing" });
    }

    const rawBody = req.body;

    let event;
    try {
      // Check if rawBody is actually a Buffer
      if (!Buffer.isBuffer(rawBody)) {
        return res.status(400).json({ error: "Raw body is not a Buffer" });
      }

      // Convert Buffer to string
      const rawBodyString = rawBody.toString("utf8");

      event = JSON.parse(rawBodyString);

      if (event.type === "checkout.session.completed") {
        const session = event.data.object;

        let parsedAddress;

        try {
          // parsedItems = JSON.parse(session.metadata.itemsJson);
          parsedAddress = JSON.parse(session.metadata.address);
        } catch (parseError) {
          return res.status(400).json({ error: "Failed to parse metadata" });
        }

        const result = await orderService.createOrderWithPayment(
          session.metadata.userId,
          session.metadata.cartid,
          parsedAddress,
          "processing",
          session.id
        );
      } else if (event.type === "payment_intent.succeeded") {
        const paymentIntent = event.data.object;
      } else if (event.type === "payment_intent.payment_failed") {
        const paymentIntent = event.data.object;
      } else {
      }

      res.status(200).json({ received: true, success: true });
    } catch (parseErr) {
      return res.status(400).json({ error: "Failed to parse webhook body" });
    }

    // Process the event asynchronously (after response is sent)
    try {
      const result = await stripeService.handleWebhookEvent(event);
    } catch (processingErr) {}
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to process webhook" });
    }
  }
};

/**
 * Verify payment status
 */
export const verifyPayment = async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({ error: "Session ID is required" });
    }

    // Fetch session from Stripe
    const session = await stripeService.stripe.checkout.sessions.retrieve(
      sessionId
    );

    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    // Return session details
    res.json({
      success: true,
      status: session.payment_status,
      paymentIntent: session.payment_intent,
      amountTotal: session.amount_total / 100, // Convert from cents
      customerEmail: session.customer_email,
      customerDetails: session.customer_details,
      metadata: session.metadata,
      clientReferenceId: session.client_reference_id,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to verify payment" });
  }
};

/**
 * Test email service
 */
export const testEmail = async (req, res) => {
  try {
    const result = await emailService.sendTestEmail();
    res.json({
      success: true,
      message: "Test email sent successfully",
      messageId: result.messageId,
    });
  } catch (error) {
    console.error("Error sending test email:", error);
    res.status(500).json({ error: "Failed to send test email" });
  }
};
