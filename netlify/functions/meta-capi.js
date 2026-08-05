// Função serverless do Netlify para envio seguro dos eventos CAPI do Meta
// Evita expor o Access Token de produção no código frontend do cliente.

exports.handler = async (event, context) => {
  // Trata requisições OPTIONS (CORS preflight)
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

  // Permite apenas POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    const body = JSON.parse(event.body);
    const pixelId = '1932684814101405';
    // Lê o Token da variável de ambiente no Netlify para segurança máxima,
    // caindo para o Token fornecido como fallback.
    const accessToken = process.env.META_ACCESS_TOKEN || 'EAAK1b7DgzXcBSDEWS7pZAqsh9JFU9rZAT1zb8g99ZBPZAMAFNFNqTMFhXpfuT9kZA42e6YZBNSAx8mKmqFCFQkwNLujTAsM83xbKdbss4CM6miDNCdqXnb5gs1zanzZAlsVKUUzCDeH0kx4W9kaEGZCaQVGI2m2484ak0j7sKyZCkmJY0gpLNzJ17FTZC1Psu6VwZDZD';

    // Obtém o IP real do cliente a partir dos cabeçalhos do Netlify
    const clientIp = event.headers['x-nf-client-connection-ip'] ||
                     event.headers['client-ip'] ||
                     event.headers['x-forwarded-for'] ||
                     body.client_ip_address ||
                     '127.0.0.1';

    // Obtém o User Agent do cliente
    const clientUserAgent = event.headers['user-agent'] ||
                            body.client_user_agent ||
                            '';

    // Enriquecimento máximo dos dados de usuário (para nota 10 no gerenciador)
    const userData = {
      // IP real do cliente (essencial para correspondência avançada)
      client_ip_address: clientIp.split(',')[0].trim(),
      // User Agent completo
      client_user_agent: clientUserAgent,
      // Cookies do Meta (_fbp e _fbc para correspondência de cliques/browser)
      ...(body.user_data?.fbp && { fbp: body.user_data.fbp }),
      ...(body.user_data?.fbc && { fbc: body.user_data.fbc }),
      // Dados pessoais em SHA-256 (correspondência avançada)
      ...(body.user_data?.em && { em: body.user_data.em }),       // email
      ...(body.user_data?.ph && { ph: body.user_data.ph }),       // telefone
      ...(body.user_data?.fn && { fn: body.user_data.fn }),       // primeiro nome
      ...(body.user_data?.ln && { ln: body.user_data.ln }),       // sobrenome
      ...(body.user_data?.ct && { ct: body.user_data.ct }),       // cidade
      ...(body.user_data?.st && { st: body.user_data.st }),       // estado
      ...(body.user_data?.zp && { zp: body.user_data.zp }),       // CEP
      ...(body.user_data?.country && { country: body.user_data.country }), // país (br)
      ...(body.user_data?.ge && { ge: body.user_data.ge }),       // gênero (se coletado)
      ...(body.user_data?.db && { db: body.user_data.db }),       // data de nascimento
      ...(body.user_data?.external_id && { external_id: body.user_data.external_id }), // ID externo
    };

    // Monta o payload do evento enriquecido
    const capiEvent = {
      event_name: body.event_name,
      event_time: Math.floor(Date.now() / 1000),
      event_id: body.event_id,
      event_source_url: body.event_source_url || event.headers['referer'] || '',
      action_source: 'website',
      user_data: userData,
      custom_data: body.custom_data || {}
    };

    const payload = {
      data: [capiEvent]
    };

    console.log(`[Netlify CAPI] Enviando evento ${body.event_name} ao Meta | Pixel ${pixelId}`);

    const response = await fetch(`https://graph.facebook.com/v20.0/${pixelId}/events?access_token=${accessToken}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const responseData = await response.json();
    console.log(`[Netlify CAPI] Resposta do Meta:`, responseData);

    return {
      statusCode: response.status,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(responseData)
    };
  } catch (error) {
    console.error('[Netlify CAPI] Erro interno:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ error: error.message })
    };
  }
};
