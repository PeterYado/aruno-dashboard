// netlify/functions/youtube.js
// YouTube RSS フィードをサーバーサイドで取得 → CORS完全回避

const YT_CHANNEL_ID = 'UCfvohDfHt1v5N8l3BzPRsWQ';

exports.handler = async (event, context) => {
  const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${YT_CHANNEL_ID}`;

  try {
    const res = await fetch(rssUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Accept': 'application/atom+xml, application/xml, text/xml, */*',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) throw new Error(`YouTube RSS fetch failed: ${res.status}`);

    const xml = await res.text();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=300', // 5分キャッシュ
      },
      body: xml,
    };
  } catch (err) {
    console.error('youtube function error:', err);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
