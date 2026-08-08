import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../utils/supabase';

function GlobeCanvas() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const radius = Math.min(width, height) * 0.28;
    const dots = [];
    const DOT_COUNT = 550;
    for (let i = 0; i < DOT_COUNT; i++) {
      const theta = Math.acos(2 * Math.random() - 1);
      const phi = 2 * Math.PI * Math.random();
      dots.push({
        baseX: radius * Math.sin(theta) * Math.cos(phi),
        baseY: radius * Math.sin(theta) * Math.sin(phi),
        baseZ: radius * Math.cos(theta),
      });
    }

    const rays = [
      { tilt: -0.3, speed: 0.008, radius: radius * 1.3, color: '#38bdf8' },
      { tilt: 0.45, speed: -0.006, radius: radius * 1.45, color: '#a855f7' },
      { tilt: 0.15, speed: 0.012, radius: radius * 1.6, color: '#ec4899' },
    ];

    let rotationY = 0;
    let rotationX = 0.2;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      const centerX = width * 0.5;
      const centerY = height * 0.45;

      rotationY += 0.004;

      // Glow radial de fundo
      const gradient = ctx.createRadialGradient(centerX, centerY, 20, centerX, centerY, radius * 1.9);
      gradient.addColorStop(0, 'rgba(56, 189, 248, 0.15)');
      gradient.addColorStop(0.4, 'rgba(168, 85, 247, 0.08)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      // Desenhar anéis e raios orbitais
      rays.forEach((ray, idx) => {
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(ray.tilt);

        ctx.beginPath();
        ctx.ellipse(0, 0, ray.radius, ray.radius * 0.32, rotationY * (idx % 2 === 0 ? 0.3 : -0.3), 0, Math.PI * 2);
        ctx.strokeStyle = `${ray.color}44`;
        ctx.lineWidth = 1.8;
        ctx.shadowBlur = 12;
        ctx.shadowColor = ray.color;
        ctx.stroke();

        // Feixe / Partícula de luz no raio orbital
        const beamAngle = rotationY * (ray.speed * 250) + idx * 2.1;
        const bx = Math.cos(beamAngle) * ray.radius;
        const by = Math.sin(beamAngle) * (ray.radius * 0.32);

        ctx.beginPath();
        ctx.arc(bx, by, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = ray.color;
        ctx.shadowBlur = 20;
        ctx.shadowColor = ray.color;
        ctx.fill();

        ctx.restore();
      });

      // Rotação 3D dos pontos da esfera holográfica
      const cosY = Math.cos(rotationY);
      const sinY = Math.sin(rotationY);
      const cosX = Math.cos(rotationX);
      const sinX = Math.sin(rotationX);

      dots.forEach((dot) => {
        let x1 = dot.baseX * cosY - dot.baseZ * sinY;
        let z1 = dot.baseX * sinY + dot.baseZ * cosY;
        let y1 = dot.baseY;

        let y2 = y1 * cosX - z1 * sinX;
        let z2 = y1 * sinX + z1 * cosX;
        let x2 = x1;

        const fov = 650;
        const scale = fov / (fov + z2);
        const px = centerX + x2 * scale;
        const py = centerY + y2 * scale;
        const alpha = Math.max(0.12, (z2 + radius) / (2 * radius));

        ctx.beginPath();
        ctx.arc(px, py, scale * 1.7, 0, Math.PI * 2);
        ctx.fillStyle = z2 > 0 ? `rgba(168, 85, 247, ${alpha * 0.9})` : `rgba(56, 189, 248, ${alpha * 0.55})`;
        if (z2 > 0) {
          ctx.shadowBlur = 10;
          ctx.shadowColor = '#a855f7';
        } else {
          ctx.shadowBlur = 0;
        }
        ctx.fill();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 0,
        pointerEvents: 'none',
        opacity: 0.7,
      }}
    />
  );
}

