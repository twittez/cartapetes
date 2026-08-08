/**
 * facebookPixel.js
 * Responsável exclusivo por todos os eventos do Facebook Pixel no browser.
 * Usa event_id para deduplicação entre browser pixel e CAPI (servidor).
 *
 * REGRAS:
 * - Cada evento só dispara 1x por sessão (controlado por sessionStorage)
 * - O mesmo event_id é enviado ao CAPI via meta-capi.js para deduplicação
 * - UTMify NÃO é responsável pelo aquecimento do Pixel
 */

import { getCookie } from '../utils/metaPixel';

const PIXEL_ID = '1932684814101405';

// Chaves de deduplicação no sessionStorage
const DEDUP_KEYS = {
  ViewContent: 'fb_vc_fired',
  InitiateCheckout: 'fb_ic_fired',
  Purchase: 'fb_purchase_fired',
};

/** Gera um event_id único e estável */
function makeEventId(prefix = 'evt') {
  return `${prefix}_${Math.random().toString(36).substring(2, 10)}_${Date.now().toString(36)}`;
}

/** Envia o evento via Pixel browser (fbq) */
function firePixel(eventName, customData = {}, eventId = null) {
  if (typeof window === 'undefined' || !window.fbq) {
    console.warn(`[FB Pixel] fbq não disponível para evento: ${eventName}`);
    return;
  }
  const eid = eventId || makeEventId(eventName.toLowerCase());
  window.fbq('track', eventName, customData, { eventID: eid });
  console.log(`[FB Pixel] ✅ ${eventName} disparado`, { eventId: eid, customData });
  return eid;
}

/** Envia o evento via CAPI (servidor Netlify) */
async function fireCAPI(eventName, customData = {}, eventId, hashedUserData = {}) {
  try {
    const fbp = getCookie('_fbp');
    const fbc = getCookie('_fbc');

    const payload = {
      event_name: eventName,
      event_id: eventId,
      event_source_url: window.location.href,
      user_data: {
        ...hashedUserData,
        ...(fbp && { fbp }),
        ...(fbc && { fbc }),
      },
      custom_data: customData,
    };

    const res = await fetch('/.netlify/functions/meta-capi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error(`CAPI respondeu ${res.status}`);
    const data = await res.json();
    console.log(`[FB CAPI] ✅ ${eventName} enviado`, data);
  } catch (e) {
    console.warn(`[FB CAPI] ⚠️ Falha ao enviar ${eventName}:`, e.message);
  }
}

// ─────────────────────────────────────────
// Eventos Públicos
// ─────────────────────────────────────────

/**
 * PageView — dispara automaticamente via fbq('init') no index.html
 * Não precisa ser chamado manualmente.
 */
export function pageView() {
  if (typeof window !== 'undefined' && window.fbq) {
    window.fbq('track', 'PageView');
    console.log('[FB Pixel] PageView disparado');
  }
}

/**
 * ViewContent — dispara quando o usuário visualiza um produto/kit
 * @param {string} kitId - ID do kit (ex: 'kit_basico')
 * @param {number} price - Preço do produto
 * @param {string} vehicleName - Nome do veículo selecionado
 */
export function viewContent(kitId, price, vehicleName = '') {
  const dedupKey = `${DEDUP_KEYS.ViewContent}_${kitId}`;
  if (sessionStorage.getItem(dedupKey)) {
    console.log('[FB Pixel] ViewContent já disparado para este kit, ignorando.');
    return;
  }
  sessionStorage.setItem(dedupKey, '1');

  const eventId = makeEventId('vc');
  const customData = {
    value: price,
    currency: 'BRL',
    content_type: 'product',
    content_ids: [kitId],
    content_name: `Kit ${kitId} - ${vehicleName}`,
  };

  firePixel('ViewContent', customData, eventId);
  fireCAPI('ViewContent', customData, eventId);
}

/**
 * InitiateCheckout — dispara quando o checkout é aberto
 * @param {string} kitId - ID do kit
 * @param {number} price - Preço final calculado
 * @param {string} vehicleName - Nome do veículo
 */
export function initiateCheckout(kitId, price, vehicleName = '') {
  const dedupKey = `${DEDUP_KEYS.InitiateCheckout}_${kitId}`;
  if (sessionStorage.getItem(dedupKey)) {
    console.log('[FB Pixel] InitiateCheckout já disparado para este kit, ignorando.');
    return null;
  }
  sessionStorage.setItem(dedupKey, '1');

  const eventId = makeEventId('ic');
  sessionStorage.setItem('fb_ic_event_id', eventId); // salva para usar no Purchase

  const customData = {
    value: price,
    currency: 'BRL',
    content_type: 'product',
    content_ids: [kitId],
    contents: [{ id: kitId, quantity: 1, item_price: price }],
    num_items: 1,
    content_name: `Kit ${kitId} - ${vehicleName}`,
  };

  firePixel('InitiateCheckout', customData, eventId);
  fireCAPI('InitiateCheckout', customData, eventId);

  return eventId;
}

/**
 * Purchase — dispara quando o pagamento é confirmado (status paid)
 * @param {string} orderId - ID do pedido
 * @param {number} value - Valor pago
 * @param {object} hashedUserData - Dados do cliente hasheados em SHA-256
 */
export function purchase(orderId, value, hashedUserData = {}) {
  const dedupKey = `${DEDUP_KEYS.Purchase}_${orderId || 'default'}`;
  if (sessionStorage.getItem(dedupKey)) {
    console.log(`[FB Pixel] Purchase já disparado para pedido ${orderId}, ignorando.`);
    return null;
  }
  sessionStorage.setItem(dedupKey, '1');

  // Usa o eventId do InitiateCheckout se disponível ou gera novo
  const eventId = sessionStorage.getItem('fb_purchase_event_id') || makeEventId('purchase');
  sessionStorage.setItem('fb_purchase_event_id', eventId);

  const customData = {
    value,
    currency: 'BRL',
    content_type: 'product',
    contents: [{ id: 'kit_tapete', quantity: 1, item_price: value }],
    order_id: orderId,
  };

  firePixel('Purchase', customData, eventId);
  fireCAPI('Purchase', customData, eventId, hashedUserData);

  console.log(`[FB Pixel] ✅ Purchase registrado — orderId: ${orderId}, valor: R$ ${value}`);
  return eventId;
}

