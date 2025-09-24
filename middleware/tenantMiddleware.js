// middleware/tenantMiddleware.js
const { runWithTenant } = require("../utils/tenantContext");

module.exports = function tenantMiddleware(req, res, next) {
  const vendorCode = req.headers["x-vendor-code"]
    ? req.headers["x-vendor-code"].toLowerCase().trim()
    : null;

  if (!vendorCode) {
    return res.status(400).json({ error: "x-vendor-code header missing" });
  }

  // Run all downstream code with tenant context
  runWithTenant(vendorCode, () => next());
};
