export default async function handler(req, res) {
  const { code, state: userId } = req.query;
  
  if (!code) {
    return res.redirect('/mail.html?error=no_code');
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = 'https://secondbrain-one-tau.vercel.app/api/gmail-callback';

  try {
    // Byt ut code mot tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    });

    const tokens = await tokenRes.json();
    console.log('Tokens:', JSON.stringify(tokens));

    if (tokens.error) {
      return res.redirect(`/mail.html?error=${encodeURIComponent(tokens.error_description || tokens.error)}`);
    }

    // Hämta användarens Gmail-adress
    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    });
    const userInfo = await userInfoRes.json();
    console.log('UserInfo:', JSON.stringify(userInfo));

    const gmailEmail = userInfo.email || '';

    // Spara tokens i Supabase
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

    const saveRes = await fetch(`${SUPABASE_URL}/rest/v1/gmail_tokens`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({ 
        user_id: userId,
        email: gmailEmail,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || '',
        expires_at: new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString()
      })
    });

    console.log('Save status:', saveRes.status);

    // Skicka tillbaka till mail-sidan med success
    res.redirect(`/mail.html?gmail=connected&email=${encodeURIComponent(gmailEmail)}`);
  } catch (err) {
    console.error('Callback error:', err);
    res.redirect('/mail.html?error=' + encodeURIComponent(err.message));
  }
}
