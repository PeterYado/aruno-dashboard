const fs = require('fs');
const xml = fs.readFileSync('/tmp/youtube.xml', 'utf8');
console.log('XML length:', xml.length);
console.log('XML preview:', xml.substring(0, 300));

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
  const thumb = videoId ? 'https://i.ytimg.com/vi/' + videoId + '/hqdefault.jpg' : '';
  if (videoId && title) entries.push({ videoId, title, published, thumb });
}
const KEYWORDS = ['中西', 'アルノ', '5期生', '5期', 'aruno', 'nakanishi'];
const aruno = entries.filter(v => KEYWORDS.some(kw => v.title.toLowerCase().includes(kw.toLowerCase())));
const rest  = entries.filter(v => !KEYWORDS.some(kw => v.title.toLowerCase().includes(kw.toLowerCase())));
const result = [...aruno, ...rest];
fs.writeFileSync('data/youtube.json', JSON.stringify({ updated: new Date().toISOString(), items: result }, null, 2));
console.log('YouTube items:', result.length);
