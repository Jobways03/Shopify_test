const mongoose = require("mongoose");

const OrderVerificationSchema = new mongoose.Schema(
  {
    shopifyOrderId: {
      type: String,
      required: true,
      unique: true,
    },

    orderNumber: {
      type: String,
      required: true,
    },

    customerName: {
      type: String,
      required: true,
    },

    email: {
      type: String,
      default: "",
    },

    phone: {
      type: String,
      required: true,
    },

    totalAmount: {
      type: Number,
      required: true,
    },

    currency: {
      type: String,
      required: true,
    },

    paymentMethod: {
      type: String,
      required: true,
    },

    itemsSummary: {
      type: String,
      required: true,
    },

    shippingAddress: {
      address: { type: String, default: "" },
      city: { type: String, default: "" },
      state: { type: String, default: "" },
      pincode: { type: String, default: "" },
      country: { type: String, default: "" },
    },

    verificationStatus: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED", "NO_REPLY"],
      default: "PENDING",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("OrderVerification", OrderVerificationSchema);
