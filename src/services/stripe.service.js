import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

class StripeService {
  constructor() {
    this.stripe = stripe;
  }

  async createCheckoutSession(
    orderData,
    cartid,
    userId,
    successUrl,
    cancelUrl
  ) {
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
          address: addressJson,
          cartid: cartid,
        },
      });

      return {
        sessionId: session.id,
        sessionUrl: session.url,
      };
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  async getSession(sessionId) {
    try {
      const session = await this.stripe.checkout.sessions.retrieve(sessionId);
      return session;
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  async handleWebhookEvent(event) {
    try {
      const { type, data } = event;

      switch (type) {
        case "checkout.session.completed": {
          const session = data.object;

          let parsedAddress;

          try {
            parsedAddress = JSON.parse(session.metadata.address);
          } catch (parseError) {
            throw new Error("Failed to parse metadata");
          }

          return { status: "success", eventType: type, sessionId: session.id };
        }

        case "checkout.session.async_payment_succeeded": {
          return {
            status: "success",
            eventType: type,
            paymentIntentId: paymentIntent.id,
          };
        }

        case "checkout.session.async_payment_failed": {
          return {
            status: "failed",
            eventType: type,
            paymentIntentId: paymentIntent.id,
          };
        }

        default:
          return { status: "ignored", eventType: type };
      }
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  verifyWebhookSignature(signature, rawBody) {
    try {
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

      if (!webhookSecret) {
        throw new Error("Webhook secret is not configured");
      }

      const event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        webhookSecret
      );

      return event;
    } catch (error) {
      console.log(error);
      throw error;
    }
  }
}

export default new StripeService();
