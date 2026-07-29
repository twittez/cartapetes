const crypto = require('crypto');

function sha256(str) {
  if (!str) return '';
  return crypto.createHash('sha256').update(str.trim().toLowerCase()).digest('hex');
}

exports.handler = async (event, context) => {
  // CORS Preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    const body = JSON.parse(event.body);
    console.log('[Beehive Webhook] Payload recebido:', JSON.stringify(body, null, 2));

    // Beehive webhook: { id, type, objectId, url, data: { ...transaction } }
    const txnData = body.data || body;
    if (!txnData) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid payload' }) };
    }

    const rawStatus = txnData.status || '';
    const status = rawStatus.toLowerCase();
    const transactionId = String(txnData.id || body.objectId || '');

    console.log(`[Beehive Webhook] Transação ${transactionId} – Status: ${status}`);

    // Apenas processa se pago
    if (status !== 'paid') {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: `Status ${status} – no event sent` })
      };
    }

    // 1. Atualizar Supabase
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      try {
        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient(supabaseUrl, supabaseKey);
        const { error } = await supabase
          .from('leads')
          .update({ status: 'pago' })
          .eq('transaction_id', transactionId);
        if (error) console.error('[Beehive Webhook] Supabase error:', error.message);
        else console.log(`[Beehive Webhook] Lead ${transactionId} marcado como PAGO ✓`);
      } catch (dbErr) {
        console.error('[Beehive Webhook] Supabase connection error:', dbErr);
      }
    }

    // 2. Extrair dados do cliente
    const customer = txnData.customer || {};
    const metadata = txnData.metadata || {};

    const nome     = customer.name  || '';
    const email    = customer.email || '';
    const telefone = customer.phone || '';
    const value    = (txnData.amount || 0) / 100; // centavos → reais

    // 3. Hash para Meta CAPI
    const hashedData = { country: sha256('br') };
    if (email)    hashedData.em = sha256(email);
    if (telefone) {
      const clean = telefone.replace(/\D/g, '');
      hashedData.ph = sha256(clean.startsWith('55') ? clean : '55' + clean);
    }
    if (nome) {
      const parts = nome.trim().split(/\s+/);
      if (parts[0]) hashedData.fn = sha256(parts[0]);
      if (parts.slice(1).join(' ')) hashedData.ln = sha256(parts.slice(1).join(' '));
    }

    const clientIp = event.headers['x-nf-client-connection-ip'] ||
                     event.headers['x-forwarded-for'] || '127.0.0.1';

    const mergedUserData = {
      client_ip_address: clientIp.split(',')[0].trim(),
      client_user_agent: event.headers['user-agent'] || '',
      ...hashedData
    };

    const pixelId     = '1932684814101405';
    const accessToken = process.env.META_ACCESS_TOKEN || 'EAAK1b7DgzXcBRsShH7RrGo3MHSgc5SMdUvxOmZB7iGKZC8JxKximXkLkSekqKZBiQtbn4dESkKXt87keRLpBjybBbsu3LlrU7hMWD1mzw8iseR69kRnXkkrK1xXZAPpNZBniy0IzQW1SZBn1ZBcWwztRN7KoYYo7UkwmhRCNHqqfbiY8OYTAOJzEQ699TdV4gZDZD';

    const deduplicationId = `purchase_${transactionId}`;

    const capiEvent = {
      event_name: 'Purchase',
      event_time: Math.floor(Date.now() / 1000),
      event_id: deduplicationId,
      event_source_url: 'https://cartapetes.netlify.app/obrigado',
      action_source: 'website',
      user_data: mergedUserData,
      custom_data: {
        value,
        currency: 'BRL',
        content_type: 'product',
        contents: [{ id: 'kit_tapete', quantity: 1, item_price: value }]
      }
    };

    console.log(`[Beehive Webhook] Enviando Purchase para Meta (event_id: ${deduplicationId})`);

    const response = await fetch(
      `https://graph.facebook.com/v22.0/${pixelId}/events?access_token=${accessToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: [capiEvent] })
      }
    );

    const responseData = await response.json();
    console.log('[Beehive Webhook] Meta CAPI response:', responseData);

    return {
      statusCode: response.status,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify(responseData)
    };

  } catch (error) {
    console.error('[Beehive Webhook] Erro:', error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message })
    };
  }
};
