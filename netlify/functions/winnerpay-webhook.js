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

    // 1. Atualizar o status da transação no Supabase para 'pago'
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      try {
        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        console.log(`[WinnerPay Webhook] Atualizando transação ${transactionId} no Supabase...`);
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(transactionId);
        
        let error;
        if (isUuid) {
          const res = await supabase.from('leads').update({ status: 'pago' }).or(`id.eq.${transactionId},transaction_id.eq.${transactionId}`);
          error = res.error;
        } else {
          const res = await supabase.from('leads').update({ status: 'pago' }).eq('transaction_id', transactionId);
          error = res.error;
        }

        if (error) {
          console.error('[WinnerPay Webhook] Erro ao salvar status pago no Supabase:', error.message);
        } else {
          console.log(`[WinnerPay Webhook] Transação ${transactionId} marcada como PAGO no Supabase ✓`);
        }
      } catch (dbErr) {
        console.error('[WinnerPay Webhook] Falha ao conectar ao Supabase:', dbErr);
      }
    } else {
      console.warn('[WinnerPay Webhook] Credenciais do Supabase não encontradas no ambiente.');
    }

    // Extrai os dados do cliente e metadados de rastreamento do Meta
    const metadata = transaction.metadata || {};
    const tracking = metadata.tracking || {};
    const customer = metadata.customer || {};

    const nome = customer.name || transaction.payerName || transaction.payer_name || body.name || '';
    const email = customer.email || transaction.payerEmail || transaction.payer_email || body.email || '';
    const telefone = tracking.telefone || customer.phone || transaction.payerPhone || transaction.payer_phone || '';
    const cidade = tracking.cidade || '';
    const estado = tracking.estado || '';
    const cep = tracking.cep || '';

    // Metadados do Meta (fbp, fbc, userAgent, eventId)
    const fbp = tracking.fbp || '';
    const fbc = tracking.fbc || '';
    const userAgent = tracking.userAgent || '';
    const eventId = tracking.eventId || '';

    const value = parseFloat(transaction.amount || transaction.value) || 0;

    console.log('[WinnerPay Webhook] Dados extraídos:', {
      nome,
      email,
      telefone,
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

    const pixelId = '1932684814101405';
    const accessToken = process.env.META_ACCESS_TOKEN || 'EAAK1b7DgzXcBRsShH7RrGo3MHSgc5SMdUvxOmZB7iGKZC8JxKximXkLkSekqKZBiQtbn4dESkKXt87keRLpBjybBbsu3LlrU7hMWD1mzw8iseR69kRnXkkrK1xXZAPpNZBniy0IzQW1SZBn1ZBcWwztRN7KoYYo7UkwmhRCNHqqfbiY8OYTAOJzEQ699TdV4gZDZD';

    const capiEvent = {
      event_name: 'Purchase',
      event_time: Math.floor(Date.now() / 1000),
      event_id: eventId || ('evt_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now().toString(36)),
      event_source_url: 'https://cartapetesautomotivos.lovable.app/obrigado.html',
      action_source: 'website',
      user_data: mergedUserData,
      custom_data: customData
    };

    const payload = {
      data: [capiEvent]
    };

    console.log(`[WinnerPay Webhook] Enviando Conversão de Compra para o Meta Pixel ${pixelId} (Event ID: ${capiEvent.event_id})`);

    const response = await fetch(`https://graph.facebook.com/v17.0/${pixelId}/events?access_token=${accessToken}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const responseData = await response.json();
    console.log(`[WinnerPay Webhook] Resposta do Meta CAPI:`, responseData);

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
