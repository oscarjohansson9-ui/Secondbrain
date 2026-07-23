export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  let body = req.body;
  if (typeof body === 'string') body = JSON.parse(body);
  const { userId, provider, email, signature } = body || {};

  if (!userId || !provider || !email) {
    return res.status(400).json({ error: 'Saknar userId, provider eller email' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

  try {
    const saveRes = await fetch(`${SUPABASE_URL}/rest/v1/mail_connections`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({ user_id: userId, provider, email, signature: signature || '' })
    });

    if (!saveRes.ok) {
      const err = await saveRes.text();
      return res.status(400).json({ error: err });
    }

    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
