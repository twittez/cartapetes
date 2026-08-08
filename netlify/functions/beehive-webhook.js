/**
 * beehive-webhook.js
 * Recebe notificações de status de pagamento da Beehive.
 *
 * REGRAS:
 * - Em status PAID: Atualiza Supabase (status=pago), envia Purchase para Meta CAPI e envia paid para UTMify (com UTMs reais).
 * - Em status PENDING: Envia waiting_payment para UTMify com UTMs reais do pedido.
 */

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
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

exports.handler = async (event) => {
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method Not Allowed' }) };

  try {
    const body = JSON.parse(event.body);
    console.log('[Beehive Webhook] Payload recebido:', JSON.stringify(body, null, 2));

    const txnData = body.data || body;
    const rawStatus = (txnData.status || body.status || body.event || body.type || '').toLowerCase();
    const eventType = (body.type || body.event || '').toLowerCase();
    const transactionId = String(txnData.id || body.objectId || body.id || '');

    console.log(`[Beehive Webhook] TX: ${transactionId} | Status: ${rawStatus} | Event: ${eventType}`);

    const isPaid = rawStatus === 'paid' || rawStatus === 'approved' || rawStatus === 'pago' ||
                   rawStatus === 'completed' || rawStatus.includes('paid') ||
                   eventType.includes('paid') || eventType.includes('approved');

    const mappedStatus = isPaid ? 'paid' : 'waiting_payment';

    // ─────────────────────────────────────────
    // 1. Buscar UTMs e dados do pedido no Supabase
    // ─────────────────────────────────────────
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    let storedUTMs = {};

    if (supabaseUrl && supabaseKey) {
      try {
        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient(supabaseUrl, supabaseKey);

        if (isPaid) {
          const { error: updateError } = await supabase
            .from('leads')
            .update({ status: 'pago' })
            .eq('transaction_id', transactionId);

          if (updateError) {
            console.error('[Beehive Webhook] Erro ao atualizar Supabase:', updateError.message);
          } else {
            console.log(`[Beehive Webhook] ✅ Lead ${transactionId} → PAGO no Supabase`);
          }
        }

        const { data: leadRow } = await supabase
          .from('leads')
          .select('utm_source, utm_medium, utm_campaign, utm_content, utm_term, fbclid, gclid')
          .eq('transaction_id', transactionId)
          .maybeSingle();

        if (leadRow) {
          storedUTMs = leadRow;
          console.log('[Beehive Webhook] UTMs recuperadas do Supabase:', storedUTMs);
        }
      } catch (dbErr) {
        console.error('[Beehive Webhook] Supabase connection error:', dbErr.message);
      }
    }

    // ─────────────────────────────────────────
    // 2. Extrair dados do cliente e valor
    // ─────────────────────────────────────────
    const customer = txnData.customer || {};
    const metadata = txnData.metadata || {};
    const nome = customer.name || '';
    const email = customer.email || '';
    const telefone = (customer.phone || '').replace(/\D/g, '');
    const documentNum = (customer.document?.number || '').replace(/\D/g, '');
    
    // Suporte flexível para cálculo do valor em centavos
    const rawAmt = txnData.amount || txnData.value || txnData.total || 0;
    const amountInCents = rawAmt > 1000 ? Math.round(rawAmt) : Math.round(rawAmt * 100);
    const value = amountInCents / 100;

    const nowStr = new Date().toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' })
      .replace('T', ' ').substring(0, 19);

    // ─────────────────────────────────────────
    // 3. Disparar para UTMify (waiting_payment ou paid)
    // ─────────────────────────────────────────
    const utmifyToken = process.env.UTMIFY_TOKEN || 'cSOZLc4zjXQY48Nz6Mlk35KQqSXlLOiV53S8';
    const utmifyPayload = {
      orderId: metadata.order_id || `CP-${transactionId}`,
      platform: 'Beehive',
      paymentMethod: 'pix',
      status: mappedStatus,
      createdAt: nowStr,
      approvedDate: isPaid ? nowStr : null,
      refundedAt: null,
      customer: { name: nome, email, phone: telefone, document: documentNum },
      products: [{
        id: 'kit_tapete',
        name: 'Tapete Bandeja Premium Sob Medida',
        planId: null,
        planName: null,
        quantity: 1,
        priceInCents: amountInCents,
      }],
      trackingParameters: {
        src: storedUTMs.src || null,
        sck: storedUTMs.sck || null,
        utm_source: storedUTMs.utm_source || null,
        utm_medium: storedUTMs.utm_medium || null,
        utm_campaign: storedUTMs.utm_campaign || null,
        utm_content: storedUTMs.utm_content || null,
        utm_term: storedUTMs.utm_term || null,
      },
      commission: {
        totalPriceInCents: amountInCents,
        gatewayFeeInCents: txnData.fee?.estimatedFee || 0,
        userCommissionInCents: txnData.fee?.netAmount || amountInCents,
      },
      isTest: false,
    };

    try {
      if (isPaid) {
        console.log(`[Beehive Webhook] Enviando status PAID para UTMify...`);
        const utmRes = await postToUtmify(utmifyPayload, utmifyToken);
        console.log(`[Beehive Webhook] UTMify (${utmRes.status}):`, utmRes.body);
      } else {
        console.log(`[Beehive Webhook] Status PENDING recebido — waiting_payment já foi registrado na geração do PIX pelo servidor. Ignorando envio duplicado.`);
      }
    } catch (utmErr) {
      console.error('[Beehive Webhook] Erro ao enviar para UTMify:', utmErr.message);
    }

    // ─────────────────────────────────────────
    // 4. Disparar Purchase para Meta CAPI (apenas se PAID)
    // ─────────────────────────────────────────
    if (isPaid) {
      const hashedData = { country: sha256('br') };
      if (email) hashedData.em = sha256(email);
      if (telefone) {
        const phone = telefone.startsWith('55') ? telefone : '55' + telefone;
        hashedData.ph = sha256(phone);
      }
      if (nome) {
        const parts = nome.trim().split(/\s+/);
        if (parts[0]) hashedData.fn = sha256(parts[0]);
        if (parts.slice(1).join(' ')) hashedData.ln = sha256(parts.slice(1).join(' '));
      }

      const clientIp = (event.headers['x-nf-client-connection-ip'] ||
                        event.headers['x-forwarded-for'] || '127.0.0.1').split(',')[0].trim();

      const pixelId = process.env.META_PIXEL_ID || '1932684814101405';
      const accessToken = process.env.META_ACCESS_TOKEN || 'EAAK1b7DgzXcBRsShH7RrGo3MHSgc5SMdUvxOmZB7iGKZC8JxKximXkLkSekqKZBiQtbn4dESkKXt87keRLpBjybBbsu3LlrU7hMWD1mzw8iseR69kRnXkkrK1xXZAPpNZBniy0IzQW1SZBn1ZBcWwztRN7KoYYo7UkwmhRCNHqqfbiY8OYTAOJzEQ699TdV4gZDZD';
      const deduplicationId = `purchase_${transactionId}`;

      const capiEvent = {
        event_name: 'Purchase',
        event_time: Math.floor(Date.now() / 1000),
        event_id: deduplicationId,
        event_source_url: 'https://cartapetes.netlify.app/obrigado',
        action_source: 'website',
        user_data: {
          client_ip_address: clientIp,
          client_user_agent: event.headers['user-agent'] || '',
          ...hashedData,
          ...(storedUTMs.fbclid && { fbc: `fb.1.${Date.now()}.${storedUTMs.fbclid}` }),
        },
        custom_data: {
          value,
          currency: 'BRL',
          content_type: 'product',
          contents: [{ id: 'kit_tapete', quantity: 1, item_price: value }],
          order_id: metadata.order_id || transactionId,
        },
      };

      console.log(`[Beehive Webhook] Enviando Purchase para Meta CAPI (event_id: ${deduplicationId})`);
      const metaRes = await fetch(
        `https://graph.facebook.com/v22.0/${pixelId}/events?access_token=${accessToken}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: [capiEvent] }) }
      );
      const metaData = await metaRes.json();
      console.log('[Beehive Webhook] Meta CAPI response:', metaData);
    }

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ success: true, utmifySent: true, mappedStatus, transactionId }),
    };

  } catch (error) {
    console.error('[Beehive Webhook] Erro:', error);
    return { statusCode: 500, headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }, body: JSON.stringify({ error: error.message }) };
  }
};
