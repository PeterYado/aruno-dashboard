// netlify/functions/news.js
// インメモリキャッシュ + CDNキャッシュで高速化

let cache = { data: null, at: 0 };
const CACHE_TTL = 10 * 60 * 1000; // 10分

exports.handler = async (event, context) => {
  const now = Date.now();

  // インメモリキャッシュが生きていればすぐ返す
  if (cache.data && (now - cache.at) < CACHE_TTL) {
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, s-maxage=600, max-age=600, stale-while-revalidate=300',
        'X-Cache': 'HIT',
      },
      body: cache.data,
    };
  }

  const query = '中西アルノ 乃木坂46';
  const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ja&gl=JP&ceid=JP:ja`;

  try {
    const res = await fetch(rssUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) throw new Error(`RSS fetch failed: ${res.status}`);

    const xml = await res.text();
    cache = { data: xml, at: now };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, s-maxage=600, max-age=600, stale-while-revalidate=300',
        'X-Cache': 'MISS',
      },
      body: xml,
    };
  } catch (err) {
    // キャッシュが古くても返す（フォールバック）
    if (cache.data) {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/xml; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, s-maxage=60, max-age=60',
          'X-Cache': 'STALE',
        },
        body: cache.data,
      };
    }
    console.error('news function error:', err);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
