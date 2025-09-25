const { getTenant } = require("../utils/tenantContext");

module.exports = function vendorScopePlugin(schema) {
  // Auto-scope queries by vendor_code
  schema.pre(/^find/, function (next) {
    const tenant = getTenant();
    if (tenant) {
      this.where({ vendor_code: tenant });
    }
    next();
  });

    schema.pre("save", function (next) {
      const tenant = getTenant();
      if (this.isNew && tenant) {
        this.vendor_code = tenant; // auto injected
      }
      next();
    });

  // Auto-scope updates
  schema.pre(/^update/, function (next) {
    const tenant = getTenant();
    if (tenant) {
      this.where({ vendor_code: tenant });
    }
    next();
  });

  // Auto-scope deletes
  schema.pre(/^delete/, function (next) {
    const tenant = getTenant();
    if (tenant) {
      this.where({ vendor_code: tenant });
    }
    next();
  });

  // 🔒 Hide vendor_code and vendor_subdomain in all responses
  const hiddenFields = ["password"];

  schema.set("toJSON", {
    transform: (doc, ret) => {
      hiddenFields.forEach((f) => delete ret[f]);
      return ret;
    }
  });

  schema.set("toObject", {
    transform: (doc, ret) => {
      hiddenFields.forEach((f) => delete ret[f]);
      return ret;
    }
  });
};
