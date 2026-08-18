// netlify/functions/verify-payment.js
// Given a Stripe Checkout session_id, asks Stripe's servers whether it was
// actually paid. Returns { paid: true/false }. The Stripe secret key never
// touches the browser — it only ever lives here, on Netlify's servers.

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let sessionId;
  try {
    const body = JSON.parse(event.body || '{}');
    sessionId = (body.sessionId || '').trim();
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body' }) };
  }

  if (!sessionId || !sessionId.startsWith('cs_')) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing or invalid session ID' }) };
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Server is not configured (missing Stripe key).' }) };
  }

  try {
    const resp = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${secretKey}` },
      }
    );

    if (!resp.ok) {
      const errText = await resp.text();
      console.error('Stripe API error:', resp.status, errText);
      return { statusCode: 502, body: JSON.stringify({ error: 'Could not reach Stripe to verify payment.' }) };
    }

    const session = await resp.json();
    const paid = session.payment_status === 'paid';

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paid }),
    };
  } catch (err) {
    console.error('Function error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Unexpected server error verifying payment.' }) };
  }
};
