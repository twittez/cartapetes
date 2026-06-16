// Função serverless do Netlify para cobrança no cartão de crédito via Pagou.ai
// (https://pagouai.readme.io/reference/criar-transacao).
//
// O fluxo é: o navegador tokeniza o cartão com a CHAVE PÚBLICA (pk_live) usando
// a lib JS da Pagou.ai e envia apenas o TOKEN para esta função. A CHAVE SECRETA
// (sk_live) nunca chega ao navegador — ela é lida da variável de ambiente
// PAGOUAI_SECRET_KEY e usada apenas aqui, no servidor, para criar a transação.

const crypto = require('crypto');

const PAGOUAI_API_URL = 'https://api.conta.pagou.ai/v1/transactions';

function sha256(str) {
  if (!str) return '';
  return crypto.createHash('sha256').update(String(str).trim().toLowerCase()).digest('hex');
}

// Envia o evento Purchase para a API de Conversões do Meta (server-side).
// Usa o mesmo event_id gerado no navegador para que o Meta deduplique o Pixel
// (disparado na página de obrigado) contra este evento de servidor.
async function sendMetaPurchase({ eventId, value, customer, tracking, clientIp, sourceUrl }) {
  try {
    const pixelId = '1932684814101405';
    const accessToken = process.env.META_ACCESS_TOKEN ||
      'EAAK1b7DgzXcBRsShH7RrGo3MHSgc5SMdUvxOmZB7iGKZC8JxKximXkLkSekqKZBiQtbn4dESkKXt87keRLpBjybBbsu3LlrU7hMWD1mzw8iseR69kRnXkkrK1xXZAPpNZBniy0IzQW1SZBn1ZBcWwztRN7KoYYo7UkwmhRCNHqqfbiY8OYTAOJzEQ699TdV4gZDZD';

    const hashedData = { country: sha256('br') };
    if (customer.email) hashedData.em = sha256(customer.email);
    if (customer.phone) {
      const cleanPhone = String(customer.phone).replace(/\D/g, '');
      const phoneWithCountry = cleanPhone.startsWith('55') ? cleanPhone : '55' + cleanPhone;
      hashedData.ph = sha256(phoneWithCountry);
    }
    if (customer.name) {
      const parts = customer.name.trim().split(/\s+/);
      if (parts[0]) hashedData.fn = sha256(parts[0]);
      if (parts.slice(1).join(' ')) hashedData.ln = sha256(parts.slice(1).join(' '));
    }
    if (tracking.cidade) hashedData.ct = sha256(tracking.cidade);
    if (tracking.estado) hashedData.st = sha256(tracking.estado);
    if (tracking.cep) hashedData.zp = sha256(String(tracking.cep).replace(/\D/g, ''));

    const userData = {
      client_ip_address: clientIp,
      client_user_agent: tracking.userAgent || '',
      ...hashedData,
      ...(tracking.fbp && { fbp: tracking.fbp }),
      ...(tracking.fbc && { fbc: tracking.fbc })
    };

    const payload = {
      data: [{
        event_name: 'Purchase',
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId,
        event_source_url: sourceUrl || 'https://seguro.cartapetes.com.br/obrigado.html',
        action_source: 'website',
        user_data: userData,
        custom_data: {
          value: value,
          currency: 'BRL',
          content_type: 'product',
          contents: [{ id: 'kit_tapete', quantity: 1, item_price: value }]
        }
      }]
    };

    const resp = await fetch(`https://graph.facebook.com/v17.0/${pixelId}/events?access_token=${accessToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await resp.json();
    console.log('[Pagouai Charge] Meta CAPI Purchase enviado:', data);
  } catch (err) {
    console.error('[Pagouai Charge] Falha ao enviar Purchase ao Meta:', err);
  }
}

exports.handler = async (event) => {
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
    return { statusCode: 405, body: JSON.stringify({ success: false, error: 'Method Not Allowed' }) };
  }

  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  try {
    const secretKey = process.env.PAGOUAI_SECRET_KEY;
    if (!secretKey) {
      console.error('[Pagouai Charge] PAGOUAI_SECRET_KEY não configurada.');
      return { statusCode: 500, headers: cors, body: JSON.stringify({ success: false, error: 'Gateway de cartão não configurado.' }) };
    }

    const body = JSON.parse(event.body || '{}');
    const {
      token,
      amount,            // valor em reais (number)
      installments = 1,
      customer = {},
      items = [],
      eventId,
      tracking = {},
      metadata = {},
      postbackUrl
    } = body;

    if (!token) {
      return { statusCode: 400, headers: cors, body: JSON.stringify({ success: false, error: 'Token do cartão ausente.' }) };
    }

    // Valor em centavos (a Pagou.ai trabalha em centavos: 500 = R$ 5,00)
    const amountInCents = Math.round(parseFloat(amount) * 100);
    const cleanPhone = String(customer.phone || '').replace(/\D/g, '');
    const cleanDoc = String(customer.document || '').replace(/\D/g, '');

    const clientIp = (event.headers['x-nf-client-connection-ip'] ||
      event.headers['client-ip'] ||
      event.headers['x-forwarded-for'] ||
      '127.0.0.1').split(',')[0].trim();

    // Itens da transação (preço unitário em centavos)
    const transactionItems = (items.length ? items : [{ title: 'Tapete Bandeja Premium', quantity: 1, unitPrice: amount }])
      .map(it => ({
        title: it.title || 'Produto',
        quantity: it.quantity || 1,
        unitPrice: Math.round(parseFloat(it.unitPrice ?? it.price ?? amount) * 100),
        tangible: true
      }));

    const pagouaiBody = {
      amount: amountInCents,
      paymentMethod: 'credit_card',
      installments: parseInt(installments, 10) || 1,
      card: { token },
      customer: {
        name: customer.name || '',
        email: customer.email || '',
        phone: cleanPhone,
        // O telefone também segue nos metadados para aparecer no painel.
        document: cleanDoc ? { type: 'CPF', number: cleanDoc } : undefined
      },
      items: transactionItems,
      ip: clientIp,
      postbackUrl: postbackUrl || undefined,
      metadata: {
        ...metadata,
        nome: customer.name || '',
        email: customer.email || '',
        telefone: cleanPhone,
        customer_phone: cleanPhone,
        tracking: {
          eventId: eventId || '',
          fbp: tracking.fbp || '',
          fbc: tracking.fbc || '',
          userAgent: tracking.userAgent || '',
          telefone: cleanPhone,
          cep: tracking.cep || '',
          cidade: tracking.cidade || '',
          estado: tracking.estado || ''
        }
      }
    };

    // Basic auth: base64(secretKey + ":") — chave secreta como usuário, senha vazia.
    const authHeader = 'Basic ' + Buffer.from(secretKey + ':').toString('base64');

    console.log('[Pagouai Charge] Criando transação no cartão...', {
      amount: amountInCents,
      installments: pagouaiBody.installments,
      hasToken: !!token
    });

    const resp = await fetch(PAGOUAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify(pagouaiBody)
    });

    const data = await resp.json().catch(() => ({}));
    console.log('[Pagouai Charge] Resposta da Pagou.ai:', JSON.stringify(data));

    const transaction = data.transaction || data.data || data;
    const status = String(transaction.status || '').toLowerCase();
    const transactionId = transaction.id || transaction.transactionId || transaction.transaction_id || '';

    const approved = status === 'paid' || status === 'authorized' || status === 'approved';

    if (!resp.ok || (!approved && status !== 'waiting_payment' && status !== 'processing')) {
      const reason = (transaction.refusedReason && (transaction.refusedReason.message || transaction.refusedReason.code)) ||
        transaction.message || data.message || data.error || 'Pagamento recusado pela operadora.';
      return {
        statusCode: 200,
        headers: cors,
        body: JSON.stringify({ success: false, status: status || 'refused', transactionId, error: reason })
      };
    }

    // Em caso de aprovação imediata, dispara o Purchase server-side (CAPI) com o
    // MESMO event_id do navegador, garantindo a deduplicação no Meta.
    if (approved && eventId) {
      await sendMetaPurchase({
        eventId,
        value: parseFloat(amount),
        customer: { name: customer.name, email: customer.email, phone: cleanPhone },
        tracking,
        clientIp,
        sourceUrl: event.headers['referer']
      });
    }

    return {
      statusCode: 200,
      headers: cors,
      body: JSON.stringify({ success: true, status: status || 'paid', transactionId })
    };
  } catch (error) {
    console.error('[Pagouai Charge] Erro interno:', error);
    return { statusCode: 500, headers: cors, body: JSON.stringify({ success: false, error: error.message }) };
  }
};
