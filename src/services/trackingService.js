/**
 * trackingService.js
 * Serviço centralizado de rastreamento de visitantes, UTMs, atribuição e eventos em tempo real.
 *
 * REGRAS DE ATRIBUIÇÃO & UTMs:
 * - Salva parâmetros de primeira visita (First Touch) no localStorage/sessionStorage.
 * - Preserva UTMs (utm_source, utm_medium, utm_campaign, utm_content, utm_term, fbclid, gclid)
 *   durante toda a jornada do funil.
 * - Determina origem do tráfego (Instagram, Facebook, Google, TikTok, Kwai, WhatsApp, Direto).
 * - Envia heartbeats periódicos (10s) para o Supabase (tabela online_leads) mantendo o estado do lead vivo.
 */

import { supabase } from '../utils/supabase';

const SESSION_KEY = 'cartapetes_session_id';
const UTM_STORE_KEY = 'cartapetes_first_touch_utms';
const VEHICLE_STORE_KEY = 'cartapetes_selected_vehicle';

// Gera ou recupera o ID de sessão único do visitante
export function getSessionId() {
  if (typeof window === 'undefined') return 'ssr_session';
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = 'sess_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

// Extrai e armazena os parâmetros UTM / Ads da URL (preservando First Touch)
export function captureAndStoreUTMs() {
  if (typeof window === 'undefined') return {};

  const urlParams = new URLSearchParams(window.location.search);
  const currentUtms = {
    utm_source: urlParams.get('utm_source') || null,
    utm_medium: urlParams.get('utm_medium') || null,
    utm_campaign: urlParams.get('utm_campaign') || null,
    utm_content: urlParams.get('utm_content') || null,
    utm_term: urlParams.get('utm_term') || null,
    fbclid: urlParams.get('fbclid') || null,
    gclid: urlParams.get('gclid') || null,
    src: urlParams.get('src') || null,
    sck: urlParams.get('sck') || null,
  };

  // Se houver novos UTMs na URL, salva/atualiza
  const hasNewUtms = Object.values(currentUtms).some(val => val !== null);

  let storedStr = localStorage.getItem(UTM_STORE_KEY);
  let storedUtms = storedStr ? JSON.parse(storedStr) : {};

  if (hasNewUtms) {
    storedUtms = { ...storedUtms, ...currentUtms };
    localStorage.setItem(UTM_STORE_KEY, JSON.stringify(storedUtms));
    sessionStorage.setItem(UTM_STORE_KEY, JSON.stringify(storedUtms));
  } else if (!storedStr) {
    // Se não tinha salvo, usa o que tiver no sessionStorage
    const sessionStr = sessionStorage.getItem(UTM_STORE_KEY);
    if (sessionStr) {
      storedUtms = JSON.parse(sessionStr);
    }
  }

  return storedUtms;
}

// Identifica a Origem do Tráfego com precisão baseada em UTMs e Referrer
export function getTrafficOrigin() {
  if (typeof window === 'undefined') return 'Direto';

  const utms = captureAndStoreUTMs();
  const source = (utms.utm_source || utms.src || '').toLowerCase();
  const ref = (document.referrer || '').toLowerCase();

  if (source.includes('instagram') || ref.includes('instagram.com')) return 'Instagram';
  if (source.includes('facebook') || source.includes('fb') || ref.includes('facebook.com') || ref.includes('fb.me')) return 'Facebook';
  if (source.includes('google') || source.includes('gads') || ref.includes('google.com')) return 'Google';
  if (source.includes('tiktok') || ref.includes('tiktok.com')) return 'TikTok';
  if (source.includes('kwai') || ref.includes('kwai.com')) return 'Kwai';
  if (source.includes('whatsapp') || ref.includes('wa.me') || ref.includes('whatsapp.com')) return 'WhatsApp';

  if (!ref) return 'Direto';
  return 'Outra referência';
}

// Dispositivo e Navegador
export function getDeviceAndBrowser() {
  if (typeof navigator === 'undefined') return { dispositivo: 'Desktop', navegador: 'Chrome' };
  const ua = navigator.userAgent;

  let dispositivo = 'Desktop';
  if (/mobile|android|iphone|ipad|phone/i.test(ua)) dispositivo = 'Mobile';
  else if (/tablet|ipad/i.test(ua)) dispositivo = 'Tablet';

  let navegador = 'Outro';
  if (/chrome|crios/i.test(ua) && !/edge|edg/i.test(ua) && !/opr/i.test(ua)) navegador = 'Chrome';
  else if (/safari/i.test(ua) && !/chrome|crios/i.test(ua)) navegador = 'Safari';
  else if (/firefox|fxios/i.test(ua)) navegador = 'Firefox';
  else if (/edge|edg/i.test(ua)) navegador = 'Edge';

  return { dispositivo, navegador };
}

// Classe Central do Rastreamento
class TrackingService {
  constructor() {
    this.sessionId = getSessionId();
    this.currentStage = 'Loja'; // Stages: 'Loja', 'Checkout', 'Pagamento', 'Rastreio'
    this.vehicle = typeof window !== 'undefined' ? localStorage.getItem(VEHICLE_STORE_KEY) : null;
    this.customerData = { nome: null, email: null };
    this.heartbeatTimer = null;
    this.initialized = false;
  }

  init(initialStage = 'Loja') {
    if (this.initialized) return;
    this.initialized = true;

    this.currentStage = initialStage;
    captureAndStoreUTMs();

    // Envia ping inicial imediato
    this.sendPing();

    // Inicia Heartbeat a cada 10 segundos
    if (typeof window !== 'undefined') {
      this.heartbeatTimer = setInterval(() => {
        this.sendPing();
      }, 10000);

      // Notifica saída no unload
      window.addEventListener('beforeunload', () => {
        this.notifyExit();
      });
    }
  }

  setVehicle(vehicleName) {
    if (!vehicleName) return;
    this.vehicle = vehicleName;
    if (typeof window !== 'undefined') {
      localStorage.setItem(VEHICLE_STORE_KEY, vehicleName);
    }
    this.sendPing();
    this.recordEvent('vehicle_selected', `Veículo selecionado: ${vehicleName}`, { vehicle: vehicleName });
  }

  updateCustomerData(nome, email) {
    if (nome) this.customerData.nome = nome;
    if (email) this.customerData.email = email;
    this.sendPing();
  }

  updateStage(stageName) {
    this.currentStage = stageName;
    this.sendPing();

    if (stageName === 'Checkout') {
      this.recordEvent('initiate_checkout', 'Checkout iniciado', { vehicle: this.vehicle });
    } else if (stageName === 'Rastreio') {
      this.recordEvent('tracking_view', 'Página de rastreio acessada', {});
    }
  }

  async sendPing() {
    const utms = captureAndStoreUTMs();
    const origin = getTrafficOrigin();
    const { dispositivo, navegador } = getDeviceAndBrowser();
    const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
    const carModel = this.vehicle || (typeof window !== 'undefined' ? localStorage.getItem(VEHICLE_STORE_KEY) : null);

    const payload = {
      session_id: this.sessionId,
      last_seen: new Date().toISOString(),
      status_etapa: this.currentStage,
      modelo_carro: carModel,
      nome: this.customerData.nome || null,
      email: this.customerData.email || null,
      url_atual: currentUrl,
      dispositivo,
      navegador,
      origem_trafego: origin,
      utm_source: utms.utm_source || null,
      utm_medium: utms.utm_medium || null,
      utm_campaign: utms.utm_campaign || null,
      utm_content: utms.utm_content || null,
      utm_term: utms.utm_term || null,
      fbclid: utms.fbclid || null,
      gclid: utms.gclid || null,
    };

    // 1. Envia Ping via HTTP API ao backend Node/Render
    if (typeof window !== 'undefined') {
      const endpoints = ['/api/online-leads', 'https://wepink-checkout.onrender.com/api/online-leads'];
      endpoints.forEach(url => {
        fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }).catch(() => {});
      });
    }

    // 2. Se o Supabase estiver configurado, salva na tabela online_leads
    if (supabase) {
      try {
        await supabase.from('online_leads').upsert([payload], { onConflict: 'session_id' });
      } catch (e) {
        console.warn('[TrackingService] Falha no ping Supabase online_leads:', e.message);
      }
    }
  }

  async recordEvent(eventType, description, metadata = {}) {
    if (!supabase) return;
    try {
      await supabase.from('events').insert([{
        session_id: this.sessionId,
        event_type: eventType,
        description,
        vehicle: this.vehicle,
        metadata,
        created_at: new Date().toISOString()
      }]);
    } catch (e) {
      console.warn('[TrackingService] Falha ao registrar evento:', e.message);
    }
  }

  async notifyExit() {
    // Opção leve para marcar inatividade no unload
    if (!supabase) return;
    try {
      const oldTime = new Date(Date.now() - 60000).toISOString();
      supabase.from('online_leads').update({ last_seen: oldTime }).eq('session_id', this.sessionId).then();
    } catch (e) {}
  }
}

export const trackingService = new TrackingService();
