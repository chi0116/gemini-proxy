export default async function handler(req, res) {
  // 1. 設定 CORS 標頭允許 Excel Online 跨域請求
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // 2. 處理瀏覽器預檢請求 (OPTIONS)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const apiKey = req.query.key;
    // 優先使用 gemini-3.6-flash，若遇到 503 繁忙則自動降級使用 gemini-1.5-flash
    const models = ['gemini-3.6-flash', 'gemini-1.5-flash'];
    let lastErrorData = null;

    for (const model of models) {
      const targetUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body)
      });

      const data = await response.json();

      // 若非 503 繁忙（例如成功 200 或其他錯誤），直接回傳結果
      if (response.status !== 503) {
        return res.status(response.status).json(data);
      }

      lastErrorData = data;
      console.warn(`[Proxy] Model ${model} returned 503, trying fallback model...`);
    }

    // 若所有模型均繁忙，回傳最後的錯誤
    return res.status(503).json(lastErrorData);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
