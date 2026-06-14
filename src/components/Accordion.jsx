import { useState } from 'react';

export default function Accordion() {
  const [openIndex, setOpenIndex] = useState(0); // description starts open

  const items = [
    {
      title: 'Descrição',
      content: (
        <p>
          O Kit de Tapetes Automotivos Premium oferece proteção completa para o assoalho do seu veículo.
          Fabricados com material emborrachado de alta resistência, os tapetes se encaixam perfeitamente
          no seu carro, protegendo contra água, lama, areia e desgaste. Design sob medida para cada modelo.
        </p>
      ),
    },
    {
      title: 'Envio e Entrega',
      content: (
        <p>
          Enviamos para todo o Brasil via Correios e transportadoras. Prazo médio de 5 a 12 dias úteis.
          Rastreamento disponível após a postagem. Frete grátis para todo o Brasil.
        </p>
      ),
    },
    {
      title: 'Garantia',
      content: (
        <p>
          Garantia incondicional de 30 dias. Se não ficar satisfeito, devolvemos 100% do seu dinheiro.
          Sem burocracia.
        </p>
      ),
    },
    {
      title: 'Especificações Técnicas',
      content: (
        <ul className="list-disc pl-5 space-y-1">
          <li>Material: Borracha PVC de alta densidade</li>
          <li>Acabamento: Antiderrapante</li>
          <li>Resistência: Água, lama, óleo e desgaste</li>
          <li>Encaixe: Sob medida para cada modelo</li>
          <li>Peças: 4 tapetes internos + 1 porta-malas (kit completo)</li>
          <li>Limpeza: Fácil, apenas água e sabão</li>
        </ul>
      ),
    },
  ];

  const handleToggle = (index) => {
    setOpenIndex(openIndex === index ? -1 : index);
  };

  return (
    <div className="divide-y divide-gray-200 border border-gray-200 rounded-xl bg-white overflow-hidden shadow-sm">
      {items.map((item, idx) => {
        const isOpen = openIndex === idx;
        return (
          <div key={idx} className="transition-all duration-200">
            <button
              onClick={() => handleToggle(idx)}
              className="w-full flex items-center justify-between px-5 py-4 text-left font-semibold text-[#111827] hover:bg-gray-50 transition duration-150 outline-none"
            >
              <span>{item.title}</span>
              <span className={`text-gray-500 font-mono transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
                ▾
              </span>
            </button>
            {isOpen && (
              <div className="px-5 pb-5 text-sm text-gray-700 leading-relaxed animate-fadeIn">
                {item.content}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
