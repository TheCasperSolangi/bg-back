require('dotenv').config();

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const PAGE_ID = process.env.PAGE_ID;
const FB_GRAPH_API = `https://graph.facebook.com/${process.env.FB_API_VERSION}`;

module.exports = {
  PAGE_ACCESS_TOKEN,
  PAGE_ID,
  FB_GRAPH_API
};