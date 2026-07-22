import { useState, useEffect } from 'react';
import { generateEventId, trackMetaEvent } from '../utils/metaPixel';

export default function ThankYouUpsellPage() {
  const [purchaseData, setPurchaseData] = useState(null);
  const [selectedUpsells, setSelectedUpsells] = useState([]);
  
  // Timer de Urgência de 15 minutos (900 segundos)
  const [timeLeft, setTimeLeft] = useState(900);

  useEffect(() => {
    if (timeLeft <= 0) return;
    const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Carrega os dados da compra do localStorage e dispara o evento de Purchase inicial se necessário
  useEffect(() => {
    try {
      const dataStr = localStorage.getItem('cartapetes_purchase_data');
      if (dataStr) {
        const data = JSON.parse(dataStr);
        setPurchaseData(data);

        if (window.fbq && !window.purchaseEventTracked) {
          window.purchaseEventTracked = true;
          window.fbq('track', 'Purchase', {
            value: data.value || 137.90,
            currency: 'BRL',
            content_type: 'product',
            contents: [{ id: data.kit || 'kit_premium', quantity: 1, item_price: data.value || 137.90 }]
          }, { eventID: data.eventId });
        }
      }

      // Restaura upsells pré-selecionados se existirem
      const savedUpsells = localStorage.getItem('cartapetes_added_upsells');
      if (savedUpsells) {
        setSelectedUpsells(JSON.parse(savedUpsells));
      }
    } catch (e) {
      console.error('Erro ao ler dados:', e);
    }
  }, []);

  // Lista de Produtos Upsell Automotivos
  const upsellProducts = [
    {
      id: 'organizador_portamalas',
      title: 'Organizador de Porta-Malas Impermeável 50L',
      tag: '🔥 MAIS VENDIDO',
      tagBg: 'bg-[#FF5A00]',
      description: 'Estrutura reforçada com divisórias ajustáveis e fundo antiderrapante.',
      originalPrice: 149.90,
      price: 49.90,
      image: '/organizador_portamalas.png',
      rating: '4.9',
      reviews: '428'
    },
    {
      id: 'kit_limpeza_pro',
      title: 'Kit de Limpeza & Estética Automotiva Pro (3 Pçs)',
      tag: '✨ OPORTUNIDADE',
      tagBg: 'bg-emerald-600',
      description: 'Cera Líquida + Pretinho Pneu + Flanela Microfibra 40x40cm.',
      originalPrice: 79.90,
      price: 39.90,
      image: '/kit_limpeza.png',
      rating: '5.0',
      reviews: '312'
    },
    {
      id: 'aromatizador_gel_duo',
      title: 'Aromatizador Gel Luxo Vanilla (2 Unidades)',
      tag: '⭐ RECOMENDADO',
      tagBg: 'bg-amber-500',
      description: 'Fragrância de Vanilla Black importada. Duração de até 60 dias.',
      originalPrice: 59.90,
      price: 19.90,
      image: '/aromatizador_carro.png',
      rating: '4.9',
      reviews: '519'
    },
    {
      id: 'aspirador_po_12v',
      title: 'Aspirador de Pó Automotivo High Power 12V',
      tag: '⚡ POTENTE',
      tagBg: 'bg-blue-600',
      description: 'Ligue no acendedor 12V. Sucção forte para poeira e terra dos cantos.',
      originalPrice: 129.90,
      price: 69.90,
      image: '/aspirador_po_automotivo.png',
      rating: '4.8',
      reviews: '184'
    },
    {
      id: 'capa_protecao_banco',
      title: 'Capa Protetora Impermeável Banco Traseiro',
      tag: '🐕 PROTEÇÃO TOTAL',
      tagBg: 'bg-purple-600',
      description: 'Protege os bancos contra sujeira, água, pets e transporte de objetos.',
      originalPrice: 119.90,
      price: 59.90,
      image: '/capa_protecao_bancos.png',
      rating: '4.9',
      reviews: '245'
    },
    {
      id: 'suporte_celular_magnetico',
      title: 'Suporte Veicular Magnético de Celular',
      tag: '📱 PRÁTICO',
      tagBg: 'bg-gray-800',
      description: 'Ímãs de neodímio ultra fortes para fixar o celular na saída de ar.',
      originalPrice: 49.90,
      price: 24.90,
      image: '/suporte_celular_magnetico.png',
      rating: '5.0',
      reviews: '610'
    }
  ];

  // Alterna produto no Mini Carrinho
  const handleToggleProduct = (product) => {
    const exists = selectedUpsells.some(item => item.id === product.id);
    let updated;
    if (exists) {
      updated = selectedUpsells.filter(item => item.id !== product.id);
    } else {
      updated = [...selectedUpsells, product];
    }
    setSelectedUpsells(updated);
    localStorage.setItem('cartapetes_added_upsells', JSON.stringify(updated));
  };

  // Redireciona para o checkout com os produtos atualizados
  const handleGoToCheckout = () => {
    localStorage.setItem('cartapetes_added_upsells', JSON.stringify(selectedUpsells));
    localStorage.setItem('cartapetes_is_upsell_only', 'true');
    window.location.href = '/checkout';
  };

  // Cálculo de valor extra dos upsells
  const upsellsTotal = selectedUpsells.reduce((sum, item) => sum + item.price, 0);

  return (
    <div className="min-h-screen bg-white text-[#111827] fontRubik pb-32 antialiased">
      
      {/* Top Banner Informativo de Rastreio */}
      <div className="bg-[#FF5A00] text-white text-[11px] sm:text-xs font-bold py-2.5 px-4 text-center tracking-wide shadow-sm flex items-center justify-center gap-1.5">
        <span className="text-base">📦</span>
        <span><b>Pedido Confirmado!</b> O código de rastreamento será enviado no seu <b>WhatsApp e E-mail em até 2 dias úteis</b>.</span>
      </div>

      {/* Header com Logo da Loja */}
      <header className="bg-black py-2 px-4 sticky top-0 z-40 shadow-md">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <a href="/" className="flex items-center hover:opacity-90 transition-opacity" title="Voltar para a página inicial">
            <img 
              src="/logo-whats-cropped.png" 
              alt="CarTapetes Logo" 
              className="h-14 sm:h-16 w-auto object-contain"
            />
          </a>
          <a 
            href="https://wa.me/5511911016413?text=Ol%C3%A1%2C%20gostaria%20de%20tirar%20uma%20d%C3%BAvida%20sobre%20meu%20pedido!"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] sm:text-xs font-bold px-3 py-1.5 rounded-lg transition flex items-center gap-1 shadow-sm"
          >
            💬 Suporte WhatsApp
          </a>
        </div>
      </header>

      {/* Hero de Oferta Especial Pós-Compra */}
      <section className="max-w-5xl mx-auto px-4 mt-6">
        <div className="bg-[#FFF8F5] border border-orange-200 rounded-2xl p-5 sm:p-7 text-center shadow-xs relative overflow-hidden">
          
          <div className="inline-flex items-center gap-1.5 bg-[#FF5A00] text-white text-[10px] sm:text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full mb-3">
            <span>🔥</span> Oferta Exclusiva de Pós-Compra
          </div>

          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-gray-900 tracking-tight leading-tight max-w-3xl mx-auto">
            Adicione Acessórios com <span className="text-[#FF5A00] underline decoration-[#FF5A00]/40">Frete Grátis na Mesma Caixa</span>!
          </h1>

          <p className="text-gray-600 text-xs sm:text-sm md:text-base max-w-2xl mx-auto mt-2 leading-relaxed font-medium">
            Seu pedido ainda está na mesa de embalagem. Selecione os itens desejados abaixo para incluir no seu envio sem pagar nada a mais de frete!
          </p>

          {/* Timer de Validade */}
          <div className="mt-4 inline-flex items-center gap-2 bg-white border border-orange-200 px-4 py-2 rounded-xl shadow-xs">
            <span className="text-base">⏰</span>
            <div className="text-xs sm:text-sm text-gray-700 font-bold">
              Frete grátis liberado por: <span className="font-mono text-sm sm:text-base text-[#FF5A00] font-black">{formatTime(timeLeft)}</span>
            </div>
          </div>

        </div>
      </section>

      {/* Vitrine de Produtos (Grade 2x2 no Celular com Fotos Limpas) */}
      <section className="max-w-5xl mx-auto px-4 mt-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg sm:text-2xl font-black text-gray-900 flex items-center gap-2">
              <span>🚘</span> Acessórios em Promoção Exclusiva
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">Clique em "Adicionar ao Pedido" para incluir no seu carrinho</p>
          </div>
          <span className="bg-emerald-50 text-emerald-700 text-[11px] font-bold px-2.5 py-1 rounded-lg border border-emerald-200">
            🚚 Frete R$ 0,00
          </span>
        </div>

        {/* Grade 2x2 no Celular (grid-cols-2) */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-5">
          {upsellProducts.map((product) => {
            const isSelected = selectedUpsells.some(item => item.id === product.id);

            return (
              <div 
                key={product.id}
                className={`bg-white border rounded-xl sm:rounded-2xl overflow-hidden flex flex-col justify-between transition-all duration-200 ${
                  isSelected ? 'border-[#FF5A00] ring-2 ring-[#FF5A00]/20 bg-orange-50/20 shadow-md' : 'border-gray-200 hover:shadow-md'
                }`}
              >
                {/* Foto Limpa */}
                <div className="relative bg-white border-b border-gray-100">
                  <span className={`absolute top-2 left-2 ${product.tagBg} text-white text-[9px] sm:text-[10px] font-black px-2 py-0.5 rounded shadow-sm uppercase tracking-wider z-10`}>
                    {product.tag}
                  </span>
                  
                  <div className="w-full h-36 sm:h-48 bg-white flex items-center justify-center p-2">
                    <img 
                      src={product.image} 
                      alt={product.title}
                      className="max-h-full max-w-full object-contain transform hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                </div>

                {/* Conteúdo do Produto */}
                <div className="p-3 sm:p-4 flex-1 flex flex-col justify-between space-y-2.5">
                  <div>
                    <div className="flex items-center gap-1 text-[10px] sm:text-xs text-amber-500 font-bold mb-1">
                      <span>★ {product.rating}</span>
                      <span className="text-gray-400">({product.reviews})</span>
                    </div>

                    <h3 className="font-extrabold text-gray-900 text-xs sm:text-sm leading-snug line-clamp-2">
                      {product.title}
                    </h3>
                    
                    <p className="text-gray-500 text-[10px] sm:text-xs mt-1 leading-tight line-clamp-2">
                      {product.description}
                    </p>
                  </div>

                  {/* Preço e Ação */}
                  <div className="pt-2 border-t border-gray-100 space-y-2">
                    <div>
                      <div className="text-[10px] sm:text-xs text-gray-400 line-through">
                        De R$ {product.originalPrice.toFixed(2).replace('.', ',')}
                      </div>
                      <div className="text-sm sm:text-lg font-black text-[#FF5A00] leading-none">
                        R$ {product.price.toFixed(2).replace('.', ',')}
                      </div>
                    </div>

                    <button
                      onClick={() => handleToggleProduct(product)}
                      className={`w-full font-extrabold py-2 sm:py-2.5 px-2 rounded-lg text-[10px] sm:text-xs text-center transition cursor-pointer shadow-xs flex items-center justify-center gap-1 transform active:scale-95 ${
                        isSelected 
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
                          : 'bg-[#FF5A00] hover:bg-[#e04f00] text-white'
                      }`}
                    >
                      {isSelected ? (
                        <span>✓ No Carrinho</span>
                      ) : (
                        <>
                          <span>➕</span>
                          <span>Adicionar ao Pedido</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Mini Carrinho Inferior Fixo (Bottom Bar) */}
      {selectedUpsells.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-2xl p-3 sm:p-4 animate-slideUp">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
            
            {/* Thumbnails e Resumo */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="flex -space-x-2 overflow-hidden flex-shrink-0">
                {selectedUpsells.slice(0, 3).map((item) => (
                  <img 
                    key={item.id} 
                    src={item.image} 
                    alt={item.title}
                    className="w-10 h-10 rounded-full border-2 border-white object-cover bg-gray-50 shadow-sm"
                  />
                ))}
              </div>

              <div className="min-w-0">
                <div className="text-xs sm:text-sm font-extrabold text-gray-900 truncate">
                  🛒 {selectedUpsells.length} {selectedUpsells.length === 1 ? 'item selecionado' : 'itens selecionados'}
                </div>
                <div className="text-[11px] sm:text-xs text-emerald-600 font-bold">
                  Frete Grátis na mesma caixa
                </div>
              </div>
            </div>

            {/* Total e Botão para Ir ao Pagamento */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="text-right hidden sm:block">
                <div className="text-[10px] text-gray-400 uppercase font-bold">Valor dos Acessórios</div>
                <div className="text-base font-black text-[#FF5A00]">
                  + R$ {upsellsTotal.toFixed(2).replace('.', ',')}
                </div>
              </div>

              <button
                onClick={handleGoToCheckout}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-4 sm:px-6 py-3 rounded-xl text-xs sm:text-sm transition cursor-pointer shadow-lg shadow-emerald-600/20 flex items-center gap-1.5 transform active:scale-95"
              >
                <span>Ir Para o Pagamento</span>
                <span>→</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Rodapé */}
      <footer className="max-w-5xl mx-auto px-4 mt-16 pt-8 border-t border-gray-200 text-center text-xs text-gray-500 space-y-2">
        <div className="font-bold text-gray-700">CarTapetes Ltda.</div>
        <div>CNPJ: 15.807.911/0001-00</div>
        <div>Endereço: Avenida Cristiano Machado 8966 Galpão 01, 02 e 03 Minaslândia Belo Horizonte MG 31812-112</div>
        <div className="text-gray-400 pt-2">© {new Date().getFullYear()} CarTapetes. Todos os direitos reservados.</div>
      </footer>

    </div>
  );
}
