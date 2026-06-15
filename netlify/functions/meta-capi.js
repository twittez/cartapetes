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
    const accessToken = process.env.META_ACCESS_TOKEN || 'EAAK1b7DgzXcBRsShH7RrGo3MHSgc5SMdUvxOmZB7iGKZC8JxKximXkLkSekqKZBiQtbn4dESkKXt87keRLpBjybBbsu3LlrU7hMWD1mzw8iseR69kRnXkkrK1xXZAPpNZBniy0IzQW1SZBn1ZBcWwztRN7KoYYo7UkwmhRCNHqqfbiY8OYTAOJzEQ699TdV4gZDZD';

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

    // Enriquecimento dos dados de usuário
    const userData = {
      client_ip_address: clientIp.split(',')[0].trim(), // Pega o primeiro IP caso venha de proxy
      client_user_agent: clientUserAgent,
      ...body.user_data
    };

    // Monta o payload do evento único
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

    console.log(`[Netlify Function CAPI] Enviando evento ${body.event_name} ao Meta para o Pixel ${pixelId}`);

    const response = await fetch(`https://graph.facebook.com/v21.0/${pixelId}/events?access_token=${accessToken}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const responseData = await response.json();
    console.log(`[Netlify Function CAPI] Resposta do Meta:`, responseData);

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
    console.error('[Netlify Function CAPI] Erro interno:', error);
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
