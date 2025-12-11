const express = require("express")
const crypto = require("crypto");
const dotenv = require("dotenv");

dotenv.config();

const app = express();

// Shopify requires RAW BODY for HMAC validation
app.post(
  "/webhooks/orders",
  express.raw({ type: "application/json" }),
  (req, res) => {
    try {
      const hmac = req.headers["x-shopify-hmac-sha256"];
      const secret = process.env.SHOPIFY_WEBHOOK_SECRET;

      // Validate Shopify signature
      const generatedHash = crypto
        .createHmac("sha256", secret)
        .update(req.body, "utf8")
        .digest("base64");

      if (generatedHash !== hmac) {
        console.log("❌ HMAC validation failed");
        return res.status(401).send("Unauthorized");
      }

      // Convert raw buffer to JSON
      const orderData = JSON.parse(req.body.toString());

      console.log("🔥 New Order Received from Shopify:");
      console.log(orderData); // This is your full order JSON

      // Respond OK to Shopify
      res.status(200).send("OK");
    } catch (err) {
      console.log("Error processing webhook:", err);
      res.status(500).send("Server Error");
    }
  }
);

app.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`);
});
