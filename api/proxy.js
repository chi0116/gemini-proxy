export default async function handler(req, res) {
  // 1. 設定 CORS 標頭允許 Excel 跨域請求
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const apiKey = req.query.key;
    if (!apiKey) {
      return res.status(400).json({ error: { message: "API key is missing" } });
    }

    // 2. 優先使用指定的 model，未指定則預設使用 gemini-3.6-flash
    let targetModel = req.query.model || 'gemini-3.6-flash';

    let targetUrl = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${apiKey}`;

    let response = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });

    let data = await response.json();

    // 如果請求成功，直接回傳結果
    if (response.ok) {
      return res.status(200).json(data);
    }

    // 3.【關鍵升級】如果遇到 404 (模型已被 Google 下架)，自動查詢 ListModels 取得最新可用模型
    if (response.status === 404) {
      console.log(`模型 ${targetModel} 無效 (404)，自動向 Google 查詢最新可用模型...`);

      const listModelsUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
      const listRes = await fetch(listModelsUrl);
      const listData = await listRes.json();

      if (listData.models && listData.models.length > 0) {
        // 篩選出支援 generateContent 且名稱包含 flash 嘅最新可用模型
        const activeFlashModel = listData.models.find(m => 
          m.supportedGenerationMethods && 
          m.supportedGenerationMethods.includes('generateContent') && 
          m.name.includes('flash')
        );

        if (activeFlashModel) {
          // 清除 "models/" 字頭取得純模型名稱
          const activeModelName = activeFlashModel.name.replace('models/', '');
          console.log(`成功找到替代模型：${activeModelName}`);

          // 自動用最新模型重新發送請求
          const retryUrl = `https://generativelanguage.googleapis.com/v1beta/models/${activeModelName}:generateContent?key=${apiKey}`;
          const retryRes = await fetch(retryUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body)
          });
          const retryData = await retryRes.json();

          if (retryRes.ok) {
            return res.status(200).json(retryData);
          }
          return res.status(retryRes.status).json(retryData);
        }
      }
    }

    // 如果非 404 錯誤（如 400 API Key 錯誤），回傳原本的錯誤訊息
    return res.status(response.status).json(data);

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
