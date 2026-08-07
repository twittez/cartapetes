/**
 * utmCapture.js
 * Responsável por capturar, persistir e recuperar UTMs da URL.
 * Salva em sessionStorage para que os UTMs acompanhem o pedido até o pagamento.
 */

const SESSION_KEY = 'cartapetes_utms';

/**
 * Captura todos os parâmetros de rastreamento da URL atual e salva no sessionStorage.
 * Deve ser chamado 1x no carregamento inicial do site (App.jsx).
 */
export function captureUTMs() {
  try {
    const params = new URLSearchParams(window.location.search);

    const utms = {
      utm_source: params.get('utm_source') || null,
      utm_medium: params.get('utm_medium') || null,
      utm_campaign: params.get('utm_campaign') || null,
      utm_content: params.get('utm_content') || null,
      utm_term: params.get('utm_term') || null,
      fbclid: params.get('fbclid') || null,
      gclid: params.get('gclid') || null,
      ttclid: params.get('ttclid') || null,
      src: params.get('src') || null,
      sck: params.get('sck') || null,
    };

    // Só sobrescreve se houver algum UTM novo na URL
    const hasAnyUTM = Object.values(utms).some(v => v !== null);
    if (hasAnyUTM) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(utms));
      console.log('[UTMCapture] UTMs capturados e salvos:', utms);
    } else {
      // Tenta recuperar UTMs de sessões anteriores na mesma aba
      const existing = sessionStorage.getItem(SESSION_KEY);
      if (!existing) {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(utms));
      }
    }

    // Também salva fbclid no cookie _fbc se presente (padrão Meta)
    if (utms.fbclid) {
      const timestamp = Math.floor(Date.now() / 1000);
      document.cookie = `_fbc=fb.1.${timestamp}.${utms.fbclid};path=/;max-age=7776000`;
    }

    return utms;
  } catch (e) {
    console.error('[UTMCapture] Erro ao capturar UTMs:', e);
    return {};
  }
}

/**
 * Retorna os UTMs salvos no sessionStorage.
 * Use antes de criar um pedido para incluir UTMs no payload.
 */
export function getStoredUTMs() {
  try {
    const stored = sessionStorage.getItem(SESSION_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (e) {
    return {};
  }
}

/**
 * Retorna os UTMs formatados para o payload da UTMify (trackingParameters).
 */
export function getUTMifyTrackingParams() {
  const utms = getStoredUTMs();
  return {
    src: utms.src || null,
    sck: utms.sck || null,
    utm_source: utms.utm_source || null,
    utm_medium: utms.utm_medium || null,
    utm_campaign: utms.utm_campaign || null,
    utm_content: utms.utm_content || null,
    utm_term: utms.utm_term || null,
  };
}
