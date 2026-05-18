const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// In-memory storage (use a database in production)
let apiKeys = new Map(); // key -> { key, createdAt, requests }
let videoHistory = new Map(); // key -> array of videos

// Initialize with a default admin key (optional)
const ADMIN_KEY = 'admin_tiktok_downloader_2024';
apiKeys.set(ADMIN_KEY, { key: ADMIN_KEY, createdAt: Date.now(), requests: 0 });

// Helper: Generate unique API key
function generateApiKey() {
  return 'tiktok_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Helper: Validate API key
function validateApiKey(key) {
  if (!key) return false;
  return apiKeys.has(key);
}

// Helper: Increment request count
function incrementRequests(key) {
  if (apiKeys.has(key)) {
    const data = apiKeys.get(key);
    data.requests = (data.requests || 0) + 1;
    apiKeys.set(key, data);
  }
}

// ==================== ENDPOINTS ====================

// Health check endpoint
// GET /api/health
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: Date.now(),
    uptime: process.uptime(),
    apiKeysCount: apiKeys.size
  });
});

// Create new API key
// GET /api/create?name=optional_name
app.get('/api/create', (req, res) => {
  const newKey = generateApiKey();
  apiKeys.set(newKey, {
    key: newKey,
    createdAt: Date.now(),
    requests: 0,
    name: req.query.name || 'unnamed'
  });
  
  res.json({
    success: true,
    apiKey: newKey,
    message: 'API key created successfully',
    createdAt: new Date().toISOString()
  });
});

// Get all API keys (admin only - requires admin key)
// GET /api/api_keys?admin_key=admin_tiktok_downloader_2024
app.get('/api/api_keys', (req, res) => {
  const adminKey = req.query.admin_key;
  
  if (adminKey !== ADMIN_KEY) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized. Admin key required.'
    });
  }
  
  const keys = Array.from(apiKeys.entries()).map(([key, data]) => ({
    key: key,
    name: data.name,
    createdAt: data.createdAt,
    requests: data.requests || 0,
    isActive: true
  }));
  
  res.json({
    success: true,
    count: keys.length,
    keys: keys
  });
});

// Download TikTok video
// GET /api/APIkey={APIkey}&url={tiktok_url}
app.get('/api/', async (req, res) => {
  try {
    const apiKey = req.query.APIkey;
    const videoUrl = req.query.url;
    
    // Validate API key
    if (!apiKey || !validateApiKey(apiKey)) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or missing API key',
        message: 'Please provide a valid API key using ?APIkey=your_key'
      });
    }
    
    // Validate URL
    if (!videoUrl) {
      return res.status(400).json({
        success: false,
        error: 'Missing URL parameter',
        message: 'Please provide a TikTok video URL using &url=video_url'
      });
    }
    
    // Check if it's a TikTok URL
    if (!videoUrl.includes('tiktok.com')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid URL',
        message: 'Please provide a valid TikTok video URL'
      });
    }
    
    // Increment request count for this API key
    incrementRequests(apiKey);
    
    // Call TikTok API
    const response = await axios.get('https://www.tikwm.com/api/', {
      params: {
        url: videoUrl
      }
    });
    
    if (response.data && response.data.code === 0) {
      const videoData = response.data.data;
      
      // Store in history
      if (!videoHistory.has(apiKey)) {
        videoHistory.set(apiKey, []);
      }
      const history = videoHistory.get(apiKey);
      history.push({
        id: videoData.id,
        title: videoData.title,
        downloadedAt: Date.now(),
        url: videoUrl
      });
      // Keep only last 100 items
      if (history.length > 100) history.shift();
      videoHistory.set(apiKey, history);
      
      // Return formatted response
      res.json({
        success: true,
        data: {
          id: videoData.id,
          title: videoData.title,
          duration: videoData.duration,
          cover: videoData.cover,
          play_count: videoData.play_count,
          digg_count: videoData.digg_count,
          comment_count: videoData.comment_count,
          share_count: videoData.share_count,
          download_urls: {
            video_no_watermark: videoData.play,
            video_with_watermark: videoData.wmplay,
            audio: videoData.music
          },
          author: {
            id: videoData.author?.id,
            username: videoData.author?.unique_id,
            nickname: videoData.author?.nickname,
            avatar: videoData.author?.avatar
          },
          music_info: videoData.music_info ? {
            title: videoData.music_info.title,
            author: videoData.music_info.author,
            duration: videoData.music_info.duration
          } : null
        },
        api_key_used: apiKey,
        requests_used: (apiKeys.get(apiKey).requests || 0)
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Video not found',
        message: 'Could not fetch video data. Please check the URL.'
      });
    }
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message || 'Failed to download video'
    });
  }
});

// Delete API key
// GET /api/delete=yes&APIkey={APIkey}
app.get('/api/delete', (req, res) => {
  const confirm = req.query.delete;
  const apiKey = req.query.APIkey;
  
  if (confirm !== 'yes') {
    return res.status(400).json({
      success: false,
      error: 'Confirmation required',
      message: 'Use ?delete=yes to confirm deletion'
    });
  }
  
  if (!apiKey) {
    return res.status(400).json({
      success: false,
      error: 'Missing API key parameter'
    });
  }
  
  if (!apiKeys.has(apiKey)) {
    return res.status(404).json({
      success: false,
      error: 'API key not found'
    });
  }
  
  // Prevent deletion of admin key
  if (apiKey === ADMIN_KEY) {
    return res.status(403).json({
      success: false,
      error: 'Cannot delete admin key'
    });
  }
  
  apiKeys.delete(apiKey);
  videoHistory.delete(apiKey);
  
  res.json({
    success: true,
    message: 'API key deleted successfully',
    deletedKey: apiKey
  });
});

// List download history for specific API key
// GET /api/list?APIkey={APIkey}
app.get('/api/list', (req, res) => {
  const apiKey = req.query.APIkey;
  
  if (!apiKey || !validateApiKey(apiKey)) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or missing API key'
    });
  }
  
  const history = videoHistory.get(apiKey) || [];
  const apiKeyData = apiKeys.get(apiKey);
  
  res.json({
    success: true,
    api_key: apiKey,
    total_downloads: history.length,
    total_requests: apiKeyData?.requests || 0,
    created_at: apiKeyData?.createdAt,
    downloads: history.reverse() // Most recent first
  });
});

// Support for POST requests (alternative to GET)
app.post('/api/', async (req, res) => {
  const { APIkey, url } = req.body;
  req.query.APIkey = APIkey;
  req.query.url = url;
  return app.handle(req, res);
});

// Export for Vercel
module.exports = app;
