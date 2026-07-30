// test_pending_utmify.cjs
const https = require('https');

const UTMIFY_TOKEN = 'HNIuD0M6zetaINZlNEBZQAzabtvFovXyt8Ui';
const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
const orderId = `CP-PENDING-${Date.now()}`;
const valueReais = 131.00;
const valueCents = Math.round(valueReais * 100);

const utmifyPayload = {
  orderId: orderId,
  platform: 'Beehive',
  paymentMethod: 'pix',
  status: 'waiting_payment',
  createdAt: nowStr,
  approvedDate: null,
  refundedAt: null,
  customer: {
    name: 'Cliente Pendente Teste',
    email: 'pendente.teste@cartapetes.com',
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

async function run() {
  console.log('--- ENVIANDO PEDIDO PENDENTE PARA UTMIFY ---');
  try {
    const res = await postToUtmify(utmifyPayload);
    console.log(`UTMify Status: ${res.status}`);
    console.log(`UTMify Body: ${res.body}`);
  } catch (e) {
    console.error('Erro UTMify:', e);
  }
}

run();
