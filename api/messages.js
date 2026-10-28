// 留言板 API：GET 返回全部留言，POST 新增一条
// 持久化：优先使用 Vercel KV（Upstash Redis，环境变量 KV_REST_API_URL / KV_REST_API_TOKEN）
// 未配置 KV 时降级为内存存储（serverless 实例冷启动后会丢失，仅用于演示）

const KV_REST_API_URL = process.env.KV_REST_API_URL;
const KV_REST_API_TOKEN = process.env.KV_REST_API_TOKEN;
const KV_KEY = 'jiahao:messages';
const MAX_MESSAGES = 100;
const MAX_NAME = 30;
const MAX_CONTENT = 500;

// 内存 fallback（仅当前实例生命周期内有效）
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

function readBody(req) {
  return new Promise((resolve) => {
    if (req.body && typeof req.body === 'object') return resolve(req.body);
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > 1e6) req.destroy(); });
    req.on('end', () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch { resolve({}); }
    });
  });
}

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method === 'GET') {
    const messages = (await kvGet()) ?? memoryStore;
    return res.status(200).json({ messages });
  }

  if (req.method === 'POST') {
    const body = await readBody(req);
    const name = String(body.name || '').trim().slice(0, MAX_NAME);
    const content = String(body.content || '').trim().slice(0, MAX_CONTENT);

    if (!name || !content) {
      return res.status(400).json({ error: '昵称和内容都不能为空' });
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

    return res.status(200).json({ messages });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