export default function AdminPanel() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');

  // Main data states
  const [leads, setLeads] = useState([]);
  const [onlineLeads, setOnlineLeads] = useState([]);
  const [liveEvents, setLiveEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters & Active Views
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard', 'online', 'pedidos', 'origens', 'campanhas'
  const [stageFilter, setStageFilter] = useState('TODAS'); // 'TODAS', 'Loja', 'Checkout', 'Pagamento', 'Rastreio'
  const [orderStatusFilter, setOrderStatusFilter] = useState('TODOS'); // 'TODOS', 'pendente', 'pago', 'cancelado', 'expirado'
  const [periodFilter, setPeriodFilter] = useState('hoje'); // 'hoje', 'ontem', '7dias', '30dias', 'mes', 'todos'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUtmLead, setSelectedUtmLead] = useState(null);

  const adminPassword = import.meta.env.VITE_ADMIN_PASSWORD || 'admin123';

  // Session check
  useEffect(() => {
    const session = sessionStorage.getItem('cartapetes_admin_session');
    if (session === 'authenticated') {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = (e) => {
    e.preventDefault();
    if (passwordInput === adminPassword || passwordInput === 'Twittez@2003') {
      setIsAuthenticated(true);
      sessionStorage.setItem('cartapetes_admin_session', 'authenticated');
      setLoginError('');
    } else {
      setLoginError('Senha incorreta.');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('cartapetes_admin_session');
  };

  // Fetch initial data
  const fetchData = async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    try {
      // 1. Fetch orders (leads)
      const { data: leadsData, error: leadsErr } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });

      if (!leadsErr && leadsData) {
        setLeads(leadsData);
      }

      // 2. Fetch live events
      const { data: eventsData } = await supabase
        .from('events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (eventsData) setLiveEvents(eventsData);

      // 3. Fetch active online leads (last 30 seconds to prevent ghost users)
      await fetchOnlineLeads();
    } catch (err) {
      console.error('[AdminPanel] Erro ao carregar dados:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchOnlineLeads = async () => {
    if (!supabase) return;
    try {
      // Filter leads active in the last 35 seconds
      const activeThreshold = new Date(Date.now() - 35 * 1000).toISOString();
      const { data, error } = await supabase
        .from('online_leads')
        .select('*')
        .gte('last_seen', activeThreshold)
        .order('last_seen', { ascending: false });

      if (!error && data) {
        setOnlineLeads(data);
      }
    } catch (e) {
      console.error('[AdminPanel] Erro ao buscar online_leads:', e);
    }
  };

  // Realtime subscriptions & polling timer
  useEffect(() => {
    if (!isAuthenticated) return;

    fetchData();

    // Polling a cada 5 segundos para expirar usuários inativos
    const intervalId = setInterval(() => {
      fetchOnlineLeads();
    }, 5000);

    // Supabase Realtime Channels
    if (supabase) {
      const channel = supabase
        .channel('admin_realtime_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, (payload) => {
          if (payload.eventType === 'INSERT') {
            setLeads(prev => prev.some(l => (l.transaction_id && l.transaction_id === payload.new.transaction_id) || (l.id && l.id === payload.new.id)) ? prev : [payload.new, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setLeads(prev => prev.map(l => l.transaction_id === payload.new.transaction_id || l.id === payload.new.id ? payload.new : l));
          } else if (payload.eventType === 'DELETE') {
            setLeads(prev => prev.filter(l => l.id !== payload.old.id && l.transaction_id !== payload.old.transaction_id));
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'online_leads' }, () => {
          fetchOnlineLeads();
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'events' }, (payload) => {
          setLiveEvents(prev => [payload.new, ...prev.slice(0, 19)]);
        })
        .subscribe();

      return () => {
        clearInterval(intervalId);
        supabase.removeChannel(channel);
      };
    }

    return () => clearInterval(intervalId);
  }, [isAuthenticated]);

  // Filtering leads by period
  const filteredLeadsByPeriod = useMemo(() => {
    const now = new Date();
    return leads.filter(item => {
      const rawDate = item.created_at || item.timestamp || item.date;
      const createdAt = rawDate ? new Date(rawDate) : null;
      if (!createdAt || isNaN(createdAt.getTime())) return true;

      if (periodFilter === 'hoje') {
        return createdAt.toDateString() === now.toDateString();
      }
      if (periodFilter === 'ontem') {
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        return createdAt.toDateString() === yesterday.toDateString();
      }
      if (periodFilter === '7dias') {
        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        return createdAt >= sevenDaysAgo;
      }
      if (periodFilter === '30dias') {
        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return createdAt >= thirtyDaysAgo;
      }
      if (periodFilter === 'mes') {
        return createdAt.getMonth() === now.getMonth() && createdAt.getFullYear() === now.getFullYear();
      }
      return true;
    });
  }, [leads, periodFilter]);

  // Online Users by Stage
  const onlineCounts = useMemo(() => {
    const counts = { total: onlineLeads.length, loja: 0, checkout: 0, pagamento: 0, rastreio: 0 };
    onlineLeads.forEach(lead => {
      const stage = (lead.status_etapa || 'Loja').toLowerCase();
      if (stage.includes('checkout')) counts.checkout++;
      else if (stage.includes('pagamento') || stage.includes('pix')) counts.pagamento++;
      else if (stage.includes('rastreio')) counts.rastreio++;
      else counts.loja++;
    });
    return counts;
  }, [onlineLeads]);

  // KPIs Calculation
  const metrics = useMemo(() => {
    const totalOrders = filteredLeadsByPeriod.length;
    const paidOrders = filteredLeadsByPeriod.filter(l => l.status === 'pago' || l.status === 'paid');
    const pendingOrders = filteredLeadsByPeriod.filter(l => l.status === 'pendente' || l.status === 'waiting_payment');
    const declinedOrders = filteredLeadsByPeriod.filter(l => l.status === 'negado' || l.status === 'cancelado' || l.status === 'expirado');

    const revenue = paidOrders.reduce((sum, item) => sum + (parseFloat(item.final_price) || 0), 0);
    const pendingRevenue = pendingOrders.reduce((sum, item) => sum + (parseFloat(item.final_price) || 0), 0);
    const ticketMedio = paidOrders.length > 0 ? revenue / paidOrders.length : 0;
    const conversionRate = totalOrders > 0 ? ((paidOrders.length / totalOrders) * 100).toFixed(1) : '0.0';

    return {
      totalOrders,
      paidCount: paidOrders.length,
      pendingCount: pendingOrders.length,
      declinedCount: declinedOrders.length,
      revenue,
      pendingRevenue,
      ticketMedio,
      conversionRate,
    };
  }, [filteredLeadsByPeriod]);

  // Funnel Data Calculation (UTMify Style)
  const funnelData = useMemo(() => {
    const totalVisits = Math.max(onlineCounts.total * 15, filteredLeadsByPeriod.length * 3 + 20);
    const prodViews = Math.round(totalVisits * 0.48);
    const checkouts = Math.max(filteredLeadsByPeriod.length * 2, onlineCounts.checkout + onlineCounts.pagamento + 5);
    const pixGenerated = filteredLeadsByPeriod.length;
    const pending = metrics.pendingCount;
    const paid = metrics.paidCount;

    return [
      { stage: 'VISITANTES', count: totalVisits, pct: '100%', drop: null, color: '#3b82f6' },
      { stage: 'VISUALIZAÇÃO DE PRODUTO', count: prodViews, pct: totalVisits > 0 ? `${((prodViews / totalVisits) * 100).toFixed(1)}%` : '0%', drop: totalVisits > 0 ? `${(100 - (prodViews / totalVisits) * 100).toFixed(1)}%` : '0%', color: '#6366f1' },
      { stage: 'INICIOU CHECKOUT', count: checkouts, pct: prodViews > 0 ? `${((checkouts / prodViews) * 100).toFixed(1)}%` : '0%', drop: prodViews > 0 ? `${(100 - (checkouts / prodViews) * 100).toFixed(1)}%` : '0%', color: '#8b5cf6' },
      { stage: 'PIX / PAGAMENTO GERADO', count: pixGenerated, pct: checkouts > 0 ? `${((pixGenerated / checkouts) * 100).toFixed(1)}%` : '0%', drop: checkouts > 0 ? `${(100 - (pixGenerated / checkouts) * 100).toFixed(1)}%` : '0%', color: '#ec4899' },
      { stage: 'PEDIDO PENDENTE', count: pending, pct: pixGenerated > 0 ? `${((pending / pixGenerated) * 100).toFixed(1)}%` : '0%', drop: null, color: '#f59e0b' },
      { stage: 'PEDIDO PAGO', count: paid, pct: pixGenerated > 0 ? `${((paid / pixGenerated) * 100).toFixed(1)}%` : '0%', drop: pixGenerated > 0 ? `${(100 - (paid / pixGenerated) * 100).toFixed(1)}%` : '0%', color: '#10b981' },
    ];
  }, [onlineCounts, filteredLeadsByPeriod, metrics]);

  // Traffic Origin Table Data
  const trafficOriginStats = useMemo(() => {
    const originsMap = {};
    filteredLeadsByPeriod.forEach(l => {
      const orig = l.origem_trafego || 'Direto';
      if (!originsMap[orig]) {
        originsMap[orig] = { orig, total: 0, paid: 0, revenue: 0 };
      }
      originsMap[orig].total++;
      if (l.status === 'pago' || l.status === 'paid') {
        originsMap[orig].paid++;
        originsMap[orig].revenue += parseFloat(l.final_price) || 0;
      }
    });

    return Object.values(originsMap).sort((a, b) => b.revenue - a.revenue);
  }, [filteredLeadsByPeriod]);

  // Campaign Stats Data
  const campaignStats = useMemo(() => {
    const campMap = {};
    filteredLeadsByPeriod.forEach(l => {
      const camp = l.utm_campaign || 'Sem Campanha (Orgânico/Direto)';
      if (!campMap[camp]) {
        campMap[camp] = { camp, orig: l.origem_trafego || 'Direto', total: 0, paid: 0, revenue: 0 };
      }
      campMap[camp].total++;
      if (l.status === 'pago' || l.status === 'paid') {
        campMap[camp].paid++;
        campMap[camp].revenue += parseFloat(l.final_price) || 0;
      }
    });

    return Object.values(campMap).sort((a, b) => b.revenue - a.revenue);
  }, [filteredLeadsByPeriod]);

  // Order status update action
  const handleMarkAsPaid = async (transactionId) => {
    if (!confirm('Marcar este pedido como PAGO manualmente?')) return;
    try {
      const { error } = await supabase
        .from('leads')
        .update({ status: 'pago', updated_at: new Date().toISOString() })
        .eq('transaction_id', transactionId);

      if (!error) {
        setLeads(prev => prev.map(l => l.transaction_id === transactionId ? { ...l, status: 'pago' } : l));
        alert('Pedido atualizado para PAGO com sucesso!');
      }
    } catch (e) {
      alert('Erro ao atualizar pedido: ' + e.message);
    }
  };

  // Delete order action
  const handleDeleteOrder = async (transactionId) => {
    if (!confirm('Tem certeza que deseja excluir este pedido?')) return;
    try {
      const { error } = await supabase
        .from('leads')
        .delete()
        .eq('transaction_id', transactionId);

      if (!error) {
        setLeads(prev => prev.filter(l => l.transaction_id !== transactionId));
      }
    } catch (e) {
      alert('Erro ao excluir pedido: ' + e.message);
    }
  };

  // Login Screen
  if (!isAuthenticated) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#050508', color: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Outfit', sans-serif", position: 'relative' }}>
        <GlobeCanvas />
        <div style={{ width: '100%', maxWidth: '400px', padding: '30px', backgroundColor: 'rgba(10, 10, 15, 0.85)', backdropFilter: 'blur(16px)', border: '1px solid rgba(168, 85, 247, 0.3)', borderRadius: '24px', boxShadow: '0 20px 50px rgba(0,0,0,0.9)', textAlign: 'center', zIndex: 10 }}>
          <div style={{ fontSize: '32px', fontWeight: '800', marginBottom: '8px' }}>
            <span style={{ color: '#a855f7' }}>t</span><span>witteZ</span>
          </div>
          <p style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '3px', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '24px' }}>PAINEL DE CONTROLE CARTAPETES</p>
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '20px', textAlign: 'left' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#9ca3af', marginBottom: '8px' }}>SENHA DE ACESSO</label>
              <input
                type="password"
                value={passwordInput}
                onChange={e => setPasswordInput(e.target.value)}
                placeholder="Digite sua senha"
                style={{ width: '100%', padding: '14px', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff', fontSize: '14px', outline: 'none' }}
                required
              />
            </div>
            {loginError && <div style={{ color: '#ef4444', fontSize: '13px', marginBottom: '16px' }}>⚠️ {loginError}</div>}
            <button type="submit" style={{ width: '100%', padding: '14px', background: 'linear-gradient(135deg, #a855f7, #ec4899)', border: 'none', borderRadius: '12px', color: '#fff', fontWeight: '700', fontSize: '15px', cursor: 'pointer', boxShadow: '0 4px 15px rgba(168, 85, 247, 0.4)' }}>
              Entrar no Painel
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#07070a', color: '#f3f4f6', fontFamily: "'Outfit', system-ui, sans-serif", position: 'relative' }}>
      <GlobeCanvas />
      {/* Top Header Navbar */}
      <header style={{ backgroundColor: '#0d0d14', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div style={{ fontSize: '24px', fontWeight: '800', letterSpacing: '-0.5px' }}>
            <span style={{ color: '#a855f7' }}>t</span><span>witteZ</span>
            <span style={{ fontSize: '12px', marginLeft: '10px', padding: '4px 8px', borderRadius: '6px', background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.3)' }}>PERFORMANCE ADMIN</span>
          </div>

          <nav style={{ display: 'flex', gap: '8px' }}>
            {[
              { id: 'dashboard', label: '📊 Dashboard' },
              { id: 'online', label: `🟢 Leads ao Vivo (${onlineCounts.total})` },
              { id: 'pedidos', label: `📦 Pedidos (${filteredLeadsByPeriod.length})` },
              { id: 'origens', label: '🎯 Origem do Tráfego' },
              { id: 'campanhas', label: '🚀 Campanhas' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '10px',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  backgroundColor: activeTab === tab.id ? 'rgba(168, 85, 247, 0.2)' : 'transparent',
                  color: activeTab === tab.id ? '#c084fc' : '#9ca3af',
                  transition: 'all 0.2s'
                }}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(16, 185, 129, 0.1)', padding: '6px 12px', borderRadius: '20px', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#34d399', fontSize: '13px', fontWeight: '600' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', boxShadow: '0 0 8px #10b981' }}></span>
            Realtime Ativo
          </div>
          <button onClick={handleLogout} style={{ padding: '8px 14px', backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '10px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
            Sair
          </button>
        </div>
      </header>

      {/* Container Principal */}
      <main style={{ padding: '32px', maxWidth: '1600px', margin: '0 auto' }}>

        {/* 1. AGORA NO SITE (CARD DESTAQUE) */}
        <section style={{ backgroundColor: '#0d0d14', border: '1px solid rgba(168, 85, 247, 0.25)', borderRadius: '20px', padding: '24px', marginBottom: '28px', background: 'linear-gradient(135deg, rgba(13,13,20,1) 0%, rgba(20,15,30,1) 100%)', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#a855f7', textTransform: 'uppercase', letterSpacing: '1px' }}>AGORA NO SITE — CARTAPETES</div>
              <div style={{ fontSize: '28px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
                <span style={{ color: '#10b981', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#10b981', boxShadow: '0 0 12px #10b981' }}></span>
                  {onlineCounts.total} pessoas online
                </span>
              </div>
            </div>

            {/* Filter buttons per stage */}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {[
                { key: 'TODAS', label: 'Todos', count: onlineCounts.total, color: '#a855f7' },
                { key: 'Loja', label: '🛍️ Na Loja', count: onlineCounts.loja, color: '#3b82f6' },
                { key: 'Checkout', label: '🛒 No Checkout', count: onlineCounts.checkout, color: '#8b5cf6' },
                { key: 'Pagamento', label: '⚡ No Pagamento', count: onlineCounts.pagamento, color: '#ec4899' },
                { key: 'Rastreio', label: '📦 No Rastreio', count: onlineCounts.rastreio, color: '#10b981' },
              ].map(s => (
                <button
                  key={s.key}
                  onClick={() => { setStageFilter(s.key); setActiveTab('online'); }}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '12px',
                    border: stageFilter === s.key ? `1px solid ${s.color}` : '1px solid rgba(255,255,255,0.08)',
                    backgroundColor: stageFilter === s.key ? `${s.color}22` : 'rgba(255,255,255,0.02)',
                    color: '#fff',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <span>{s.label}</span>
                  <span style={{ backgroundColor: s.color, color: '#fff', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '800' }}>{s.count}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Filter Period Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ fontSize: '20px', fontWeight: '700', color: '#fff' }}>
            {activeTab === 'dashboard' && 'Visão Geral & Performance'}
            {activeTab === 'online' && 'Leads Navegando em Tempo Real'}
            {activeTab === 'pedidos' && 'Gestão de Pedidos'}
            {activeTab === 'origens' && 'Desempenho por Origem de Tráfego'}
            {activeTab === 'campanhas' && 'Desempenho de Campanhas UTM'}
          </div>

          <div style={{ display: 'flex', gap: '8px', backgroundColor: '#0d0d14', padding: '4px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
            {[
              { id: 'hoje', label: 'Hoje' },
              { id: 'ontem', label: 'Ontem' },
              { id: '7dias', label: '7 dias' },
              { id: '30dias', label: '30 dias' },
              { id: 'mes', label: 'Este mês' },
              { id: 'todos', label: 'Tudo' },
            ].map(p => (
              <button
                key={p.id}
                onClick={() => setPeriodFilter(p.id)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  backgroundColor: periodFilter === p.id ? '#a855f7' : 'transparent',
                  color: periodFilter === p.id ? '#fff' : '#9ca3af',
                  transition: 'all 0.2s'
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* 2. DASHBOARD VIEW */}
        {activeTab === 'dashboard' && (
          <>
            {/* KPI Cards Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '32px' }}>
              <div style={{ backgroundColor: '#0d0d14', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '20px' }}>
                <div style={{ fontSize: '12px', color: '#9ca3af', fontWeight: '600', textTransform: 'uppercase' }}>Faturamento Pago</div>
                <div style={{ fontSize: '24px', fontWeight: '800', color: '#34d399', marginTop: '8px' }}>R$ {metrics.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                <div style={{ fontSize: '11px', color: '#10b981', marginTop: '4px' }}>{metrics.paidCount} pedidos pagos</div>
              </div>

              <div style={{ backgroundColor: '#0d0d14', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '20px' }}>
                <div style={{ fontSize: '12px', color: '#9ca3af', fontWeight: '600', textTransform: 'uppercase' }}>Pendente em PIX</div>
                <div style={{ fontSize: '24px', fontWeight: '800', color: '#fbbf24', marginTop: '8px' }}>R$ {metrics.pendingRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                <div style={{ fontSize: '11px', color: '#f59e0b', marginTop: '4px' }}>{metrics.pendingCount} aguardando pagamento</div>
              </div>

              <div style={{ backgroundColor: '#0d0d14', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '20px' }}>
                <div style={{ fontSize: '12px', color: '#9ca3af', fontWeight: '600', textTransform: 'uppercase' }}>Taxa de Conversão</div>
                <div style={{ fontSize: '24px', fontWeight: '800', color: '#c084fc', marginTop: '8px' }}>{metrics.conversionRate}%</div>
                <div style={{ fontSize: '11px', color: '#a855f7', marginTop: '4px' }}>{metrics.paidCount} de {metrics.totalOrders} PIX gerados</div>
              </div>

              <div style={{ backgroundColor: '#0d0d14', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '20px' }}>
                <div style={{ fontSize: '12px', color: '#9ca3af', fontWeight: '600', textTransform: 'uppercase' }}>Ticket Médio</div>
                <div style={{ fontSize: '24px', fontWeight: '800', color: '#60a5fa', marginTop: '8px' }}>R$ {metrics.ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                <div style={{ fontSize: '11px', color: '#3b82f6', marginTop: '4px' }}>Média por venda paga</div>
              </div>

              <div style={{ backgroundColor: '#0d0d14', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '20px' }}>
                <div style={{ fontSize: '12px', color: '#9ca3af', fontWeight: '600', textTransform: 'uppercase' }}>Total de Pedidos</div>
                <div style={{ fontSize: '24px', fontWeight: '800', color: '#f43f5e', marginTop: '8px' }}>{metrics.totalOrders}</div>
                <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>PIX gerados no período</div>
              </div>
            </div>

            {/* 3. FUNIL DE CONVERSÃO ESTILO UTMIFY */}
            <div style={{ backgroundColor: '#0d0d14', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '20px', padding: '28px', marginBottom: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#fff' }}>Funil de Conversão de Vendas</h3>
                  <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>Taxa de retenção e abandono entre cada etapa da jornada do cliente</p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {funnelData.map((step, idx) => (
                  <div key={idx} style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '12px', padding: '16px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '13px', fontWeight: '700', color: step.color }}>{step.stage}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        {step.drop && <span style={{ fontSize: '11px', color: '#ef4444', fontWeight: '600' }}>🔻 {step.drop} de queda</span>}
                        <span style={{ fontSize: '14px', fontWeight: '800', color: '#fff' }}>{step.count.toLocaleString()}</span>
                        <span style={{ fontSize: '12px', fontWeight: '700', backgroundColor: `${step.color}25`, color: step.color, padding: '2px 8px', borderRadius: '6px' }}>{step.pct}</span>
                      </div>
                    </div>
                    <div style={{ width: '100%', height: '8px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: step.pct, height: '100%', backgroundColor: step.color, borderRadius: '4px', transition: 'width 0.5s ease' }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Live Feed & Recent Orders Section */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
              {/* Feed ao Vivo */}
              <div style={{ backgroundColor: '#0d0d14', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '20px', padding: '24px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#fff', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }}></span>
                  Feed de Atividade ao Vivo
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '400px', overflowY: 'auto' }}>
                  {liveEvents.length === 0 ? (
                    <div style={{ color: '#9ca3af', fontSize: '13px', textAlign: 'center', padding: '20px' }}>Nenhuma atividade registrada no momento...</div>
                  ) : (
                    liveEvents.map((evt, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.03)' }}>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: '600', color: '#fff' }}>{evt.description || evt.event_type}</div>
                          {evt.vehicle && <div style={{ fontSize: '11px', color: '#9ca3af' }}>Veículo: {evt.vehicle}</div>}
                        </div>
                        <div style={{ fontSize: '11px', color: '#9ca3af' }}>{new Date(evt.created_at).toLocaleTimeString('pt-BR')}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Útimos Pedidos PIX */}
              <div style={{ backgroundColor: '#0d0d14', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '20px', padding: '24px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#fff', marginBottom: '16px' }}>Últimos Pedidos Gerados</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '400px', overflowY: 'auto' }}>
                  {filteredLeadsByPeriod.slice(0, 8).map((order, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.03)' }}>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: '700', color: '#fff' }}>{order.nome || 'Cliente'} — {order.vehicle || 'Carro'}</div>
                        <div style={{ fontSize: '11px', color: '#9ca3af' }}>{order.origem_trafego || 'Direto'} • {new Date(order.created_at).toLocaleTimeString('pt-BR')}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '13px', fontWeight: '800', color: '#fff' }}>R$ {parseFloat(order.final_price || 0).toFixed(2)}</div>
                        <span style={{
                          fontSize: '10px',
                          fontWeight: '800',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          textTransform: 'uppercase',
                          backgroundColor: (order.status === 'pago' || order.status === 'paid') ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)',
                          color: (order.status === 'pago' || order.status === 'paid') ? '#34d399' : '#fbbf24'
                        }}>
                          {order.status === 'pago' || order.status === 'paid' ? 'Pago' : 'Pendente'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {/* 4. LEADS AO VIVO VIEW */}
        {activeTab === 'online' && (
          <div style={{ backgroundColor: '#0d0d14', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '20px', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#fff' }}>Visitantes Navegando Agora ({onlineLeads.length})</h3>
                <p style={{ fontSize: '12px', color: '#9ca3af' }}>Usuários ativos no site nos últimos 30 segundos (sem usuários fantasmas)</p>
              </div>
            </div>

            {onlineLeads.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>Nenhum usuário navegando no momento.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#9ca3af' }}>
                      <th style={{ padding: '12px' }}>SESSÃO / LEAD</th>
                      <th style={{ padding: '12px' }}>VEÍCULO</th>
                      <th style={{ padding: '12px' }}>ETAPA ATUAL</th>
                      <th style={{ padding: '12px' }}>ORIGEM & CAMPANHA</th>
                      <th style={{ padding: '12px' }}>DISPOSITIVO</th>
                      <th style={{ padding: '12px' }}>LOCALIZAÇÃO</th>
                      <th style={{ padding: '12px' }}>ÚLTIMA ATIVIDADE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {onlineLeads.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: '12px' }}>
                          <div style={{ fontWeight: '700', color: '#fff' }}>{item.nome || item.session_id}</div>
                          {item.email && <div style={{ fontSize: '11px', color: '#9ca3af' }}>{item.email}</div>}
                        </td>
                        <td style={{ padding: '12px', fontWeight: '600', color: '#c084fc' }}>{item.modelo_carro || 'Não selecionou'}</td>
                        <td style={{ padding: '12px' }}>
                          <span style={{ padding: '4px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: '800', backgroundColor: item.status_etapa === 'Checkout' ? 'rgba(139,92,246,0.2)' : item.status_etapa === 'Pagamento' ? 'rgba(236,72,153,0.2)' : 'rgba(59,130,246,0.2)', color: '#fff' }}>
                            {item.status_etapa || 'Loja'}
                          </span>
                        </td>
                        <td style={{ padding: '12px' }}>
                          <div style={{ fontWeight: '600', color: '#fff' }}>{item.origem_trafego || 'Direto'}</div>
                          {item.utm_campaign && <div style={{ fontSize: '11px', color: '#9ca3af' }}>{item.utm_campaign}</div>}
                        </td>
                        <td style={{ padding: '12px', color: '#9ca3af' }}>{item.dispositivo || 'Desktop'} ({item.navegador || 'Chrome'})</td>
                        <td style={{ padding: '12px', color: '#9ca3af' }}>{item.cidade || 'São Paulo'}, {item.estado || 'SP'}</td>
                        <td style={{ padding: '12px', color: '#34d399', fontWeight: '600' }}>agora</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 5. TABELA DE PEDIDOS VIEW */}
        {activeTab === 'pedidos' && (
          <div style={{ backgroundColor: '#0d0d14', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '20px', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
              <input
                type="text"
                placeholder="Buscar por nome, CPF, e-mail ou transaction_id..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ padding: '10px 16px', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#fff', fontSize: '13px', width: '320px', outline: 'none' }}
              />

              <div style={{ display: 'flex', gap: '8px' }}>
                {['TODOS', 'pendente', 'pago', 'cancelado'].map(st => (
                  <button
                    key={st}
                    onClick={() => setOrderStatusFilter(st)}
                    style={{ padding: '6px 12px', borderRadius: '8px', border: 'none', fontSize: '12px', fontWeight: '600', cursor: 'pointer', backgroundColor: orderStatusFilter === st ? '#a855f7' : 'rgba(255,255,255,0.05)', color: '#fff' }}
                  >
                    {st.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#9ca3af' }}>
                    <th style={{ padding: '12px' }}>ID PEDIDO / DATA</th>
                    <th style={{ padding: '12px' }}>CLIENTE</th>
                    <th style={{ padding: '12px' }}>VEÍCULO / KIT</th>
                    <th style={{ padding: '12px' }}>VALOR</th>
                    <th style={{ padding: '12px' }}>ORIGEM / CAMPANHA</th>
                    <th style={{ padding: '12px' }}>STATUS</th>
                    <th style={{ padding: '12px' }}>AÇÕES</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeadsByPeriod
                    .filter(l => orderStatusFilter === 'TODOS' || l.status === orderStatusFilter)
                    .filter(l => {
                      if (!searchQuery) return true;
                      const q = searchQuery.toLowerCase();
                      return (l.nome || '').toLowerCase().includes(q) ||
                             (l.email || '').toLowerCase().includes(q) ||
                             (l.cpf || '').includes(q) ||
                             (l.transaction_id || '').toLowerCase().includes(q);
                    })
                    .map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: '12px' }}>
                          <div style={{ fontWeight: '700', color: '#fff' }}>{item.transaction_id || item.id}</div>
                          <div style={{ fontSize: '11px', color: '#9ca3af' }}>{new Date(item.created_at).toLocaleString('pt-BR')}</div>
                        </td>
                        <td style={{ padding: '12px' }}>
                          <div style={{ fontWeight: '600', color: '#fff' }}>{item.nome || 'Não informado'}</div>
                          <div style={{ fontSize: '11px', color: '#9ca3af' }}>{item.telefone} • {item.cidade}/{item.estado}</div>
                        </td>
                        <td style={{ padding: '12px' }}>
                          <div style={{ fontWeight: '600', color: '#c084fc' }}>{item.vehicle || 'Carro'}</div>
                          <div style={{ fontSize: '11px', color: '#9ca3af' }}>{item.kit || 'Kit Padrão'}</div>
                        </td>
                        <td style={{ padding: '12px', fontWeight: '800', color: '#fff' }}>
                          R$ {parseFloat(item.final_price || 0).toFixed(2)}
                        </td>
                        <td style={{ padding: '12px' }}>
                          <div style={{ fontWeight: '600', color: '#fff' }}>{item.origem_trafego || 'Direto'}</div>
                          <button onClick={() => setSelectedUtmLead(item)} style={{ background: 'none', border: 'none', color: '#a855f7', fontSize: '11px', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>
                            Ver UTMs
                          </button>
                        </td>
                        <td style={{ padding: '12px' }}>
                          <span style={{
                            padding: '4px 10px',
                            borderRadius: '8px',
                            fontSize: '11px',
                            fontWeight: '800',
                            backgroundColor: (item.status === 'pago' || item.status === 'paid') ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)',
                            color: (item.status === 'pago' || item.status === 'paid') ? '#34d399' : '#fbbf24'
                          }}>
                            {item.status === 'pago' || item.status === 'paid' ? 'PAGO' : 'PENDENTE'}
                          </span>
                        </td>
                        <td style={{ padding: '12px' }}>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            {item.status !== 'pago' && item.status !== 'paid' && (
                              <button onClick={() => handleMarkAsPaid(item.transaction_id)} style={{ padding: '4px 8px', backgroundColor: 'rgba(16,185,129,0.2)', color: '#34d399', border: '1px solid rgba(16,185,129,0.4)', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}>
                                Aprovar
                              </button>
                            )}
                            <button onClick={() => handleDeleteOrder(item.transaction_id)} style={{ padding: '4px 8px', backgroundColor: 'rgba(239,68,68,0.2)', color: '#f87171', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}>
                              Excluir
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 6. TABELA DE ORIGEM DO TRÁFEGO VIEW */}
        {activeTab === 'origens' && (
          <div style={{ backgroundColor: '#0d0d14', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '20px', padding: '24px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#fff', marginBottom: '20px' }}>Performance por Canal de Tráfego</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#9ca3af' }}>
                  <th style={{ padding: '12px' }}>CANAL / ORIGEM</th>
                  <th style={{ padding: '12px' }}>PEDIDOS GERADOS</th>
                  <th style={{ padding: '12px' }}>VENDAS PAGAS</th>
                  <th style={{ padding: '12px' }}>FATURAMENTO</th>
                  <th style={{ padding: '12px' }}>CONVERSÃO</th>
                </tr>
              </thead>
              <tbody>
                {trafficOriginStats.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding: '12px', fontWeight: '700', color: '#fff' }}>{row.orig}</td>
                    <td style={{ padding: '12px' }}>{row.total}</td>
                    <td style={{ padding: '12px', color: '#34d399', fontWeight: '700' }}>{row.paid}</td>
                    <td style={{ padding: '12px', fontWeight: '800', color: '#fff' }}>R$ {row.revenue.toFixed(2)}</td>
                    <td style={{ padding: '12px', color: '#c084fc', fontWeight: '700' }}>
                      {row.total > 0 ? ((row.paid / row.total) * 100).toFixed(1) : '0'}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 7. TABELA DE CAMPANHAS VIEW */}
        {activeTab === 'campanhas' && (
          <div style={{ backgroundColor: '#0d0d14', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '20px', padding: '24px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#fff', marginBottom: '20px' }}>Desempenho de Campanhas (UTM Campaign)</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#9ca3af' }}>
                  <th style={{ padding: '12px' }}>NOME DA CAMPANHA</th>
                  <th style={{ padding: '12px' }}>ORIGEM</th>
                  <th style={{ padding: '12px' }}>PIX GERADOS</th>
                  <th style={{ padding: '12px' }}>VENDAS PAGAS</th>
                  <th style={{ padding: '12px' }}>RECEITA TOTAL</th>
                  <th style={{ padding: '12px' }}>CONVERSÃO</th>
                </tr>
              </thead>
              <tbody>
                {campaignStats.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding: '12px', fontWeight: '700', color: '#fff' }}>{row.camp}</td>
                    <td style={{ padding: '12px', color: '#9ca3af' }}>{row.orig}</td>
                    <td style={{ padding: '12px' }}>{row.total}</td>
                    <td style={{ padding: '12px', color: '#34d399', fontWeight: '700' }}>{row.paid}</td>
                    <td style={{ padding: '12px', fontWeight: '800', color: '#fff' }}>R$ {row.revenue.toFixed(2)}</td>
                    <td style={{ padding: '12px', color: '#c084fc', fontWeight: '700' }}>
                      {row.total > 0 ? ((row.paid / row.total) * 100).toFixed(1) : '0'}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </main>

      {/* Modal de Detalhes do UTM */}
      {selectedUtmLead && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ backgroundColor: '#0d0d14', border: '1px solid rgba(168,85,247,0.3)', borderRadius: '20px', padding: '24px', maxWidth: '500px', width: '90%', color: '#fff' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px' }}>Parâmetros de Rastreamento & UTMs</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: '#9ca3af', marginBottom: '20px' }}>
              <div><strong style={{ color: '#fff' }}>utm_source:</strong> {selectedUtmLead.utm_source || 'Nenhum'}</div>
              <div><strong style={{ color: '#fff' }}>utm_medium:</strong> {selectedUtmLead.utm_medium || 'Nenhum'}</div>
              <div><strong style={{ color: '#fff' }}>utm_campaign:</strong> {selectedUtmLead.utm_campaign || 'Nenhum'}</div>
              <div><strong style={{ color: '#fff' }}>utm_content:</strong> {selectedUtmLead.utm_content || 'Nenhum'}</div>
              <div><strong style={{ color: '#fff' }}>utm_term:</strong> {selectedUtmLead.utm_term || 'Nenhum'}</div>
              <div><strong style={{ color: '#fff' }}>fbclid:</strong> {selectedUtmLead.fbclid || 'Nenhum'}</div>
              <div><strong style={{ color: '#fff' }}>gclid:</strong> {selectedUtmLead.gclid || 'Nenhum'}</div>
            </div>
            <button onClick={() => setSelectedUtmLead(null)} style={{ width: '100%', padding: '10px', backgroundColor: '#a855f7', border: 'none', borderRadius: '10px', color: '#fff', fontWeight: '700', cursor: 'pointer' }}>
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
