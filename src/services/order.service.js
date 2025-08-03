import { createClient } from "@supabase/supabase-js";

class OrderService {
  constructor() {
    // Use admin access with secret key for webhook operations
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SECRET_KEY
    );
  }

  /**
   * Create order after successful payment (webhook)
   */
  async createOrderWithPayment(userId, email, name, address, items, total, status, stripeSessionId) {
    try {
      console.log("🛒 Creating order after successful payment...");
      console.log("📋 Order Data:", {
        userId,
        email,
        name,
        address,
        itemsCount: items.length,
        total,
        status,
        stripeSessionId
      });

      // Validate required data
      if (!email) {
        throw new Error("Email is required");
      }

      if (!userId) {
        throw new Error("User ID is required");
      }

      // Create order in database
      const { data: order, error: orderError } = await this.supabase
        .from("orders")
        .insert({
          user_id: userId,
          stripe_session_id: stripeSessionId,
          total_amount: total,
          currency: "NPR", // Default currency
          status: status,
          shipping_address: address,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (orderError) {
        console.error("❌ Database error creating order:", orderError);
        throw new Error("Failed to create order in database");
      }

      console.log("✅ Order created in database:", order.id);

      // Create order items
      const orderItems = items.map(item => {
        console.log("📦 Processing item:", item);
        
        return {
          order_id: order.id,
          product_id: item.product_id || item.id,
          quantity: item.quantity || 1,
          price: item.price || 0,
          selected_color: item.color || item.selected_color || null,
          selected_size: item.size || item.selected_size || null,
          delivery_option: item.deliveryOption || item.delivery_option || "pay_on_website",
          status: "pending",
          created_at: new Date().toISOString(),
        };
      });

      console.log("📦 Creating order items:", orderItems);

      const { data: orderItemsData, error: itemsError } = await this.supabase
        .from("order_items")
        .insert(orderItems)
        .select();

      if (itemsError) {
        console.error("❌ Database error creating order items:", itemsError);
        throw new Error("Failed to create order items in database");
      }

      console.log("✅ Order items created:", orderItemsData.length, "items");

      return {
        success: true,
        order: order,
        orderItems: orderItemsData,
      };
    } catch (error) {
      console.error("❌ Error in createOrderWithPayment:", error);
      throw error;
    }
  }
}

export default new OrderService;
