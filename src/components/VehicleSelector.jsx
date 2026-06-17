import { useState, useMemo } from 'react';
import { VEHICLES_DB } from '../data/vehicles';

export default function VehicleSelector({ id, buyUrl, onCheckout }) {
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');

  // Estados para carro personalizado (Outro / Não listado)
  const [customBrand, setCustomBrand] = useState('');
  const [customModel, setCustomModel] = useState('');
  const [customYear, setCustomYear] = useState('');

  const isCustom = brand === 'outro';

  const modelsList = useMemo(() => {
    if (isCustom) return [];
    return brand ? (VEHICLES_DB[brand] ?? []) : [];
  }, [brand, isCustom]);

  const yearsList = useMemo(() => {
    if (isCustom) {
      const list = [];
      const currentYear = new Date().getFullYear() + 1;
      for (let y = currentYear; y >= 1950; y--) {
        list.push(String(y));
      }
      return list;
    }
    if (!brand || !model) return [];
    const modelObj = modelsList.find((m) => m.name === model);
    if (!modelObj) return [];
    const list = [];
    for (let y = modelObj.endYear; y >= modelObj.startYear; y--) {
      list.push(String(y));
    }
    return list;
  }, [brand, model, modelsList, isCustom]);

  const isValid = isCustom
    ? !!(customBrand.trim() && customModel.trim() && customYear)
    : !!(brand && model && year);

  const handleCheckout = () => {
    if (isValid) {
      const vehicleName = isCustom
        ? `${customBrand.trim()} ${customModel.trim()} (${customYear})`
        : `${brand} ${model} (${year})`;
      if (onCheckout) {
        onCheckout(vehicleName);
      } else {
        window.location.href = buyUrl;
      }
    }
  };

  return (
    <div className="space-y-3">
      {/* Brand Select */}
      <select
        value={brand}
        onChange={(e) => {
          setBrand(e.target.value);
          setModel('');
          setYear('');
          setCustomBrand('');
          setCustomModel('');
          setCustomYear('');
        }}
        className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm focus:border-[#FF5A00] focus:ring-2 focus:ring-[#FF5A00]/20 outline-none transition-all cursor-pointer"
        aria-label="Marca do veículo"
      >
        <option value="">Marca do veículo...</option>
        {Object.keys(VEHICLES_DB).map((b) => (
          <option key={b} value={b}>
            {b}
          </option>
        ))}
        <option value="outro">Outro / Não listado (Digitar manualmente)</option>
      </select>

      {/* Condicional para "Outro" (Campos manuais) */}
      {isCustom ? (
        <div className="space-y-3 animate-fadeIn">
          {/* Custom Brand Input */}
          <input
            type="text"
            value={customBrand}
            onChange={(e) => setCustomBrand(e.target.value)}
            placeholder="Digite a Marca do Veículo (ex: Ferrari)"
            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm focus:border-[#FF5A00] focus:ring-2 focus:ring-[#FF5A00]/20 outline-none transition-all"
            aria-label="Marca personalizada"
          />

          {/* Custom Model Input */}
          <input
            type="text"
            value={customModel}
            onChange={(e) => setCustomModel(e.target.value)}
            placeholder="Digite o Modelo do Veículo (ex: Roma)"
            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm focus:border-[#FF5A00] focus:ring-2 focus:ring-[#FF5A00]/20 outline-none transition-all"
            aria-label="Modelo personalizado"
          />

          {/* Custom Year Select */}
          <select
            value={customYear}
            onChange={(e) => setCustomYear(e.target.value)}
            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm focus:border-[#FF5A00] focus:ring-2 focus:ring-[#FF5A00]/20 outline-none transition-all cursor-pointer"
            aria-label="Ano personalizado"
          >
            <option value="">Selecione o Ano...</option>
            {yearsList.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <>
          {/* Model Select */}
          <select
            value={model}
            onChange={(e) => {
              setModel(e.target.value);
              setYear('');
            }}
            disabled={!brand}
            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm disabled:bg-gray-100 disabled:text-gray-400 focus:border-[#FF5A00] focus:ring-2 focus:ring-[#FF5A00]/20 outline-none transition-all cursor-pointer disabled:cursor-not-allowed"
            aria-label="Modelo"
          >
            <option value="">Modelo...</option>
            {modelsList.map((m) => (
              <option key={m.name} value={m.name}>
                {m.name}
              </option>
            ))}
          </select>

          {/* Year Select */}
          <select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            disabled={!model}
            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm disabled:bg-gray-100 disabled:text-gray-400 focus:border-[#FF5A00] focus:ring-2 focus:ring-[#FF5A00]/20 outline-none transition-all cursor-pointer disabled:cursor-not-allowed"
            aria-label="Ano"
          >
            <option value="">Ano...</option>
            {yearsList.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </>
      )}

      {/* CTA Button */}
      <button
        type="button"
        onClick={handleCheckout}
        disabled={!isValid}
        id={id}
        data-xtracky-checkout=""
        className="w-full rounded-xl bg-[#FF5A00] py-3.5 text-sm font-bold text-white uppercase tracking-wide shadow-md hover:bg-[#e64f00] disabled:bg-gray-300 disabled:text-gray-500 disabled:shadow-none disabled:cursor-not-allowed transition duration-200"
      >
        {isValid ? 'Comprar agora' : 'Selecione seu veículo'}
      </button>
    </div>
  );
}
