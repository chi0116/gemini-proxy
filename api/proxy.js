// api/proxy.ts
export const config = {
  runtime: 'edge', // 使用 Edge 模式，速度極快且運行於全球海外節點
};

export default async function handler(req: Request) {
  // 處理 CORS 預檢請求
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const body = await req.json();
    const authHeader = req.headers.get('Authorization') || '';

    // 由 Vercel 海外伺服器（非香港 IP）發送請求給 OpenRouter
    const openrouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://excel.script',
        'X-Title': 'Excel Schedule Parser'
      },
      body: JSON.stringify(body),
    });

    const data = await openrouterResponse.json();

    return new Response(JSON.stringify(data), {
      status: openrouterResponse.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Proxy Internal Error' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}
