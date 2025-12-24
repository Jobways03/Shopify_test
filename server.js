const express = require("express");
const crypto = require("crypto");
const dotenv = require("dotenv");

const connectDB = require("./db");
const OrderVerification = require("./models/OrderVerification");
const normalizePhone = require("./utils/normalizePhone");
const getItemsSummary = require("./utils/itemSummary");

dotenv.config();
connectDB();

const app = express();

// Shopify requires RAW BODY for HMAC validation
app.post(
  "/webhooks/orders",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    try {
      const hmac = req.headers["x-shopify-hmac-sha256"];
      const secret = process.env.SHOPIFY_WEBHOOK_SECRET;

      const generatedHash = crypto
        .createHmac("sha256", secret)
        .update(req.body, "utf8")
        .digest("base64");

      if (generatedHash !== hmac) {
        console.log("❌ HMAC validation failed");
        return res.status(401).send("Unauthorized");
      }

      const orderData = JSON.parse(req.body.toString());

      console.log("🔥 New Order Received:", orderData.name);

      // ---- Extract required fields ----
      const phoneRaw =
        orderData.shipping_address?.phone ||
        orderData.billing_address?.phone ||
        orderData.customer?.default_address?.phone;

      if (!phoneRaw) {
        console.log("⚠️ No phone number found, skipping verification");
        return res.status(200).send("OK");
      }

      const phone = normalizePhone(phoneRaw);

      const verificationPayload = {
        shopifyOrderId: String(orderData.id),
        adminGraphqlId: orderData.admin_graphql_api_id,
        orderNumber: orderData.name,
        phone,
        totalAmount: Number(orderData.total_price),
        currency: orderData.currency,
        paymentMethod: orderData.payment_gateway_names?.[0] || "UNKNOWN",
        itemsSummary: getItemsSummary(orderData.line_items),
        city: orderData.shipping_address.city,
        state: orderData.shipping_address.province,
        pincode: orderData.shipping_address.zip,
        verificationStatus: "PENDING",
      };

      // ---- Idempotency check ----
      const existing = await OrderVerification.findOne({
        shopifyOrderId: verificationPayload.shopifyOrderId,
      });

      if (existing) {
        console.log("ℹ️ Verification already exists, skipping");
        return res.status(200).send("OK");
      }

      await OrderVerification.create(verificationPayload);

      console.log(
        "✅ Verification record stored:",
        verificationPayload.orderNumber
      );

      res.status(200).send("OK");
    } catch (err) {
      console.error("❌ Webhook processing error:", err);
      res.status(500).send("Server Error");
    }
  }
);

app.listen(process.env.PORT, () => {
  console.log(`🚀 Server running on port ${process.env.PORT}`);
});
