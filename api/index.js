const express = require('express');
const ytdl = require('ytdl-core');
const ytpl = require('ytpl');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());

// ব্র্যান্ডিং
const BRAND = {
  name: 'TNEH DOWNLOADER',
  creator: 'DV NOMAN',
  version: '1.0.0'
};

// API Keys স্টোর
let apiKeys = new Map();
const ADMIN_KEY = 'TNEH_ADMIN_2024';

// URL ক্লিন করা ফাংশন (si= ট্যাগ রিমুভ)
function cleanYouTubeUrl(url) {
  if (!url) return null;
  // si= ট্র্যাকিং প্যারামিটার রিমুভ
  let cleanUrl = url.split('?si=')[0];
  // শর্ট ইউআরএল (youtu.be) কনভার্ট
  if (cleanUrl.includes('youtu.be/')) {
    const videoId = cleanUrl.split('youtu.be/')[1].split('?')[0];
    cleanUrl = `https://youtube.com/watch?v=${videoId}`;
  }
  return cleanUrl;
}

// মিডলওয়্যার: API Key ভেরিফিকেশন
const verifyApiKey = (req, res, next) => {
  const publicEndpoints = ['/', '/health', '/create-apikey', '/tneh', '/docs', '/list-keys'];
  
  if (publicEndpoints.includes(req.path)) {
    return next();
  }
  
  const apiKey = req.headers['x-api-key'] || req.query.apikey;
  
  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: 'API Key প্রয়োজন!',
      message: 'হেডারে x-api-key বা কুয়েরিতে apikey দিন',
      getKey: '/create-apikey?admin_key=TNEH_ADMIN_2024&name=আপনার_নাম'
    });
  }
  
  if (!apiKeys.has(apiKey)) {
    return res.status(403).json({
      success: false,
      error: 'Invalid API Key!'
    });
  }
  
  req.apiUser = apiKeys.get(apiKey);
  next();
};

// API Key তৈরি
app.get('/create-apikey', (req, res) => {
  const { admin_key, name } = req.query;
  
  if (admin_key !== ADMIN_KEY) {
    return res.status(401).json({
      success: false,
      error: 'এডমিন কী সঠিক নয়!',
      adminKey: ADMIN_KEY
    });
  }
  
  if (!name) {
    return res.status(400).json({
      error: 'name প্যারামিটার দিন!',
      example: '/create-apikey?admin_key=TNEH_ADMIN_2024&name=DV_NOMAN'
    });
  }
  
  const apiKey = crypto.randomBytes(32).toString('hex');
  const userData = {
    name: name,
    key: apiKey,
    createdAt: new Date().toISOString(),
    requests: 0
  };
  
  apiKeys.set(apiKey, userData);
  
  res.json({
    success: true,
    message: 'API Key তৈরি হয়েছে!',
    apiKey: apiKey,
    user: name
  });
});

// সব API Keys দেখা (এডমিন)
app.get('/list-keys', (req, res) => {
  const { admin_key } = req.query;
  if (admin_key !== ADMIN_KEY) {
    return res.status(401).json({ error: 'এডমিন কী দরকার!' });
  }
  
  const keys = Array.from(apiKeys.values()).map(u => ({
    name: u.name,
    key: u.key.substring(0, 10) + '...',
    requests: u.requests
  }));
  
  res.json({ total: apiKeys.size, keys });
});

// হোম রুট
app.get('/', (req, res) => {
  res.json({
    status: 'active',
    brand: BRAND.name,
    creator: BRAND.creator,
    documentation: '/docs',
    getApiKey: '/create-apikey?admin_key=TNEH_ADMIN_2024&name=আপনার_নাম',
    endpoints: {
      'ভিডিও তথ্য': '/info?url=...',
      'ভিডিও ডাউনলোড': '/download?url=...',
      'অডিও ডাউনলোড': '/audio?url=...',
      'প্লেলিস্ট': '/playlist?url=...'
    }
  });
});

// ডকুমেন্টেশন
app.get('/docs', (req, res) => {
  res.json({
    title: 'TNEH DOWNLOADER API',
    creator: 'DV NOMAN',
    authentication: {
      method: 'API Key',
      getKey: '/create-apikey?admin_key=TNEH_ADMIN_2024&name=YOUR_NAME'
    },
    endpoints: [
      { name: 'ভিডিও তথ্য', method: 'GET', url: '/info?url=VIDEO_URL&apikey=KEY' },
      { name: 'ভিডিও ডাউনলোড', method: 'GET', url: '/download?url=VIDEO_URL&quality=18&apikey=KEY' },
      { name: 'MP3 অডিও', method: 'GET', url: '/audio?url=VIDEO_URL&apikey=KEY' },
      { name: 'প্লেলিস্ট', method: 'GET', url: '/playlist?url=PLAYLIST_URL&apikey=KEY' }
    ]
  });
});

// মিডলওয়্যার অ্যাপ্লাই
app.use(verifyApiKey);

