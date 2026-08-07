// netlify/functions/beehive-pix.js
// Proxy server-side para criar transações PIX na Beehive.
// Mantém a SK fora do frontend.
// Inclui verificação de IP via ip-guard antes de criar a transação.

const { createClient } = require('@supabase/supabase-js');

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
    // ─────────────────────────────────────────
    // Verificação de IP — bloqueio duro no servidor
    // ─────────────────────────────────────────
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

    // ─────────────────────────────────────────
    // Cria transação na Beehive
    // ─────────────────────────────────────────
    const BEEHIVE_SK = process.env.VITE_BEEHIVE_SK || process.env.BEEHIVE_SK || '';
    if (!BEEHIVE_SK) {
      console.error('[beehive-pix] VITE_BEEHIVE_SK não definido nas variáveis de ambiente!');
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Gateway não configurado' }) };
    }

    const beehiveToken = Buffer.from(`${BEEHIVE_SK}:x`).toString('base64');
    const body = event.body;

    // Injeta o IP do cliente no metadata da requisição (para salvar no Supabase depois)
    let parsedBody;
    try {
      parsedBody = JSON.parse(body);
      if (!parsedBody.metadata) parsedBody.metadata = {};
      parsedBody.metadata.client_ip = clientIp;
    } catch (e) {
      parsedBody = null;
    }

    console.log('[beehive-pix] Criando PIX para IP:', clientIp);

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

    // Injeta o client_ip na resposta para que o orderService possa salvá-lo no Supabase
    if (response.status === 200 || response.status === 201) {
      try {
        const responseData = JSON.parse(text);
        responseData._client_ip = clientIp;
        return {
          statusCode: response.status,
          headers,
          body: JSON.stringify(responseData),
        };
      } catch (e) {
        // se não for JSON, retorna como string mesmo
      }
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
