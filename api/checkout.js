export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { priceId, email, plan } = req.body;

  if (!priceId || !email) {
    return res.status(400).json({ error: 'Saknar priceId eller email' });
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
        'customer_email': email,
        'line_items[0][price]': priceId,
        'line_items[0][quantity]': '1',
        'success_url': `${process.env.NEXT_PUBLIC_SITE_URL || 'https://secondbrain-one-tau.vercel.app'}/app.html?payment=success&plan=${plan}`,
        'cancel_url': `${process.env.NEXT_PUBLIC_SITE_URL || 'https://secondbrain-one-tau.vercel.app'}/pricing.html`,
        'metadata[plan]': plan
      })
    });

    const session = await response.json();

    if (!response.ok) {
      return res.status(400).json({ error: session.error?.message || 'Stripe-fel' });
    }

    res.status(200).json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
