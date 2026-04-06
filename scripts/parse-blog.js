const https = require('https');
const fs = require('fs');

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ja,en;q=0.9',
      }
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(get(res.headers.location));
      }
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function main() {
  const BASE = 'https://tools.yotujoho.com/blog/nogizaka46/n-55395/';
  const allPosts = [];
  const seenTitles = new Set();
  const seenIds = new Set();

  for (let page = 1; page <= 5; page++) {
    const url = page === 1 ? BASE : BASE + '?page=' + page;
    try {
      const html = await get(url);
      if (!html || html.length < 100) break;

      const h3s = [...html.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/g)]
        .map(m => m[1].replace(/<[^>]+>/g, '').trim())
        .filter(t => t.length > 1 && t.length < 80 && !t.includes('Recent') && !t.includes('Archive') && !t.includes('坂道'));

      const imgMatches  = [...html.matchAll(/https:\/\/yotujoho\.com\/blog-data\/nogizaka46\/image\/(\d+)\/small\/0\.jpg/g)];
      const linkMatches = [...html.matchAll(/nogizaka46\.com\/s\/n46\/diary\/detail\/(\d+)/g)];
      const dateMatches = [...html.matchAll(/(\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2})/g)];

      const uniqueLinks = [];
      for (const m of linkMatches) {
        if (!seenIds.has(m[1])) { seenIds.add(m[1]); uniqueLinks.push(m); }
      }

      const count = Math.min(h3s.length, imgMatches.length);
      let added = 0;
      for (let i = 0; i < count; i++) {
        const title = h3s[i];
        if (!title || seenTitles.has(title)) continue;
        seenTitles.add(title);
        const imgSrc = imgMatches[i]?.[0] || '';
        const articleId = uniqueLinks[i]?.[1] || '';
        const rawDate = dateMatches[i]?.[1] || '';
        let dateStr = '';
        if (rawDate) {
          const p = rawDate.match(/(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})/);
          if (p) dateStr = new Date(+p[1], +p[2]-1, +p[3], +p[4], +p[5]).toISOString();
        }
        allPosts.push({
          title,
          thumb: imgSrc,
          date: dateStr,
          link: articleId
            ? 'https://www.nogizaka46.com/s/n46/diary/detail/' + articleId
            : 'https://www.nogizaka46.com/s/n46/diary/MEMBER/list?ct=55395',
        });
        added++;
      }
      console.log('Blog page ' + page + ': +' + added + ' posts (total: ' + allPosts.length + ')');
      if (!html.includes('page=') && !html.includes('次へ')) break;
      if (added === 0) break;
      await new Promise(r => setTimeout(r, 500));
    } catch(e) {
      console.error('Blog page ' + page + ' error:', e.message);
      break;
    }
  }
  fs.writeFileSync('data/blog.json', JSON.stringify({ updated: new Date().toISOString(), items: allPosts }, null, 2));
  console.log('Blog total:', allPosts.length);
}
main();
