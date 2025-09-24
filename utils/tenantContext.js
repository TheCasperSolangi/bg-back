// utils/tenantContext.js
const { AsyncLocalStorage } = require("async_hooks");

const asyncLocalStorage = new AsyncLocalStorage();

module.exports = {
  runWithTenant(vendorCode, callback) {
    // Use enterWith so context survives async/await boundaries
    asyncLocalStorage.enterWith({ vendorCode });
    return callback();
  },
  getTenant() {
    return asyncLocalStorage.getStore()?.vendorCode;
  }
};