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
  async createOrderWithPayment(
    userId,
    cartid,
    address,
    status,
    stripeSessionId
  ) {
    try {
      console.log("🛒 Creating order after successful payment...");
      console.log("📋 Order Data:", {
        userId,
        cartid,
        address,
        status,
        stripeSessionId,
      });

      if (!userId) {
        throw new Error("User ID is required");
      }

      if (!stripeSessionId) {
        throw new Error("Stripe session ID is required");
      }

      if (!cartid) {
        throw new Error("Cart ID is required");
      }

      // Check if order already exists with this stripe session ID
      console.log(
        "🔍 Checking for existing order with session ID:",
        stripeSessionId
      );

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
          total: existingOrder.total_amount,
        });

        // Return existing order details
        return {
          success: true,
          order: existingOrder,
          message: "Order already exists",
          isExisting: true,
        };
      }

      console.log("✅ No existing order found, creating new order...");

      // Fetch cart items with only required product details for order creation
      console.log("🛒 Fetching cart items for cart ID:", cartid);
      const { data: cartItems, error: fetchError } = await this.supabase
        .from("cart_items")
        .select(`
          id, 
          product_id, 
          quantity, 
          selected_color, 
          selected_size, 
          delivery_option,
          products (
            id,
            name,
            price,
            sale_price
          )
        `)
        .eq("cart_id", cartid);

      if (fetchError) {
        console.error("❌ Error fetching cart items:", fetchError);
        throw new Error("Failed to fetch cart items");
      }

      if (!cartItems || cartItems.length === 0) {
        console.error("❌ No cart items found for cart ID:", cartid);
        throw new Error("No cart items found");
      }

      console.log("📦 Found cart items:", cartItems.length, "items");

      // Calculate total amount from cart items
      const totalAmount = cartItems.reduce((sum, item) => {
        // Use sale_price if available, otherwise use regular price
        const productPrice = item.products?.sale_price || item.products?.price || 0;
        const itemTotal = productPrice * item.quantity;
        console.log(`💰 Item: ${item.products?.name} - Price: ${productPrice} x ${item.quantity} = ${itemTotal}`);
        return sum + itemTotal;
      }, 0);

      console.log("💰 Total amount calculated:", totalAmount);

      // Create order in database with error handling for duplicate key
      let order;
      try {
        const { data: newOrder, error: orderError } = await this.supabase
          .from("orders")
          .insert({
            user_id: userId,
            stripe_session_id: stripeSessionId,
            total_amount: totalAmount,
            currency: "NPR", // Default currency
            status: status || "processing",
            shipping_address: address,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (orderError) {
          // Check if it's a duplicate key error
          if (
            orderError.code === "23505" &&
            orderError.message.includes("stripe_session_id")
          ) {
            console.log(
              "⚠️ Duplicate key error - order already exists, fetching existing order..."
            );

            // Fetch the existing order
            const { data: existingOrderData, error: fetchError } =
              await this.supabase
                .from("orders")
                .select("*")
                .eq("stripe_session_id", stripeSessionId)
                .single();

            if (fetchError) {
              console.error("❌ Error fetching existing order:", fetchError);
              throw new Error(
                "Failed to fetch existing order after duplicate key error"
              );
            }

            console.log("✅ Retrieved existing order:", existingOrderData.id);
            return {
              success: true,
              order: existingOrderData,
              message: "Order already exists (handled duplicate key)",
              isExisting: true,
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

      // Create order items from cart items
      console.log("📦 Creating order items for order:", order.id);
      const orderItems = cartItems.map((cartItem) => {
        console.log("📦 Processing cart item:", cartItem);
        
        // Use sale_price if available, otherwise use regular price
        const productPrice = cartItem.products?.sale_price || cartItem.products?.price || 0;

        return {
          order_id: order.id,
          product_id: cartItem.product_id,
          quantity: cartItem.quantity,
          price: productPrice,
          selected_color: cartItem.selected_color || null,
          selected_size: cartItem.selected_size || null,
          delivery_option: cartItem.delivery_option || "pay_on_website",
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

      // Clear cart items after successful order creation
      console.log("🛒 Clearing cart items after successful order creation");
      const cartResult = await this.clearCartItems(cartid);
      console.log("✅ Cart cleared:", cartResult.deletedCount, "items deleted");

      console.log("🎉 Order creation completed successfully!");

      return {
        success: true,
        order: order,
        orderItems: orderItemsData,
        isExisting: false,
        cartCleared: cartResult,
      };
    } catch (error) {
      console.error("❌ Error in createOrderWithPayment:", error);
      throw error;
    }
  }

  /**
   * Clear cart items after successful order creation
   */
  async clearCartItems(cartId) {
    try {
      console.log("🛒 Clearing cart items for cart ID:", cartId);

      if (!cartId) {
        console.log("⚠️ No cart ID provided, skipping cart clearing");
        return {
          success: true,
          deletedCount: 0,
          message: "No cart ID provided",
        };
      }

      // First, get the cart items to log what we're deleting
      const { data: cartItems, error: fetchError } = await this.supabase
        .from("cart_items")
        .select(`
          id, 
          product_id, 
          quantity, 
          selected_color, 
          selected_size, 
          delivery_option,
          products (
            id,
            name,
            price,
            sale_price
          )
        `)
        .eq("cart_id", cartId);

      if (fetchError) {
        console.error("❌ Error fetching cart items:", fetchError);
        throw new Error("Failed to fetch cart items");
      }

      console.log(
        "📦 Found cart items to delete:",
        cartItems?.length || 0,
        "items"
      );
      
      // Log detailed cart items information
      if (cartItems && cartItems.length > 0) {
        cartItems.forEach((item, index) => {
          const productPrice = item.products?.sale_price || item.products?.price || 0;
          console.log(`📦 Item ${index + 1}: ${item.products?.name} - Qty: ${item.quantity} - Price: ${productPrice} - Color: ${item.selected_color || 'N/A'} - Size: ${item.selected_size || 'N/A'}`);
        });
      }

      if (!cartItems || cartItems.length === 0) {
        console.log("ℹ️ No cart items found to delete");
        return {
          success: true,
          deletedCount: 0,
          message: "No cart items found",
        };
      }

      // Delete all cart items for this cart
      const { data: deletedItems, error: deleteError } = await this.supabase
        .from("cart_items")
        .delete()
        .eq("cart_id", cartId)
        .select("id, cart_id, product_id, quantity, selected_color, selected_size, delivery_option");

      if (deleteError) {
        console.error("❌ Error deleting cart items:", deleteError);
        throw new Error("Failed to delete cart items");
      }

      console.log(
        "✅ Cart items deleted successfully:",
        deletedItems?.length || 0,
        "items"
      );
      console.log("📦 Deleted items:", deletedItems);

      return {
        success: true,
        deletedCount: deletedItems?.length || 0,
        message: "Cart items cleared successfully",
        deletedItems: deletedItems,
        cartId: cartId,
      };
    } catch (error) {
      console.error("❌ Error in clearCartItems:", error);
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
        console.error(
          "❌ Error checking for existing order during retry:",
          error
        );
        return { success: false, error: "Failed to check existing order" };
      }

      if (existingOrder) {
        console.log("✅ Order exists, retry handled gracefully");
        return {
          success: true,
          order: existingOrder,
          message: "Order already exists from previous webhook",
        };
      }

      console.log(
        "⚠️ No order found for session during retry:",
        stripeSessionId
      );
      return { success: false, message: "No order found for session" };
    } catch (error) {
      console.error("❌ Error in handleWebhookRetry:", error);
      return { success: false, error: error.message };
    }
  }
}

export default new OrderService();
