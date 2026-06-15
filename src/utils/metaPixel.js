/**
 * Utilitário de rastreamento do Meta (Pixel & Conversions API - CAPI)
 */

// Gera hash SHA-256 no cliente usando a Web Crypto API (nativa do browser)
export async function sha256(str) {
  if (!str) return '';
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(str.trim().toLowerCase());
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (err) {
    console.error('Erro ao gerar hash SHA-256:', err);
    return '';
  }
}

// Gera um ID único para deduplicação de eventos (Pixel vs CAPI)
export function generateEventId() {
  return 'evt_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now().toString(36);
}

// Lê um cookie pelo nome (usado para recuperar _fbp e _fbc do Meta)
export function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

// Prepara e encripta em SHA-256 os dados sensíveis do cliente para Correspondência Avançada
export async function getHashedUserData(formData) {
  if (!formData) return {};
  
  const userData = {};

  if (formData.email) {
    userData.em = await sha256(formData.email);
  }
  
  if (formData.telefone) {
    // Apenas números
    const cleanPhone = formData.telefone.replace(/\D/g, '');
    // Garante DDI do Brasil (55) se não fornecido
    const phoneWithCountry = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    userData.ph = await sha256(phoneWithCountry);
  }

  if (formData.nome) {
    const nameParts = formData.nome.trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';
    
    if (firstName) userData.fn = await sha256(firstName);
    if (lastName) userData.ln = await sha256(lastName);
  }

  if (formData.cidade) {
    userData.ct = await sha256(formData.cidade);
  }

  if (formData.estado) {
    userData.st = await sha256(formData.estado);
  }

  if (formData.cep) {
    userData.zp = await sha256(formData.cep.replace(/\D/g, ''));
  }

  // Define país padrão Brasil
  userData.country = await sha256('br');

  return userData;
}

/**
 * Dispara um evento para o Meta Pixel (Navegador) e API de Conversões (Servidor)
 * 
 * @param {string} eventName - Nome do evento padrão (Ex: ViewContent, InitiateCheckout, Purchase)
 * @param {string} eventId - ID único de deduplicação
 * @param {object} customData - Informações customizadas (value, currency, contents, etc.)
 * @param {object} hashedUserData - Dados do cliente em SHA-256
 */
export async function trackMetaEvent(eventName, eventId, customData = {}, hashedUserData = {}) {
  const fbp = getCookie('_fbp');
  const fbc = getCookie('_fbc');
  
  // Combina dados de usuário com cookies padrão do Meta
  const mergedUserData = {
    ...hashedUserData,
    ...(fbp && { fbp }),
    ...(fbc && { fbc })
  };

  // 1. Dispara o evento no Navegador (Meta Pixel)
  if (window.fbq) {
    console.log(`[Meta Pixel] Enviando evento: ${eventName}`, { customData, eventId });
    window.fbq('track', eventName, customData, { eventID: eventId });
  } else {
    console.warn('[Meta Pixel] SDK do Pixel não encontrado no navegador.');
  }

  // 2. Dispara o evento via Servidor (Conversions API - CAPI)
  const capiPayload = {
    event_name: eventName,
    event_id: eventId,
    event_source_url: window.location.href,
    user_data: mergedUserData,
    custom_data: customData
  };

  try {
    console.log(`[Meta CAPI Proxy] Enviando evento via proxy: ${eventName}`);
    const response = await fetch('/meta-capi', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(capiPayload)
    });

    if (!response.ok) {
      throw new Error(`Proxy respondeu com status ${response.status}`);
    }

    const resData = await response.json();
    console.log('[Meta CAPI Proxy] Sucesso:', resData);
  } catch (err) {
    // Sem fallback direto ao Graph API a partir do navegador: isso exporia o Access
    // Token publicamente. O Pixel (navegador) já cobre este evento e, para o Purchase,
    // o webhook do servidor envia o CAPI com o mesmo event_id (deduplicação).
    console.warn('[Meta CAPI Proxy] Falha ao enviar via proxy:', err);
  }
}
