export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  let body = req.body;
  if (typeof body === 'string') body = JSON.parse(body);
  const { userId, maxResults = 10 } = body || {};

  if (!userId) return res.status(400).json({ error: 'Saknar userId' });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

  try {
    // Hämta tokens från Supabase
    const tokenRes = await fetch(
      `${SUPABASE_URL}/rest/v1/gmail_tokens?user_id=eq.${userId}&select=*`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        }
      }
    );
    const tokens = await tokenRes.json();
    if (!tokens.length) return res.status(404).json({ error: 'Gmail ej ansluten' });

    let accessToken = tokens[0].access_token;

    // Kolla om token har gått ut och refresha
    if (new Date(tokens[0].expires_at) < new Date()) {
      const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          refresh_token: tokens[0].refresh_token,
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          grant_type: 'refresh_token'
        })
      });
      const refreshed = await refreshRes.json();
      accessToken = refreshed.access_token;

      // Uppdatera token i Supabase
      await fetch(`${SUPABASE_URL}/rest/v1/gmail_tokens?user_id=eq.${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        },
        body: JSON.stringify({
          access_token: accessToken,
          expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
        })
      });
    }

    // Hämta senaste mail från Gmail
    const listRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}&labelIds=INBOX&q=is:unread`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const list = await listRes.json();

    if (!list.messages) return res.status(200).json({ emails: [] });

    // Hämta detaljer för varje mail
    const emails = await Promise.all(
      list.messages.slice(0, 5).map(async (msg) => {
        const msgRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const msgData = await msgRes.json();
        
        const headers = msgData.payload.headers;
        const subject = headers.find(h => h.name === 'Subject')?.value || '(Inget ämne)';
        const from = headers.find(h => h.name === 'From')?.value || '';
        const date = headers.find(h => h.name === 'Date')?.value || '';
        
        // Hämta textinnehåll
        let body = '';
        if (msgData.payload.parts) {
          const textPart = msgData.payload.parts.find(p => p.mimeType === 'text/plain');
          if (textPart?.body?.data) {
            body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
          }
        } else if (msgData.payload.body?.data) {
          body = Buffer.from(msgData.payload.body.data, 'base64').toString('utf-8');
        }

        return { id: msg.id, subject, from, date, body: body.slice(0, 1000) };
      })
    );

    res.status(200).json({ emails, gmailEmail: tokens[0].email });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
