const axios = require('axios');
const createHmac = require('create-hmac');

const MAX_RETRIES = 2;

module.exports = class Lalamove {
  constructor({
    lalamoveUrl,
    version = 'v3',
    apiSecret,
    apiKey,
    market,
    env = 'production',
    debug,
  }) {
    if (lalamoveUrl) {
      this.lalamoveUrl = lalamoveUrl;
    } else if (env === 'production') {
      this.lalamoveUrl = 'https://rest.lalamove.com';
    } else {
      this.lalamoveUrl = 'https://rest.sandbox.lalamove.com';
    }
    this.version = version;
    this.apiSecret = apiSecret;
    this.apiKey = apiKey;
    this.market = market;
    this.debug = debug;
  }

  log(data) {
    if (this.debug) {
      console.log(data); // eslint-disable-line no-console
    }
  }

  getLalamoveSignatureHash(httpMethod, serviceType, time, data = undefined) {
    const { version } = this;
    // const body = JSON.stringify(data);
    const rawSignature = `${time}\r\n${httpMethod}\r\n/${version}${serviceType}\r\n\r\n${data || ''}`;
    const signature = createHmac('sha256', this.apiSecret).update(rawSignature).digest().toString('hex');

    return signature;
  }

  async getApiHeaders(httpMethod, serviceType, data) {
    const { apiKey } = this;
    const time = new Date().getTime().toString();
    const signatureHash = this.getLalamoveSignatureHash(httpMethod, serviceType, time, data);
    const token = `${apiKey}:${time}:${signatureHash}`;

    return {
      Authorization: `hmac ${token}`,
      'Content-Type': 'application/json',
      Market: this.market,
    };
  }

  getApiUrl(path) {
    const { lalamoveUrl, version } = this;
    return `${lalamoveUrl}/${version}${path}`;
  }

  async request(payload, inRetries = 0) {
    try {
      this.log(payload);
      const { data } = await axios(payload);
      return data;
    } catch (e) {
      this.log(e);

      // TODO
      if (e.response && e.response.status === 403 && inRetries < MAX_RETRIES) {
        this.log('Retry for 403');
        // Object.assign(payload, {
        //   headers: await this.getApiHeaders(),
        // });
        return this.request(payload, inRetries + 1);
      }

      if (e.response && e.response.data && e.response.data.message) {
        throw new Error(e.response.data.message);
      }
      if (e.response && e.response.data && e.response.data.errors && e.response.data.errors[0]) {
        throw e.response.data.errors;
      }
      throw new Error(e.toJSON().message);
    }
  }

  async getCityInfo() {
    const serviceType = '/cities';
    const method = 'GET';
    const options = {
      method,
      url: this.getApiUrl(serviceType),
      headers: await this.getApiHeaders(method, serviceType),
    };
    return this.request(options);
  }

  async createQuotation(quotation) {
    const serviceType = '/quotations';
    const method = 'POST';
    const data = JSON.stringify(quotation);
    const options = {
      method,
      url: this.getApiUrl(serviceType),
      data,
      headers: await this.getApiHeaders(method, serviceType, data),
    };
    return this.request(options);
  }

  async placeOrder(order) {
    const serviceType = '/orders';
    const method = 'POST';
    const data = JSON.stringify(order);
    const options = {
      method,
      url: this.getApiUrl(serviceType),
      data,
      headers: await this.getApiHeaders(method, serviceType, data),
    };
    return this.request(options);
  }

  async cancelOrder(orderId) {
    const serviceType = `/orders/${orderId}`;
    const method = 'DELETE';
    const options = {
      method,
      url: this.getApiUrl(serviceType),
      headers: await this.getApiHeaders(method, serviceType),
    };
    return this.request(options);
  }

  async getOrderDetails(orderId) {
    const serviceType = `/orders/${orderId}`;
    const method = 'GET';
    const options = {
      method,
      url: this.getApiUrl(serviceType),
      headers: await this.getApiHeaders(method, serviceType),
    };
    return this.request(options);
  }
};
