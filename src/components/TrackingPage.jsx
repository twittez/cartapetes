import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';

function addBusinessDays(startDate, days) {
  let d = new Date(startDate);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return d;
}

function fmtDate(d) {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}
function fmtShort(d) {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function fmtDateTime(d) {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
function titleCase(str) {
  return (str || '').toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export default function TrackingPage() {
  const [inputCode, setInputCode] = useState('');
  const [orderData, setOrderData] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [searched, setSearched] = useState(false);
  const [copiedPix, setCopiedPix] = useState(false);

  const handleCopyPix = (code) => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopiedPix(true);
    setTimeout(() => setCopiedPix(false), 3000);
  };

  // Auto-fill from URL param or sessionStorage on load
  useEffect(() => {
    window.scrollTo(0, 0);
    const url = new URLSearchParams(window.location.search);
    const codeFromUrl = url.get('codigo') || url.get('code') || url.get('tracking');
    if (codeFromUrl) {
      setInputCode(codeFromUrl.toUpperCase());
      doSearch(codeFromUrl.toUpperCase());
      return;
    }
    try {
      const last = JSON.parse(sessionStorage.getItem('lastOrder') || 'null') ||
                   JSON.parse(sessionStorage.getItem('cartapetes_purchase_data') || 'null');
      if (last && (last.trackingCode || last.orderId)) {
        const code = last.trackingCode || '';
        if (code) {
          setInputCode(code);
          doSearch(code);
        }
      }
    } catch (e) {}
  }, []);

  async function doSearch(rawCode) {
    const code = (rawCode || inputCode).trim().toUpperCase();
    if (!code) return;
    setSearched(true);
    setOrderData(null);
    setNotFound(false);

    // 1. localStorage cpOrders
    let found = null;
    try {
      const all = JSON.parse(localStorage.getItem('cpOrders') || '{}');
      found = all[code] || null;
    } catch (e) {}

    // 2. sessionStorage lastOrder
    if (!found) {
      try {
        const last = JSON.parse(sessionStorage.getItem('lastOrder') || 'null');
        if (last && (last.trackingCode === code || last.orderId === code)) found = last;
      } catch (e) {}
    }

    // 3. Query Supabase Database if available
    if (supabase) {
      try {
        const { data } = await supabase
          .from('leads')
          .select('*')
          .or(`tracking_code.eq.${code},transaction_id.eq.${code}`)
          .maybeSingle();

        if (data) {
          found = {
            trackingCode: code,
            orderId: data.transaction_id || code,
            name: data.nome || 'Cliente',
            email: data.email || '',
            total: data.final_price || 131.00,
            createdAt: data.created_at || new Date().toISOString(),
            status: data.status === 'pago' ? 'em_producao' : 'aguardando_pagamento',
          };
        }
      } catch (sbErr) {
        console.warn('[Tracking] Supabase lookup:', sbErr);
      }
    }

    // 4. Fallback for CP prefix
    if (!found && (code.startsWith('CP') || code.length >= 6)) {
      found = {
        trackingCode: code,
        orderId: code,
        name: 'Cliente',
        email: '',
        total: 131.00,
        createdAt: new Date().toISOString(),
        status: 'aguardando_pagamento',
      };
    }

    if (found) {
      setOrderData(found);
    } else {
      setNotFound(true);
    }
  }

  const handleKeyDown = (e) => { if (e.key === 'Enter') doSearch(); };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans antialiased">
      
      {/* Black Top Header */}
      <header className="bg-black border-b border-slate-900 sticky top-0 z-50 shadow-md">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <a 
            href="/" 
            onClick={(e) => { e.preventDefault(); window.location.href = '/'; }} 
            className="flex items-center cursor-pointer"
          >
            <img 
              src="/logo-whats-cropped.png" 
              alt="CarTapetes Logo" 
              className="h-10 sm:h-12 w-auto object-contain hover:opacity-90 transition" 
            />
          </a>
          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-3 py-1.5 rounded-full shadow-inner">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span>Ambiente 100% Seguro</span>
          </div>
        </div>
      </header>

      {/* Main Container matching Checkout styling */}
      <div className="max-w-2xl mx-auto px-4 py-8 pb-20">

        {/* Title Header */}
        <div className="text-center space-y-1.5 mb-8">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Rastreio de Pedido
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto">
            Insira abaixo o seu código de rastreamento para acompanhar a produção e entrega.
          </p>
        </div>

        {/* Search Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mb-8">
          <label className="block text-[11px] font-bold text-slate-500 mb-2 uppercase tracking-wide">
            Código de Rastreio
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={inputCode}
              onChange={e => setInputCode(e.target.value.toUpperCase())}
              onKeyDown={handleKeyDown}
              placeholder="EX: CPKF178534..."
              maxLength={30}
              className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm font-bold tracking-widest text-slate-800 uppercase outline-none focus:border-[#3BAE8A] focus:ring-1 focus:ring-[#3BAE8A] transition placeholder:text-slate-400 font-mono"
            />
            <button
              onClick={() => doSearch()}
              className="bg-[#3BAE8A] hover:bg-[#2d8f70] text-white font-extrabold px-6 py-3 rounded-xl text-xs sm:text-sm uppercase tracking-wide transition cursor-pointer active:scale-95 flex items-center justify-center gap-2 shadow-sm"
            >
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
              </svg>
              <span>Rastrear</span>
            </button>
          </div>
        </div>

        {/* Not Found Screen */}
        {notFound && (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-3 shadow-xs">
            <div className="w-14 h-14 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center text-2xl mx-auto border border-amber-100">
              🔍
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Código não encontrado</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
                Verifique o código informado e tente novamente.<br />
                O código de rastreamento é gerado após a confirmação do pedido.
              </p>
            </div>
          </div>
        )}

        {/* Search Results */}
        {orderData && (() => {
          const createdAt = orderData.createdAt ? new Date(orderData.createdAt) : new Date();
          const deliveryDate = addBusinessDays(createdAt, 15);
          const step2Date = new Date(createdAt.getTime() + 2 * 3600 * 1000);

          return (
            <div className="space-y-6 animate-fadeIn">

              {/* PIX QR Code Box (If pending payment) */}
              {orderData.pixCode && (
                <div className="bg-emerald-50/70 border-2 border-emerald-400/80 rounded-2xl p-6 text-center space-y-4 shadow-sm">
                  <div className="inline-flex items-center gap-2 bg-emerald-100 text-emerald-800 border border-emerald-300 font-extrabold text-xs px-3.5 py-1.5 rounded-full uppercase tracking-wide">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    ⚡ Conclua seu Pagamento via PIX
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-emerald-200 max-w-[200px] mx-auto shadow-inner flex items-center justify-center">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(orderData.pixCode)}`}
                      alt="QR Code Pix"
                      className="w-40 h-40 rounded-lg"
                    />
                  </div>

                  <div className="space-y-1.5 max-w-sm mx-auto">
                    <label className="block text-[10px] text-emerald-800 uppercase font-bold">Código PIX Copia e Cola</label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        readOnly
                        value={orderData.pixCode}
                        className="flex-1 bg-white border border-emerald-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 font-mono outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleCopyPix(orderData.pixCode)}
                        className="bg-[#3BAE8A] hover:bg-[#2d8f70] text-white font-bold px-3.5 py-1.5 rounded-lg text-xs transition cursor-pointer shadow-xs"
                      >
                        {copiedPix ? '✓ Copiado!' : 'Copiar'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Order Info Card */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wide">Código do Pedido</p>
                    <p className="text-sm font-extrabold text-slate-800 mt-0.5">{orderData.orderId || orderData.trackingCode}</p>
                  </div>

                  {orderData.status === 'aguardando_pagamento' || orderData.status === 'pendente' ? (
                    <div className="flex items-center gap-1.5 bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold px-3 py-1 rounded-full">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                      Aguardando Pagamento
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold px-3 py-1 rounded-full">
                      <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                      Em Produção
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <p className="text-[10px] text-slate-400 uppercase font-bold mb-0.5">Cliente</p>
                    <p className="font-extrabold text-slate-800 truncate">{titleCase(orderData.name || 'Cliente')}</p>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <p className="text-[10px] text-slate-400 uppercase font-bold mb-0.5">Data do Pedido</p>
                    <p className="font-extrabold text-slate-800">{fmtShort(createdAt)}</p>
                  </div>
                  {orderData.total && (
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <p className="text-[10px] text-slate-400 uppercase font-bold mb-0.5">Valor Total</p>
                      <p className="font-extrabold text-emerald-600">
                        R$ {parseFloat(orderData.total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  )}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <p className="text-[10px] text-slate-400 uppercase font-bold mb-0.5">Previsão de Entrega</p>
                    <p className="font-extrabold text-slate-800">{fmtShort(deliveryDate)}</p>
                  </div>
                </div>
              </div>

              {/* Delivery Date Banner */}
              <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-5 text-white shadow-md flex items-center gap-4 border border-slate-700">
                <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center text-2xl border border-white/10 flex-shrink-0">
                  🚚
                </div>
                <div>
                  <p className="text-[11px] font-bold text-slate-300 uppercase tracking-wide">Previsão Estimada de Entrega</p>
                  <p className="text-lg font-extrabold text-white mt-0.5">{fmtDate(deliveryDate)}</p>
                  <p className="text-xs text-slate-400 mt-0.5">Estimativa total de 15 dias úteis (fabricação + envio).</p>
                </div>
              </div>

              {/* Timeline */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                    <span>📦</span> Status do Pedido
                  </h3>
                  <span className="text-xs text-slate-400 font-semibold">Prazo: 15 dias úteis</span>
                </div>

                <div className="relative pl-7 space-y-5">
                  {/* Vertical Line */}
                  <div className="absolute left-[13px] top-2 bottom-2 w-0.5 bg-slate-100" />

                  {orderData.status === 'aguardando_pagamento' || orderData.status === 'pendente' ? [
                    {
                      active: true, icon: '⚡',
                      title: 'Pedido Gerado · Aguardando Pagamento PIX',
                      desc: 'Aguardando a confirmação do pagamento via PIX para enviar para a fila de corte e produção.',
                      date: fmtDateTime(createdAt)
                    },
                    { pending: true, icon: '✓', title: 'Pagamento Aprovado', desc: 'Aguardando confirmação bancária.' },
                    { pending: true, icon: '⚙', title: 'Em Produção (Corte & Acabamento)', desc: 'Será cortado no molde exato do seu veículo assim que aprovado.' },
                    { pending: true, icon: '📦', title: 'Enviado para Transportadora', desc: 'Controle de qualidade realizado e entregue à transportadora.' },
                    { pending: true, icon: '🚀', title: 'Saiu para Entrega', desc: 'Objeto em trânsito para o seu endereço cadastrado.' },
                    { pending: true, icon: '🏠', title: 'Entregue', desc: 'Produto entregue com sucesso!' }
                  ] : [
                    {
                      done: true, icon: '✓',
                      title: 'Pedido Confirmado',
                      desc: 'Pedido registrado no sistema e enviado para a fila de produção.',
                      date: fmtDateTime(createdAt)
                    },
                    {
                      done: true, icon: '✓',
                      title: 'Pagamento Aprovado',
                      desc: 'Confirmação do pagamento recebida com sucesso.',
                      date: fmtDateTime(step2Date)
                    },
                    {
                      active: true, icon: '⚙',
                      title: 'Em Produção (Corte & Acabamento)',
                      desc: 'O tapete está sendo cortado no molde exato do seu veículo. Esta etapa leva de 3 a 5 dias úteis.',
                      date: 'Etapa Atual · Em andamento'
                    },
                    { pending: true, icon: '📦', title: 'Enviado para Transportadora', desc: 'Controle de qualidade realizado e entregue à transportadora.' },
                    { pending: true, icon: '🚀', title: 'Saiu para Entrega', desc: 'Objeto em trânsito para o seu endereço cadastrado.' },
                    { pending: true, icon: '🏠', title: 'Entregue', desc: 'Produto entregue com sucesso!' }
                  ]}.map((item, i) => (
                    <div key={i} className="relative">
                      {/* Circle Dot */}
                      <div className={`absolute -left-[29px] top-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold z-10 ${
                        item.done ? 'bg-emerald-500 text-white shadow-sm' :
                        item.active ? 'bg-blue-600 text-white ring-4 ring-blue-100 shadow-sm animate-pulse' :
                        'bg-slate-100 text-slate-400 border border-slate-200'
                      }`}>
                        {item.icon}
                      </div>

                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <p className={`text-xs font-bold ${item.pending ? 'text-slate-400' : item.active ? 'text-blue-600 font-extrabold' : 'text-slate-800'}`}>
                            {item.title}
                          </p>
                          {item.active && (
                            <span className="bg-blue-50 text-blue-700 text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                              Em andamento
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 leading-relaxed">{item.desc}</p>
                        {item.date && <p className="text-[10px] font-bold text-slate-400 pt-0.5">{item.date}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Product Card */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex items-center gap-4">
                <img
                  src="/produto-1.jpg"
                  alt="Tapete Bandeja Premium"
                  className="w-16 h-16 rounded-xl object-cover flex-shrink-0 bg-slate-50 border border-slate-100"
                  onError={e => { e.target.src = 'https://via.placeholder.com/64x64/F8FAFC/3BAE8A?text=🚗'; }}
                />
                <div className="space-y-0.5">
                  <p className="text-xs font-extrabold text-slate-800">Tapete Bandeja Premium 100% Sob Medida</p>
                  <p className="text-[11px] text-slate-500">Modelo exclusivo automotivo · Impermeável · Bordas elevadas</p>
                  <p className="text-[11px] font-bold text-emerald-600 pt-0.5">🎁 Brinde: Lixeira Premium para Carro</p>
                </div>
              </div>

              {/* Support Contact Box */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-center space-y-2.5">
                <p className="text-xs font-bold text-slate-800">Dúvidas sobre o seu rastreamento?</p>
                <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                  Nossa equipe de atendimento está disponível no WhatsApp para tirar qualquer dúvida.
                </p>
                <a
                  href="https://wa.me/5511911016413?text=Olá,%20gostaria%20de%20informações%20sobre%20o%20meu%20rastreio"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 bg-[#25D366] hover:bg-emerald-600 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition active:scale-95 shadow-sm"
                >
                  <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  <span>Atendimento WhatsApp</span>
                </a>
              </div>

            </div>
          );
        })()}

        {/* Footer info */}
        <footer className="mt-12 text-center text-xs text-slate-500 space-y-2 border-t border-slate-200 pt-6">
          <div className="font-extrabold text-slate-700">CarTapetes Ltda. · CNPJ: 59.291.162/0001-79</div>
          <div>Prazo estimado de entrega: até 15 dias úteis após a confirmação do pagamento.</div>
          <div className="text-slate-400 text-[10px] pt-1">© {new Date().getFullYear()} CarTapetes. Todos os direitos reservados.</div>
        </footer>

      </div>
    </div>
  );
}
