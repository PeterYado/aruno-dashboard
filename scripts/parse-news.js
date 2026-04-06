const fs = require('fs');
const xml = fs.readFileSync('/tmp/news.xml', 'utf8');
const items = [];
const itemReg = /<item>([\s\S]*?)<\/item>/g;
let m;
while ((m = itemReg.exec(xml)) !== null) {
  const block = m[1];
  const title = (block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || block.match(/<title>(.*?)<\/title>/) || [])[1] || '';
  const link  = (block.match(/<link>(.*?)<\/link>/)  || [])[1] || '#';
  const pub   = (block.match(/<pubDate>(.*?)<\/pubDate>/) || [])[1] || '';
  const src   = (block.match(/<source[^>]*>(.*?)<\/source>/) || [])[1] || '';
  if (title) items.push({ title, link, pub, src });
}
const ARUNO_RE = /中西アルノ|アルノ|[Aa]runo/;
const filtered = items.filter(x => ARUNO_RE.test(x.title));
const result = filtered.length >= 3 ? filtered : items;
result.sort((a,b) => new Date(b.pub||0) - new Date(a.pub||0));
fs.writeFileSync('data/news.json', JSON.stringify({ updated: new Date().toISOString(), items: result }, null, 2));
console.log('News items:', result.length);
