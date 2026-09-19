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
    if (!apiKey) {
      return res.status(400).json({ error: { message: "API key is missing" } });
    }

    // 備用模型清單
    const models = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash'];
    let lastErrorData = null;
    let lastStatus = 503;

    for (const model of models) {
      // 每個模型遇到 503 時自動重試最多 2 次
      for (let attempt = 0; attempt < 2; attempt++) {
        const targetUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const response = await fetch(targetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(req.body)
        });

        const data = await response.json();

        // 成功取得資料，直接回傳
        if (response.ok) {
          return res.status(200).json(data);
        }

        lastErrorData = data;
        lastStatus = response.status;

        // 若非 503 (例如 400 錯誤)，不需重試該模型
        if (response.status !== 503) {
          break;
        }

        // 若為 503，延遲 1 秒後自動重試
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return res.status(lastStatus).json(lastErrorData);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
