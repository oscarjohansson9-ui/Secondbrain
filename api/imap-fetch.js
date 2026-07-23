export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  let body = req.body;
  if (typeof body === 'string') body = JSON.parse(body);
  const { userId } = body || {};

  if (!userId) return res.status(400).json({ error: 'Saknar userId' });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

  try {
    // Hämta mailkoppling från Supabase
    const connRes = await fetch(
      `${SUPABASE_URL}/rest/v1/mail_connections?user_id=eq.${userId}&select=*`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        }
      }
    );
    const connections = await connRes.json();
    
    if (!connections.length) {
      return res.status(404).json({ error: 'Ingen mailkoppling hittad' });
    }

    const conn = connections[0];

    // Om Gmail — använd befintlig gmail-fetch logik
    if (conn.provider === 'gmail') {
      return res.status(200).json({ redirect: 'gmail', email: conn.email });
    }

    // IMAP för one.com och andra
    const imapConfig = getImapConfig(conn.email);
    
    // Använd fetch mot Vercel edge för IMAP
    // Returnera anslutningsinfo för klienten
    return res.status(200).json({
      provider: conn.provider,
      email: conn.email,
      imapHost: imapConfig.host,
      imapPort: imapConfig.port,
      signature: conn.signature || ''
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

function getImapConfig(email) {
  const domain = email.split('@')[1]?.toLowerCase();
  const configs = {
    'one.com': { host: 'imap.one.com', port: 993 },
    'gmail.com': { host: 'imap.gmail.com', port: 993 },
    'outlook.com': { host: 'outlook.office365.com', port: 993 },
    'hotmail.com': { host: 'outlook.office365.com', port: 993 },
    'live.com': { host: 'outlook.office365.com', port: 993 },
  };
  return configs[domain] || { host: `imap.${domain}`, port: 993 };
}
