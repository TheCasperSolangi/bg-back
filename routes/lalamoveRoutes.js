const express = require('express');
const router = express.Router();
const lalamoveService = require('../services/lalamoveSecret');

// Get quotation for delivery
router.post('/quotation', async (req, res) => {
  try {
    const {
      serviceType,
      specialRequests,
      stops,
      item,
      scheduleAt,
      isRouteOptimized,
      language
    } = req.body;

    // Validate required fields
    if (!stops || stops.length < 2) {
      return res.status(400).json({
        error: 'At least 2 stops (pickup and delivery) are required'
      });
    }

    // Create API v3 compatible quotation data
    const quotationData = {
      data: {
        serviceType: serviceType || 'MOTORCYCLE',
        language: language || 'en_SG',
        stops: stops.map(stop => ({
          coordinates: {
            lat: stop.coordinates.lat.toString(),
            lng: stop.coordinates.lng.toString()
          },
          address: stop.address
        })),
        ...(specialRequests && specialRequests.length > 0 && { specialRequests }),
        ...(item && { item }),
        ...(scheduleAt && { scheduleAt }),
        ...(isRouteOptimized !== undefined && { isRouteOptimized })
      }
    };

    const quotation = await lalamoveService.getQuotation(quotationData);
    res.json(quotation);
  } catch (error) {
    console.error('Quotation route error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Place a new order
router.post('/order', async (req, res) => {
  try {
    const {
      quotationId,
      sender,
      recipients,
      isPODEnabled,
      partner,
      metadata
    } = req.body;

    // Validate required fields
    if (!quotationId) {
      return res.status(400).json({ error: 'quotationId is required' });
    }

    if (!sender || !sender.stopId || !sender.name || !sender.phone) {
      return res.status(400).json({ 
        error: 'sender with stopId, name, and phone is required' 
      });
    }

    if (!recipients || recipients.length === 0) {
      return res.status(400).json({ 
        error: 'At least one recipient is required' 
      });
    }

    // Create API v3 compatible order data
    const orderData = {
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
        ...(isPODEnabled && { isPODEnabled }),
        ...(partner && { partner }),
        ...(metadata && { metadata })
      }
    };

    const order = await lalamoveService.placeOrder(orderData);
    res.json(order);
  } catch (error) {
    console.error('Order route error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get order details
router.get('/order/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    
    if (!orderId) {
      return res.status(400).json({ error: 'orderId is required' });
    }

    const orderDetails = await lalamoveService.getOrderDetails(orderId);
    res.json(orderDetails);
  } catch (error) {
    console.error('Order details route error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Cancel an order
router.delete('/order/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    
    if (!orderId) {
      return res.status(400).json({ error: 'orderId is required' });
    }

    const result = await lalamoveService.cancelOrder(orderId);
    res.json(result);
  } catch (error) {
    console.error('Cancel order route error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get order status
router.get('/order/:orderId/status', async (req, res) => {
  try {
    const { orderId } = req.params;
    
    if (!orderId) {
      return res.status(400).json({ error: 'orderId is required' });
    }

    const status = await lalamoveService.getOrderStatus(orderId);
    res.json(status);
  } catch (error) {
    console.error('Order status route error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get driver details
router.get('/order/:orderId/driver/:driverId', async (req, res) => {
  try {
    const { orderId, driverId } = req.params;
    
    if (!orderId || !driverId) {
      return res.status(400).json({ error: 'orderId and driverId are required' });
    }

    const driverDetails = await lalamoveService.getDriverDetails(orderId, driverId);
    res.json(driverDetails);
  } catch (error) {
    console.error('Driver details route error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get driver location
router.get('/order/:orderId/driver/:driverId/location', async (req, res) => {
  try {
    const { orderId, driverId } = req.params;
    
    if (!orderId || !driverId) {
      return res.status(400).json({ error: 'orderId and driverId are required' });
    }

    const location = await lalamoveService.getDriverLocation(orderId, driverId);
    res.json(location);
  } catch (error) {
    console.error('Driver location route error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Edit an order (new in v3)
router.patch('/order/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { stops } = req.body;
    
    if (!orderId) {
      return res.status(400).json({ error: 'orderId is required' });
    }

    if (!stops || stops.length === 0) {
      return res.status(400).json({ error: 'stops are required for editing' });
    }

    const editData = {
      data: {
        stops: stops.map(stop => ({
          ...(stop.stopId && { stopId: stop.stopId }),
          coordinates: {
            lat: stop.coordinates.lat.toString(),
            lng: stop.coordinates.lng.toString()
          },
          address: stop.address,
          name: stop.name,
          phone: stop.phone,
          ...(stop.remarks && { remarks: stop.remarks })
        }))
      }
    };

    const result = await lalamoveService.editOrder(orderId, editData);
    res.json(result);
  } catch (error) {
    console.error('Edit order route error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add priority fee (new in v3)
router.post('/order/:orderId/priority-fee', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { priorityFee } = req.body;
    
    if (!orderId) {
      return res.status(400).json({ error: 'orderId is required' });
    }

    if (!priorityFee) {
      return res.status(400).json({ error: 'priorityFee is required' });
    }

    const result = await lalamoveService.addPriorityFee(orderId, priorityFee);
    res.json(result);
  } catch (error) {
    console.error('Add priority fee route error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Change driver (new in v3)
router.delete('/order/:orderId/driver/:driverId', async (req, res) => {
  try {
    const { orderId, driverId } = req.params;
    const { reason } = req.body;
    
    if (!orderId || !driverId) {
      return res.status(400).json({ error: 'orderId and driverId are required' });
    }

    if (!reason) {
      return res.status(400).json({ 
        error: 'reason is required. Valid reasons: DRIVER_LATE, DRIVER_ASKED_CHANGE, DRIVER_UNRESPONSIVE, DRIVER_RUDE' 
      });
    }

    const result = await lalamoveService.changeDriver(orderId, driverId, reason);
    res.json(result);
  } catch (error) {
    console.error('Change driver route error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get city info (new in v3)
router.get('/cities', async (req, res) => {
  try {
    const cityInfo = await lalamoveService.getCityInfo();
    res.json(cityInfo);
  } catch (error) {
    console.error('City info route error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Setup webhook (new in v3)
router.patch('/webhook', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'webhook url is required' });
    }

    const result = await lalamoveService.setupWebhook(url);
    res.json(result);
  } catch (error) {
    console.error('Setup webhook route error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;