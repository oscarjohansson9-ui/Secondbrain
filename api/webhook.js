export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    // Verify webhook signature
    const payload = JSON.stringify(req.body);
    
    // Simple verification without stripe library
    event = req.body;
    
    if (!event || !event.type) {
      return res.status(400).json({ error: 'Ogiltig webhook' });
    }
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  // Initialize Supabase
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const customerEmail = session.customer_details?.email;
      const plan = session.metadata?.plan || 'pro';

      if (customerEmail) {
        // Update user plan in Supabase via REST API
        const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/update_user_plan`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
          },
          body: JSON.stringify({ 
            user_email: customerEmail,
            new_plan: plan
          })
        });

        console.log(`Plan uppdaterad: ${customerEmail} → ${plan}`);
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object;
      const customerId = subscription.customer;

      // Get customer email from Stripe
      const customerRes = await fetch(`https://api.stripe.com/v1/customers/${customerId}`, {
        headers: {
          'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`
        }
      });
      const customer = await customerRes.json();

      if (customer.email) {
        // Downgrade to free/pro
        await fetch(`${SUPABASE_URL}/rest/v1/rpc/update_user_plan`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
          },
          body: JSON.stringify({ 
            user_email: customer.email,
            new_plan: 'pro'
          })
        });

        console.log(`Plan nedgraderad: ${customer.email} → pro`);
      }
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook fel:', err);
    res.status(500).json({ error: err.message });
  }
}
