// netlify/functions/beehive-pix.js
// Proxy server-side para criar transações PIX na Beehive.
// Mantém a SK fora do frontend.

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
    const BEEHIVE_SK = process.env.VITE_BEEHIVE_SK || process.env.BEEHIVE_SK || '';
    if (!BEEHIVE_SK) {
      console.error('[beehive-pix] VITE_BEEHIVE_SK não definido nas variáveis de ambiente!');
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Gateway não configurado' }) };
    }

    const beehiveToken = Buffer.from(`${BEEHIVE_SK}:x`).toString('base64');

    const body = event.body;
    console.log('[beehive-pix] Payload recebido:', body);

    const response = await fetch('https://api.conta.paybeehive.com.br/v1/transactions', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${beehiveToken}`,
        'Content-Type': 'application/json'
      },
      body
    });

    const text = await response.text();
    console.log(`[beehive-pix] Beehive status ${response.status}:`, text);

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
