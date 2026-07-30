// test_dispatch_sale.cjs
const https = require('https');
const crypto = require('crypto');

function sha256(str) {
  if (!str) return '';
  return crypto.createHash('sha256').update(str.trim().toLowerCase()).digest('hex');
}

const UTMIFY_TOKEN = 'HNIuD0M6zetaINZlNEBZQAzabtvFovXyt8Ui';
const META_PIXEL_ID = '1932684814101405';
const META_TOKEN = 'EAAK1b7DgzXcBRsShH7RrGo3MHSgc5SMdUvxOmZB7iGKZC8JxKximXkLkSekqKZBiQtbn4dESkKXt87keRLpBjybBbsu3LlrU7hMWD1mzw8iseR69kRnXkkrK1xXZAPpNZBniy0IzQW1SZBn1ZBcWwztRN7KoYYo7UkwmhRCNHqqfbiY8OYTAOJzEQ699TdV4gZDZD';

const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
const orderId = `CP-TEST-${Date.now()}`;
const valueReais = 131.00;
const valueCents = Math.round(valueReais * 100);

// 1. UTMify Payload
const utmifyPayload = {
  orderId: orderId,
  platform: 'Beehive',
  paymentMethod: 'pix',
  status: 'paid',
  createdAt: nowStr,
  approvedDate: nowStr,
  refundedAt: null,
  customer: {
    name: 'Cliente Teste Tapete',
    email: 'cliente.teste@cartapetes.com',
    phone: '5511999999999',
    document: '12345678900',
  },
  products: [
    {
      id: 'kit_tapete',
      name: 'Tapete Bandeja Premium Sob Medida',
      planId: null,
      planName: null,
      quantity: 1,
      priceInCents: valueCents,
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
    totalPriceInCents: valueCents,
    gatewayFeeInCents: 0,
    userCommissionInCents: valueCents,
  },
  isTest: false,
};

function postToUtmify(payload) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(payload);
    const req = https.request(
      {
        hostname: 'api.utmify.com.br',
        port: 443,
        path: '/api-credentials/orders',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(bodyStr),
          'x-api-token': UTMIFY_TOKEN,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
      }
    );
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

// 2. Meta CAPI Payload
const capiEvent = {
  event_name: 'Purchase',
  event_time: Math.floor(Date.now() / 1000),
  event_id: `purchase_${orderId}`,
  event_source_url: 'https://cartapetes.netlify.app/obrigado',
  action_source: 'website',
  user_data: {
    client_ip_address: '127.0.0.1',
    client_user_agent: 'Mozilla/5.0 Test',
    em: sha256('cliente.teste@cartapetes.com'),
    ph: sha256('5511999999999'),
    fn: sha256('cliente'),
    ln: sha256('teste'),
    country: sha256('br'),
  },
  custom_data: {
    value: valueReais,
    currency: 'BRL',
    content_type: 'product',
    contents: [{ id: 'kit_tapete', quantity: 1, item_price: valueReais }],
  },
};

function postToMetaCapi(eventData) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify({ data: [eventData] });
    const req = https.request(
      {
        hostname: 'graph.facebook.com',
        port: 443,
        path: `/v22.0/${META_PIXEL_ID}/events?access_token=${META_TOKEN}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(bodyStr),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
      }
    );
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

async function runTest() {
  console.log('--- ENVIANDO TESTE PARA UTMIFY ---');
  try {
    const utmRes = await postToUtmify(utmifyPayload);
    console.log(`UTMify Status: ${utmRes.status}`);
    console.log(`UTMify Body: ${utmRes.body}`);
  } catch (e) {
    console.error('Erro UTMify:', e);
  }

  console.log('\n--- ENVIANDO TESTE PARA META CAPI (FACEBOOK) ---');
  try {
    const metaRes = await postToMetaCapi(capiEvent);
    console.log(`Meta CAPI Status: ${metaRes.status}`);
    console.log(`Meta CAPI Body: ${metaRes.body}`);
  } catch (e) {
    console.error('Erro Meta CAPI:', e);
  }
}

runTest();
