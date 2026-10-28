// Netlify Functions: GET /api/messages 返回留言列表，POST 新增一条
// 路径通过 netlify.toml 重写 /api/messages -> /.netlify/functions/messages

const KV_REST_API_URL = process.env.KV_REST_API_URL;
const KV_REST_API_TOKEN = process.env.KV_REST_API_TOKEN;
const KV_KEY = 'jiahao:messages';
const MAX_MESSAGES = 100;
const MAX_NAME = 30;
const MAX_CONTENT = 500;

// 内存 fallback（Netlify Functions 冷启动后会丢失，仅用于演示）
let memoryStore = [];

async function kvGet() {
  if (!KV_REST_API_URL || !KV_REST_API_TOKEN) return null;
  try {
    const res = await fetch(`${KV_REST_API_URL}/get/${KV_KEY}`, {
      headers: { Authorization: `Bearer ${KV_REST_API_TOKEN}` },
    });
    const data = await res.json();
    if (!data || data.result == null) return [];
    const parsed = JSON.parse(data.result);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('KV get failed:', e);
    return null;
  }
}

async function kvSet(messages) {
  if (!KV_REST_API_URL || !KV_REST_API_TOKEN) return;
  try {
    await fetch(`${KV_REST_API_URL}/set/${KV_KEY}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${KV_REST_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });
  } catch (e) {
    console.error('KV set failed:', e);
  }
}

const commonHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json; charset=utf-8',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: commonHeaders, body: '' };
  }

  if (event.httpMethod === 'GET') {
    const messages = (await kvGet()) ?? memoryStore;
    return {
      statusCode: 200,
      headers: commonHeaders,
      body: JSON.stringify({ messages }),
    };
  }

  if (event.httpMethod === 'POST') {
    let body = {};
    try {
      body = event.body ? JSON.parse(event.body) : {};
    } catch {
      body = {};
    }
    const name = String(body.name || '').trim().slice(0, MAX_NAME);
    const content = String(body.content || '').trim().slice(0, MAX_CONTENT);

    if (!name || !content) {
      return {
        statusCode: 400,
        headers: commonHeaders,
        body: JSON.stringify({ error: '昵称和内容都不能为空' }),
      };
    }

    const messages = (await kvGet()) ?? memoryStore;
    const msg = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name,
      content,
      time: new Date().toISOString(),
    };
    messages.unshift(msg);
    if (messages.length > MAX_MESSAGES) messages.length = MAX_MESSAGES;

    if (KV_REST_API_URL && KV_REST_API_TOKEN) {
      await kvSet(messages);
    } else {
      memoryStore = messages;
    }

    return {
      statusCode: 200,
      headers: commonHeaders,
      body: JSON.stringify({ messages }),
    };
  }

  return {
    statusCode: 405,
    headers: commonHeaders,
    body: JSON.stringify({ error: 'Method not allowed' }),
  };
};
