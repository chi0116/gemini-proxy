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

    // 2. 穩定模型優先陣列 (優先使用指定模型 -> Lite 低負載模型 -> Pro 模型 -> Flash)
    const requestedModel = req.query.model;
    const fallbackList = [
      'gemini-2.5-flash-lite', // 負載極低，測試最穩定
      'gemini-1.5-flash-8b',   // 輕量 8B 版，反應快
      'gemini-2.5-flash',      // 標準 Flash
      'gemini-1.5-pro'         // 獨立 Pro 伺服器池備援
    ];

    const modelsToTry = requestedModel 
      ? [requestedModel, ...fallbackList.filter(m => m !== requestedModel)]
      : fallbackList;

    let lastErrorData = null;
    let lastStatus = 503;

    for (const model of modelsToTry) {
      // 每個模型最多重試 3 次
      for (let attempt = 0; attempt < 3; attempt++) {
        const targetUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const response = await fetch(targetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(req.body)
        });

        const data = await response.json();

        // 請求成功，直接回傳
        if (response.ok) {
          return res.status(200).json(data);
        }

        lastErrorData = data;
        lastStatus = response.status;

        // 若為 404 (模型下架) 或 400 (格式錯誤)，不需重試該 model，直接跳到下一個模型
        if (response.status === 404 || response.status === 400) {
          break;
        }

        // 若為 503 (伺服器爆滿)，採用指數退避演算法 (2s, 4s) 加上隨機微秒，避免同時擠爆伺服器
        if (response.status === 503) {
          const delay = Math.pow(2, attempt) * 2000 + Math.random() * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          break;
        }
      }
    }

    return res.status(lastStatus).json(lastErrorData);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
