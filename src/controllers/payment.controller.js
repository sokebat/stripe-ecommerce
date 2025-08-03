import stripeService from "../services/stripe.service.js";
import orderService from "../services/order.service.js";
import { createAuthenticatedClient } from "../config/supabase.js";

export const createPayment = async (req, res) => {
  try {
    const supabase = createAuthenticatedClient(req.headers.authorization);
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
    console.log(formatedCartItems, "formatedCartItems");
    // Create order data for Stripe
    const orderData = {
      
      id: `order_${userEmail}_${userId}`,
      amount: totalAmount,
      customerEmail: userEmail,
      customerName: userName,
      items: stripeItems,
      address: address,
    };
 console.log(cartid, "cartid");
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
        return res.status(400).json({ error: "Raw body is not a Buffer" });
      }

      // Convert Buffer to string
      const rawBodyString = rawBody.toString("utf8");

      event = JSON.parse(rawBodyString);

      if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        console.log("🎉 CHECKOUT SESSION COMPLETED");

        console.log(session, "session");

        let parsedItems, parsedAddress;
        
        try {
          parsedItems = JSON.parse(session.metadata.itemsJson);
          parsedAddress = JSON.parse(session.metadata.address);
        } catch (parseError) {
          console.error("❌ Error parsing metadata:", parseError);
          console.error("📄 Raw itemsJson:", session.metadata.itemsJson);
          console.error("📄 Raw address:", session.metadata.address);
          return res.status(400).json({ error: "Failed to parse metadata" });
        }
        
        console.log("📦 Parsed Items:", parsedItems);
        console.log("📦 Parsed Address:", parsedAddress);
        
        const result = await orderService.createOrderWithPayment(
          session.metadata.userId,
      
          parsedAddress,
          parsedItems,
          session.amount_total / 100,
          "processing",
          session.id
        );

        if (result.isExisting) {
          console.log("ℹ️ Order already existed:", result.message);
        } else {
          console.log("✅ New order created successfully:", result.order.id);
          
          // Clear cart items after successful order creation
          // This ensures the cart is emptied after payment success
          if (session.metadata.cartid) {
            try {
              console.log("🛒 Clearing cart items for cart ID:", session.metadata.cartid);
              const cartResult = await orderService.clearCartItems(session.metadata.cartid);
              console.log("✅ Cart items cleared successfully:", cartResult.deletedCount, "items deleted");
              
              // Note: Frontend should also clear localStorage for these items
              // The deletedItems array contains the items that were removed
            } catch (cartError) {
              console.error("❌ Error clearing cart items:", cartError);
              // Don't fail the webhook if cart clearing fails
            }
          } else {
            console.log("⚠️ No cart ID found in metadata, skipping cart clearing");
          }
        }
      } else if (event.type === "payment_intent.succeeded") {
        const paymentIntent = event.data.object;
        console.log("✅ PAYMENT INTENT SUCCEEDED");
      } else if (event.type === "payment_intent.payment_failed") {
        const paymentIntent = event.data.object;
        console.log("❌ PAYMENT INTENT FAILED");
      } else {
        console.log(`ℹ️ Unhandled event type: ${event.type}`);
      }

      res.status(200).json({ received: true, success: true });
    } catch (parseErr) {
      console.error("❌ Failed to parse event body:", parseErr);
      return res.status(400).json({ error: "Failed to parse webhook body" });
    }

    // Process the event asynchronously (after response is sent)
    try {
      console.log("🔄 Processing event asynchronously...");
      const result = await stripeService.handleWebhookEvent(event);
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
