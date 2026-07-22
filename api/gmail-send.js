export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  let body = req.body;
  if (typeof body === 'string') body = JSON.parse(body);
  const { userId, to, subject, message, threadId, messageId } = body || {};

  if (!userId || !to || !message) {
    return res.status(400).json({ error: 'Saknar userId, to eller message' });
  }

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
    const fromEmail = tokens[0].email;

    // Refresha token om den gått ut
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

    // Bygg email i RFC 2822-format
    const replySubject = subject?.startsWith('Re:') ? subject : `Re: ${subject || ''}`;
    const emailLines = [
      `From: ${fromEmail}`,
      `To: ${to}`,
      `Subject: ${replySubject}`,
      'Content-Type: text/plain; charset=utf-8',
      'MIME-Version: 1.0',
    ];

    // Lägg till thread-headers om det är ett svar
    if (messageId) emailLines.push(`In-Reply-To: ${messageId}`);
    if (messageId) emailLines.push(`References: ${messageId}`);

    emailLines.push('', message);

    const rawEmail = emailLines.join('\r\n');
    const encodedEmail = Buffer.from(rawEmail).toString('base64')
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    // Skicka via Gmail API
    const sendBody = { raw: encodedEmail };
    if (threadId) sendBody.threadId = threadId;

    const sendRes = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(sendBody)
      }
    );

    const sendData = await sendRes.json();

    if (!sendRes.ok) {
      return res.status(400).json({ error: sendData.error?.message || 'Kunde inte skicka mail' });
    }

    res.status(200).json({ success: true, messageId: sendData.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
