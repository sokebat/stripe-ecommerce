import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

class StripeService {
  constructor() {
    this.stripe = stripe;
  }

  async createCheckoutSession(orderData, customerId, successUrl, cancelUrl) {
    try {
      const { id, items, email, name, amount } = orderData;

      const lineItems = items.map((item) => ({
        price_data: {
          currency: "usd",
          product_data: {
            name: item.name,
            description: item.description || item.name,
          },
          unit_amount: item.price,
        },
        quantity: item.quantity,
      }));

      // Create a checkout session
      const session = await this.stripe.checkout.sessions.create({
        mode: "payment",
        line_items: lineItems,
        success_url: successUrl,
        cancel_url: cancelUrl,
        client_reference_id: id,
        customer_email: email,

        metadata: {
          orderId: id,
          amount: amount,
          email: email,
          name: name,
          items: items.map((item) => item.name).join(", "),
          customerId: customerId,
        },
      });

      console.log(session, "session from stripe");

      return {
        sessionId: session.id,
        sessionUrl: session.url,
      };
    } catch (error) {
      console.error("Error creating Stripe checkout session:", error);
      throw error;
    }
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId) {
    try {
      const session = await this.stripe.checkout.sessions.retrieve(sessionId);
      return session;
    } catch (error) {
      console.error("Error retrieving Stripe session:", error);
      throw error;
    }
  }

  async handleWebhookEvent(event) {
    try {
      const { type, data } = event;

      console.log(`\n=== PROCESSING STRIPE EVENT: ${type} ===`);
      console.log(`Event ID: ${event.id}`);
      console.log(`Created: ${new Date(event.created * 1000).toISOString()}`);

      switch (type) {
        case "checkout.session.completed": {
          console.log("\n=== CHECKOUT SESSION COMPLETED ===");
          const session = data.object;
          console.log("Session details:", {
            id: session.id,
            customer: session.customer,
            customer_email: session.customer_email,
            amount_total: session.amount_total,
            payment_status: session.payment_status,
            client_reference_id: session.client_reference_id,
            metadata: session.metadata,
          });

          // Enhanced logging for order payments
          if (session.metadata && session.metadata.orderId) {
            console.log("\n=== ORDER PAYMENT COMPLETED ===");
            console.log("Order ID:", session.metadata.orderId);
            console.log("Business ID:", session.metadata.businessId);
            console.log("Payment Status:", session.payment_status);
            console.log("Amount Paid:", session.amount_total / 100); // Convert from cents
            console.log("Currency:", session.currency);

          
          }

          return { status: "success", eventType: type, sessionId: session.id };
        }

        case "payment_intent.succeeded": {
          console.log("\n=== PAYMENT INTENT SUCCEEDED ===");

          return {
            status: "success",
            eventType: type,
            paymentIntentId: paymentIntent.id,
          };
        }

        case "payment_intent.payment_failed": {
          console.log("\n=== PAYMENT INTENT FAILED ===");

          return {
            status: "failed",
            eventType: type,
            paymentIntentId: paymentIntent.id,
          };
        }

        default:
          console.log(`Unhandled Stripe webhook event type: ${type}`);
          return { status: "ignored", eventType: type };
      }
    } catch (error) {
      console.error("Error handling Stripe webhook:", error);
      throw error;
    }
  }

  verifyWebhookSignature(signature, rawBody) {
    console.log(signature, "signature from stripe");
    console.log(rawBody, "rawBody from stripe");
    try {
      console.log("Verifying order webhook signature with secret...");

      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

      if (!webhookSecret) {
        console.error("STRIPE_WEBHOOK_SECRET environment variable is not set");
        throw new Error("Webhook secret is not configured");
      }

      const event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        webhookSecret
      );

      console.log("Webhook signature verified successfully");
      return event;
    } catch (error) {
      console.error("Stripe webhook signature verification failed:", error);
      throw error;
    }
  }
}

export default new StripeService();
