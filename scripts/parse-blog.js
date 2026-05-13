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

async function fetchThumbFromArticle(articleId) {
  try {
    const url = 'https://www.nogizaka46.com/s/n46/diary/detail/' + articleId;
    const res = await get(url);
    if (res.status !== 200) return '';
    // 公式ブログの画像URLパターンを探す
    const imgMatch = res.body.match(/https:\/\/cdn\.nogizaka46\.com\/s\/img\/[^"'\s]+\.jpg/)
                  || res.body.match(/https:\/\/[^"'\s]+nogizaka[^"'\s]+diary[^"'\s]+\.jpg/)
                  || res.body.match(/<img[^>]+src="(https:\/\/[^"]+\.(?:jpg|jpeg|png|webp))"[^>]*class="[^"]*diary[^"]*"/i)
                  || res.body.match(/property="og:image"[^>]+content="([^"]+)"/);
    if (imgMatch) return imgMatch[1] || imgMatch[0];
    return '';
  } catch(e) {
    return '';
  }
}

async function main() {
  const allPosts = [];
  const seenTitles = new Set();
  const seenIds = new Set();

  const BASE = 'https://tools.yotujoho.com/blog/nogizaka46/n-55395/';

  for (let page = 1; page <= 5; page++) {
    const url = page === 1 ? BASE : BASE + '?page=' + page;
    try {
      const res = await get(url);
      console.log(`yotujoho page ${page} status:`, res.status, 'length:', res.body.length);
      if (res.status !== 200 || res.body.length < 500) break;

      const html = res.body;

      const h3s = [...html.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/g)]
        .map(m => m[1].replace(/<[^>]+>/g, '').trim())
        .filter(t => t.length > 1 && t.length < 120 && !t.includes('Recent') && !t.includes('Archive') && !t.includes('坂道') && !t.includes('ページ'));

      const linkMatches = [...html.matchAll(/nogizaka46\.com\/s\/n46\/diary\/detail\/(\d+)/g)];
      const dateMatches = [...html.matchAll(/(\d{4}[\/\-]\d{2}[\/\-]\d{2}[\s　]+\d{2}:\d{2})/g)];

      // data-src や lazy load パターンも含めて画像を探す
      const imgMatches = [
        ...html.matchAll(/data-src="(https?:\/\/[^"]*\.(?:jpg|jpeg|png|webp))"/g),
        ...html.matchAll(/src="(https?:\/\/[^"]*\/blog-data\/[^"]*\.(?:jpg|jpeg|png|webp))"/g),
        ...html.matchAll(/src="(https?:\/\/[^"]*nogizaka[^"]*\.(?:jpg|jpeg|png|webp))"/g),
      ].map(m => m[1]).filter((v, i, arr) => arr.indexOf(v) === i);

      console.log(`  h3s: ${h3s.length}, imgs: ${imgMatches.length}, links: ${linkMatches.length}`);

      const uniqueLinks = [];
      for (const m of linkMatches) {
        if (!seenIds.has(m[1])) { seenIds.add(m[1]); uniqueLinks.push(m[1]); }
      }

      const count = Math.min(h3s.length, uniqueLinks.length);
      let added = 0;
      for (let i = 0; i < count; i++) {
        const title = h3s[i];
        if (!title || seenTitles.has(title)) continue;
        seenTitles.add(title);
        const articleId = uniqueLinks[i] || '';
        const imgSrc = imgMatches[i] || '';
        const rawDate = dateMatches[i]?.[1] || '';
        let dateStr = '';
        if (rawDate) {
          const p = rawDate.match(/(\d{4})[\/\-](\d{2})[\/\-](\d{2})[\s　]+(\d{2}):(\d{2})/);
          if (p) dateStr = new Date(+p[1], +p[2]-1, +p[3], +p[4], +p[5]).toISOString();
        }
        allPosts.push({ title, thumb: imgSrc, date: dateStr, articleId,
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

  // サムネイルがない記事は公式ページから取得（最初の10件のみ）
  const noThumb = allPosts.filter(p => !p.thumb && p.articleId).slice(0, 10);
  if (noThumb.length > 0) {
    console.log(`Fetching thumbnails for ${noThumb.length} articles...`);
    for (const post of noThumb) {
      post.thumb = await fetchThumbFromArticle(post.articleId);
      if (post.thumb) console.log(`  Got thumb for: ${post.title.substring(0, 20)}`);
      await new Promise(r => setTimeout(r, 300));
    }
  }

  // articleId は出力に含めない
  const output = allPosts.map(({ articleId, ...rest }) => rest);
  fs.writeFileSync('data/blog.json', JSON.stringify({ updated: new Date().toISOString(), items: output }, null, 2));
  console.log('Blog total:', output.length);
}

main();
