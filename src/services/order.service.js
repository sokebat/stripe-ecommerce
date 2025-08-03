import { createClient } from "@supabase/supabase-js";

class OrderService {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SECRET_KEY
    );
  }

  /**
   * Create order after successful payment (webhook)
   */
  async createOrderWithPayment(orderData) {
    try {
      console.log("🛒 Creating order after successful payment...");

      const {
        userId,
        email,
        name,
        items,
        total,
        status = "paid",
        stripe_session_id,
        stripe_payment_intent_id,
      } = orderData;

      // Validate required data
      if (!email) {
        throw new Error("Email is required");
      }

      // Create order in database
      const { data: order, error: orderError } = await this.supabase
        .from("orders")
        .create({
          user_id: userId,
          email: email,
          customer_name: name,
          status: status,
          total: total,
          items: items,
          stripe_session_id: stripe_session_id,
          stripe_payment_intent_id: stripe_payment_intent_id,
          payment_status: "succeeded",
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (orderError) {
        console.error("❌ Database error creating order:", orderError);
        throw new Error("Failed to create order in database");
      }

      console.log("✅ Order created in database:", order.id);

      return {
        success: true,
        order: order,
      };
    } catch (error) {
      console.error("❌ Error in createOrderWithPayment:", error);
      throw error;
    }
  }
}

export default OrderService;
