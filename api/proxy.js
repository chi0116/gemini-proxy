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

    // 3. 優先使用 Office Script 傳入的 model，否則使用最新官方支援的模型備用清單
    const requestedModel = req.query.model;
    const defaultModels = ['gemini-3.6-flash', 'gemini-1.5-flash'];
    
    // 如果有傳入 requestedModel，將其排在第一位嘗試
    const models = requestedModel 
      ? [requestedModel, ...defaultModels.filter(m => m !== requestedModel)]
      : defaultModels;

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

        // 若為 404 (模型不存在/已停用) 或 400 (參數錯誤)，不重試這個 model，直接跳出嘗試下一個 model
        if (response.status === 404 || response.status === 400) {
          break;
        }

        // 若非 503，也不需要重試
        if (response.status !== 503) {
          break;
        }

        // 若為 503，延遲 1 秒後自動重試
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // 如果所有 Model 都失敗，回傳最後一次的錯誤訊息
    return res.status(lastStatus).json(lastErrorData);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
