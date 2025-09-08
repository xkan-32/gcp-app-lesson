const express = require('express');
const app = express();
const port = process.env.PORT || 8080;
const { Pool } = require('pg');

// DB 接続設定（ホストは優先順位付きでフォールバック）
const dbHost =
  process.env.DB_HOST ||
  process.env.DB_RW_HOST ||
  process.env.DB_RO_HOST;

const dbPort = Number(process.env.DB_PORT || 5432);

const pgPool = new Pool({
  host: dbHost,
  port: dbPort,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD, // Secret Manager 注入
  ssl: false // Private IP 接続のため不要
});

// 起動時にDB疎通確認
(async () => {
  try {
    await pgPool.query('SELECT 1');
    console.log(`DB connected: ${dbHost}:${dbPort}`);
  } catch (e) {
    console.error('DB connect failed:', e.message);
  }
})();

// スキーマ初期化（orders テーブルがなければ作成）
async function ensureSchema() {
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id          BIGSERIAL PRIMARY KEY,
      item        TEXT NOT NULL,
      price       NUMERIC(10,2) NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders (created_at DESC);
  `);
  console.log('orders table is ready');
}
ensureSchema().catch(err => {
  console.error('Schema init failed', err);
});

// JSONボディパーサ
app.use(express.json());

// ルートエンドポイント
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to the Cloud Run Sample API!',
    timestamp: new Date().toISOString()
  });
});

// ヘルスチェック
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// サンプルAPI（エコー）
// db=true の場合は orders テーブルの件数を追加返却
app.post('/api/echo', async (req, res) => {
  const { message, db } = req.body || {};
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  const payload = {
    received: message,
    processedAt: new Date().toISOString()
  };

  if (db === true) {
    try {
      const { rows } = await pgPool.query('SELECT COUNT(*)::int AS count FROM orders');
      payload.db = { count: rows[0]?.count ?? 0 };
    } catch (e) {
      console.error('DB query failed', e);
      payload.db = { error: 'DB query failed' };
    }
  }

  res.json(payload);
});

// 注文一覧（最新50件）
app.get('/api/orders', async (req, res) => {
  try {
    const { rows } = await pgPool.query(
      'SELECT id, item, price, created_at FROM orders ORDER BY id DESC LIMIT 50'
    );
    res.json(rows);
  } catch (e) {
    console.error('DB query failed', e);
    res.status(500).json({ error: 'DB query failed' });
  }
});

// エラーハンドラ
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

// サーバー起動
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});