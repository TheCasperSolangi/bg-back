const axios = require('axios');
const crypto = require('crypto');

class LalamoveService {
  constructor() {
    this.baseURL = process.env.LALAMOVE_BASE_URL || 'https://rest.sandbox.lalamove.com';
    this.apiKey = process.env.LALAMOVE_API_KEY;
    this.secret = process.env.LALAMOVE_SECRET;
    this.market = process.env.LALAMOVE_MARKET || 'SG'; // Changed from SG_SIN to SG
  }

  // Generate authentication headers for API v3
  generateAuthHeaders(method, path, body = '') {
    const timestamp = Date.now().toString();
    const rawSignature = `${timestamp}\r\n${method}\r\n${path}\r\n\r\n${body}`;
    
    const signature = crypto
      .createHmac('sha256', this.secret)
      .update(rawSignature)
      .digest('hex');

    return {
      'Market': this.market, // Changed from X-LLM-Market to Market
      'Authorization': `hmac ${this.apiKey}:${timestamp}:${signature}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Request-ID': this.generateRequestId() // Added Request-ID for tracking
    };
  }

  // Generate a unique request ID (nonce)
  generateRequestId() {
    return crypto.randomUUID();
  }

  // Get quotation for delivery
  async getQuotation(quotationData) {
    try {
      const path = '/v3/quotations';
      const method = 'POST';
      
      const headers = this.generateAuthHeaders(method, path, JSON.stringify(quotationData));
      
      const response = await axios.post(`${this.baseURL}${path}`, quotationData, { headers });
      return response.data;
    } catch (error) {
      console.error('Quotation error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || error.response?.data?.errors?.[0]?.message || 'Failed to get quotation');
    }
  }

  // Get quotation details
  async getQuotationDetails(quotationId) {
    try {
      const path = `/v3/quotations/${quotationId}`;
      const method = 'GET';
      
      const headers = this.generateAuthHeaders(method, path);
      
      const response = await axios.get(`${this.baseURL}${path}`, { headers });
      return response.data;
    } catch (error) {
      console.error('Quotation details error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || error.response?.data?.errors?.[0]?.message || 'Failed to get quotation details');
    }
  }

  // Place an order
  async placeOrder(orderData) {
    try {
      const path = '/v3/orders';
      const method = 'POST';
      
      const headers = this.generateAuthHeaders(method, path, JSON.stringify(orderData));
      
      const response = await axios.post(`${this.baseURL}${path}`, orderData, { headers });
      return response.data;
    } catch (error) {
      console.error('Order placement error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || error.response?.data?.errors?.[0]?.message || 'Failed to place order');
    }
  }

  // Get order details
  async getOrderDetails(orderId) {
    try {
      const path = `/v3/orders/${orderId}`;
      const method = 'GET';
      
      const headers = this.generateAuthHeaders(method, path);
      
      const response = await axios.get(`${this.baseURL}${path}`, { headers });
      return response.data;
    } catch (error) {
      console.error('Order details error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || error.response?.data?.errors?.[0]?.message || 'Failed to get order details');
    }
  }

  // Get driver details
  async getDriverDetails(orderId, driverId) {
    try {
      const path = `/v3/orders/${orderId}/drivers/${driverId}`;
      const method = 'GET';
      
      const headers = this.generateAuthHeaders(method, path);
      
      const response = await axios.get(`${this.baseURL}${path}`, { headers });
      return response.data;
    } catch (error) {
      console.error('Driver details error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || error.response?.data?.errors?.[0]?.message || 'Failed to get driver details');
    }
  }

  // Cancel an order
  async cancelOrder(orderId) {
    try {
      const path = `/v3/orders/${orderId}`;
      const method = 'DELETE';
      
      const headers = this.generateAuthHeaders(method, path);
      
      const response = await axios.delete(`${this.baseURL}${path}`, { headers });
      return response.status === 204 ? { success: true, message: 'Order cancelled successfully' } : response.data;
    } catch (error) {
      console.error('Cancel order error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || error.response?.data?.errors?.[0]?.message || 'Failed to cancel order');
    }
  }

  // Edit an order
  async editOrder(orderId, editData) {
    try {
      const path = `/v3/orders/${orderId}`;
      const method = 'PATCH';
      
      const headers = this.generateAuthHeaders(method, path, JSON.stringify(editData));
      
      const response = await axios.patch(`${this.baseURL}${path}`, editData, { headers });
      return response.data;
    } catch (error) {
      console.error('Edit order error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || error.response?.data?.errors?.[0]?.message || 'Failed to edit order');
    }
  }

  // Add priority fee (tip)
  async addPriorityFee(orderId, priorityFee) {
    try {
      const path = `/v3/orders/${orderId}/priority-fee`;
      const method = 'POST';
      const requestData = { data: { priorityFee: priorityFee.toString() } };
      
      const headers = this.generateAuthHeaders(method, path, JSON.stringify(requestData));
      
      const response = await axios.post(`${this.baseURL}${path}`, requestData, { headers });
      return response.data;
    } catch (error) {
      console.error('Add priority fee error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || error.response?.data?.errors?.[0]?.message || 'Failed to add priority fee');
    }
  }

  // Change driver
  async changeDriver(orderId, driverId, reason) {
    try {
      const path = `/v3/orders/${orderId}/drivers/${driverId}`;
      const method = 'DELETE';
      const requestData = { data: { reason } };
      
      const headers = this.generateAuthHeaders(method, path, JSON.stringify(requestData));
      
      const response = await axios.delete(`${this.baseURL}${path}`, { 
        headers,
        data: requestData 
      });
      return response.status === 204 ? { success: true, message: 'Driver changed successfully' } : response.data;
    } catch (error) {
      console.error('Change driver error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || error.response?.data?.errors?.[0]?.message || 'Failed to change driver');
    }
  }

  // Get city information (service types, special requests)
  async getCityInfo() {
    try {
      const path = '/v3/cities';
      const method = 'GET';
      
      const headers = this.generateAuthHeaders(method, path);
      
      const response = await axios.get(`${this.baseURL}${path}`, { headers });
      return response.data;
    } catch (error) {
      console.error('City info error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || error.response?.data?.errors?.[0]?.message || 'Failed to get city information');
    }
  }

  // Setup webhook
  async setupWebhook(webhookUrl) {
    try {
      const path = '/v3/webhook';
      const method = 'PATCH';
      const requestData = { data: { url: webhookUrl } };
      
      const headers = this.generateAuthHeaders(method, path, JSON.stringify(requestData));
      
      const response = await axios.patch(`${this.baseURL}${path}`, requestData, { headers });
      return response.data;
    } catch (error) {
      console.error('Setup webhook error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || error.response?.data?.errors?.[0]?.message || 'Failed to setup webhook');
    }
  }

  // Helper method to create a basic quotation payload
  createQuotationPayload(stops, serviceType = 'MOTORCYCLE', options = {}) {
    // Validate minimum stops requirement
    if (!stops || stops.length < 2) {
      throw new Error('At least 2 stops are required (pickup + 1 drop-off). Maximum 16 stops allowed.');
    }

    // Validate maximum stops
    if (stops.length > 16) {
      throw new Error('Maximum 16 stops allowed.');
    }

    return {
      data: {
        serviceType,
        language: options.language || 'en_SG',
        stops: stops.map(stop => {
          // Validate stop structure
          if (!stop.coordinates || !stop.coordinates.lat || !stop.coordinates.lng) {
            throw new Error('Each stop must have coordinates with lat and lng');
          }
          if (!stop.address) {
            throw new Error('Each stop must have an address');
          }

          return {
            coordinates: {
              lat: stop.coordinates.lat.toString(),
              lng: stop.coordinates.lng.toString()
            },
            address: stop.address
          };
        }),
        ...(options.scheduleAt && { scheduleAt: options.scheduleAt }),
        ...(options.specialRequests && { specialRequests: options.specialRequests }),
        ...(options.isRouteOptimized && { isRouteOptimized: options.isRouteOptimized }),
        ...(options.item && { item: options.item })
      }
    };
  }

  // Helper method to create a basic order payload
  createOrderPayload(quotationId, sender, recipients, options = {}) {
    return {
      data: {
        quotationId,
        sender: {
          stopId: sender.stopId,
          name: sender.name,
          phone: sender.phone
        },
        recipients: recipients.map(recipient => ({
          stopId: recipient.stopId,
          name: recipient.name,
          phone: recipient.phone,
          ...(recipient.remarks && { remarks: recipient.remarks })
        })),
        ...(options.isPODEnabled && { isPODEnabled: options.isPODEnabled }),
        ...(options.partner && { partner: options.partner }),
        ...(options.metadata && { metadata: options.metadata })
      }
    };
  }

  // Get order status (alias for getOrderDetails for backward compatibility)
  async getOrderStatus(orderId) {
    return this.getOrderDetails(orderId);
  }

  // Get driver location (now included in driver details in v3)
  async getDriverLocation(orderId, driverId) {
    try {
      const driverDetails = await this.getDriverDetails(orderId, driverId);
      return {
        data: {
          coordinates: driverDetails.data.coordinates
        }
      };
    } catch (error) {
      console.error('Driver location error:', error.message);
      throw new Error('Failed to get driver location');
    }
  }

  // Validation method for quotation data
  validateQuotationData(data) {
    if (!data || !data.data) {
      throw new Error('Invalid quotation data structure. Expected { data: { ... } }');
    }

    const { stops, serviceType } = data.data;

    if (!stops || !Array.isArray(stops)) {
      throw new Error('Stops must be an array');
    }

    if (stops.length < 2) {
      throw new Error('At least 2 stops are required (pickup + 1 drop-off)');
    }

    if (stops.length > 16) {
      throw new Error('Maximum 16 stops allowed');
    }

    if (!serviceType) {
      throw new Error('serviceType is required');
    }

    stops.forEach((stop, index) => {
      if (!stop.coordinates || typeof stop.coordinates.lat !== 'string' || typeof stop.coordinates.lng !== 'string') {
        throw new Error(`Stop ${index + 1}: coordinates.lat and coordinates.lng must be strings`);
      }
      if (!stop.address || typeof stop.address !== 'string') {
        throw new Error(`Stop ${index + 1}: address is required and must be a string`);
      }
    });

    return true;
  }

  // Example method to create a simple delivery quotation
  async createSimpleDeliveryQuotation(pickup, dropoff, serviceType = 'MOTORCYCLE') {
    try {
      // Validate input
      if (!pickup || !dropoff) {
        throw new Error('Both pickup and dropoff locations are required');
      }

      const stops = [pickup, dropoff];
      const quotationData = this.createQuotationPayload(stops, serviceType);
      
      // Validate before sending
      this.validateQuotationData(quotationData);
      
      return await this.getQuotation(quotationData);
    } catch (error) {
      console.error('Simple delivery quotation error:', error.message);
      throw error;
    }
  }
}

module.exports = new LalamoveService();