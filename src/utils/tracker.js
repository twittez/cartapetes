import { supabase } from './supabase';

let sessionId = sessionStorage.getItem('tracker_session_id');
if (!sessionId) {
  sessionId = 'sess_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
  sessionStorage.setItem('tracker_session_id', sessionId);
}

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

// IP/Geo lookup
async function fetchGeoData() {
  try {
    const response = await fetch('https://ipapi.co/json/');
    if (response.ok) {
      const data = await response.json();
      return {
        ip: data.ip || '127.0.0.1',
        pais: data.country_name || 'Brasil',
        estado: data.region || 'São Paulo',
        cidade: data.city || 'São Paulo'
      };
    }
  } catch (err) {
    console.warn('[Tracker] Falha ao obter geolocalização. Usando dados padrão.', err);
  }
  return { ip: '127.0.0.1', pais: 'Brasil', estado: 'São Paulo', cidade: 'São Paulo' };
}

// Global buffer for recording mouse movements/events
let eventQueue = [];
let lastMousePos = { x: 0, y: 0 };
let trackStartTime = Date.now();

export const tracker = {
  initialized: false,

  async init(initialPage = 'Loja') {
    if (this.initialized || !supabase) return;
    this.initialized = true;

    try {
      const geo = await fetchGeoData();
      const utms = getUTMData();
      const origin = getTrafficOrigin();

      const sessionData = {
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
        rejeitado: true, // Default to true, will update to false on action
        last_active: new Date().toISOString()
      };

      // 1. Save or update visitor session
      const { error: sessErr } = await supabase
        .from('visitor_sessions')
        .upsert([sessionData], { onConflict: 'session_id' });

      if (sessErr) {
        console.error('[Tracker] Erro ao registrar sessão:', sessErr.message);
      }

      // 2. Log to online_leads table
      await supabase.from('online_leads').upsert([{
        session_id: sessionId,
        nome: null,
        email: null,
        status_etapa: initialPage,
        dispositivo: getDevice(),
        url_atual: window.location.href,
        last_seen: new Date().toISOString()
      }], { onConflict: 'session_id' });

      // Start periodic updates (heartbeat + replay upload)
      this.startHeartbeat(initialPage);
      this.startEventListeners(initialPage);

    } catch (err) {
      console.error('[Tracker] Falha na inicialização do tracking:', err);
    }
  },

  updateLeadInfo(nome, email) {
    if (!supabase) return;
    supabase.from('online_leads').update({
      nome,
      email,
      last_seen: new Date().toISOString()
    }).eq('session_id', sessionId).then();
  },

  async updateStage(stageName) {
    if (!supabase) return;
    // Mark session as non-bounced (rejeitado = false) on step progress
    await supabase.from('visitor_sessions').update({
      rejeitado: false,
      last_active: new Date().toISOString()
    }).eq('session_id', sessionId);

    await supabase.from('online_leads').update({
      status_etapa: stageName,
      url_atual: window.location.href,
      last_seen: new Date().toISOString()
    }).eq('session_id', sessionId);
  },

  startHeartbeat(currentStage) {
    // Send active state check every 10 seconds
    setInterval(async () => {
      if (!supabase) return;
      const now = new Date().toISOString();
      
      // Update session activity
      const timeElapsed = Math.floor((Date.now() - trackStartTime) / 1000);
      await supabase.from('visitor_sessions').update({
        duracao_segundos: timeElapsed,
        last_active: now
      }).eq('session_id', sessionId);

      // Update online lead state
      await supabase.from('online_leads').update({
        last_seen: now
      }).eq('session_id', sessionId);

    }, 10000);

    // Upload recorded cursor/scroll replay actions every 6 seconds
    setInterval(async () => {
      if (eventQueue.length === 0 || !supabase) return;

      const eventsToUpload = [...eventQueue];
      eventQueue = []; // Clear queue immediately to avoid race conditions

      await supabase.from('session_replays').insert([{
        session_id: sessionId,
        events: eventsToUpload
      }]);
    }, 6000);
  },

  startEventListeners(currentPage) {
    // 1. Mouse movements (Sampled to keep payload light)
    let sampleTimer = 0;
    window.addEventListener('mousemove', (e) => {
      const now = Date.now();
      if (now - sampleTimer > 250) { // Limit sampling to 250ms
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
      const yPx = e.pageY; // pageY includes vertical scroll level

      // Add to replay log
      eventQueue.push({
        type: 'click',
        x: e.clientX,
        y: e.clientY,
        path: window.location.pathname,
        time: now - trackStartTime
      });

      // Save to global heatmap_clicks table
      if (supabase) {
        await supabase.from('heatmap_clicks').insert([{
          session_id: sessionId,
          page_url: window.location.pathname,
          x_pct: xPct,
          y_px: yPx,
          screen_width: window.innerWidth
        }]);
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
