/**
 * ip-guard.js
 * Netlify Function que verifica se um IP já gerou 3 ou mais pedidos.
 *
 * Chamado por:
 * - beehive-pix.js: antes de criar transação (bloqueio duro no servidor)
 * - Frontend: ao abrir o checkout (bloqueio na UI)
 *
 * Retorna: { blocked: boolean, count: number, ip: string }
 */

const MAX_ORDERS_PER_IP = 3;

function getClientIp(headers) {
  const raw =
    headers['x-nf-client-connection-ip'] ||
    headers['x-real-ip'] ||
    headers['x-forwarded-for'] ||
    headers['client-ip'] ||
    '0.0.0.0';
  // x-forwarded-for pode ter múltiplos IPs separados por vírgula; pega o primeiro (origem real)
  return raw.split(',')[0].trim();
}

exports.handler = async (event) => {
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };

  const clientIp = getClientIp(event.headers);
  console.log(`[IP Guard] Verificando IP: ${clientIp}`);

  // Se não há Supabase configurado, não bloqueia (fail-open)
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.warn('[IP Guard] Supabase não configurado — liberando acesso.');
    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ blocked: false, count: 0, ip: clientIp }),
    };
  }

  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Conta pedidos não-negados com este IP (status pendente ou pago)
    const { count, error } = await supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('client_ip', clientIp)
      .in('status', ['pendente', 'pago', 'em_producao']);

    if (error) {
      console.error('[IP Guard] Erro ao consultar Supabase:', error.message);
      // Fail-open: em caso de erro, não bloqueia
      return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify({ blocked: false, count: 0, ip: clientIp }),
      };
    }

    const orderCount = count || 0;
    const isBlocked = orderCount >= MAX_ORDERS_PER_IP;

    console.log(`[IP Guard] IP ${clientIp} → ${orderCount} pedido(s) | Bloqueado: ${isBlocked}`);

    return {
      statusCode: isBlocked ? 403 : 200,
      headers: CORS,
      body: JSON.stringify({
        blocked: isBlocked,
        count: orderCount,
        ip: clientIp,
        limit: MAX_ORDERS_PER_IP,
      }),
    };
  } catch (err) {
    console.error('[IP Guard] Exceção:', err.message);
    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ blocked: false, count: 0, ip: clientIp }),
    };
  }
};
