const crypto = require('crypto');
const { getStore } = require('@netlify/blobs');

const GRAPH_API_VERSION = 'v21.0';
const PIXEL_ID = '1932684814101405';

function sha256(str) {
  if (!str) return '';
  return crypto.createHash('sha256').update(str.trim().toLowerCase()).digest('hex');
}

// Os gateways às vezes devolvem o campo metadata como string JSON; normaliza para objeto.
function asObject(value) {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (e) {
      return {};
    }
  }
  return typeof value === 'object' ? value : {};
}

exports.handler = async (event) => {
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
    console.log('[WinnerPay Webhook] Recebido payload:', JSON.stringify(body, null, 2));

    // Determina a estrutura do objeto de transação de forma resiliente
    const transaction = body.transaction || body.data || body;
    if (!transaction) {
      console.warn('[WinnerPay Webhook] Nenhuma transação encontrada no payload.');
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid payload structure' })
      };
    }

    const rawStatus = transaction.status || '';
    const status = rawStatus.toLowerCase();
    const transactionId = transaction.transaction_id || transaction.transactionId || transaction.id;

    console.log(`[WinnerPay Webhook] Processando Transação ID: ${transactionId} (Status: ${status})`);

    // Apenas envia o Purchase se o pagamento estiver confirmado
    if (status !== 'paid' && status !== 'completed' && status !== 'approved' && status !== 'pago') {
      console.log(`[WinnerPay Webhook] Status '${status}' não requer disparo de Purchase.`);
      return {
        statusCode: 200,
        body: JSON.stringify({ message: `Status ${status} processed, no event sent` })
      };
    }

    // Recupera os dados de rastreamento persistidos pelo checkout (fonte confiável).
    // Isso garante o mesmo event_id usado no navegador (deduplicação) e o telefone,
    // mesmo que o gateway não devolva os metadados no postback.
    const store = getStore({ name: 'purchase-tracking', consistency: 'strong' });
    let stored = null;
    if (transactionId) {
      try {
        stored = await store.get(String(transactionId), { type: 'json' });
      } catch (e) {
        console.warn('[WinnerPay Webhook] Falha ao ler tracking persistido:', e.message);
      }
    }

    // Idempotência: evita Purchase duplicado caso o WinnerPay reenvie o webhook.
    if (stored && stored.purchaseSent) {
      console.log(`[WinnerPay Webhook] Purchase já enviado para ${transactionId}. Ignorando reenvio.`);
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Purchase already sent for this transaction' })
      };
    }

    // Extrai dados também do payload do gateway (fallback se não houver tracking persistido)
    const metadata = asObject(transaction.metadata);
    const tracking = asObject(metadata.tracking);
    const customer = asObject(transaction.customer || metadata.customer);
    stored = stored || {};

    const nome = stored.nome || customer.name || transaction.payerName || transaction.payer_name || body.name || '';
    const email = stored.email || customer.email || transaction.payerEmail || transaction.payer_email || body.email || '';
    const telefone = stored.telefone || tracking.telefone || customer.phone || transaction.payerPhone || transaction.payer_phone || '';
    const cidade = stored.cidade || tracking.cidade || '';
    const estado = stored.estado || tracking.estado || '';
    const cep = stored.cep || tracking.cep || '';

    // Metadados do Meta (fbp, fbc, userAgent, eventId)
    const fbp = stored.fbp || tracking.fbp || '';
    const fbc = stored.fbc || tracking.fbc || '';
    const userAgent = stored.userAgent || tracking.userAgent || '';
    const eventId = stored.eventId || tracking.eventId || '';

    const value = parseFloat(stored.value || transaction.amount || transaction.value) || 0;

    console.log('[WinnerPay Webhook] Dados extraídos:', {
      nome,
      hasEmail: !!email,
      hasTelefone: !!telefone,
      eventId,
      value
    });

    // Criptografia SHA-256 dos dados para Correspondência Avançada do Meta
    const hashedData = {
      country: sha256('br')
    };

    if (email) hashedData.em = sha256(email);

    if (telefone) {
      const cleanPhone = telefone.replace(/\D/g, '');
      const phoneWithCountry = cleanPhone.startsWith('55') ? cleanPhone : '55' + cleanPhone;
      hashedData.ph = sha256(phoneWithCountry);
    }

    if (nome) {
      const nameParts = nome.trim().split(/\s+/);
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      if (firstName) hashedData.fn = sha256(firstName);
      if (lastName) hashedData.ln = sha256(lastName);
    }

    if (cidade) hashedData.ct = sha256(cidade);
    if (estado) hashedData.st = sha256(estado);
    if (cep) hashedData.zp = sha256(cep.replace(/\D/g, ''));

    // IP de conexão do cliente (obtido a partir do cabeçalho do Netlify)
    const clientIp = event.headers['x-nf-client-connection-ip'] ||
                     event.headers['client-ip'] ||
                     event.headers['x-forwarded-for'] ||
                     '127.0.0.1';

    const mergedUserData = {
      client_ip_address: clientIp.split(',')[0].trim(),
      client_user_agent: userAgent || event.headers['user-agent'] || '',
      ...hashedData,
      ...(fbp && { fbp }),
      ...(fbc && { fbc })
    };

    const customData = {
      value: value,
      currency: 'BRL',
      content_type: 'product',
      contents: [{
        id: 'kit_tapete',
        quantity: 1,
        item_price: value
      }]
    };

    // Token lido da variável de ambiente do Netlify; mantém o fallback embutido
    // (apenas no servidor, nunca exposto ao navegador) para não interromper o envio.
    const accessToken = process.env.META_ACCESS_TOKEN || 'EAAK1b7DgzXcBRsShH7RrGo3MHSgc5SMdUvxOmZB7iGKZC8JxKximXkLkSekqKZBiQtbn4dESkKXt87keRLpBjybBbsu3LlrU7hMWD1mzw8iseR69kRnXkkrK1xXZAPpNZBniy0IzQW1SZBn1ZBcWwztRN7KoYYo7UkwmhRCNHqqfbiY8OYTAOJzEQ699TdV4gZDZD';

    const capiEvent = {
      event_name: 'Purchase',
      event_time: Math.floor(Date.now() / 1000),
      // Reutiliza o event_id do navegador para deduplicar com o Pixel/CAPI da página de obrigado.
      event_id: eventId || ('evt_' + crypto.randomBytes(8).toString('hex') + '_' + Date.now().toString(36)),
      event_source_url: stored.eventSourceUrl || 'https://seguro.cartapetes.com.br/obrigado.html',
      action_source: 'website',
      user_data: mergedUserData,
      custom_data: customData
    };

    const payload = {
      data: [capiEvent]
    };

    console.log(`[WinnerPay Webhook] Enviando Purchase ao Meta (Pixel ${PIXEL_ID}, Event ID: ${capiEvent.event_id})`);

    const response = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${PIXEL_ID}/events?access_token=${accessToken}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const responseData = await response.json();
    console.log(`[WinnerPay Webhook] Resposta do Meta CAPI:`, responseData);

    // Marca como enviado para garantir idempotência em reenvios do webhook.
    if (response.ok && transactionId) {
      try {
        await store.setJSON(String(transactionId), { ...stored, purchaseSent: true, sentAt: new Date().toISOString() });
      } catch (e) {
        console.warn('[WinnerPay Webhook] Falha ao marcar purchaseSent:', e.message);
      }
    }

    return {
      statusCode: response.status,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(responseData)
    };
  } catch (error) {
    console.error('[WinnerPay Webhook] Erro ao processar:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ error: error.message })
    };
  }
};
