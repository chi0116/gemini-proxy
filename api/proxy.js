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
    // 使用目前 Google AI Studio 官方支援的現行模型順序
    const models = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-3.6-flash'];
    let lastErrorData = null;
    let lastStatus = 500;

    for (const model of models) {
      const targetUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body)
      });

      const data = await response.json();

      // 若成功回傳 200，直接輸出結果
      if (response.ok) {
        return res.status(200).json(data);
      }

      lastErrorData = data;
      lastStatus = response.status;

      // 若遇到 503 (伺服器過載) 或 404 (舊模型停用)，自動嘗試下一個模型
      if (response.status === 503 || response.status === 404) {
        console.warn(`[Proxy] Model ${model} returned ${response.status}, retrying next model...`);
        continue;
      }

      // 其他錯誤（如 API Key 權限錯誤）直接回傳
      return res.status(response.status).json(data);
    }

    // 若所有模型皆失敗，回傳最後的錯誤
    return res.status(lastStatus).json(lastErrorData);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
