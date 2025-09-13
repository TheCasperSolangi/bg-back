const express = require('express');
const router = express.Router();
const axios = require('axios');

// POST /api/live/start
// Body: { pageAccessToken: string, title: string, description: string }
router.post('/start', async (req, res) => {
  const { pageAccessToken, title, description } = req.body;

  if (!pageAccessToken) {
    return res.status(400).json({ error: 'pageAccessToken is required' });
  }

  try {
    // Step 1: Create a live video
    const createLiveUrl = `https://graph.facebook.com/v17.0/me/live_videos`;
    const response = await axios.post(createLiveUrl, null, {
      params: {
        access_token: pageAccessToken,
        title: title || 'Live Stream',
        description: description || 'Streaming via API',
        status: 'LIVE_NOW' // instantly live
      }
    });

    // Response contains stream URL info
    res.json({
      message: 'Live video started successfully',
      data: response.data
    });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to start live video', details: err.response?.data || err.message });
  }
});

module.exports = router;