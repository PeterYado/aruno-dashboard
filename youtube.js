// netlify/functions/youtube.js
// インメモリキャッシュ + CDNキャッシュで高速化

const YT_CHANNEL_ID = 'UCfvohDfHt1v5N8l3BzPRsWQ';
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

  const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${YT_CHANNEL_ID}`;

  try {
    const res = await fetch(rssUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Accept': 'application/atom+xml, application/xml, text/xml, */*',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) throw new Error(`YouTube RSS fetch failed: ${res.status}`);

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
    console.error('youtube function error:', err);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
