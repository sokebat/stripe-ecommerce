import { Resend } from 'resend';

class EmailService {
  constructor() {
    this.resend = new Resend(process.env.RESEND_API_KEY );
  }

  /**
   * Send order confirmation email
   */
  async sendOrderConfirmationEmail(orderData, userEmail, userName) {
    try {
      const { order, orderItems } = orderData;
      
      const emailHtml = this.generateOrderConfirmationTemplate(order, orderItems, userName);
      
      const result = await this.resend.emails.send({
        from: 'orders@yourstore.com',
        to: userEmail,
        subject: `Order Confirmation #${order.id.slice(0, 8)}`,
        html: emailHtml,
      });

      console.log('✅ Order confirmation email sent successfully');
      return { success: true, messageId: result.data?.id };
    } catch (error) {
      console.error('❌ Error sending order confirmation email:', error);
      throw error;
    }
  }

  /**
   * Generate beautiful order confirmation email template
   */
  generateOrderConfirmationTemplate(order, orderItems, userName) {
    const orderNumber = order.id.slice(0, 8).toUpperCase();
    const orderDate = new Date(order.created_at).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    const itemsHtml = orderItems.map(item => `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 16px 0;">
          <div style="display: flex; align-items: center;">
            <div style="width: 60px; height: 60px; background: #f3f4f6; border-radius: 8px; margin-right: 16px; display: flex; align-items: center; justify-content: center;">
              <span style="font-size: 24px;">👕</span>
            </div>
            <div style="flex: 1;">
              <h3 style="margin: 0 0 4px 0; font-size: 16px; font-weight: 600; color: #111827;">${item.product_name || 'Product'}</h3>
              <p style="margin: 0; font-size: 14px; color: #6b7280;">
                Qty: ${item.quantity} | 
                ${item.selected_color ? `Color: ${item.selected_color}` : ''} 
                ${item.selected_size ? `| Size: ${item.selected_size}` : ''}
              </p>
            </div>
            <div style="text-align: right;">
              <p style="margin: 0; font-size: 16px; font-weight: 600; color: #111827;">₹${item.price}</p>
            </div>
          </div>
        </td>
      </tr>
    `).join('');

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Order Confirmation</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f9fafb; }
          .container { max-width: 600px; margin: 0 auto; background: white; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 30px; text-align: center; }
          .content { padding: 40px 30px; }
          .order-summary { background: #f8fafc; border-radius: 12px; padding: 24px; margin: 24px 0; }
          .status-badge { display: inline-block; background: #10b981; color: white; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
          .total-section { border-top: 2px solid #e5e7eb; margin-top: 24px; padding-top: 24px; }
          .footer { background: #f3f4f6; padding: 30px; text-align: center; color: #6b7280; font-size: 14px; }
          .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 16px 0; }
          @media (max-width: 600px) { .container { margin: 0; } .header, .content, .footer { padding: 20px; } }
        </style>
      </head>
      <body>
        <div class="container">
          <!-- Header -->
          <div class="header">
            <h1 style="margin: 0; font-size: 28px; font-weight: 700;">🎉 Order Confirmed!</h1>
            <p style="margin: 16px 0 0 0; font-size: 16px; opacity: 0.9;">Thank you for your purchase, ${userName}!</p>
          </div>

          <!-- Content -->
          <div class="content">
            <div style="text-align: center; margin-bottom: 32px;">
              <span class="status-badge">✅ Order Confirmed</span>
            </div>

            <!-- Order Details -->
            <div style="background: #f8fafc; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
              <h2 style="margin: 0 0 16px 0; font-size: 20px; color: #111827;">Order Details</h2>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; font-size: 14px;">
                <div>
                  <p style="margin: 0; color: #6b7280;">Order Number</p>
                  <p style="margin: 4px 0 0 0; font-weight: 600; color: #111827;">#${orderNumber}</p>
                </div>
                <div>
                  <p style="margin: 0; color: #6b7280;">Order Date</p>
                  <p style="margin: 4px 0 0 0; font-weight: 600; color: #111827;">${orderDate}</p>
                </div>
                <div>
                  <p style="margin: 0; color: #6b7280;">Payment Status</p>
                  <p style="margin: 4px 0 0 0; font-weight: 600; color: #10b981;">Paid</p>
                </div>
                <div>
                  <p style="margin: 0; color: #6b7280;">Delivery Method</p>
                  <p style="margin: 4px 0 0 0; font-weight: 600; color: #111827;">Standard Shipping</p>
                </div>
              </div>
            </div>

            <!-- Order Items -->
            <div style="margin-bottom: 24px;">
              <h2 style="margin: 0 0 16px 0; font-size: 20px; color: #111827;">Items Ordered</h2>
              <div style="background: white; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
                <table style="width: 100%; border-collapse: collapse;">
                  <thead style="background: #f9fafb;">
                    <tr>
                      <th style="padding: 16px; text-align: left; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb;">Item</th>
                      <th style="padding: 16px; text-align: right; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb;">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${itemsHtml}
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Order Summary -->
            <div class="order-summary">
              <h2 style="margin: 0 0 16px 0; font-size: 20px; color: #111827;">Order Summary</h2>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span style="color: #6b7280;">Subtotal</span>
                <span style="font-weight: 600;">₹${order.total_amount}</span>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span style="color: #6b7280;">Shipping</span>
                <span style="font-weight: 600;">Free</span>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span style="color: #6b7280;">Tax</span>
                <span style="font-weight: 600;">₹0</span>
              </div>
              <div class="total-section">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span style="font-size: 18px; font-weight: 700; color: #111827;">Total</span>
                  <span style="font-size: 18px; font-weight: 700; color: #111827;">₹${order.total_amount}</span>
                </div>
              </div>
            </div>

            <!-- Shipping Address -->
            ${order.shipping_address ? `
            <div style="background: #f8fafc; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
              <h2 style="margin: 0 0 16px 0; font-size: 20px; color: #111827;">Shipping Address</h2>
              <p style="margin: 0; color: #374151; line-height: 1.6;">${order.shipping_address}</p>
            </div>
            ` : ''}

            <!-- Next Steps -->
            <div style="background: #eff6ff; border: 1px solid #dbeafe; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
              <h2 style="margin: 0 0 16px 0; font-size: 20px; color: #1e40af;">What's Next?</h2>
              <div style="display: flex; align-items: center; margin-bottom: 12px;">
                <span style="background: #3b82f6; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; margin-right: 12px;">1</span>
                <span style="color: #374151;">We'll process your order within 24 hours</span>
              </div>
              <div style="display: flex; align-items: center; margin-bottom: 12px;">
                <span style="background: #3b82f6; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; margin-right: 12px;">2</span>
                <span style="color: #374151;">You'll receive shipping confirmation via email</span>
              </div>
              <div style="display: flex; align-items: center;">
                <span style="background: #3b82f6; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; margin-right: 12px;">3</span>
                <span style="color: #374151;">Your order will be delivered in 3-5 business days</span>
              </div>
            </div>

            <!-- CTA Buttons -->
            <div style="text-align: center; margin: 32px 0;">
              <a href="#" class="button">Track Your Order</a>
              <br>
              <a href="#" style="color: #6b7280; text-decoration: none; font-size: 14px;">View Order Details</a>
            </div>
          </div>

          <!-- Footer -->
          <div class="footer">
            <p style="margin: 0 0 16px 0;">Thank you for choosing us!</p>
            <p style="margin: 0 0 16px 0; font-size: 12px;">
              If you have any questions, please contact us at support@yourstore.com
            </p>
            <div style="margin-top: 24px;">
              <a href="#" style="color: #6b7280; text-decoration: none; margin: 0 8px; font-size: 12px;">Privacy Policy</a>
              <a href="#" style="color: #6b7280; text-decoration: none; margin: 0 8px; font-size: 12px;">Terms of Service</a>
              <a href="#" style="color: #6b7280; text-decoration: none; margin: 0 8px; font-size: 12px;">Unsubscribe</a>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Send test email
   */
  async sendTestEmail() {
    try {
      const result = await this.resend.emails.send({
        from: 'onboarding@resend.dev',
        to: 'botoverloadoffice@gmail.com',
        subject: 'Test Email from Order Service',
        html: '<p>This is a test email from the order service!</p>'
      });

      console.log('✅ Test email sent successfully');
      return { success: true, messageId: result.data?.id };
    } catch (error) {
      console.error('❌ Error sending test email:', error);
      throw error;
    }
  }
}

export default new EmailService();