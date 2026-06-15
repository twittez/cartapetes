// Persiste os dados de rastreamento de uma transação (telefone, event_id do Meta,
// fbp/fbc, valor, etc.) no Netlify Blobs, indexados pelo ID da transação.
//
// O webhook do WinnerPay lê esses dados para enviar o evento Purchase ao Meta com o
// MESMO event_id usado no navegador (deduplicação Pixel + CAPI) e com o telefone
// garantido, sem depender de o gateway devolver os metadados na notificação.

const { getStore } = require('@netlify/blobs');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const transactionId = body.transactionId;
    const data = body.data || {};

    if (!transactionId) {
      return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'transactionId é obrigatório' }) };
    }

    const store = getStore('purchase-tracking');
    await store.setJSON(String(transactionId), {
      ...data,
      purchaseSent: false,
      storedAt: new Date().toISOString()
    });

    console.log(`[store-tracking] Tracking armazenado para a transação ${transactionId}`);

    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ success: true }) };
  } catch (error) {
    console.error('[store-tracking] Erro ao armazenar tracking:', error);
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: error.message }) };
  }
};
