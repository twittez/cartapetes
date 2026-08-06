const crypto = require('crypto');
const https = require('https');

function sha256(str) {
  if (!str) return '';
  return crypto.createHash('sha256').update(str.trim().toLowerCase()).digest('hex');
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

    const rawStatus = txnData.status || body.status || body.event || body.type || '';
    const status = rawStatus.toLowerCase();
    const eventType = (body.type || body.event || '').toLowerCase();
    const transactionId = String(txnData.id || body.objectId || body.id || '');

    console.log(`[Beehive Webhook] Transação ${transactionId} – Status: ${status}, Event: ${eventType}`);

    // Processa tanto pagos quanto pendentes (capturando qualquer variação de status pago)
    const isPaid = status === 'paid' || status === 'approved' || status === 'pago' || status === 'completed' || 
                   status.includes('paid') || status.includes('aprovado') ||
                   eventType.includes('paid') || eventType.includes('approved') || eventType.includes('pago');
                   
    const isPending = !isPaid && (status === 'waiting_payment' || status === 'pending' || status === 'pendente' || 
                       status.includes('pending') || status.includes('waiting') || eventType.includes('created'));

    if (!isPaid && !isPending) {
      console.log(`[Beehive Webhook] Status '${status}' (Event: '${eventType}') ignorado — sem ação.`);
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

    // 2. Extrair dados do cliente e transação
    const customer = txnData.customer || {};
    const metadata = txnData.metadata || {};

    const nome     = customer.name  || '';
    const email    = customer.email || '';
    const telefone = (customer.phone || '').replace(/\D/g, '');
    const documentNum = (customer.document?.number || '').replace(/\D/g, '');
    const amountInCents = txnData.amount || 0;
    const value    = amountInCents / 100; // centavos → reais

    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);

    // 3. Notificar UTMify
    const utmifyToken = process.env.UTMIFY_TOKEN || 'cSOZLc4zjXQY48Nz6Mlk35KQqSXlLOiV53S8';
    const utmifyStatus = isPaid ? 'paid' : 'waiting_payment';
    const utmifyPayload = {
      orderId: metadata.order_id || `CP-${transactionId}`,
      platform: 'Beehive',
      paymentMethod: 'pix',
      status: utmifyStatus,
      createdAt: nowStr,
      approvedDate: isPaid ? nowStr : null,
      refundedAt: null,
      customer: {
        name: nome,
        email: email,
        phone: telefone,
        document: documentNum,
      },
      products: [
        {
          id: 'kit_tapete',
          name: 'Tapete Bandeja Premium Sob Medida',
          planId: null,
          planName: null,
          quantity: 1,
          priceInCents: amountInCents,
        },
      ],
      trackingParameters: {
        src: null,
        sck: null,
        utm_source: null,
        utm_medium: null,
        utm_campaign: null,
        utm_content: null,
        utm_term: null,
      },
      commission: {
        totalPriceInCents: amountInCents,
        gatewayFeeInCents: txnData.fee?.estimatedFee || 0,
        userCommissionInCents: txnData.fee?.netAmount || amountInCents,
      },
      isTest: false,
    };

    try {
      console.log(`[Beehive Webhook] Enviando pedido (${utmifyStatus}) para UTMify...`);
      const utmRes = await postToUtmify(utmifyPayload, utmifyToken);
      console.log(`[Beehive Webhook] Resposta UTMify (${utmRes.status}):`, utmRes.body);
    } catch (utmErr) {
      console.error('[Beehive Webhook] Erro ao disparar para UTMify:', utmErr.message);
    }

    // 3b. Notificar painel wepink-checkout quando pago
    if (isPaid) {
      try {
        await fetch('https://wepink-checkout.onrender.com/api/webhook/beehive', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            data: { id: transactionId, status: 'paid' }
          })
        });
        console.log(`[Beehive Webhook] Painel notificado → transação ${transactionId} PAGO`);
      } catch (e) {
        console.warn('[Beehive Webhook] Falha ao notificar painel:', e.message);
      }
    }

    // 4. Hash para Meta CAPI
    const hashedData = { country: sha256('br') };
    if (email) hashedData.em = sha256(email);
    if (telefone) {
      const phoneWithCountry = telefone.startsWith('55') ? telefone : '55' + telefone;
      hashedData.ph = sha256(phoneWithCountry);
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
      body: JSON.stringify({
        success: true,
        utmifySent: true,
        metaSent: true,
        transactionId
      })
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
