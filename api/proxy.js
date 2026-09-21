export default async function handler(req, res) {
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

    const requestedModel = req.query.model || 'gemini-3.6-flash';

    // 1. 嘗試呼叫 API
    let result = await tryGenerateContent(requestedModel, apiKey, req.body);

    if (result.ok) {
      return res.status(200).json(result.data);
    }

    // 2. 如果遇到 404 (模型下架)，自動查詢最新線上可用模型
    if (result.status === 404) {
      console.log(`模型 ${requestedModel} 報 404，正在向 Google 查詢最新模型...`);

      const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      const listData = await listRes.json();

      if (listData.models && listData.models.length > 0) {
        const validModels = listData.models.filter(m => 
          m.supportedGenerationMethods && 
          m.supportedGenerationMethods.includes('generateContent')
        );

        const bestModelObj = validModels.find(m => m.name.includes('flash')) || validModels[0];

        if (bestModelObj) {
          const realModelName = bestModelObj.name.replace('models/', '');
          console.log(`自動切換至最新模型：${realModelName}`);

          result = await tryGenerateContent(realModelName, apiKey, req.body);
          if (result.ok) {
            return res.status(200).json(result.data);
          }
        }
      }
    }

    return res.status(result.status).json(result.data);

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

// 帶有 429 冷卻 + 503 重試嘅發送邏輯
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

    // 如果遇到 429 速率限制，自動等待 10 秒後重試一次
    if (response.status === 429) {
      console.log("遇到 429 限流，自動等待 10 秒冷卻...");
      await new Promise(resolve => setTimeout(resolve, 10000));
      continue;
    }

    // 如果遇到 503 爆滿，退避 2 秒、4 秒後重試
    if (response.status === 503) {
      const delay = Math.pow(2, attempt) * 2000 + Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
      continue;
    }

    // 其他錯誤 (例如 400 API Key 錯誤)，不重試
    break;
  }

  return { ok: false, status: lastStatus, data: lastData };
}
