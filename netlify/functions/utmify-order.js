/**
 * utmify-order.js
 * Proxy para envio de eventos (waiting_payment e paid) para a UTMify.
 *
 * SUPORTA:
 * - waiting_payment: quando o PIX é gerado (venda pendente)
 * - paid: quando o pagamento é confirmado (venda aprovada)
 * - refunded / refused: se aplicável
 */

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
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

function mapStatus(inputStatus) {
  const s = (inputStatus || '').toLowerCase();
  if (s === 'paid' || s === 'pago' || s === 'approved' || s === 'completed') return 'paid';
  if (s === 'refunded' || s === 'reembolsado') return 'refunded';
  if (s === 'refused' || s === 'negado' || s === 'recusado') return 'refused';
  return 'waiting_payment';
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };

  try {
    const body = JSON.parse(event.body);
    console.log('[UTMify Function] Request body:', JSON.stringify(body, null, 2));

    const token = process.env.UTMIFY_TOKEN || 'cSOZLc4zjXQY48Nz6Mlk35KQqSXlLOiV53S8';
    const nowStr = new Date().toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' }).replace('T', ' ').substring(0, 19);

    const mappedStatus = mapStatus(body.status);
    const rawValue = parseFloat(body.value || body.totalPrice || body.final_price || 0);
    const amountInCents = body.amountInCents ? Math.round(body.amountInCents) : (rawValue > 0 ? Math.round(rawValue * 100) : 0);

    const trackingParams = body.trackingParameters || {
      src: body.src || null,
      sck: body.sck || null,
      utm_source: body.utm_source || null,
      utm_medium: body.utm_medium || null,
      utm_campaign: body.utm_campaign || null,
      utm_content: body.utm_content || null,
      utm_term: body.utm_term || null,
    };

    const utmifyPayload = {
      orderId: body.orderId || `CP-${Date.now()}`,
      platform: body.platform || 'Beehive',
      paymentMethod: body.paymentMethod || 'pix',
      status: mappedStatus,
      createdAt: body.createdAt || nowStr,
      approvedDate: mappedStatus === 'paid' ? (body.approvedDate || nowStr) : null,
      refundedAt: mappedStatus === 'refunded' ? (body.refundedAt || nowStr) : null,
      customer: {
        name: body.customer?.name || body.nome || 'Cliente',
        email: body.customer?.email || body.email || '',
        phone: (body.customer?.phone || body.telefone || '').replace(/\D/g, ''),
        document: (body.customer?.document || body.cpf || '').replace(/\D/g, ''),
      },
      products: [{
        id: 'kit_tapete',
        name: body.productName || 'Tapete Bandeja Premium Sob Medida',
        planId: null,
        planName: null,
        quantity: 1,
        priceInCents: amountInCents,
      }],
      trackingParameters: trackingParams,
      commission: {
        totalPriceInCents: amountInCents,
        gatewayFeeInCents: 0,
        userCommissionInCents: amountInCents,
      },
      isTest: Boolean(body.isTest),
    };

    console.log(`[UTMify Function] Sending payload (${mappedStatus}):`, JSON.stringify(utmifyPayload, null, 2));
    const result = await postToUtmify(utmifyPayload, token);
    console.log(`[UTMify Function] Resposta (${result.status}):`, result.body);

    return { statusCode: result.status, headers, body: result.body };
  } catch (err) {
    console.error('[UTMify Function] Error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
