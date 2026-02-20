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
 * DEV ONLY – Delete a stored order so the webhook can be re-tested.
 * Usage: DELETE /dev/orders/:shopifyOrderId
 */
if (process.env.NODE_ENV === "development") {
  app.delete("/dev/orders/:id", async (req, res) => {
    const result = await OrderVerification.deleteOne({
      shopifyOrderId: req.params.id,
    });
    if (result.deletedCount) {
      console.log("🗑️ Deleted order:", req.params.id);
      return res.json({ deleted: true });
    }
    return res.status(404).json({ deleted: false, message: "Not found" });
  });
}

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

      console.log(order);

      // 🔒 Ignore non-order / malformed payloads
      if (!order || !order.id || !order.name) {
        console.log("⚠️ Non-order webhook received. Ignoring.");
        return res.status(200).send("OK");
      }

      console.log("🔥 Order received:", order.name);

      /* -------------------- 3. PHONE EXTRACTION -------------------- */
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

      /* -------------------- 4. IDEMPOTENCY CHECK -------------------- */
      const alreadyExists = await OrderVerification.findOne({
        shopifyOrderId: String(order.id),
      });

      if (alreadyExists) {
        console.log("ℹ️ Order already processed. Skipping.");
        return res.status(200).send("OK");
      }

      /* -------------------- 5. BUILD & SAVE VERIFICATION RECORD -------------------- */
      const customerName =
        order.shipping_address?.name ||
        order.billing_address?.name ||
        `${order.customer?.first_name || ""} ${order.customer?.last_name || ""}`.trim() ||
        "Customer";

      const verificationPayload = {
        shopifyOrderId: String(order.id),
        orderNumber: order.name,
        customerName,
        email: order.email || order.contact_email || "",
        phone,
        totalAmount: Number(order.total_price),
        currency: order.currency,
        paymentMethod: order.payment_gateway_names?.[0] || "UNKNOWN",
        itemsSummary: getItemsSummary(order.line_items),
        shippingAddress: {
          address: order.shipping_address?.address1 || "",
          city: order.shipping_address?.city || "",
          state: order.shipping_address?.province || "",
          pincode: order.shipping_address?.zip || "",
          country: order.shipping_address?.country || "",
        },
        verificationStatus: "PENDING",
      };

      console.log("✅ Verification payload:", verificationPayload);

      await OrderVerification.create(verificationPayload);
      console.log("✅ Verification record stored:", order.name);

      /* -------------------- 6. WHATSAPP OPT-IN CHECK -------------------- */
      if (!hasWhatsappOptIn(order)) {
        console.log("🚫 WhatsApp opt-in not found. Message not sent.");
        return res.status(200).send("OK");
      }

      /* -------------------- 7. SEND FULL ORDER TO WA NOTIFIER -------------------- */
      try {
        await sendOrderVerification(order);

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