// =============== ভিডিও তথ্য API ===============
app.get('/info', async (req, res) => {
  const { url } = req.query;
  
  if (req.apiUser) {
    req.apiUser.requests++;
  }
  
  if (!url) {
    return res.status(400).json({ error: 'URL প্রয়োজন! দেখুন: /info?url=ইউটিউব_লিংক' });
  }
  
  const cleanUrl = cleanYouTubeUrl(url);
  
  try {
    const info = await ytdl.getInfo(cleanUrl);
    const formats = ytdl.filterFormats(info.formats, 'audioandvideo')
      .map(f => ({
        quality: f.qualityLabel || 'Unknown',
        itag: f.itag,
        container: f.container,
        size: f.contentLength ? `${(f.contentLength / 1024 / 1024).toFixed(2)} MB` : 'N/A'
      }));
    
    res.json({
      success: true,
      title: info.videoDetails.title,
      duration: `${Math.floor(info.videoDetails.lengthSeconds / 60)}:${info.videoDetails.lengthSeconds % 60}`,
      thumbnail: info.videoDetails.thumbnails[info.videoDetails.thumbnails.length - 1]?.url,
      author: info.videoDetails.author.name,
      views: parseInt(info.videoDetails.viewCount).toLocaleString(),
      formats: formats.slice(0, 10),
      download: {
        mp4_360p: `/download?url=${encodeURIComponent(url)}&quality=18&apikey=${req.query.apikey || req.headers['x-api-key']}`,
        mp4_720p: `/download?url=${encodeURIComponent(url)}&quality=22&apikey=${req.query.apikey || req.headers['x-api-key']}`,
        mp3: `/audio?url=${encodeURIComponent(url)}&apikey=${req.query.apikey || req.headers['x-api-key']}`
      }
    });
  } catch (error) {
    console.error('Info Error:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'ভিডিও তথ্য পাওয়া যায়নি!',
      details: error.message
    });
  }
});

// =============== ভিডিও ডাউনলোড API ===============
app.get('/download', async (req, res) => {
  const { url, quality = '18' } = req.query;
  
  if (!url) {
    return res.status(400).json({ error: 'URL দরকার! দেখুন: /download?url=ইউটিউব_লিংক&quality=18' });
  }
  
  const cleanUrl = cleanYouTubeUrl(url);
  
  try {
    const info = await ytdl.getInfo(cleanUrl);
    const format = ytdl.chooseFormat(info.formats, { quality });
    
    if (!format) {
      return res.status(400).json({ error: 'এই কোয়ালিটি পাওয়া যায়নি! 18, 22, 137 ব্যবহার করুন' });
    }
    
    let filename = info.videoDetails.title.replace(/[^\w\s\u0980-\u09FF]/gi, '');
    filename = `${filename}.mp4`;
    
    res.header('Content-Disposition', `attachment; filename="${filename}"`);
    res.header('Content-Type', 'video/mp4');
    
    const stream = ytdl(cleanUrl, { format });
    stream.pipe(res);
    
    stream.on('error', (err) => {
      console.error('Stream Error:', err);
      res.status(500).json({ error: 'ডাউনলোড স্ট্রিম ব্যর্থ!' });
    });
    
  } catch (error) {
    console.error('Download Error:', error.message);
    res.status(500).json({ 
      error: 'ডাউনলোড ব্যর্থ!',
      suggestion: 'ছোট কোয়ালিটি ব্যবহার করুন (18 বা 22)',
      details: error.message
    });
  }
});

// =============== অডিও ডাউনলোড API ===============
app.get('/audio', async (req, res) => {
  const { url } = req.query;
  
  if (!url) {
    return res.status(400).json({ error: 'URL দরকার!' });
  }
  
  const cleanUrl = cleanYouTubeUrl(url);
  
  try {
    const info = await ytdl.getInfo(cleanUrl);
    const audioFormat = ytdl.filterFormats(info.formats, 'audioonly')[0];
    
    if (!audioFormat) {
      return res.status(400).json({ error: 'অডিও ফরম্যাট পাওয়া যায়নি!' });
    }
    
    let filename = info.videoDetails.title.replace(/[^\w\s\u0980-\u09FF]/gi, '');
    filename = `${filename}.mp3`;
    
    res.header('Content-Disposition', `attachment; filename="${filename}"`);
    res.header('Content-Type', 'audio/mpeg');
    
    const stream = ytdl(cleanUrl, { format: audioFormat });
    stream.pipe(res);
    
  } catch (error) {
    console.error('Audio Error:', error.message);
    res.status(500).json({ error: 'অডিও এক্সট্র্যাক্ট ব্যর্থ!' });
  }
});

// =============== প্লেলিস্ট API ===============
app.get('/playlist', async (req, res) => {
  const { url } = req.query;
  
  if (!url) {
    return res.status(400).json({ error: 'প্লেলিস্ট URL দিন!' });
  }
  
  try {
    const playlist = await ytpl(url);
    res.json({
      success: true,
      title: playlist.title,
      totalVideos: playlist.items.length,
      videos: playlist.items.slice(0, 20).map((item, index) => ({
        sl: index + 1,
        title: item.title,
        url: item.url,
        duration: item.duration
      }))
    });
  } catch (error) {
    console.error('Playlist Error:', error.message);
    res.status(500).json({ error: 'প্লেলিস্ট লোড হয়নি!' });
  }
});

// হেলথ চেক
app.get('/health', (req, res) => {
  res.json({
    status: 'running',
    uptime: process.uptime(),
    totalKeys: apiKeys.size,
    timestamp: new Date().toISOString()
  });
});

// DV NOMAN স্পেশাল
app.get('/tneh', (req, res) => {
  res.json({
    message: '❤️ TNEH DOWNLOADER - Made by DV NOMAN ❤️',
    features: ['YouTube ডাউনলোড', 'MP3 এক্সট্র্যাক্ট', 'প্লেলিস্ট সাপোর্ট', 'API Key প্রোটেকশন']
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════╗
  ║   TNEH DOWNLOADER - DV NOMAN        ║
  ║   🚀 সার্ভার চালু হয়েছে!              ║
  ║   📡 পোর্ট: ${PORT}                   ║
  ║   🔑 এডমিন কী: ${ADMIN_KEY}           ║
  ╚══════════════════════════════════════╝
  `);
});
