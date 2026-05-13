const https = require('https');
const fs = require('fs');

function get(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/atom+xml, application/xml, text/xml, */*',
        'Accept-Language': 'ja,en;q=0.9',
      }
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(get(res.headers.location));
      }
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function main() {
  const YT_CHANNEL_ID = 'UCfvohDfHt1v5N8l3BzPRsWQ';
  const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${YT_CHANNEL_ID}`;

  let xml = '';
  try {
    const res = await get(rssUrl);
    console.log('YouTube RSS status:', res.status);
    console.log('YouTube RSS length:', res.body.length);
    console.log('YouTube RSS preview:', res.body.substring(0, 200));
    xml = res.body;
  } catch (e) {
    console.error('YouTube RSS fetch error:', e.message);
    fs.writeFileSync('data/youtube.json', JSON.stringify({ updated: new Date().toISOString(), items: [] }, null, 2));
    return;
  }

  if (!xml.includes('<entry>')) {
    console.error('No entries found in XML');
    console.log('Full response:', xml.substring(0, 500));
    fs.writeFileSync('data/youtube.json', JSON.stringify({ updated: new Date().toISOString(), items: [] }, null, 2));
    return;
  }

  const entries = [];
  const entryReg = /<entry>([\s\S]*?)<\/entry>/g;
  let m;
  while ((m = entryReg.exec(xml)) !== null) {
    const block = m[1];
    const videoIdMatch = block.match(/<yt:videoId>(.*?)<\/yt:videoId>/)
                      || block.match(/videoId>(.*?)<\//)
                      || block.match(/watch\?v=([a-zA-Z0-9_-]{11})/);
    const videoId = videoIdMatch ? videoIdMatch[1] : '';
    const titleMatch = block.match(/<title>(.*?)<\/title>/);
    const title = titleMatch ? titleMatch[1] : '';
    const publishedMatch = block.match(/<published>(.*?)<\/published>/);
    const published = publishedMatch ? publishedMatch[1] : '';
    const thumb = videoId ? 'https://i.ytimg.com/vi/' + videoId + '/maxresdefault.jpg' : '';
    if (videoId && title) entries.push({ videoId, title, published, thumb });
  }

  const KEYWORDS = ['中西', 'アルノ', '5期生', '5期', 'aruno', 'nakanishi'];
  const aruno = entries.filter(v => KEYWORDS.some(kw => v.title.toLowerCase().includes(kw.toLowerCase())));
  const rest  = entries.filter(v => !KEYWORDS.some(kw => v.title.toLowerCase().includes(kw.toLowerCase())));
  const result = [...aruno, ...rest];
  fs.writeFileSync('data/youtube.json', JSON.stringify({ updated: new Date().toISOString(), items: result }, null, 2));
  console.log('YouTube items:', result.length);
}

main();
