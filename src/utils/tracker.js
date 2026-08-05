import { supabase } from './supabase';

let sessionId = sessionStorage.getItem('tracker_session_id');
if (!sessionId) {
  sessionId = 'sess_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
  sessionStorage.setItem('tracker_session_id', sessionId);
}

const API_BASE = (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
  ? 'http://localhost:3000'
  : 'https://wepink-checkout.onrender.com';

let cachedGeo = { ip: null, pais: 'Brasil', estado: 'São Paulo', cidade: 'São Paulo' };
let cachedLead = { nome: null, email: null };
let currentStage = 'Loja';

// OS, Browser, Device parsing
function getOS() {
  const ua = navigator.userAgent;
  if (/windows/i.test(ua)) return 'Windows';
  if (/macintosh|mac os x/i.test(ua)) return 'macOS';
  if (/iphone|ipad|ipod/i.test(ua)) return 'iOS';
  if (/android/i.test(ua)) return 'Android';
  if (/linux/i.test(ua)) return 'Linux';
  return 'Outro';
}

function getBrowser() {
  const ua = navigator.userAgent;
  if (/chrome|crios/i.test(ua) && !/edge|edg/i.test(ua) && !/opr/i.test(ua)) return 'Chrome';
  if (/safari/i.test(ua) && !/chrome|crios/i.test(ua)) return 'Safari';
  if (/firefox|fxios/i.test(ua)) return 'Firefox';
  if (/edge|edg/i.test(ua)) return 'Edge';
  if (/opr|opera/i.test(ua)) return 'Opera';
  return 'Outro';
}

function getDevice() {
  const ua = navigator.userAgent;
  if (/mobile|android|iphone|ipad|phone/i.test(ua)) return 'Mobile';
  if (/tablet|ipad/i.test(ua)) return 'Tablet';
  return 'Desktop';
}

// Parse UTM params
function getUTMData() {
  const urlParams = new URLSearchParams(window.location.search);
  return {
    source: urlParams.get('utm_source'),
    medium: urlParams.get('utm_medium'),
    campaign: urlParams.get('utm_campaign')
  };
}

// Parse traffic origin
function getTrafficOrigin() {
  const ref = document.referrer;
  if (!ref) return 'Direto';
  if (ref.includes('facebook.com') || ref.includes('fb.me')) return 'Facebook Ads';
  if (ref.includes('instagram.com')) return 'Instagram';
  if (ref.includes('tiktok.com')) return 'TikTok Ads';
  if (ref.includes('google.com')) return 'Google Ads / Orgânico';
  if (ref.includes('wa.me') || ref.includes('whatsapp.com')) return 'WhatsApp';
  if (ref.includes('mailto:')) return 'E-mail';
  return 'Referência';
}

// IP/Geo lookup rápido e com timeout seguro de 3s
async function fetchGeoData() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const response = await fetch('https://api.ipify.org?format=json', { signal: controller.signal });
    clearTimeout(timeoutId);
    if (response.ok) {
      const data = await response.json();
      const ip = data.ip;
      return { ip, pais: 'Brasil', estado: 'São Paulo', cidade: 'São Paulo' };
    }
  } catch (err) {}
  return { ip: null, pais: 'Brasil', estado: 'São Paulo', cidade: 'São Paulo' };
}

// Global buffer for recording mouse movements/events
let eventQueue = [];
let lastMousePos = { x: 0, y: 0 };
let trackStartTime = Date.now();

