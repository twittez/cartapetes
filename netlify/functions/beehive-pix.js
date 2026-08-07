// netlify/functions/beehive-pix.js
// Proxy server-side para criar transações PIX na Beehive.
// Mantém a SK fora do frontend.
// Inclui verificação de IP via ip-guard antes de criar a transação.
// Dispara evento 'waiting_payment' para a UTMify diretamente do servidor.

const { createClient } = require('@supabase/supabase-js');
const https = require('https');

const MAX_ORDERS_PER_IP = 3;

function getClientIp(headers) {
  const raw =
    headers['x-nf-client-connection-ip'] ||
    headers['x-real-ip'] ||
    headers['x-forwarded-for'] ||
    headers['client-ip'] ||
    '0.0.0.0';
  return raw.split(',')[0].trim();
}

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

async function checkIpBlocked(clientIp) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) return false;

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { count, error } = await supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('client_ip', clientIp)
      .in('status', ['pendente', 'pago', 'em_producao']);

    if (error) {
      console.error('[beehive-pix IP Guard] Erro Supabase:', error.message);
      return false; // fail-open
    }

    return (count || 0) >= MAX_ORDERS_PER_IP;
  } catch (err) {
    console.error('[beehive-pix IP Guard] Exceção:', err.message);
    return false;
  }
}

exports.handler = async (event) => {
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
    const clientIp = getClientIp(event.headers);
    const isBlocked = await checkIpBlocked(clientIp);

    if (isBlocked) {
      console.warn(`[beehive-pix] ⛔ IP BLOQUEADO: ${clientIp} — limite de ${MAX_ORDERS_PER_IP} pedidos atingido.`);
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({
          error: 'IP_BLOCKED',
          message: 'Limite de pedidos atingido para este endereço de IP.',
          blocked: true,
        }),
      };
    }

    const BEEHIVE_SK = process.env.VITE_BEEHIVE_SK || process.env.BEEHIVE_SK || '';
    if (!BEEHIVE_SK) {
      console.error('[beehive-pix] VITE_BEEHIVE_SK não definido nas variáveis de ambiente!');
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Gateway não configurado' }) };
    }

    const beehiveToken = Buffer.from(`${BEEHIVE_SK}:x`).toString('base64');
    const body = event.body;

    let parsedBody;
    try {
      parsedBody = JSON.parse(body);
      if (!parsedBody.metadata) parsedBody.metadata = {};
      parsedBody.metadata.client_ip = clientIp;
    } catch (e) {
      parsedBody = null;
    }

    console.log('[beehive-pix] Criando PIX na Beehive para IP:', clientIp);

    const response = await fetch('https://api.conta.paybeehive.com.br/v1/transactions', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${beehiveToken}`,
        'Content-Type': 'application/json'
      },
      body: parsedBody ? JSON.stringify(parsedBody) : body
    });

    const text = await response.text();
    console.log(`[beehive-pix] Beehive status ${response.status}:`, text);

    if (response.status === 200 || response.status === 201) {
      try {
        const responseData = JSON.parse(text);
        responseData._client_ip = clientIp;

        // Dispara evento 'waiting_payment' para a UTMify via servidor
        const utmifyToken = process.env.UTMIFY_TOKEN || 'cSOZLc4zjXQY48Nz6Mlk35KQqSXlLOiV53S8';
        const nowStr = new Date().toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' }).replace('T', ' ').substring(0, 19);
        const orderId = parsedBody?.metadata?.order_id || `CP-${responseData.id || Date.now()}`;
        const cust = parsedBody?.customer || {};
        const meta = parsedBody?.metadata || {};

        const utmifyPayload = {
          orderId: orderId,
          platform: 'Beehive',
          paymentMethod: 'pix',
          status: 'waiting_payment',
          createdAt: nowStr,
          approvedDate: null,
          refundedAt: null,
          customer: {
            name: cust.name || 'Cliente',
            email: cust.email || '',
            phone: (cust.phone || '').replace(/\D/g, ''),
            document: (cust.document?.number || '').replace(/\D/g, ''),
          },
          products: [{
            id: 'kit_tapete',
            name: 'Tapete Bandeja Premium Sob Medida',
            planId: null,
            planName: null,
            quantity: 1,
            priceInCents: parsedBody?.amount || 0,
          }],
          trackingParameters: {
            src: meta.src || null,
            sck: meta.sck || null,
            utm_source: meta.utm_source || null,
            utm_medium: meta.utm_medium || null,
            utm_campaign: meta.utm_campaign || null,
            utm_content: meta.utm_content || null,
            utm_term: meta.utm_term || null,
          },
          commission: {
            totalPriceInCents: parsedBody?.amount || 0,
            gatewayFeeInCents: 0,
            userCommissionInCents: parsedBody?.amount || 0,
          },
          isTest: false,
        };

        postToUtmify(utmifyPayload, utmifyToken).then(res => {
          console.log(`[beehive-pix] UTMify waiting_payment enviado (${res.status}):`, res.body);
        }).catch(err => {
          console.warn('[beehive-pix] Erro ao enviar para UTMify:', err.message);
        });

        return {
          statusCode: response.status,
          headers,
          body: JSON.stringify(responseData),
        };
      } catch (e) {}
    }

    return {
      statusCode: response.status,
      headers,
      body: text
    };
  } catch (err) {
    console.error('[beehive-pix] Erro:', err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};
