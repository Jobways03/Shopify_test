const axios = require("axios");

const WA_NOTIFIER_URL = process.env.WA_NOTIFIER_WEBHOOK_URL;

module.exports.sendOrderVerification = async function ({
  phone,
  customerFirstName,
  orderId,
  orderNumber,
  totalAmount,
}) {
  const payload = {
    phone,
    customer_first_name: customerFirstName,
    id: orderId,
    total_price: totalAmount,
    order_number: orderNumber,
  };

  return axios.post(WA_NOTIFIER_URL, payload, {
    headers: {
      "Content-Type": "application/json",
    },
    timeout: 10000,
  });
};
