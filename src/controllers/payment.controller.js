import stripeService from "../services/stripe.service.js";

export const createPayment = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token =
      authHeader && authHeader.startsWith("Bearer")
        ? authHeader.substring(7)
        : null;

    const { userId, formatedCartItems, email, name } = req.body;

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

    const stripeItems = formatedCartItems.map((order) => ({
      name: order.name || `Product ${order.product_id}`,
      description: order.description || `Product ${order.product_id}`,
      price: order.price,
      quantity: order.quantity,
    }));

    // Calculate total amount from cart items
    const totalAmount = formatedCartItems.reduce(
      (sum, item) => sum + item.total,
      0
    );

    // Create order data for Stripe
    const orderData = {
      id: `order_${email}_${userId}`,
      amount: totalAmount,
      customerEmail: email,
      customerName: name,
      items: stripeItems,
    };

    // Create checkout session
    const result = await stripeService.createCheckoutSession(
      orderData,
      userId,
      `${process.env.FRONTEND_URL?.replace(/\/$/, "")}/success`,
      `${process.env.FRONTEND_URL?.replace(/\/$/, "")}/cancel`
    );

    res.json({
      success: true,
      sessionId: result.sessionId,
      sessionUrl: result.sessionUrl,
      orderId: `order_${email}_${userId}`,
      totalAmount: totalAmount,
      orders: formatedCartItems,
    });
  } catch (error) {
    console.error("Payment creation error:", error);
    res.status(500).json({
      error: "Failed to create payment session",
      details: error.message,
    });
  }
};

export const webhook = async (req, res) => {
  try {
    console.log("🎯 WEBHOOK RECEIVED");
    console.log("📋 Headers:", Object.keys(req.headers));

    const signature = req.headers["stripe-signature"];
    if (!signature) {
      console.error("❌ Stripe signature missing from headers");
      return res.status(400).json({ error: "Stripe signature missing" });
    }

    console.log("✅ Signature found:", signature.substring(0, 50) + "...");

    // Get raw body - should be a Buffer from express.raw()
    const rawBody = req.body;
    console.log("📦 Raw body type:", typeof rawBody);
    console.log("📦 Raw body is Buffer:", Buffer.isBuffer(rawBody));
    console.log("📦 Raw body length:", rawBody ? rawBody.length : "undefined");

    let event;
    try {
      // Check if rawBody is actually a Buffer
      if (!Buffer.isBuffer(rawBody)) {
        console.error("❌ Raw body is not a Buffer! Type:", typeof rawBody);
        console.error("❌ Raw body value:", rawBody);
        return res.status(400).json({ error: "Raw body is not a Buffer" });
      }

      // Convert Buffer to string
      const rawBodyString = rawBody.toString("utf8");
      console.log(
        "📄 Raw body as string (first 200 chars):",
        rawBodyString.substring(0, 200) + "..."
      );

      event = JSON.parse(rawBodyString);
      
      // Log event details based on type
      if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        console.log("🎉 CHECKOUT SESSION COMPLETED");
        console.log("📊 Session Details:", {
          id: session.id,
          payment_status: session.payment_status,
          client_reference_id: session.client_reference_id,
          metadata: session.metadata,
          amount_total: session.amount_total,
          customer_email: session.customer_email,
          currency: session.currency,
        });
        
        // Log metadata parsing details
        console.log("🔍 Metadata Analysis:");
        console.log("  - Raw metadata:", session.metadata);
        console.log("  - Items string:", session.metadata?.items);
        console.log("  - Items JSON:", session.metadata?.itemsJson);
        
        // Test JSON parsing
        if (session.metadata?.itemsJson) {
          try {
            const parsedItems = JSON.parse(session.metadata.itemsJson);
            console.log("  ✅ Items JSON parsed successfully:", parsedItems);
          } catch (parseError) {
            console.log("  ❌ Items JSON parse error:", parseError.message);
            console.log("  📄 Raw itemsJson value:", session.metadata.itemsJson);
          }
        }
      } else if (event.type === "payment_intent.succeeded") {
        const paymentIntent = event.data.object;
        console.log("✅ PAYMENT INTENT SUCCEEDED");
        console.log("📊 Payment Intent Details:", {
          id: paymentIntent.id,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          status: paymentIntent.status,
          metadata: paymentIntent.metadata,
        });
      } else if (event.type === "payment_intent.payment_failed") {
        const paymentIntent = event.data.object;
        console.log("❌ PAYMENT INTENT FAILED");
        console.log("📊 Failed Payment Details:", {
          id: paymentIntent.id,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          status: paymentIntent.status,
          last_payment_error:
            paymentIntent.last_payment_error?.message || "No error details",
          metadata: paymentIntent.metadata,
        });
      } else {
        console.log(`ℹ️ Unhandled event type: ${event.type}`);
        console.log(
          "📊 Event data preview:",
          JSON.stringify(event.data, null, 2).substring(0, 500) + "..."
        );
      }

      // Immediately respond to Stripe to avoid timeout
      res.status(200).json({ received: true, success: true });
    } catch (parseErr) {
      console.error("❌ Failed to parse event body:", parseErr);
      return res.status(400).json({ error: "Failed to parse webhook body" });
    }

    // Process the event asynchronously (after response is sent)
    try {
      console.log("🔄 Processing event asynchronously...");
      const result = await stripeService.handleWebhookEvent(event);
      console.log("✅ Event processing completed:", {
        eventId: event.id,
        eventType: event.type,
        processingResult: result,
      });
    } catch (processingErr) {
      console.error("❌ Error in async webhook processing:", processingErr);
    }
  } catch (error) {
    console.error("❌ Error handling webhook:", error);
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
    console.error("Error verifying payment:", error);
    res.status(500).json({ error: "Failed to verify payment" });
  }
};
