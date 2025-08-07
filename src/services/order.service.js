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

      const { data: existingOrder, error: checkError } = await this.supabase
        .from("orders")
        .select("id, status, total_amount")
        .eq("stripe_session_id", stripeSessionId)
        .maybeSingle();

      if (checkError) {
        throw new Error("Failed to check existing order");
      }

      if (existingOrder) {
        // Return existing order details
        return {
          success: true,
          order: existingOrder,
          message: "Order already exists",
          isExisting: true,
        };
      }

      const { data: cartItems, error: fetchError } = await this.supabase
        .from("cart_items")
        .select(
          `
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
        `
        )
        .eq("cart_id", cartid);

      if (fetchError) {
        throw new Error("Failed to fetch cart items");
      }

      if (!cartItems || cartItems.length === 0) {
        throw new Error("No cart items found");
      }

      // Calculate total amount from cart items
      const totalAmount = cartItems.reduce((sum, item) => {
        // Use sale_price if available, otherwise use regular price
        const productPrice =
          item.products?.sale_price || item.products?.price || 0;
        const itemTotal = productPrice * item.quantity;

        return sum + itemTotal;
      }, 0);

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
            // Fetch the existing order
            const { data: existingOrderData, error: fetchError } =
              await this.supabase
                .from("orders")
                .select("*")
                .eq("stripe_session_id", stripeSessionId)
                .single();

            if (fetchError) {
              throw new Error(
                "Failed to fetch existing order after duplicate key error"
              );
            }

            return {
              success: true,
              order: existingOrderData,
              message: "Order already exists (handled duplicate key)",
              isExisting: true,
            };
          }

          throw new Error("Failed to create order in database");
        }

        order = newOrder;
      } catch (insertError) {
        throw insertError;
      }

      // Create order items from cart items

      const orderItems = cartItems.map((cartItem) => {
        // Use sale_price if available, otherwise use regular price
        const productPrice =
          cartItem.products?.sale_price || cartItem.products?.price || 0;

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

      const { data: orderItemsData, error: itemsError } = await this.supabase
        .from("order_items")
        .insert(orderItems)
        .select();

      if (itemsError) {
        throw new Error("Failed to create order items in database");
      }

      const cartResult = await this.clearCartItems(cartid);

      return {
        success: true,
        order: order,
        orderItems: orderItemsData,
        isExisting: false,
        cartCleared: cartResult,
      };
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  /**
   * Clear cart items after successful order creation
   */
  async clearCartItems(cartId) {
    try {
      if (!cartId) {
        return {
          success: true,
          deletedCount: 0,
          message: "No cart ID provided",
        };
      }

      // First, get the cart items to log what we're deleting
      const { data: cartItems, error: fetchError } = await this.supabase
        .from("cart_items")
        .select(
          `
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
        `
        )
        .eq("cart_id", cartId);

      if (fetchError) {
        throw new Error("Failed to fetch cart items");
      }

      // Log detailed cart items information
      if (cartItems && cartItems.length > 0) {
        cartItems.forEach((item, index) => {
          const productPrice =
            item.products?.sale_price || item.products?.price || 0;
        });
      }

      if (!cartItems || cartItems.length === 0) {
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
        .select(
          "id, cart_id, product_id, quantity, selected_color, selected_size, delivery_option"
        );

      if (deleteError) {
        throw new Error("Failed to delete cart items");
      }

      return {
        success: true,
        deletedCount: deletedItems?.length || 0,
        message: "Cart items cleared successfully",
        deletedItems: deletedItems,
        cartId: cartId,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Handle webhook retries gracefully
   * This method ensures idempotency for webhook processing
   */
  async handleWebhookRetry(stripeSessionId) {
    try {
      const { data: existingOrder, error } = await this.supabase
        .from("orders")
        .select("id, status, total_amount, created_at")
        .eq("stripe_session_id", stripeSessionId)
        .maybeSingle();

      if (error) {
        return { success: false, error: "Failed to check existing order" };
      }

      if (existingOrder) {
        return {
          success: true,
          order: existingOrder,
          message: "Order already exists from previous webhook",
        };
      }

      return { success: false, message: "No order found for session" };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

export default new OrderService();
