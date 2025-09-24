// plugins/vendorScopePlugin.js
const { getTenant } = require("../utils/tenantContext");

module.exports = function vendorScopePlugin(schema) {
  // Auto-scope queries
  schema.pre(/^find/, function (next) {
    const tenant = getTenant();
    if (tenant) {
      this.where({ vendor_code: tenant });
    }
    next();
  });

  // Auto-inject vendor_code on save
  schema.pre("save", function (next) {
    const tenant = getTenant();
    if (this.isNew && tenant) {
      this.vendor_code = tenant;
    }
    next();
  });

  // Hide vendor_code in responses
  schema.set("toJSON", {
    transform: (doc, ret) => {
      delete ret.vendor_code;
      return ret;
    }
  });
  schema.set("toObject", {
    transform: (doc, ret) => {
      delete ret.vendor_code;
      return ret;
    }
  });
  // In vendorScopePlugin.js
schema.pre(/^update/, function (next) {
  const tenant = getTenant();
  if (tenant) {
    this.where({ vendor_code: tenant });
  }
  next();
});

schema.pre(/^delete/, function (next) {
  const tenant = getTenant();
  if (tenant) {
    this.where({ vendor_code: tenant });
  }
  next();
});
};