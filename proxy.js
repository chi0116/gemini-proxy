export default async function handler(req, res) {
  // 1. 設定 CORS 標頭，允許任何網域（包括 Excel Online）存取
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  // 2. 處理瀏覽器的 OPTIONS 預檢請求 (Preflight)
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // 3. 取得原始請求路徑與 Query 參數 (如 ?key=...)
    const url = new URL(req.url, `https://${req.headers.host}`);
    const targetUrl = `https://generativelanguage.googleapis.com${url.pathname}${url.search}`;

    // 4. 由 Vercel 伺服器端發送請求至 Google Gemini API
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined,
    });

    const data = await response.json();

    // 5. 將 Google 回應帶上 CORS 標頭傳回 Excel Online
    res.status(response.status).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}