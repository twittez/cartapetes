import { useState, useEffect } from 'react';

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

  function doSearch(rawCode) {
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
        if (last && last.trackingCode === code) found = last;
      } catch (e) {}
    }

    // 3. Fallback: valid CP prefix
    if (!found && code.startsWith('CP') && code.length >= 10) {
      found = {
        trackingCode: code,
        orderId: code,
        name: 'Cliente',
        total: null,
        createdAt: new Date().toISOString(),
        status: 'em_producao'
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
    <div className="min-h-screen bg-[#f8fafc] font-sans">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-50">
        <div className="max-w-xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="text-lg font-extrabold text-gray-900">
            🚗 Car<span className="text-[#FF5A00]">Tapetes</span>
          </div>
          <div className="text-xs text-gray-400 flex items-center gap-1">🔒 Compra Segura</div>
        </div>
      </header>

      <div className="max-w-xl mx-auto px-4 py-8 pb-16">

        {/* Hero */}
        <div className="text-center mb-7">
          <h1 className="text-2xl font-extrabold text-gray-900">Rastreio de Pedido</h1>
          <p className="text-sm text-gray-400 mt-1">Insira seu código para acompanhar seu pedido</p>
        </div>

        {/* Search Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <label className="block text-xs font-bold text-gray-600 mb-2 uppercase tracking-wide">
            Código de Rastreio
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={inputCode}
              onChange={e => setInputCode(e.target.value.toUpperCase())}
              onKeyDown={handleKeyDown}
              placeholder="Ex: CPKF178534..."
              maxLength={30}
              className="flex-1 border-2 border-gray-200 rounded-xl px-4 py-3 text-sm font-bold tracking-widest uppercase text-gray-800 outline-none focus:border-[#FF5A00] transition"
            />
            <button
              onClick={() => doSearch()}
              className="bg-[#FF5A00] hover:bg-orange-600 text-white font-bold px-5 py-3 rounded-xl text-sm transition active:scale-95 flex items-center gap-2"
            >
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
              </svg>
              Rastrear
            </button>
          </div>
        </div>

        {/* Not Found */}
        {notFound && (
          <div className="text-center py-10">
            <div className="text-5xl mb-3">🔍</div>
            <h3 className="text-lg font-bold text-gray-800 mb-2">Código não encontrado</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              Verifique o código informado e tente novamente.<br />
              O código de rastreio é gerado após a confirmação do pedido.
            </p>
          </div>
        )}

        {/* Result */}
        {orderData && (() => {
          const createdAt = orderData.createdAt ? new Date(orderData.createdAt) : new Date();
          const deliveryDate = addBusinessDays(createdAt, 15);
          const step2Date = new Date(createdAt.getTime() + 2 * 3600 * 1000);

          return (
            <div className="space-y-4 animate-fadeIn">
              {/* PIX QR Code Box (If pending payment) */}
              {orderData.pixCode && (
                <div className="bg-emerald-50 border-2 border-emerald-400 rounded-2xl p-5 text-center space-y-4 shadow-sm">
                  <div className="flex items-center justify-center gap-2 text-emerald-800 font-extrabold text-sm">
                    <span>⚡ Conclua seu Pagamento via PIX</span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-emerald-200 max-w-[200px] mx-auto shadow-inner flex items-center justify-center">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(orderData.pixCode)}`}
                      alt="QR Code Pix"
                      className="w-40 h-40 rounded-lg"
                    />
                  </div>
                  <div className="space-y-1.5 max-w-sm mx-auto">
                    <label className="block text-[10px] text-emerald-700 uppercase font-bold">Código Copia e Cola</label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        readOnly
                        value={orderData.pixCode}
                        className="flex-1 bg-white border border-emerald-300 rounded-lg px-2.5 py-1.5 text-xs text-gray-700 font-mono outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleCopyPix(orderData.pixCode)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition cursor-pointer"
                      >
                        {copiedPix ? 'Copiado!' : 'Copiar'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Order Info Card */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wide">Pedido</p>
                    <p className="text-sm font-bold text-gray-800">{orderData.orderId || orderData.trackingCode}</p>
                  </div>
                  <div className="flex items-center gap-1.5 bg-blue-50 text-blue-700 text-xs font-bold px-3 py-1.5 rounded-full">
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse block" />
                    Em Produção
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wide mb-0.5">Cliente</p>
                    <p className="font-semibold text-gray-700">{titleCase(orderData.name || 'Cliente')}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wide mb-0.5">Data do Pedido</p>
                    <p className="font-semibold text-gray-700">{fmtShort(createdAt)}</p>
                  </div>
                  {orderData.total && (
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wide mb-0.5">Valor Total</p>
                      <p className="font-semibold text-gray-700">
                        R$ {parseFloat(orderData.total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wide mb-0.5">Previsão</p>
                    <p className="font-semibold text-gray-700">{fmtShort(deliveryDate)}</p>
                  </div>
                </div>
              </div>

              {/* Delivery Banner */}
              <div className="bg-gradient-to-r from-blue-500 to-blue-700 rounded-2xl p-5 text-white flex items-center gap-4">
                <span className="text-4xl">🚚</span>
                <div>
                  <p className="text-xs font-bold opacity-80 mb-0.5">ENTREGA ESTIMADA</p>
                  <p className="text-lg font-extrabold">{fmtDate(deliveryDate)}</p>
                  <p className="text-xs opacity-75 mt-0.5">Seu produto está sendo preparado</p>
                </div>
              </div>

              {/* Timeline */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <h3 className="font-bold text-gray-900 mb-5 text-sm">📦 Status do Pedido</h3>
                <div className="relative pl-8">
                  {/* Line */}
                  <div className="absolute left-[13px] top-0 bottom-0 w-0.5 bg-gray-100" />

                  {[
                    {
                      done: true, icon: '✓',
                      title: 'Pedido Confirmado',
                      desc: 'Recebemos seu pedido e o pagamento foi registrado.',
                      date: fmtDateTime(createdAt)
                    },
                    {
                      done: true, icon: '✓',
                      title: 'Pagamento Aprovado',
                      desc: 'Seu pagamento foi confirmado com sucesso.',
                      date: fmtDateTime(step2Date)
                    },
                    {
                      active: true, icon: '⚙',
                      title: 'Em Produção',
                      desc: 'Seu produto está sendo fabricado e preparado. Esta etapa leva de 3 a 5 dias úteis.',
                      date: 'Agora'
                    },
                    { pending: true, icon: '📦', title: 'Enviado para Transportadora', desc: 'Em breve seu produto será despachado.' },
                    { pending: true, icon: '🚀', title: 'Saiu para Entrega', desc: 'O produto está a caminho do seu endereço.' },
                    { pending: true, icon: '🏠', title: 'Entregue', desc: 'Produto entregue com sucesso!' }
                  ].map((item, i) => (
                    <div key={i} className="relative mb-5 last:mb-0">
                      {/* Dot */}
                      <div className={`absolute -left-8 top-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] z-10 ${
                        item.done ? 'bg-green-500 text-white' :
                        item.active ? 'bg-blue-500 text-white shadow-[0_0_0_4px_rgba(59,130,246,0.2)]' :
                        'bg-gray-100 text-gray-400'
                      }`}>
                        {item.icon}
                      </div>
                      <div>
                        <p className={`text-sm font-bold ${item.pending ? 'text-gray-400' : 'text-gray-800'}`}>
                          {item.title}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{item.desc}</p>
                        {item.date && <p className="text-[10px] text-gray-300 mt-1">{item.date}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Product Mini */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
                <img
                  src="/produto-1.jpg"
                  alt="Tapete Bandeja Premium"
                  className="w-16 h-16 rounded-xl object-cover flex-shrink-0 bg-gray-50"
                  onError={e => { e.target.src = 'https://via.placeholder.com/64x64/fff5f2/FF5A00?text=🚗'; }}
                />
                <div>
                  <p className="text-sm font-bold text-gray-800">Tapete Bandeja Premium – Sob Medida</p>
                  <p className="text-xs text-gray-400 mt-0.5">100% impermeável · Antiderrapante · Garantia inclusa</p>
                </div>
              </div>

            </div>
          );
        })()}

        {/* Footer */}
        <div className="mt-10 text-center text-[10px] text-gray-400 leading-relaxed">
          <strong className="text-gray-500">CNPJ: 59.291.162/0001-79</strong><br />
          Dúvidas? Entre em contato com nosso suporte.<br />
          Prazo de entrega: até 15 dias úteis após confirmação do pagamento.
        </div>
      </div>
    </div>
  );
}
