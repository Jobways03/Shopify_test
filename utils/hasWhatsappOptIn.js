module.exports = function hasWhatsappOptIn(order) {
  // 1️⃣ Check order note_attributes
  if (Array.isArray(order.note_attributes)) {
    const optIn = order.note_attributes.find(
      (attr) =>
        attr.name === "whatsapp_opt_in" &&
        String(attr.value).toLowerCase() === "true"
    );
    if (optIn) return true;
  }

  // 2️⃣ Future: customer metafield (optional)
  if (order.customer?.metafields?.whatsapp_opt_in === true) {
    return true;
  }

  return true;
};
