module.exports = function getItemsSummary(lineItems = []) {
  return lineItems.map((item) => `${item.name} × ${item.quantity}`).join(", ");
};
