const mongoose = require("mongoose");

const OrderVerificationSchema = new mongoose.Schema(
  {
    shopifyOrderId: {
      type: String,
      required: true,
      unique: true,
    },

    adminGraphqlId: {
      type: String,
      default: "",
    },

    orderNumber: {
      type: String,
      required: true,
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

    city: {
      type: String,
      required: true,
    },

    state: {
      type: String,
      required: true,
    },

    pincode: {
      type: String,
      required: true,
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
