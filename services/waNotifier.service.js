const axios = require("axios");

module.exports.sendOrderVerification = async function (order) {
  return axios.post(process.env.WA_NOTIFIER_WEBHOOK_URL, order, {
    headers: {
      "Content-Type": "application/json",
    },
    timeout: 10000,
  });
};
