const https = require('https');
const fs = require('fs');

function get(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja,en;q=0.9',
        'Accept-Encoding': 'identity',
      }
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(get(res.headers.location));
      }
      let data = '';
      res.setEncoding('utf8');
      res.on('data', d => data += d);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.setTimeout(20000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function main() {
  // yotujoho.com 試す → ダメなら nogizaka46.com 公式APIを試す
  const allPosts = [];
  const seenTitles = new Set();
  const seenIds = new Set();

  // まず yotujoho.com を試みる
  const BASE = 'https://tools.yotujoho.com/blog/nogizaka46/n-55395/';
  let yotujohoOk = false;

  for (let page = 1; page <= 5; page++) {
    const url = page === 1 ? BASE : BASE + '?page=' + page;
    try {
      const res = await get(url);
      console.log(`yotujoho page ${page} status:`, res.status, 'length:', res.body.length);

      if (res.status !== 200 || res.body.length < 500) break;

      const html = res.body;

      // 新しい構造でも動くよう複数パターン試す
      const h3s = [...html.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/g)]
        .map(m => m[1].replace(/<[^>]+>/g, '').trim())
        .filter(t => t.length > 1 && t.length < 120 && !t.includes('Recent') && !t.includes('Archive') && !t.includes('坂道') && !t.includes('ページ'));

      const imgMatches = [
        ...html.matchAll(/https?:\/\/[^"'\s]*\/blog-data\/nogizaka46\/image\/(\d+)\/[^"'\s]*\.jpg/g),
        ...html.matchAll(/https?:\/\/[^"'\s]*nogizaka[^"'\s]*\/image\/(\d+)\/[^"'\s]*\.jpg/g),
      ].filter((m, i, arr) => arr.findIndex(x => x[0] === m[0]) === i);

      const linkMatches = [...html.matchAll(/nogizaka46\.com\/s\/n46\/diary\/detail\/(\d+)/g)];
      const dateMatches = [...html.matchAll(/(\d{4}[\/\-]\d{2}[\/\-]\d{2}[\s　]+\d{2}:\d{2})/g)];

      console.log(`  h3s: ${h3s.length}, imgs: ${imgMatches.length}, links: ${linkMatches.length}`);

      const uniqueLinks = [];
      for (const m of linkMatches) {
        if (!seenIds.has(m[1])) { seenIds.add(m[1]); uniqueLinks.push(m); }
      }

      const count = Math.min(h3s.length, Math.max(imgMatches.length, uniqueLinks.length));
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
          const p = rawDate.match(/(\d{4})[\/\-](\d{2})[\/\-](\d{2})[\s　]+(\d{2}):(\d{2})/);
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
        yotujohoOk = true;
      }
      console.log('Blog page ' + page + ': +' + added + ' posts (total: ' + allPosts.length + ')');
      if (!html.includes('page=') && !html.includes('次へ')) break;
      if (added === 0) break;
      await new Promise(r => setTimeout(r, 800));
    } catch(e) {
      console.error('Blog page ' + page + ' error:', e.message);
      break;
    }
  }

  // yotujoho がダメなら nogizaka46 公式 API を試みる
  if (!yotujohoOk || allPosts.length === 0) {
    console.log('yotujoho failed, trying nogizaka46 official API...');
    try {
      const apiUrl = 'https://www.nogizaka46.com/s/n46/api/diary/MEMBER/list?site=pc&ima=0000&ct=55395&numbers=50&page=0';
      const res = await get(apiUrl);
      console.log('Nogizaka API status:', res.status, 'length:', res.body.length);

      if (res.status === 200 && res.body.includes('{')) {
        const json = JSON.parse(res.body);
        const diaries = json.body?.diary || json.diary || [];
        console.log('Nogizaka API diaries:', diaries.length);

        for (const d of diaries) {
          const title = d.title || d.name || '';
          const articleId = d.code || d.id || '';
          const thumb = d.image || d.img || '';
          const dateStr = d.release || d.date || '';
          if (!title) continue;
          allPosts.push({
            title,
            thumb,
            date: dateStr,
            link: articleId
              ? 'https://www.nogizaka46.com/s/n46/diary/detail/' + articleId
              : 'https://www.nogizaka46.com/s/n46/diary/MEMBER/list?ct=55395',
          });
        }
        console.log('Nogizaka API total:', allPosts.length);
      }
    } catch(e) {
      console.error('Nogizaka API error:', e.message);
    }
  }

  fs.writeFileSync('data/blog.json', JSON.stringify({ updated: new Date().toISOString(), items: allPosts }, null, 2));
  console.log('Blog total:', allPosts.length);
}

main();
