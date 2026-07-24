// Vercel Serverless Function：處理「共用行程規劃」的雲端讀寫。
// 跟 spots.js 不同的是，行程是一份會被多人一起編輯的單一結構（Day1/Day2...），
// 所以這裡用「整包讀取、整包覆寫」的方式，而不是像景點那樣一筆一筆新增。
// 這代表如果兩個人在極短時間內同時編輯，後寫入的人會蓋過先寫入的人（last write wins）——
// 對一般朋友一起排行程的情境來說已經足夠，重度並行編輯衝突不在這個簡單方案的處理範圍內。
//
// GET /api/itinerary → 回傳目前共用的行程（Day 陣列）
// PUT /api/itinerary → 整包覆寫成傳進來的新行程

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS app_state (
      key TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT now()
    )
  `;
}

export default async function handler(req, res) {
  try {
    await ensureTable();

    if (req.method === 'GET') {
      const rows = await sql`SELECT data FROM app_state WHERE key = 'itinerary'`;
      const itinerary = rows.length ? rows[0].data : [[]];
      res.status(200).json({ itinerary });
      return;
    }

    if (req.method === 'PUT') {
      const itinerary = req.body && req.body.itinerary;
      if (!Array.isArray(itinerary)) {
        res.status(400).json({ error: '缺少 itinerary 陣列' });
        return;
      }
      await sql`
        INSERT INTO app_state (key, data, updated_at)
        VALUES ('itinerary', ${JSON.stringify(itinerary)}, now())
        ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data, updated_at = now()
      `;
      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('itinerary api error:', err);
    res.status(500).json({ error: '伺服器發生錯誤', detail: String(err && err.message || err) });
  }
}
