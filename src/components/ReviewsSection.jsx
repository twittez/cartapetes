import { useState } from 'react';

const ALL_REVIEWS = [
  {
    id: 1, name: 'Carlos M.', city: 'São Paulo', state: 'SP', stars: 5,
    car: 'Honda Civic G10 2019', date: '18/07/2025', verified: true, hasPhoto: true,
    photo: '/review-1.jpg',
    text: 'Tapetes de qualidade excepcional! Encaixaram perfeitamente no meu Civic. Já passei por vários dias de chuva forte e o assoalho ficou completamente seco. A base antiderrapante é incrível, não move nem um milímetro. Vale cada centavo!',
    avatar: 'C', color: '#FF5A00'
  },
  {
    id: 2, name: 'Ana Paula S.', city: 'Curitiba', state: 'PR', stars: 5,
    car: 'Toyota Corolla XEI 2022', date: '15/07/2025', verified: true, hasPhoto: true,
    photo: '/review-2.jpg',
    text: 'Comprei o kit completo com porta-malas e valeu cada centavo. O acabamento é impecável e o encaixe é perfeito. Instalei sozinha em menos de 2 minutos sem nenhuma ferramenta. Muito satisfeita com a qualidade!',
    avatar: 'A', color: '#7C3AED'
  },
  {
    id: 3, name: 'Roberto F.', city: 'Belo Horizonte', state: 'MG', stars: 5,
    car: 'Volkswagen T-Cross 2021', date: '12/07/2025', verified: true, hasPhoto: true,
    photo: '/review-3.jpg',
    text: 'Já comprei vários tapetes genéricos ao longo dos anos e nenhum se compara a este. Sob medida de verdade, não escorrega nem com freada brusca, e a limpeza é ridiculamente fácil. Melhor custo-benefício que já vi!',
    avatar: 'R', color: '#059669'
  },
  {
    id: 4, name: 'Fernanda L.', city: 'Rio de Janeiro', state: 'RJ', stars: 5,
    car: 'Hyundai HB20 2020', date: '10/07/2025', verified: true, hasPhoto: false,
    photo: null,
    text: 'Atendimento maravilhoso e entrega super rápida! Chegou em 3 dias úteis. O tapete é muito mais grosso do que eu esperava, ótimo material. Recomendo demais para quem tem carro novo e quer proteger o carpete original.',
    avatar: 'F', color: '#DC2626'
  },
  {
    id: 5, name: 'Marcos A.', city: 'Porto Alegre', state: 'RS', stars: 5,
    car: 'Chevrolet Tracker LT 2023', date: '08/07/2025', verified: true, hasPhoto: false,
    photo: null,
    text: 'Produto excelente! As bordas elevadas realmente funcionam — minha cachorra molhou o tapete com a vasilha d\'água e não vazou nada pro assoalho. Embalagem muito bem feita, chegou sem nenhum amasso.',
    avatar: 'M', color: '#0891B2'
  },
  {
    id: 6, name: 'Juliana K.', city: 'Salvador', state: 'BA', stars: 4,
    car: 'Fiat Pulse Audace 2022', date: '06/07/2025', verified: true, hasPhoto: false,
    photo: null,
    text: 'Muito bom o produto! Encaixe perfeito no meu Pulse. Tirei 4 estrelas apenas pelo prazo de entrega que foi um pouco maior que o esperado, mas o produto em si é impecável. Comprarei o kit porta-malas em breve!',
    avatar: 'J', color: '#BE185D'
  },
  {
    id: 7, name: 'Diego T.', city: 'Fortaleza', state: 'CE', stars: 5,
    car: 'Jeep Compass Limited 2021', date: '04/07/2025', verified: true, hasPhoto: false,
    photo: null,
    text: 'Fiz a pesquisa de mercado antes de comprar e o preço aqui é muito bom para a qualidade entregue. No meu Compass o tapete ficou perfeito, cobrindo toda a área do assoalho. Material resistente e fácil de lavar.',
    avatar: 'D', color: '#B45309'
  },
  {
    id: 8, name: 'Patricia V.', city: 'Manaus', state: 'AM', stars: 5,
    car: 'Renault Kwid Zen 2020', date: '02/07/2025', verified: true, hasPhoto: false,
    photo: null,
    text: 'Chegou em Manaus em 6 dias úteis, muito rápido! Produto incrível, meu carro ficou com um visual muito mais limpo e organizado. A lixeira de brinde também é ótima, uso todo dia. Nota 10 para a empresa!',
    avatar: 'P', color: '#7C3AED'
  },
  {
    id: 9, name: 'Thiago B.', city: 'Brasília', state: 'DF', stars: 5,
    car: 'Nissan Kicks SV 2022', date: '29/06/2025', verified: true, hasPhoto: false,
    photo: null,
    text: 'Produto de altíssima qualidade! Meu Kicks tem um formato de assoalho que dificulta tapetes genéricos, mas esse encaixou perfeito. A espessura de 7mm faz toda a diferença no conforto. Super recomendo!',
    avatar: 'T', color: '#047857'
  },
  {
    id: 10, name: 'Camila R.', city: 'Recife', state: 'PE', stars: 5,
    car: 'Hyundai Creta Prestige 2023', date: '27/06/2025', verified: true, hasPhoto: false,
    photo: null,
    text: 'Comprei como presente para o meu marido e ele amou! Disse que é o melhor tapete que já teve. Material premium de verdade, diferente dos plásticos baratos que vendem por aí. Voltarei a comprar com certeza!',
    avatar: 'C', color: '#DB2777'
  },
  {
    id: 11, name: 'Leonardo S.', city: 'Goiânia', state: 'GO', stars: 5,
    car: 'Volkswagen Polo GTS 2022', date: '25/06/2025', verified: true, hasPhoto: false,
    photo: null,
    text: 'Instalação demorou menos de 1 minuto, literalmente! O tapete trava nos pinos originais do veículo e não sai. Já lavei 3 vezes com mangueira e está como novo. Qualidade japonesa mesmo sendo nacional!',
    avatar: 'L', color: '#1D4ED8'
  },
  {
    id: 12, name: 'Beatriz O.', city: 'Florianópolis', state: 'SC', stars: 4,
    car: 'Fiat Argo Drive 2021', date: '23/06/2025', verified: true, hasPhoto: false,
    photo: null,
    text: 'Ótimo produto! O único ponto que tiraria meia estrela é a cor — no site parecia mais escuro, mas no produto real ficou um tom de cinza mais claro. De resto é perfeito, encaixe preciso e material resistente.',
    avatar: 'B', color: '#9333EA'
  },
  {
    id: 13, name: 'Rodrigo N.', city: 'Campo Grande', state: 'MS', stars: 5,
    car: 'Mitsubishi Eclipse Cross 2022', date: '20/06/2025', verified: true, hasPhoto: false,
    photo: null,
    text: 'Para o Eclipse Cross eu não achava tapete decente em lugar nenhum. Aqui acertaram em cheio! Parabéns ao time que faz os moldes. Qualidade superior a tudo que já comprei para automóveis.',
    avatar: 'R', color: '#0F766E'
  },
  {
    id: 14, name: 'Vanessa M.', city: 'Natal', state: 'RN', stars: 5,
    car: 'Peugeot 208 Allure 2023', date: '18/06/2025', verified: true, hasPhoto: false,
    photo: null,
    text: 'Produto muito bom! Meu 208 tem o assoalho em formato diferente e o tapete se adaptou perfeitamente. A borda de contenção segurou um copo inteiro de café que caiu dentro do carro. Salvou meu carpete original!',
    avatar: 'V', color: '#C2410C'
  },
  {
    id: 15, name: 'Felipe H.', city: 'João Pessoa', state: 'PB', stars: 5,
    car: 'Citroën C3 Feel 2022', date: '15/06/2025', verified: true, hasPhoto: false,
    photo: null,
    text: 'Entrega expressa chegou antes do prazo. Tapete de qualidade absurda para o preço. Já indiquei para 4 amigos e todos compraram. O suporte via WhatsApp tirou todas as dúvidas muito rapidamente.',
    avatar: 'F', color: '#7C3AED'
  },
  {
    id: 16, name: 'Amanda C.', city: 'Vitória', state: 'ES', stars: 5,
    car: 'Fiat Cronos Drive 2021', date: '12/06/2025', verified: true, hasPhoto: false,
    photo: null,
    text: 'Terceira compra na CarTapetes! Primeiro o Onix, depois o Gol da minha mãe e agora o Cronos. Qualidade constante e preço justo. Empresa séria que entrega o que promete. Recomendo de olhos fechados!',
    avatar: 'A', color: '#059669'
  },
];

