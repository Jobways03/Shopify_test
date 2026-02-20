const express = require("express");
const crypto = require("crypto");
const dotenv = require("dotenv");

const connectDB = require("./database/db");
const OrderVerification = require("./models/OrderVerification");
const normalizePhone = require("./utils/normalizePhone");
const getItemsSummary = require("./utils/itemSummary");
const hasWhatsappOptIn = require("./utils/hasWhatsappOptIn");
const { sendOrderVerification } = require("./services/waNotifier.service");

dotenv.config();
connectDB();

const app = express();

/**
 * Health check
 */
app.get("/health", (req, res) => {
  res.send("OK");
});

/**
 * Shopify Orders Webhook
 */
app.post(
  "/webhooks/orders",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    try {
      /* -------------------- 1. VERIFY HMAC -------------------- */
      const hmacHeader = req.headers["x-shopify-hmac-sha256"];
      const secret = process.env.SHOPIFY_WEBHOOK_SECRET;

      const calculatedHmac = crypto
        .createHmac("sha256", secret)
        .update(req.body, "utf8")
        .digest("base64");

      const isDev = process.env.NODE_ENV === "development";

      if (!isDev && calculatedHmac !== hmacHeader) {
        console.error("❌ Shopify HMAC validation failed");
        return res.status(401).send("Unauthorized");
      }

      /* -------------------- 2. PARSE PAYLOAD -------------------- */
      const order = JSON.parse(req.body.toString());

      // 🔒 Ignore non-order / malformed payloads
      if (!order || !order.id || !order.name) {
        console.log("⚠️ Non-order webhook received. Ignoring.");
        return res.status(200).send("OK");
      }

      console.log("🔥 Order received:", order.name);

      /* -------------------- 3. EXTRACT FIRST NAME -------------------- */
      const firstName =
        order.customer?.first_name ||
        order.shipping_address?.first_name ||
        order.billing_address?.first_name ||
        "Customer";

      /* -------------------- 4. PHONE EXTRACTION -------------------- */
      const phoneRaw =
        order.customer?.phone ||
        order.shipping_address?.phone ||
        order.billing_address?.phone ||
        order.customer?.default_address?.phone;

      if (!phoneRaw) {
        console.log("⚠️ No phone number found. Skipping WhatsApp.");
        return res.status(200).send("OK");
      }

      const phone = normalizePhone(phoneRaw);

      /* -------------------- 5. IDEMPOTENCY CHECK -------------------- */
      const alreadyExists = await OrderVerification.findOne({
        shopifyOrderId: String(order.id),
      });

      if (alreadyExists) {
        console.log("ℹ️ Order already processed. Skipping.");
        return res.status(200).send("OK");
      }

      /* -------------------- 6. BUILD VERIFICATION PAYLOAD -------------------- */
      const verificationPayload = {
        shopifyOrderId: String(order.id),
        adminGraphqlId: order.admin_graphql_api_id,
        orderNumber: order.name,
        phone,
        totalAmount: Number(order.total_price),
        currency: order.currency,
        paymentMethod: order.payment_gateway_names?.[0] || "UNKNOWN",
        itemsSummary: getItemsSummary(order.line_items),
        city: order.shipping_address?.city || "",
        state: order.shipping_address?.province || "",
        pincode: order.shipping_address?.zip || "",
        verificationStatus: "PENDING",
      };

      console.log("✅ Verification payload:", verificationPayload);

      await OrderVerification.create(verificationPayload);
      console.log("✅ Verification record stored:", order.name);

      /* -------------------- 7. WHATSAPP OPT-IN CHECK -------------------- */
      if (!hasWhatsappOptIn(order)) {
        console.log("🚫 WhatsApp opt-in not found. Message not sent.");
        return res.status(200).send("OK");
      }

      /* -------------------- 8. SEND TO WA NOTIFIER -------------------- */
      try {
        await sendOrderVerification({
          phone,
          customerFirstName: firstName,
          orderId: verificationPayload.shopifyOrderId,
          orderNumber: verificationPayload.orderNumber,
          totalAmount: verificationPayload.totalAmount,
        });

        console.log("📲 WA Notifier triggered successfully");
      } catch (waErr) {
        console.error(
          "❌ WA Notifier error:",
          waErr.response?.data || waErr.message
        );
      }

      return res.status(200).send("OK");
    } catch (err) {
      console.error("❌ Webhook processing error:", err);
      return res.status(500).send("Server Error");
    }
  }
);

/* -------------------- SERVER START -------------------- */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
