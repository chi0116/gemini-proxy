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

    // 預設嘗試模型（優先使用最新 gemini-3.6-flash）
    const requestedModel = req.query.model || 'gemini-3.6-flash';

    // 2. 嘗試呼叫目標模型 (內含 503 重試邏輯)
    let result = await tryGenerateContent(requestedModel, apiKey, req.body);

    // 如果成功，直接回傳結果
    if (result.ok) {
      return res.status(200).json(result.data);
    }

    // 3. 如果遇到 404 (代表該 Model 名稱已失效/下架)，自動向 Google 查詢最新線上可用模型
    if (result.status === 404) {
      console.log(`模型 ${requestedModel} 報 404 (已下架)，正在向 Google 查詢最新線上模型...`);

      const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      const listData = await listRes.json();

      if (listData.models && listData.models.length > 0) {
        // 過濾出支援 generateContent 的線上模型
        const validModels = listData.models.filter(m => 
          m.supportedGenerationMethods && 
          m.supportedGenerationMethods.includes('generateContent')
        );

        // 優先挑選名稱含 flash 的模型，若無則挑第一個可用模型
        const bestModelObj = validModels.find(m => m.name.includes('flash')) || validModels[0];

        if (bestModelObj) {
          const realModelName = bestModelObj.name.replace('models/', '');
          console.log(`自動切換至最新線上模型：${realModelName}`);

          result = await tryGenerateContent(realModelName, apiKey, req.body);
          if (result.ok) {
            return res.status(200).json(result.data);
          }
        }
      }
    }

    // 回傳最終錯誤訊息
    return res.status(result.status).json(result.data);

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

// 輔助函式：帶有 503 指數退避 (Exponential Backoff) 的發送邏輯
async function tryGenerateContent(model, apiKey, body) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  let lastData = null;
  let lastStatus = 503;

  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    if (response.ok) {
      return { ok: true, status: 200, data };
    }

    lastData = data;
    lastStatus = response.status;

    // 若非 503 爆滿 (例如 404 或 400)，直接跳出不重試此模型
    if (response.status !== 503) {
      break;
    }

    // 遇到 503 爆滿時，進行退避延遲 (2s, 4s...)
    const delay = Math.pow(2, attempt) * 2000 + Math.random() * 1000;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  return { ok: false, status: lastStatus, data: lastData };
}
