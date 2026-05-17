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

// API Keys স্টোর (প্রোডাকশনে ডাটাবেস ব্যবহার করবেন)
let apiKeys = new Map();

// ডিফল্ট এডমিন কী (প্রথমবারের জন্য)
const ADMIN_KEY = 'TNEH_ADMIN_2024';

// মিডলওয়্যার: API Key ভেরিফিকেশন
const verifyApiKey = (req, res, next) => {
  // পাবলিক এন্ডপয়েন্ট (কী লাগবে না)
  const publicEndpoints = ['/', '/health', '/create-apikey', '/tneh', '/docs'];
  
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
      error: 'Invalid API Key!',
      message: 'সঠিক API Key দিন'
    });
  }
  
  req.apiUser = apiKeys.get(apiKey);
  next();
};

// API Key তৈরি করার এন্ডপয়েন্ট
app.get('/create-apikey', (req, res) => {
  const { admin_key, name } = req.query;
  
  // এডমিন ভেরিফিকেশন
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
  
  // ইউনিক API Key জেনারেট
  const apiKey = crypto.randomBytes(32).toString('hex');
  const userData = {
    name: name,
    key: apiKey,
    createdAt: new Date().toISOString(),
    requests: 0,
    limit: 1000 // দৈনিক লিমিট
  };
  
  apiKeys.set(apiKey, userData);
  
  res.json({
    success: true,
    message: '🎉 API Key তৈরি হয়েছে!',
    apiKey: apiKey,
    user: name,
    note: 'এই কীটি সংরক্ষণ করুন। হেডারে x-api-key হিসেবে ব্যবহার করুন।',
    example: `fetch('/info?url=...', { headers: { 'x-api-key': '${apiKey}' } })`
  });
});

// সব API Keys দেখুন (শুধু এডমিন)
app.get('/list-keys', (req, res) => {
  const { admin_key } = req.query;
  
  if (admin_key !== ADMIN_KEY) {
    return res.status(401).json({ error: 'এডমিন কী দরকার!' });
  }
  
  const keys = Array.from(apiKeys.values()).map(u => ({
    name: u.name,
    key: u.key.substring(0, 10) + '...',
    requests: u.requests,
    createdAt: u.createdAt
  }));
  
  res.json({ total: apiKeys.size, keys });
});

// API Key ডিলিট
app.delete('/delete-key', (req, res) => {
  const { admin_key, api_key } = req.query;
  
  if (admin_key !== ADMIN_KEY) {
    return res.status(401).json({ error: 'এডমিন কী দরকার!' });
  }
  
  if (apiKeys.delete(api_key)) {
    res.json({ success: true, message: 'API Key ডিলিট হয়েছে' });
  } else {
    res.json({ error: 'কী পাওয়া যায়নি' });
  }
});

// হোম রুট
app.get('/', (req, res) => {
  res.json({
    status: 'active',
    brand: BRAND.name,
    creator: BRAND.creator,
    version: BRAND.version,
    documentation: '/docs',
    getApiKey: '/create-apikey?admin_key=TNEH_ADMIN_2024&name=আপনার_নাম',
    endpoints: {
      'ভিডিও তথ্য': '/info?url=...',
      'ভিডিও ডাউনলোড': '/download?url=...',
      'অডিও ডাউনলোড': '/audio?url=...',
      'প্লেলিস্ট': '/playlist?url=...'
    },
    auth: 'প্রতিটি রিকোয়েস্টে x-api-key হেডার বা ?apikey= কুয়েরি দিন'
  });
});

// ডকুমেন্টেশন পেজ
app.get('/docs', (req, res) => {
  res.json({
    title: 'TNEH DOWNLOADER API ডকুমেন্টেশন',
    creator: 'DV NOMAN',
    authentication: {
      method: 'API Key',
      getKey: '/create-apikey?admin_key=TNEH_ADMIN_2024&name=YOUR_NAME',
      usage: 'হেডার: x-api-key: আপনার_কী',
      alternative: 'কুয়েরি: ?apikey=আপনার_কী'
    },
    endpoints: [
      {
        name: 'ভিডিও তথ্য',
        method: 'GET',
        url: '/info?url=VIDEO_URL',
        example: '/info?url=https://youtu.be/dQw4w9WgXcQ&apikey=YOUR_KEY'
      },
      {
        name: 'ভিডিও ডাউনলোড',
        method: 'GET',
        url: '/download?url=VIDEO_URL&quality=18',
        qualities: '18=360p, 22=720p, 137=1080p'
      },
      {
        name: 'MP3 অডিও',
        method: 'GET',
        url: '/audio?url=VIDEO_URL'
      }
    ]
  });
});

