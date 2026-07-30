const https = require('https');

function postToUtmify(payload, token) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(payload);
    const options = {
      hostname: 'api.utmify.com.br',
      port: 443,
      path: '/api-credentials/orders',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
        'x-api-token': token,
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({ status: res.statusCode, body: data });
      });
    });

    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const body = JSON.parse(event.body);
    console.log('[UTMify Function] Request body:', JSON.stringify(body, null, 2));

    const token = process.env.UTMIFY_TOKEN || 'HNIuD0M6zetaINZlNEBZQAzabtvFovXyt8Ui';
    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);

    const amountInCents = body.amountInCents || Math.round((body.value || 131) * 100);

    const utmifyPayload = {
      orderId: body.orderId || `CP-${Date.now()}`,
      platform: body.platform || 'Beehive',
      paymentMethod: body.paymentMethod || 'pix',
      status: body.status || 'paid',
      createdAt: body.createdAt || nowStr,
      approvedDate: body.status === 'paid' ? (body.approvedDate || nowStr) : null,
      refundedAt: null,
      customer: {
        name: body.customer?.name || body.nome || 'Cliente',
        email: body.customer?.email || body.email || '',
        phone: (body.customer?.phone || body.telefone || '').replace(/\D/g, ''),
        document: (body.customer?.document || body.cpf || '').replace(/\D/g, ''),
      },
      products: [
        {
          id: 'kit_tapete',
          name: body.productName || 'Tapete Bandeja Premium Sob Medida',
          planId: null,
          planName: null,
          quantity: 1,
          priceInCents: amountInCents,
        },
      ],
      trackingParameters: {
        src: body.src || null,
        sck: body.sck || null,
        utm_source: body.utm_source || null,
        utm_medium: body.utm_medium || null,
        utm_campaign: body.utm_campaign || null,
        utm_content: body.utm_content || null,
        utm_term: body.utm_term || null,
      },
      commission: {
        totalPriceInCents: amountInCents,
        gatewayFeeInCents: 0,
        userCommissionInCents: amountInCents,
      },
      isTest: Boolean(body.isTest),
    };

    console.log('[UTMify Function] Sending payload:', JSON.stringify(utmifyPayload, null, 2));
    const result = await postToUtmify(utmifyPayload, token);
    console.log(`[UTMify Function] Resposta (${result.status}):`, result.body);

    return {
      statusCode: result.status,
      headers,
      body: result.body,
    };
  } catch (err) {
    console.error('[UTMify Function] Error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};
