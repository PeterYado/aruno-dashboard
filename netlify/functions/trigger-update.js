// netlify/functions/trigger-update.js
// GitHub Actions workflow_dispatch をトリガーする

exports.handler = async (event, context) => {
  // POST のみ許可
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const token = process.env.GITHUB_PAT;
  if (!token) {
    return { statusCode: 500, body: JSON.stringify({ error: 'GITHUB_PAT not set' }) };
  }

  try {
    const res = await fetch(
      'https://api.github.com/repos/PeterYado/aruno-dashboard/actions/workflows/fetch-rss.yml/dispatches',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github+json',
          'Content-Type': 'application/json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        body: JSON.stringify({ ref: 'main' }),
      }
    );

    if (res.status === 204) {
      return {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ ok: true, message: 'GitHub Actions triggered!' }),
      };
    } else {
      const text = await res.text();
      return {
        statusCode: res.status,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: text }),
      };
    }
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