// Dispara ping para o servidor backend e para o Supabase
async function sendPing(stage = 'Loja', extra = {}) {
  const payload = {
    session_id: sessionId,
    ip: cachedGeo.ip || null,
    cidade: cachedGeo.cidade || 'São Paulo',
    estado: cachedGeo.estado || 'SP',
    dispositivo: getDevice(),
    status_etapa: stage || currentStage,
    url_atual: window.location.href,
    nome: cachedLead.nome || null,
    email: cachedLead.email || null,
    ...extra
  };

  // 1. Backend Server Ping (Render / Localhost)
  try {
    fetch(`${API_BASE}/api/tracker/ping`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch(() => {});
  } catch (e) {}

  // 2. Supabase Realtime Online Leads Table
  if (supabase) {
    try {
      supabase.from('online_leads').upsert([{
        session_id: payload.session_id,
        ip: payload.ip,
        cidade: payload.cidade,
        estado: payload.estado,
        nome: payload.nome,
        email: payload.email,
        status_etapa: payload.status_etapa,
        dispositivo: payload.dispositivo,
        url_atual: payload.url_atual,
        last_seen: new Date().toISOString()
      }], { onConflict: 'session_id' }).then();
    } catch (e) {}
  }
}

export const tracker = {
  initialized: false,

  async init(initialPage = 'Loja') {
    if (this.initialized) return;
    this.initialized = true;
    currentStage = initialPage;

    // Disparo imediato (0ms delay) para o painel registrar o lead na hora
    sendPing(initialPage);

    // Inicia ouvintes de evento e heartbeat constante
    this.startHeartbeat(initialPage);
    this.startEventListeners(initialPage);

    // Busca IP e localização em segundo plano de forma não-bloqueante
    fetchGeoData().then((geo) => {
      cachedGeo = geo;
      sendPing(currentStage);

      if (supabase) {
        const utms = getUTMData();
        const origin = getTrafficOrigin();
        supabase.from('visitor_sessions').upsert([{
          session_id: sessionId,
          ip: geo.ip,
          pais: geo.pais,
          estado: geo.estado,
          cidade: geo.cidade,
          dispositivo: getDevice(),
          navegador: getBrowser(),
          so: getOS(),
          screen_resolution: `${window.innerWidth}x${window.innerHeight}`,
          origem_trafego: origin,
          utm_source: utms.source,
          utm_medium: utms.medium,
          utm_campaign: utms.campaign,
          url_entrada: window.location.href,
          rejeitado: true,
          last_active: new Date().toISOString()
        }], { onConflict: 'session_id' }).then();
      }
    }).catch(() => {});
  },

  updateLeadInfo(nome, email) {
    cachedLead.nome = nome || cachedLead.nome;
    cachedLead.email = email || cachedLead.email;
    sendPing(currentStage);
  },

  async updateStage(stageName) {
    currentStage = stageName;
    sendPing(stageName);

    if (supabase) {
      try {
        supabase.from('visitor_sessions').update({
          rejeitado: false,
          last_active: new Date().toISOString()
        }).eq('session_id', sessionId).then();
      } catch (e) {}
    }
  },

  startHeartbeat(initialStage) {
    // Send active state check every 2 seconds for instant real-time sync
    setInterval(() => {
      sendPing(currentStage);

      if (supabase) {
        try {
          const timeElapsed = Math.floor((Date.now() - trackStartTime) / 1000);
          supabase.from('visitor_sessions').update({
            duracao_segundos: timeElapsed,
            last_active: new Date().toISOString()
          }).eq('session_id', sessionId).then();
        } catch (e) {}
      }
    }, 2000);

    // Upload recorded cursor/scroll replay actions every 6 seconds
    setInterval(async () => {
      if (eventQueue.length === 0 || !supabase) return;

      const eventsToUpload = [...eventQueue];
      eventQueue = []; // Clear queue immediately to avoid race conditions

      try {
        supabase.from('session_replays').insert([{
          session_id: sessionId,
          events: eventsToUpload
        }]).then();
      } catch (e) {}
    }, 6000);
  },

  startEventListeners(currentPage) {
    // 1. Mouse movements (Sampled to keep payload light)
    let sampleTimer = 0;
    window.addEventListener('mousemove', (e) => {
      const now = Date.now();
      if (now - sampleTimer > 250) {
        sampleTimer = now;
        lastMousePos = { x: e.clientX, y: e.clientY };
        eventQueue.push({
          type: 'move',
          x: e.clientX,
          y: e.clientY,
          time: now - trackStartTime
        });
      }
    });

    // 2. Click events (Heatmap & Replays)
    window.addEventListener('click', async (e) => {
      const now = Date.now();
      const xPct = parseFloat(((e.clientX / window.innerWidth) * 100).toFixed(2));
      const yPx = e.pageY;

      eventQueue.push({
        type: 'click',
        x: e.clientX,
        y: e.clientY,
        path: window.location.pathname,
        time: now - trackStartTime
      });

      if (supabase) {
        try {
          supabase.from('heatmap_clicks').insert([{
            session_id: sessionId,
            page_url: window.location.pathname,
            x_pct: xPct,
            y_px: yPx,
            screen_width: window.innerWidth
          }]).then();
        } catch (e) {}
      }
    });

    // 3. Scroll tracking
    let scrollTimer = 0;
    window.addEventListener('scroll', () => {
      const now = Date.now();
      if (now - scrollTimer > 300) {
        scrollTimer = now;
        eventQueue.push({
          type: 'scroll',
          scrollY: window.scrollY,
          time: now - trackStartTime
        });
      }
    });
  }
};
