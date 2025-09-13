const axios = require('axios');
const { PAGE_ACCESS_TOKEN, PAGE_ID, FB_GRAPH_API } = require('../config/facebook');

const FacebookService = {
  startLive: async function(title, description) {
    try {
      const response = await axios.post(
        `${FB_GRAPH_API}/${PAGE_ID}/live_videos`,
        { title, description, status: 'LIVE_NOW' },
        { params: { access_token: PAGE_ACCESS_TOKEN } }
      );
      return response.data;
    } catch (err) {
      throw err;
    }
  },

  getLiveAnalytics: async function(liveId) {
    try {
      const response = await axios.get(`${FB_GRAPH_API}/${liveId}`, {
        params: {
          fields: 'id,title,status,live_views,comments.summary(true),reactions.summary(true)',
          access_token: PAGE_ACCESS_TOKEN
        }
      });
      return response.data;
    } catch (err) {
      throw err;
    }
  },

  endLive: async function(liveId) {
    try {
      const response = await axios.post(
        `${FB_GRAPH_API}/${liveId}`,
        { end_live_video: true },
        { params: { access_token: PAGE_ACCESS_TOKEN } }
      );
      return response.data;
    } catch (err) {
      throw err;
    }
  }
};

module.exports = FacebookService;