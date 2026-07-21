export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  let body = req.body;
  if (typeof body === 'string') body = JSON.parse(body);
  const { priceId, email, plan } = body || {};

  if (!priceId) {
    return res.status(400).json({ error: 'Saknar priceId' });
  }

  try {
    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        'payment_method_types[]': 'card',
        'mode': 'subscription',
        'line_items[0][price]': priceId,
        'line_items[0][quantity]': '1',
        'success_url': 'https://secondbrain-one-tau.vercel.app/app.html?payment=success',
        'cancel_url': 'https://secondbrain-one-tau.vercel.app/pricing.html',
        'metadata[plan]': plan || ''
      })
    });

    const session = await response.json();

    if (!response.ok) {
      return res.status(400).json({ 
        error: session.error?.message || 'Stripe-fel', 
        details: session 
      });
    }

    res.status(200).json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
