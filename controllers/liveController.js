const FacebookService = require('../services/facebookServices');

const LiveController = {
  startLive: async function(req, res) {
    try {
      const { title, description } = req.body;
      const liveData = await FacebookService.startLive(title, description);
      res.json(liveData);
    } catch (err) {
      console.error(err.response ? err.response.data : err.message);
      res.status(500).json({ error: 'Failed to start live video' });
    }
  },

  getAnalytics: async function(req, res) {
    try {
      const liveId = req.params.liveId;
      const analytics = await FacebookService.getLiveAnalytics(liveId);
      res.json(analytics);
    } catch (err) {
      console.error(err.response ? err.response.data : err.message);
      res.status(500).json({ error: 'Failed to fetch analytics' });
    }
  },

  endLive: async function(req, res) {
    try {
      const liveId = req.params.liveId;
      const result = await FacebookService.endLive(liveId);
      res.json(result);
    } catch (err) {
      console.error(err.response ? err.response.data : err.message);
      res.status(500).json({ error: 'Failed to end live video' });
    }
  }
};

module.exports = LiveController;