const STAR_COLORS = ['', '#dc2626', '#f59e0b', '#f59e0b', '#22c55e', '#FF5A00'];

function StarRow({ count, total = 5, color = '#FF5A00', filled = true }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: total }).map((_, i) => (
        <svg key={i} width="14" height="14" viewBox="0 0 24 24"
          fill={filled && i < count ? color : '#E5E7EB'}>
          <path d="M12 2l2.9 6.9L22 10l-5.5 4.8L18.2 22 12 18.3 5.8 22l1.7-7.2L2 10l7.1-1.1L12 2z" />
        </svg>
      ))}
    </div>
  );
}

export default function ReviewsSection() {
  const [activeFilter, setActiveFilter] = useState('all');
  const [visibleCount, setVisibleCount] = useState(6);
  const [expandedReview, setExpandedReview] = useState(null);

  const filters = [
    { key: 'all', label: 'Todas', count: '2.847' },
    { key: '5', label: '5 ★', count: '2.335' },
    { key: '4', label: '4 ★', count: '341' },
    { key: 'photo', label: 'Com Foto', count: '1.204' },
  ];

  const filtered = ALL_REVIEWS.filter(r => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'photo') return r.hasPhoto;
    return r.stars === parseInt(activeFilter);
  });

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length || visibleCount < 20;

  const ratingDist = [
    { stars: 5, pct: 82, count: '2.335' },
    { stars: 4, pct: 12, count: '341' },
    { stars: 3, pct: 4, count: '113' },
    { stars: 2, pct: 1, count: '28' },
    { stars: 1, pct: 1, count: '30' },
  ];

  return (
    <section id="avaliacoes" className="bg-white py-14 border-t border-gray-100">
      <div className="max-w-6xl mx-auto px-4">

        {/* Section header */}
        <div className="text-center mb-10">
          <span className="text-xs font-bold tracking-widest text-[#FF5A00] uppercase">Avaliações Reais</span>
          <h2 className="text-2xl sm:text-3xl font-extrabold mt-2 text-[#111827]">
            O Que Nossos Clientes Dizem
          </h2>
          <p className="mt-2 text-sm text-gray-500">Mais de 2.847 avaliações verificadas de compradores reais</p>
        </div>

        {/* Shopee-style rating summary */}
        <div className="bg-[#FFF8F3] border border-orange-100 rounded-2xl p-6 mb-8 max-w-2xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            {/* Big score */}
            <div className="text-center flex-shrink-0">
              <div className="text-6xl font-black text-[#FF5A00] leading-none">4.9</div>
              <StarRow count={5} color="#FF5A00" />
              <div className="text-xs text-gray-400 mt-1.5 font-medium">de 5 estrelas</div>
              <div className="text-xs text-gray-500 mt-1">2.847 avaliações</div>
            </div>

            {/* Bar chart */}
            <div className="flex-1 w-full space-y-2.5">
              {ratingDist.map(row => (
                <div key={row.stars} className="flex items-center gap-3">
                  <div className="flex items-center gap-1 w-16 flex-shrink-0">
                    <span className="text-xs font-bold text-gray-700">{row.stars}</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="#FF5A00">
                      <path d="M12 2l2.9 6.9L22 10l-5.5 4.8L18.2 22 12 18.3 5.8 22l1.7-7.2L2 10l7.1-1.1L12 2z" />
                    </svg>
                  </div>
                  <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${row.pct}%`,
                        background: row.stars >= 4 ? '#FF5A00' : row.stars === 3 ? '#f59e0b' : '#ef4444'
                      }}
                    />
                  </div>
                  <span className="text-xs text-gray-400 font-medium w-10 text-right">{row.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Trust badges */}
          <div className="mt-5 pt-4 border-t border-orange-100 flex flex-wrap justify-center gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-emerald-700 font-semibold bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
              100% Avaliações Verificadas
            </span>
            <span className="flex items-center gap-1.5 text-[#FF5A00] font-semibold bg-orange-50 px-3 py-1.5 rounded-full border border-orange-100">
              🏆 RA1000 Reclame Aqui
            </span>
            <span className="flex items-center gap-1.5 text-blue-700 font-semibold bg-blue-50 px-3 py-1.5 rounded-full border border blue-100">
              📦 1.204 Com Foto
            </span>
          </div>
        </div>

        {/* Filter chips — Shopee style */}
        <div className="flex flex-wrap gap-2 mb-6 justify-center">
          {filters.map(f => (
            <button
              key={f.key}
              onClick={() => { setActiveFilter(f.key); setVisibleCount(6); }}
              className={`px-4 py-2 rounded-full text-sm font-semibold border transition-all duration-200 ${
                activeFilter === f.key
                  ? 'bg-[#FF5A00] text-white border-[#FF5A00] shadow-md scale-105'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-[#FF5A00] hover:text-[#FF5A00]'
              }`}
            >
              {f.label}
              <span className={`ml-1.5 text-xs ${activeFilter === f.key ? 'text-orange-100' : 'text-gray-400'}`}>
                ({f.count})
              </span>
            </button>
          ))}
        </div>

        {/* Review cards grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map(review => (
            <div
              key={review.id}
              className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 flex flex-col"
            >
              {/* Review photo (if has) */}
              {review.hasPhoto && review.photo && (
                <div className="h-44 overflow-hidden bg-gray-50 relative">
                  <img
                    src={review.photo}
                    alt={`Avaliação de ${review.name}`}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                    onError={e => { e.target.parentElement.style.display = 'none'; }}
                  />
                  <span className="absolute top-2 left-2 bg-black/60 text-white text-[10px] font-bold px-2 py-1 rounded-full backdrop-blur-sm">
                    📷 Com Foto
                  </span>
                </div>
              )}

              <div className="p-5 flex-1 flex flex-col">
                {/* Header: avatar + name + badges */}
                <div className="flex items-start gap-3 mb-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-black text-sm flex-shrink-0 shadow-sm"
                    style={{ background: review.color }}
                  >
                    {review.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-[#111827] text-sm truncate">{review.name}</div>
                    <div className="text-[11px] text-gray-400">{review.city} — {review.state}</div>
                  </div>
                  {review.verified && (
                    <span className="flex-shrink-0 flex items-center gap-1 text-[10px] text-emerald-600 font-bold bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
                      Verificado
                    </span>
                  )}
                </div>

                {/* Stars + car model */}
                <div className="flex items-center justify-between mb-2">
                  <StarRow count={review.stars} color="#FF5A00" />
                  <span className="text-[10px] text-gray-400 font-medium">{review.date}</span>
                </div>

                {/* Car tag */}
                <div className="mb-3">
                  <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-1 rounded-md font-medium inline-flex items-center gap-1">
                    🚗 {review.car}
                  </span>
                </div>

                {/* Review text */}
                <p className="text-sm text-gray-600 leading-relaxed flex-1">
                  {expandedReview === review.id || review.text.length <= 120
                    ? `"${review.text}"`
                    : `"${review.text.slice(0, 120)}..."`
                  }
                  {review.text.length > 120 && (
                    <button
                      onClick={() => setExpandedReview(expandedReview === review.id ? null : review.id)}
                      className="ml-1 text-[#FF5A00] font-semibold text-xs hover:underline"
                    >
                      {expandedReview === review.id ? 'ver menos' : 'ver mais'}
                    </button>
                  )}
                </p>

                {/* Bottom action row */}
                <div className="mt-4 pt-3 border-t border-gray-50 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    {review.hasPhoto && (
                      <span className="text-[10px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-medium">📷 Foto</span>
                    )}
                    <span className="text-[10px] text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full font-medium">✅ Compra Verificada</span>
                  </div>
                  <button className="text-[11px] text-gray-400 hover:text-gray-600 flex items-center gap-1 transition-colors">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
                    </svg>
                    Útil
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Load more button */}
        {(hasMore || visibleCount < ALL_REVIEWS.length) && (
          <div className="mt-8 text-center">
            <button
              onClick={() => setVisibleCount(v => v + 6)}
              className="inline-flex items-center gap-2 bg-white border-2 border-[#FF5A00] text-[#FF5A00] font-bold px-8 py-3 rounded-full hover:bg-[#FF5A00] hover:text-white transition-all duration-300 shadow-sm hover:shadow-lg"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 5v14M5 12l7 7 7-7"/>
              </svg>
              Ver mais avaliações
              <span className="text-xs opacity-70">({Math.min(ALL_REVIEWS.length - visibleCount, 6)} mais)</span>
            </button>
            <p className="mt-3 text-xs text-gray-400">
              Exibindo {Math.min(visibleCount, filtered.length)} de {filtered.length === ALL_REVIEWS.length ? '2.847' : filtered.length} avaliações
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
