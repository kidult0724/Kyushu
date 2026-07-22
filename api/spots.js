// Vercel Serverless Function：處理「使用者共同新增的景點／餐廳／住宿」的雲端讀寫。
// 這支程式碼只會在 Vercel 的伺服器端執行，DATABASE_URL 這組連線字串
// 是透過 Vercel 專案的環境變數注入，瀏覽器端永遠看不到、也抓不到。
//
// GET  /api/spots  → 回傳目前資料庫裡所有共用新增的項目
// POST /api/spots  → 新增一筆項目到資料庫（body 格式：{ "item": {...} }）

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

// 第一次呼叫時自動確保資料表存在，不需要另外手動建表
async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS user_items (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `;
}

export default async function handler(req, res) {
  try {
    await ensureTable();

    if (req.method === 'GET') {
      const rows = await sql`SELECT data FROM user_items ORDER BY created_at ASC`;
      const items = rows.map(r => r.data);
      res.status(200).json({ items });
      return;
    }

    if (req.method === 'POST') {
      const item = req.body && req.body.item;
      if (!item || !item.id || !item.name) {
        res.status(400).json({ error: '缺少必要欄位 (item.id / item.name)' });
        return;
      }
      await sql`
        INSERT INTO user_items (id, data)
        VALUES (${item.id}, ${JSON.stringify(item)})
        ON CONFLICT (id) DO NOTHING
      `;
      res.status(200).json({ ok: true });
      return;
    }

    if (req.method === 'DELETE') {
      const id = req.query && req.query.id;
      if (!id) {
        res.status(400).json({ error: '缺少 id 參數' });
        return;
      }
      await sql`DELETE FROM user_items WHERE id = ${id}`;
      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('spots api error:', err);
    res.status(500).json({ error: '伺服器發生錯誤', detail: String(err && err.message || err) });
  }
}
