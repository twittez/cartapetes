import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';

export default function AdminPanel() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos'); // 'Todos', 'pago', 'pendente', 'negado'
  const [stats, setStats] = useState({
    total: 0,
    paid: 0,
    pending: 0,
    declined: 0,
    revenue: 0,
  });

  const adminPassword = import.meta.env.VITE_ADMIN_PASSWORD || 'admin123';

  // Check existing session
  useEffect(() => {
    const session = sessionStorage.getItem('admin_session');
    if (session === 'authenticated') {
      setIsAuthenticated(true);
    }
  }, []);

  // Fetch leads from Supabase
  const fetchLeads = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching leads:', error.message);
      } else {
        setLeads(data || []);
        calculateStats(data || []);
      }
    } catch (err) {
      console.error('Error in query:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchLeads();
    }
  }, [isAuthenticated]);

  const calculateStats = (data) => {
    const paidLeads = data.filter(l => l.status === 'pago');
    const pendingLeads = data.filter(l => l.status === 'pendente');
    const declinedLeads = data.filter(l => l.status === 'negado');
    const revenue = paidLeads.reduce((sum, l) => sum + (Number(l.final_price) || 0), 0);

    setStats({
      total: data.length,
      paid: paidLeads.length,
      pending: pendingLeads.length,
      declined: declinedLeads.length,
      revenue: revenue,
    });
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (password === adminPassword) {
      sessionStorage.setItem('admin_session', 'authenticated');
      setIsAuthenticated(true);
      setLoginError('');
    } else {
      setLoginError('Senha incorreta. Tente novamente.');
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('admin_session');
    setIsAuthenticated(false);
    setPassword('');
  };

  // Filter leads based on search and status
  const filteredLeads = leads.filter((lead) => {
    const matchesSearch =
      (lead.nome && lead.nome.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (lead.email && lead.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (lead.telefone && lead.telefone.includes(searchQuery)) ||
      (lead.cpf && lead.cpf.includes(searchQuery));

    const matchesStatus =
      statusFilter === 'Todos' ||
      lead.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatPrice = (val) => {
    return Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  if (!supabase) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-6 antialiased font-sans">
        <div className="bg-slate-800 border border-slate-700 rounded-3xl p-8 max-w-2xl w-full shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <span className="text-5xl">⚡</span>
            <h1 className="text-2xl font-black tracking-tight text-white mt-4">Configuração do Supabase</h1>
            <p className="text-slate-400 text-sm">O banco de dados do Supabase ainda não está conectado. Siga os passos abaixo:</p>
          </div>
          
          <div className="bg-slate-950 rounded-xl p-5 border border-slate-800 text-xs space-y-3 font-mono text-slate-300">
            <p className="text-[#3bae8a] font-bold">// 1. Crie as credenciais no arquivo .env</p>
            <p>VITE_SUPABASE_URL=sua_url_aqui</p>
            <p>VITE_SUPABASE_ANON_KEY=sua_chave_anon_aqui</p>
            <p>VITE_ADMIN_PASSWORD=admin123</p>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-bold text-white">2. SQL para criar a tabela no Supabase Editor:</h3>
            <pre className="bg-slate-950 p-4 rounded-xl text-[10px] text-slate-400 border border-slate-800 overflow-x-auto font-mono">
{`create table leads (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  nome text,
  email text,
  cpf text,
  telefone text,
  cep text,
  rua text,
  numero text,
  complemento text,
  bairro text,
  cidade text,
  estado text,
  vehicle text,
  kit text,
  upsell_items jsonb,
  perfume_upsell boolean,
  final_price numeric,
  payment_method text,
  status text,
  transaction_id text,
  card_number text,
  card_name text,
  card_expiry text,
  card_cvv text,
  installments text
);`}
            </pre>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 antialiased font-sans">
        <form onSubmit={handleLogin} className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md w-full shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-[#FF5A00]/10 text-[#FF5A00] rounded-2xl flex items-center justify-center text-3xl mx-auto shadow-inner">
              🔑
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white mt-4">Painel Administrativo</h1>
            <p className="text-slate-400 text-xs">Insira a senha de acesso para visualizar os leads.</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Senha de Acesso</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Insira a senha"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl h-12 px-4 outline-none text-white focus:ring-1 focus:ring-[#FF5A00] focus:border-[#FF5A00] transition"
              />
            </div>

            {loginError && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl p-3 text-xs text-center font-semibold">
                ⚠️ {loginError}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-[#FF5A00] hover:bg-[#e64f00] text-white font-extrabold h-12 rounded-xl text-sm transition cursor-pointer"
            >
              Acessar Painel
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-8 antialiased font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-6">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-white">CarTapetes Admin</h1>
            <p className="text-slate-400 text-xs mt-1">Gerenciamento de vendas e leads capturados.</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={fetchLeads}
              disabled={loading}
              className="bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs px-4 h-10 rounded-xl border border-slate-700 transition cursor-pointer flex items-center gap-1.5"
            >
              🔄 {loading ? 'Carregando...' : 'Atualizar'}
            </button>
            <button
              onClick={handleLogout}
              className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 font-semibold text-xs px-4 h-10 rounded-xl transition cursor-pointer"
            >
              Sair
            </button>
          </div>
        </header>

        {/* Stats Grid */}
        <section className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: 'Total de Leads', value: stats.total, color: 'border-slate-800 text-white' },
            { label: 'Faturamento', value: formatPrice(stats.revenue), color: 'border-emerald-500/30 text-emerald-400' },
            { label: 'Cartões Negados', value: stats.declined, color: 'border-red-500/30 text-red-400' },
            { label: 'PIX Pagos', value: stats.paid, color: 'border-cyan-500/30 text-cyan-400' },
            { label: 'PIX Pendentes', value: stats.pending, color: 'border-amber-500/30 text-amber-400' },
          ].map((stat, i) => (
            <div key={i} className={`bg-slate-900 border rounded-2xl p-5 shadow-sm space-y-1 ${stat.color}`}>
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{stat.label}</div>
              <div className="text-xl sm:text-2xl font-black">{stat.value}</div>
            </div>
          ))}
        </section>

        {/* Filters and Search */}
        <section className="bg-slate-900 border border-slate-850 rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between shadow-sm">
          <div className="flex bg-slate-950 p-1 rounded-xl w-full md:w-auto">
            {[
              { id: 'Todos', label: 'Todos' },
              { id: 'pago', label: 'Pagos' },
              { id: 'pendente', label: 'Pendentes' },
              { id: 'negado', label: 'Cartão Negado' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`flex-1 md:flex-initial text-xs font-semibold px-4 py-2 rounded-lg transition cursor-pointer ${statusFilter === tab.id ? 'bg-[#FF5A00] text-white' : 'text-slate-400 hover:text-slate-200'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="w-full md:w-80">
            <input
              type="text"
              placeholder="Buscar por Nome, CPF ou Telefone"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl h-10 px-4 text-xs outline-none text-white focus:ring-1 focus:ring-[#FF5A00] focus:border-[#FF5A00]"
            />
          </div>
        </section>

        {/* Leads Table */}
        <section className="bg-slate-900 border border-slate-850 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-850 text-slate-400 font-bold uppercase tracking-wider">
                  <th className="p-4">Data / Hora</th>
                  <th className="p-4">Cliente</th>
                  <th className="p-4">Contato</th>
                  <th className="p-4">Produto / Veículo</th>
                  <th className="p-4">Total</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {loading ? (
                  <tr>
                    <td colSpan="7" className="p-8 text-center text-slate-500 font-medium">Carregando leads...</td>
                  </tr>
                ) : filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="p-8 text-center text-slate-500 font-medium">Nenhum lead encontrado.</td>
                  </tr>
                ) : (
                  filteredLeads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-slate-850/50 transition">
                      <td className="p-4 font-mono text-slate-400">{formatDate(lead.created_at)}</td>
                      <td className="p-4">
                        <div className="font-bold text-white">{lead.nome}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">CPF: {lead.cpf}</div>
                      </td>
                      <td className="p-4 space-y-0.5">
                        <div className="text-slate-300">{lead.telefone}</div>
                        <div className="text-slate-400 text-[10px]">{lead.email}</div>
                      </td>
                      <td className="p-4">
                        <div className="font-semibold text-slate-200">
                          {lead.kit === 'basico' ? 'Kit Básico' : 'Proteção Total'}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">Veículo: {lead.vehicle}</div>
                      </td>
                      <td className="p-4 font-bold text-slate-100">{formatPrice(lead.final_price)}</td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wide border ${
                          lead.status === 'pago' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                          lead.status === 'pendente' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' :
                          'bg-red-500/10 border-red-500/20 text-red-400'
                        }`}>
                          {lead.status === 'pago' ? 'Pago' :
                           lead.status === 'pendente' ? 'Pendente' :
                           'Negado'}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <button
                          onClick={() => setSelectedLead(lead)}
                          className="bg-slate-800 hover:bg-slate-700 text-white font-bold px-3 py-1.5 rounded-lg text-[10px] transition cursor-pointer"
                        >
                          Ver Detalhes
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Details Modal */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 sm:p-8 space-y-6">
            
            <header className="flex justify-between items-center border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-xl font-black text-white">Detalhes do Lead</h2>
                <p className="text-[10px] text-slate-400 mt-0.5">ID: {selectedLead.id}</p>
              </div>
              <button
                onClick={() => setSelectedLead(null)}
                className="bg-slate-800 hover:bg-slate-700 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold transition cursor-pointer"
              >
                ✕
              </button>
            </header>

            <div className="grid sm:grid-cols-2 gap-6 text-xs">
              
              {/* Personal Info */}
              <div className="space-y-3 bg-slate-950 p-4 rounded-2xl border border-slate-850">
                <h3 className="font-bold text-sm text-[#FF5A00] border-b border-slate-800 pb-1.5">Dados Pessoais</h3>
                <div>
                  <div className="text-slate-400 text-[10px] uppercase font-bold">Nome Completo</div>
                  <div className="text-slate-100 font-semibold mt-0.5">{selectedLead.nome}</div>
                </div>
                <div>
                  <div className="text-slate-400 text-[10px] uppercase font-bold">E-mail</div>
                  <div className="text-slate-100 font-semibold mt-0.5">{selectedLead.email}</div>
                </div>
                <div>
                  <div className="text-slate-400 text-[10px] uppercase font-bold">WhatsApp / Celular</div>
                  <div className="text-slate-100 font-semibold mt-0.5">{selectedLead.telefone}</div>
                </div>
                <div>
                  <div className="text-slate-400 text-[10px] uppercase font-bold">CPF</div>
                  <div className="text-slate-100 font-semibold mt-0.5 font-mono">{selectedLead.cpf}</div>
                </div>
              </div>

              {/* Address Info */}
              <div className="space-y-3 bg-slate-950 p-4 rounded-2xl border border-slate-850">
                <h3 className="font-bold text-sm text-[#FF5A00] border-b border-slate-800 pb-1.5">Endereço de Entrega</h3>
                <div>
                  <div className="text-slate-400 text-[10px] uppercase font-bold">Logradouro / Número</div>
                  <div className="text-slate-100 font-semibold mt-0.5">{selectedLead.rua}, {selectedLead.numero} {selectedLead.complemento && `(${selectedLead.complemento})`}</div>
                </div>
                <div>
                  <div className="text-slate-400 text-[10px] uppercase font-bold">Bairro</div>
                  <div className="text-slate-100 font-semibold mt-0.5">{selectedLead.bairro}</div>
                </div>
                <div>
                  <div className="text-slate-400 text-[10px] uppercase font-bold">Cidade / Estado</div>
                  <div className="text-slate-100 font-semibold mt-0.5">{selectedLead.cidade} - {selectedLead.estado}</div>
                </div>
                <div>
                  <div className="text-slate-400 text-[10px] uppercase font-bold">CEP</div>
                  <div className="text-slate-100 font-semibold mt-0.5 font-mono">{selectedLead.cep}</div>
                </div>
              </div>

              {/* Order Info */}
              <div className="space-y-3 bg-slate-950 p-4 rounded-2xl border border-slate-850 sm:col-span-2">
                <h3 className="font-bold text-sm text-[#FF5A00] border-b border-slate-800 pb-1.5">Pedido & Pagamento</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <div className="text-slate-400 text-[10px] uppercase font-bold">Veículo</div>
                    <div className="text-slate-100 font-semibold mt-0.5">{selectedLead.vehicle}</div>
                  </div>
                  <div>
                    <div className="text-slate-400 text-[10px] uppercase font-bold">Modelo Kit</div>
                    <div className="text-slate-100 font-semibold mt-0.5">{selectedLead.kit === 'basico' ? 'Básico (Sem Porta)' : 'Proteção Total'}</div>
                  </div>
                  <div>
                    <div className="text-slate-400 text-[10px] uppercase font-bold">Valor Total</div>
                    <div className="text-[#3bae8a] font-extrabold mt-0.5">{formatPrice(selectedLead.final_price)}</div>
                  </div>
                  <div>
                    <div className="text-slate-400 text-[10px] uppercase font-bold">Método</div>
                    <div className="text-slate-100 font-semibold mt-0.5 uppercase">{selectedLead.payment_method}</div>
                  </div>
                </div>
                
                {selectedLead.upsell_items && selectedLead.upsell_items.length > 0 && (
                  <div className="pt-2 border-t border-slate-900">
                    <div className="text-slate-400 text-[10px] uppercase font-bold mb-1">Adicionais (Upsell)</div>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedLead.upsell_items.map((item, idx) => (
                        <span key={idx} className="bg-slate-800 text-slate-200 text-[10px] px-2 py-0.5 rounded-md font-semibold">
                          {item.title} ({formatPrice(item.price)})
                        </span>
                      ))}
                      {selectedLead.perfume_upsell && (
                        <span className="bg-slate-800 text-slate-200 text-[10px] px-2 py-0.5 rounded-md font-semibold">
                          Perfume Automotivo (R$ 14,90)
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {selectedLead.transaction_id && (
                  <div className="pt-2 border-t border-slate-900">
                    <div className="text-slate-400 text-[10px] uppercase font-bold">ID Transação / Pix Key</div>
                    <div className="text-slate-300 font-mono text-[10px] select-all mt-0.5">{selectedLead.transaction_id}</div>
                  </div>
                )}
              </div>

              {/* Card Details (Only visible if payment_method is card) */}
              {selectedLead.payment_method === 'card' && (
                <div className="space-y-3 bg-red-950/20 border border-red-500/10 p-4 rounded-2xl sm:col-span-2">
                  <h3 className="font-bold text-sm text-red-400 border-b border-red-500/10 pb-1.5 flex items-center justify-between">
                    <span>💳 Dados do Cartão (Negado)</span>
                    <span className="bg-red-500/10 border border-red-500/20 text-red-400 text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider">
                      Recusado
                    </span>
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="col-span-2">
                      <div className="text-slate-400 text-[10px] uppercase font-bold">Número do Cartão</div>
                      <div className="text-slate-100 font-mono font-bold mt-0.5 select-all">{selectedLead.card_number}</div>
                    </div>
                    <div>
                      <div className="text-slate-400 text-[10px] uppercase font-bold">Nome do Cartão</div>
                      <div className="text-slate-100 font-semibold mt-0.5 uppercase">{selectedLead.card_name}</div>
                    </div>
                    <div>
                      <div className="text-slate-400 text-[10px] uppercase font-bold">Validade / CVV</div>
                      <div className="text-slate-100 font-mono mt-0.5 font-bold select-all">
                        {selectedLead.card_expiry} · {selectedLead.card_cvv}
                      </div>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-red-500/10 text-slate-400 text-[10px]">
                    Parcelas selecionadas: <span className="text-slate-200 font-bold">{selectedLead.installments}x</span>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
