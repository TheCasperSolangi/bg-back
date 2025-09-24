// middleware/tenantMiddleware.js
const { runWithTenant } = require("../utils/tenantContext");

module.exports = function tenantMiddleware(req, res, next) {
  const vendorCode = req.headers["x-vendor-code"]
    ? req.headers["x-vendor-code"].toLowerCase().trim()
    : null;

  const vendorSubdomain = req.headers["x-vendor-subdomain"]
    ? req.headers["x-vendor-subdomain"].toLowerCase().trim()
    : null;

  if (vendorCode) {
    // ✅ Always attach tenant context for the lifecycle of this request
    return runWithTenant(vendorCode, () => next());
  }

  if (vendorSubdomain) {
    // ⚠️ No tenant context (read-only routes like storefront browsing)
    req.vendorSubdomain = vendorSubdomain;
    return next();
  }

  // ❌ Neither provided → reject
  return res.status(400).json({ error: "x-vendor-code or x-vendor-subdomain header missing" });
};