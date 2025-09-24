// utils/tenantContext.js
const { AsyncLocalStorage } = require("async_hooks");

const asyncLocalStorage = new AsyncLocalStorage();

module.exports = {
  runWithTenant(vendorCode, callback) {
    return asyncLocalStorage.run({ vendorCode }, callback);
  },
  getTenant() {
    return asyncLocalStorage.getStore()?.vendorCode;
  }
};