import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);


class StripeService {
  constructor() {
    this.stripe = stripe;
  }

  async createCheckoutSession(orderData, userId, successUrl, cancelUrl) {
    try {
      const { id, items, amount, customerEmail, customerName, address } =
        orderData;

      // Validate items data
      if (!items || !Array.isArray(items) || items.length === 0) {
        throw new Error("Invalid items data");
      }

      // Convert items to Stripe line items format
      const lineItems = items.map((item) => ({
        price_data: {
          currency: "usd",
          product_data: {
            name: item.name || "Unknown Product",
            description:
              item.description || `Product: ${item.name || "Unknown"}`,
          },
          unit_amount: item.price || 0,
        },
        quantity: item.quantity || 1,
      }));

      const itemsJson = JSON.stringify(items);
      const addressJson = JSON.stringify(address);

      // Create a checkout session
      const session = await this.stripe.checkout.sessions.create({
        mode: "payment",
        line_items: lineItems,
        success_url: successUrl,
        cancel_url: cancelUrl,
        client_reference_id: id,
        customer_email: customerEmail,

        metadata: {
          userId: userId,
          amount: amount.toString(),
          email: customerEmail,
          name: customerName,
          items: items.map((item) => item.name || "Unknown").join(", "),
          itemsJson: itemsJson, // Use validated JSON
          address: addressJson,
          timestamp: new Date().toISOString(),
        },
      });

      return {
        sessionId: session.id,
        sessionUrl: session.url,
      };
    } catch (error) {
      console.error("Error creating Stripe checkout session:", error);
      throw error;
    }
  }

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
            let parsedItems, parsedAddress;
            
            try {
              parsedItems = JSON.parse(session.metadata.itemsJson);
              parsedAddress = JSON.parse(session.metadata.address);
            } catch (parseError) {
              console.error("❌ Error parsing metadata:", parseError);
              console.error("📄 Raw itemsJson:", session.metadata.itemsJson);
              console.error("📄 Raw address:", session.metadata.address);
              throw new Error("Failed to parse metadata");
            }
            
                        console.log("📦 Parsed Items:", parsedItems);
            console.log("📦 Parsed Address:", parsedAddress);
            
            // Order creation is handled in the controller, not here
            console.log("✅ Webhook event processed successfully");

            return { status: "success", eventType: type, sessionId: session.id };
        }

        case "checkout.session.async_payment_succeeded": {
          console.log("\n=== PAYMENT INTENT SUCCEEDED ===");

          return {
            status: "success",
            eventType: type,
            paymentIntentId: paymentIntent.id,
          };
        }

        case "checkout.session.async_payment_failed": {
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
