import { createClient } from "@supabase/supabase-js";

/**
 * OrderService - Handles order creation with robust idempotency
 * 
 * Features:
 * - Prevents duplicate orders from webhook retries
 * - Handles PostgreSQL unique constraint violations
 * - Graceful error handling for all scenarios
 * - Detailed logging for debugging
 * - Uses admin access for webhook operations
 */
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
   * Handles idempotency to prevent duplicate orders
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

      if (!stripeSessionId) {
        throw new Error("Stripe session ID is required");
      }

      // Check if order already exists with this stripe session ID
      console.log("🔍 Checking for existing order with session ID:", stripeSessionId);
      const { data: existingOrder, error: checkError } = await this.supabase
        .from("orders")
        .select("id, status, total_amount")
        .eq("stripe_session_id", stripeSessionId)
        .maybeSingle();

      if (checkError) {
        console.error("❌ Error checking existing order:", checkError);
        throw new Error("Failed to check existing order");
      }

      if (existingOrder) {
        console.log("⚠️ Order already exists for session:", stripeSessionId);
        console.log("📊 Existing order details:", {
          id: existingOrder.id,
          status: existingOrder.status,
          total: existingOrder.total_amount
        });
        
        // Return existing order details
        return {
          success: true,
          order: existingOrder,
          message: "Order already exists",
          isExisting: true
        };
      }

      console.log("✅ No existing order found, creating new order...");

      // Create order in database with error handling for duplicate key
      let order;
      try {
        const { data: newOrder, error: orderError } = await this.supabase
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
          // Check if it's a duplicate key error
          if (orderError.code === '23505' && orderError.message.includes('stripe_session_id')) {
            console.log("⚠️ Duplicate key error - order already exists, fetching existing order...");
            
            // Fetch the existing order
            const { data: existingOrderData, error: fetchError } = await this.supabase
              .from("orders")
              .select("*")
              .eq("stripe_session_id", stripeSessionId)
              .single();

            if (fetchError) {
              console.error("❌ Error fetching existing order:", fetchError);
              throw new Error("Failed to fetch existing order after duplicate key error");
            }

            console.log("✅ Retrieved existing order:", existingOrderData.id);
            return {
              success: true,
              order: existingOrderData,
              message: "Order already exists (handled duplicate key)",
              isExisting: true
            };
          }
          
          console.error("❌ Database error creating order:", orderError);
          throw new Error("Failed to create order in database");
        }

        order = newOrder;
        console.log("✅ Order created in database:", order.id);

      } catch (insertError) {
        console.error("❌ Error during order insertion:", insertError);
        throw insertError;
      }

      // Create order items
      console.log("📦 Creating order items for order:", order.id);
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
      console.log("🎉 Order creation completed successfully!");

      return {
        success: true,
        order: order,
        orderItems: orderItemsData,
        isExisting: false
      };
    } catch (error) {
      console.error("❌ Error in createOrderWithPayment:", error);
      throw error;
    }
  }

  /**
   * Handle webhook retries gracefully
   * This method ensures idempotency for webhook processing
   */
  async handleWebhookRetry(stripeSessionId) {
    try {
      console.log("🔄 Handling webhook retry for session:", stripeSessionId);
      
      const { data: existingOrder, error } = await this.supabase
        .from("orders")
        .select("id, status, total_amount, created_at")
        .eq("stripe_session_id", stripeSessionId)
        .maybeSingle();

      if (error) {
        console.error("❌ Error checking for existing order during retry:", error);
        return { success: false, error: "Failed to check existing order" };
      }

      if (existingOrder) {
        console.log("✅ Order exists, retry handled gracefully");
        return { 
          success: true, 
          order: existingOrder, 
          message: "Order already exists from previous webhook" 
        };
      }

      console.log("⚠️ No order found for session during retry:", stripeSessionId);
      return { success: false, message: "No order found for session" };
    } catch (error) {
      console.error("❌ Error in handleWebhookRetry:", error);
      return { success: false, error: error.message };
    }
  }
}

export default new OrderService;