// সব API এ মিডলওয়্যার অ্যাপ্লাই করুন
app.use(verifyApiKey);

// ভিডিও তথ্য
app.get('/info', async (req, res) => {
  const { url } = req.query;
  
  // রিকোয়েস্ট কাউন্ট আপডেট
  if (req.apiUser) {
    req.apiUser.requests++;
  }
  
  if (!url) {
    return res.status(400).json({ error: 'URL প্রয়োজন!' });
  }

  try {
    const info = await ytdl.getInfo(url);
    const formats = ytdl.filterFormats(info.formats, 'audioandvideo')
      .slice(0, 10)
      .map(f => ({
        quality: f.qualityLabel,
        itag: f.itag,
        size: f.contentLength ? `${(f.contentLength / 1024 / 1024).toFixed(2)} MB` : 'অজানা'
      }));

    res.json({
      success: true,
      title: info.videoDetails.title,
      duration: `${Math.floor(info.videoDetails.lengthSeconds / 60)}:${info.videoDetails.lengthSeconds % 60}`,
      thumbnail: info.videoDetails.thumbnails.pop().url,
      author: info.videoDetails.author.name,
      views: parseInt(info.videoDetails.viewCount).toLocaleString(),
      formats: formats,
      download_links: {
        mp4_360p: `/download?url=${encodeURIComponent(url)}&quality=18&apikey=${req.query.apikey || req.headers['x-api-key']}`,
        mp4_720p: `/download?url=${encodeURIComponent(url)}&quality=22&apikey=${req.query.apikey || req.headers['x-api-key']}`,
        mp3: `/audio?url=${encodeURIComponent(url)}&apikey=${req.query.apikey || req.headers['x-api-key']}`
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'ভিডিও পাওয়া যায়নি!' });
  }
});

// ভিডিও ডাউনলোড
app.get('/download', async (req, res) => {
  const { url, quality = '18' } = req.query;
  
  if (!url) {
    return res.status(400).json({ error: 'URL দরকার!' });
  }

  try {
    const info = await ytdl.getInfo(url);
    const format = ytdl.chooseFormat(info.formats, { quality });
    let filename = info.videoDetails.title.replace(/[^\w\s]/gi, '');
    filename = `${filename}.mp4`;
    
    res.header('Content-Disposition', `attachment; filename="${filename}"`);
    res.header('Content-Type', 'video/mp4');
    res.header('X-Powered-By', 'TNEH DOWNLOADER');
    
    ytdl(url, { format }).pipe(res);
  } catch (error) {
    res.status(500).json({ error: 'ডাউনলোড ব্যর্থ!' });
  }
});

// অডিও ডাউনলোড
app.get('/audio', async (req, res) => {
  const { url } = req.query;
  
  if (!url) {
    return res.status(400).json({ error: 'URL দরকার!' });
  }

  try {
    const info = await ytdl.getInfo(url);
    const audioFormat = ytdl.filterFormats(info.formats, 'audioonly')[0];
    let filename = info.videoDetails.title.replace(/[^\w\s]/gi, '');
    filename = `${filename}.mp3`;
    
    res.header('Content-Disposition', `attachment; filename="${filename}"`);
    res.header('Content-Type', 'audio/mpeg');
    
    ytdl(url, { format: audioFormat }).pipe(res);
  } catch (error) {
    res.status(500).json({ error: 'অডিও এক্সট্র্যাক্ট ব্যর্থ!' });
  }
});

// প্লেলিস্ট
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
      videos: playlist.items.map((item, index) => ({
        sl: index + 1,
        title: item.title,
        url: item.url,
        duration: item.duration
      }))
    });
  } catch (error) {
    res.status(500).json({ error: 'প্লেলিস্ট লোড হয়নি!' });
  }
});

// হেলথ চেক (পাবলিক)
app.get('/health', (req, res) => {
  res.json({
    status: 'running',
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
  console.log(`🚀 TNEH DOWNLOADER চালু হয়েছে পোর্ট ${PORT} এ`);
});
