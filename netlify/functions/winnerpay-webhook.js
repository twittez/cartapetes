/**
 * winnerpay-webhook.js — DESATIVADO
 *
 * Este webhook foi desativado porque a plataforma de pagamento atual é Beehive.
 * Toda lógica de Purchase está centralizada em beehive-webhook.js.
 *
 * Retorna 200 para não gerar erros caso a Netlify receba requests para esta URL.
 */

exports.handler = async (event) => {
  console.log('[WinnerPay Webhook] Desativado — ignorando request.');
  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message: 'Webhook desativado. Use beehive-webhook para pagamentos.' }),
  };
};
