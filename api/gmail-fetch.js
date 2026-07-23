export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  let body = req.body;
  if (typeof body === 'string') body = JSON.parse(body);
  const { userId, maxResults = 20 } = body || {};

  if (!userId) return res.status(400).json({ error: 'Saknar userId' });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

  try {
    const tokenRes = await fetch(
      `${SUPABASE_URL}/rest/v1/gmail_tokens?user_id=eq.${userId}&select=*`,
      { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } }
    );
    const tokens = await tokenRes.json();
    if (!tokens.length) return res.status(404).json({ error: 'Gmail ej ansluten' });

    let accessToken = tokens[0].access_token;

    // Refresha om utgången
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
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` },
        body: JSON.stringify({ access_token: accessToken, expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString() })
      });
    }

    // Hämta maillista
    const listRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}&labelIds=INBOX`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const list = await listRes.json();
    if (!list.messages) return res.status(200).json({ emails: [], gmailEmail: tokens[0].email });

    // Hämta detaljer inkl. bilder
    const emails = await Promise.all(
      list.messages.slice(0, maxResults).map(async (msg) => {
        const msgRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const msgData = await msgRes.json();
        const headers = msgData.payload.headers;
        const subject = headers.find(h => h.name === 'Subject')?.value || '(Inget ämne)';
        const from = headers.find(h => h.name === 'From')?.value || '';
        const date = headers.find(h => h.name === 'Date')?.value || '';
        const messageId = headers.find(h => h.name === 'Message-ID')?.value || '';
        const isUnread = msgData.labelIds?.includes('UNREAD') || false;

        // Extrahera text och bilder från alla delar
        let bodyText = '';
        let inlineImages = [];
        let attachments = [];

        function extractParts(parts, depth = 0) {
          if (!parts) return;
          for (const part of parts) {
            if (part.mimeType === 'text/plain' && part.body?.data) {
              bodyText = Buffer.from(part.body.data, 'base64').toString('utf-8');
            }
            // Inline bilder
            if (part.mimeType?.startsWith('image/') && part.body?.data) {
              inlineImages.push({
                mimeType: part.mimeType,
                data: part.body.data,
                filename: part.filename || 'bild'
              });
            }
            // Bifogade filer med attachmentId
            if (part.body?.attachmentId && part.mimeType?.startsWith('image/')) {
              attachments.push({
                attachmentId: part.body.attachmentId,
                mimeType: part.mimeType,
                filename: part.filename || 'bild',
                messageId: msg.id
              });
            }
            // Rekursivt för nested parts
            if (part.parts) extractParts(part.parts, depth + 1);
          }
        }

        // Kolla payload direkt
        if (msgData.payload.body?.data && msgData.payload.mimeType === 'text/plain') {
          bodyText = Buffer.from(msgData.payload.body.data, 'base64').toString('utf-8');
        }
        extractParts(msgData.payload.parts);

        // Hämta bifogade bilder (max 2 per mail för prestanda)
        const fetchedAttachments = await Promise.all(
          attachments.slice(0, 2).map(async (att) => {
            try {
              const attRes = await fetch(
                `https://gmail.googleapis.com/gmail/v1/users/me/messages/${att.messageId}/attachments/${att.attachmentId}`,
                { headers: { Authorization: `Bearer ${accessToken}` } }
              );
              const attData = await attRes.json();
              return { mimeType: att.mimeType, data: attData.data, filename: att.filename };
            } catch { return null; }
          })
        );

        const allImages = [
          ...inlineImages,
          ...fetchedAttachments.filter(Boolean)
        ].slice(0, 3); // Max 3 bilder per mail

        return {
          id: msg.id,
          threadId: msgData.threadId,
          messageId,
          subject,
          from,
          date,
          body: bodyText.slice(0, 2000),
          images: allImages,
          hasImages: allImages.length > 0,
          unread: isUnread
        };
      })
    );

    res.status(200).json({ emails, gmailEmail: tokens[0].email });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
