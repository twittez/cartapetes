import { useState, useMemo, useRef, useEffect } from 'react';
import { VEHICLES_DB } from '../data/vehicles';

const ALL_BRANDS = Object.keys(VEHICLES_DB);

// Logos locais offline para marcas principais e fallbacks CDN jsDelivr para outras marcas
const LOCAL_LOGOS = {
  Chevrolet:      '/logos/chevrolet.png',
  Fiat:           '/logos/fiat.png',
  Ford:           '/logos/ford.png',
  Honda:          '/logos/honda.png',
  Hyundai:        '/logos/hyundai.png',
  Jeep:           '/logos/jeep.png',
  Nissan:         '/logos/nissan.png',
  Renault:        '/logos/renault.png',
  Toyota:         '/logos/toyota.png',
  Volkswagen:     '/logos/volkswagen.png',
  Citroën:        '/logos/citroen.png',
  Peugeot:        '/logos/peugeot.png',
  Mitsubishi:     '/logos/mitsubishi.png',
  Kia:            '/logos/kia.png',
  BYD:            '/logos/byd.png',
  GWM:            '/logos/gwm.png',
  RAM:            '/logos/ram.png',
  'Caoa Chery':   '/logos/chery.png',
  BMW:            '/logos/bmw.png',
  'Mercedes-Benz': '/logos/mercedes-benz.png',
  Audi:           '/logos/audi.png',
  Volvo:          '/logos/volvo.png',
  'Land Rover':   '/logos/land-rover.png',
  Porsche:        '/logos/porsche.png',
  Tesla:          '/logos/tesla.png'
};

const POPULAR_BRANDS = [
  'Chevrolet','Fiat','Volkswagen','Toyota','Hyundai',
  'Ford','Renault','Jeep','Honda','Nissan',
  'Mitsubishi','Kia','BYD','Peugeot','Citroën',
];

function BrandLogo({ brand, size = 36 }) {
  const [imgError, setImgError] = useState(false);
  
  let logo = LOCAL_LOGOS[brand];
  if (!logo) {
    // Caso a marca não seja popular/local, monta link jsDelivr (que aceita hotlink perfeitamente)
    const slug = brand.toLowerCase().trim()
      .replace('caoa chery', 'chery')
      .replace('gwm', 'great-wall')
      .replace(/\s+/g, '-')
      .replace(/[^\w\-]+/g, '')
      .replace(/\-\-+/g, '-');
    logo = `https://cdn.jsdelivr.net/gh/filippofilip95/car-logos-dataset@master/logos/optimized/${slug}.png`;
  }

  if (imgError) {
    return (
      <span
        className="flex items-center justify-center rounded-lg bg-gray-100 text-gray-500 font-black flex-shrink-0 border border-gray-200"
        style={{ width: size, height: size, fontSize: Math.max(11, size * 0.36) }}
      >
        {brand.slice(0,2).toUpperCase()}
      </span>
    );
  }

  return (
    <img
      src={logo}
      alt={brand}
      onError={() => setImgError(true)}
      className="rounded-lg object-contain flex-shrink-0 bg-white border border-gray-100"
      style={{ width: size, height: size, padding: 4 }}
    />
  );
}

export default function VehicleSelector({ id, buyUrl, onCheckout }) {
  const [step, setStep] = useState('brand');
  const [brandSearch, setBrandSearch] = useState('');
  const [brand, setBrand] = useState(null);
  const [model, setModel] = useState(null);
  const [year, setYear] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [customBrand, setCustomBrand] = useState('');
  const [customModel, setCustomModel] = useState('');
  const [customYear, setCustomYear] = useState('');
  const searchRef = useRef(null);


  const filteredBrands = useMemo(() => {
    const q = brandSearch.toLowerCase().trim();
    if (!q) return ALL_BRANDS;
    return ALL_BRANDS.filter(b => b.toLowerCase().includes(q));
  }, [brandSearch]);

  const popularFiltered = useMemo(() => filteredBrands.filter(b => POPULAR_BRANDS.includes(b)), [filteredBrands]);
  const otherFiltered   = useMemo(() => filteredBrands.filter(b => !POPULAR_BRANDS.includes(b)), [filteredBrands]);

  const modelsList = useMemo(() => {
    if (!brand || isCustom) return [];
    return VEHICLES_DB[brand] ?? [];
  }, [brand, isCustom]);

  const yearsList = useMemo(() => {
    if (isCustom) return Array.from({ length: 77 }, (_, i) => String(2026 - i));
    if (!model) return [];
    const list = [];
    for (let y = model.endYear; y >= model.startYear; y--) list.push(String(y));
    return list;
  }, [model, isCustom]);

  const isValid = isCustom
    ? !!(customBrand.trim() && customModel.trim() && customYear)
    : !!(brand && model && year);

  function selectBrand(b) {
    setBrand(b); setModel(null); setYear('');
    setBrandSearch(''); setIsCustom(false);
    setStep('model');
  }

  function selectModel(m) { setModel(m); setYear(''); setStep('year'); }

  function handleCheckout() {
    if (!isValid) return;
    const vehicleName = isCustom
      ? `${customBrand.trim()} ${customModel.trim()} (${customYear})`
      : `${brand} ${model.name} (${year})`;
    if (onCheckout) onCheckout(vehicleName);
    else window.location.href = buyUrl;
  }

  function reset() {
    setBrand(null); setModel(null); setYear('');
    setIsCustom(false); setCustomBrand(''); setCustomModel(''); setCustomYear('');
    setStep('brand'); setBrandSearch('');
  }

  // ── STEP BRAND ───────────────────────────────────────────────────────────
  if (step === 'brand') {
    return (
      <div className="space-y-3">
        {/* Progress */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-[#111827] text-white text-[11px] font-black flex-shrink-0">1</div>
          <div className="h-px flex-1 bg-gray-200" />
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-200 text-gray-400 text-[11px] font-black flex-shrink-0">2</div>
          <div className="h-px flex-1 bg-gray-200" />
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-200 text-gray-400 text-[11px] font-black flex-shrink-0">3</div>
        </div>
        <p className="text-xs font-bold text-gray-600 -mt-1">Selecione a marca do seu veículo</p>

        {/* Busca */}
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={searchRef}
            type="text"
            value={brandSearch}
            onChange={(e) => setBrandSearch(e.target.value)}
            placeholder="Buscar marca (ex: Toyota, BMW, BYD...)"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border-2 border-gray-200 text-sm focus:border-[#111827] focus:ring-0 outline-none transition-all bg-gray-50"
          />
          {brandSearch && (
            <button onClick={() => setBrandSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 cursor-pointer">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          )}
        </div>

        {/* Grid marcas */}
        <div className="max-h-[300px] overflow-y-auto rounded-xl border-2 border-gray-100 bg-gray-50">
          {popularFiltered.length > 0 && (
            <div className="p-2">
              {!brandSearch && (
                <p className="text-[10px] text-gray-400 uppercase font-bold px-1 pb-1.5 tracking-widest">Mais populares</p>
              )}
              <div className="grid grid-cols-2 gap-1.5">
                {popularFiltered.map(b => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => selectBrand(b)}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white border-2 border-transparent hover:border-[#111827] hover:shadow-md transition-all duration-150 group text-left cursor-pointer"
                  >
                    <BrandLogo brand={b} size={32} />
                    <span className="text-xs font-bold text-gray-700 group-hover:text-[#111827] truncate leading-tight">{b}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {otherFiltered.length > 0 && (
            <div className="p-2 border-t-2 border-gray-100">
              {!brandSearch && (
                <p className="text-[10px] text-gray-400 uppercase font-bold px-1 pb-1.5 tracking-widest">Todas as marcas</p>
              )}
              <div className="grid grid-cols-2 gap-1.5">
                {otherFiltered.map(b => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => selectBrand(b)}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white border-2 border-transparent hover:border-[#111827] hover:shadow-md transition-all duration-150 group text-left cursor-pointer"
                  >
                    <BrandLogo brand={b} size={32} />
                    <span className="text-xs font-bold text-gray-700 group-hover:text-[#111827] truncate leading-tight">{b}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {filteredBrands.length === 0 && (
            <div className="p-6 text-center text-gray-400 text-sm">
              Marca não encontrada.
              <button type="button" onClick={() => { setIsCustom(true); setStep('model'); }}
                className="mt-2 block mx-auto text-[#111827] font-bold underline text-xs cursor-pointer">
                Digitar manualmente →
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => { setIsCustom(true); setStep('model'); }}
          className="w-full text-center text-xs text-gray-400 hover:text-[#111827] transition py-0.5 cursor-pointer"
        >
          Meu carro não está na lista →
        </button>
      </div>
    );
  }

  // ── STEP MODEL ───────────────────────────────────────────────────────────
  if (step === 'model') {
    return (
      <div className="space-y-3">
        {/* Progress */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-200 text-gray-400 text-[11px] font-black flex-shrink-0">✓</div>
          <div className="h-px flex-1 bg-[#111827]" />
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-[#111827] text-white text-[11px] font-black flex-shrink-0">2</div>
          <div className="h-px flex-1 bg-gray-200" />
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-200 text-gray-400 text-[11px] font-black flex-shrink-0">3</div>
        </div>

        {/* Back */}
        <button type="button" onClick={reset}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-[#111827] transition cursor-pointer group -mt-1">
          <svg className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
          </svg>
          Trocar marca
        </button>

        {/* Marca atual */}
        {!isCustom && brand && (
          <div className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 border-2 border-gray-200 rounded-xl">
            <BrandLogo brand={brand} size={36} />
            <div>
              <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Marca</p>
              <p className="text-sm font-black text-[#111827]">{brand}</p>
            </div>
            <span className="ml-auto text-emerald-500 text-lg">✓</span>
          </div>
        )}

        <p className="text-xs font-bold text-gray-600">
          {isCustom ? 'Digite os dados do seu veículo' : 'Selecione o modelo'}
        </p>

        {isCustom ? (
          <div className="space-y-2.5">
            <input type="text" value={customBrand} onChange={(e) => setCustomBrand(e.target.value)}
              placeholder="Marca (ex: Ferrari)" autoFocus
              className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-sm focus:border-[#111827] focus:ring-0 outline-none transition-all" />
            <input type="text" value={customModel} onChange={(e) => setCustomModel(e.target.value)}
              placeholder="Modelo (ex: Roma)"
              className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-sm focus:border-[#111827] focus:ring-0 outline-none transition-all" />
            <select value={customYear} onChange={(e) => setCustomYear(e.target.value)}
              className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-sm focus:border-[#111827] focus:ring-0 outline-none transition-all cursor-pointer">
              <option value="">Selecione o ano...</option>
              {Array.from({ length: 77 }, (_, i) => 2026 - i).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <button type="button" id={id} disabled={!(customBrand.trim() && customModel.trim() && customYear)}
              onClick={handleCheckout}
              className="w-full rounded-xl bg-[#FF5A00] py-3.5 text-sm font-black text-white uppercase tracking-wide shadow-lg hover:bg-[#e64f00] disabled:bg-gray-300 disabled:text-gray-400 disabled:shadow-none disabled:cursor-not-allowed transition-all duration-200 cursor-pointer">
              {customBrand.trim() && customModel.trim() && customYear ? 'Comprar agora' : 'Preencha todos os campos'}
            </button>
          </div>
        ) : (
          <div className="max-h-[260px] overflow-y-auto rounded-xl border-2 border-gray-100 bg-gray-50 space-y-0.5 p-1.5">
            {modelsList.map((m) => (
              <button key={m.name} type="button" onClick={() => selectModel(m)}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg bg-white border-2 border-transparent hover:border-[#111827] hover:shadow-sm transition-all duration-150 text-left cursor-pointer group">
                <span className="text-sm text-gray-700 font-semibold group-hover:text-[#111827]">{m.name}</span>
                <span className="text-[10px] text-gray-400 ml-2 flex-shrink-0 font-medium">{m.startYear}–{m.endYear}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── STEP YEAR ────────────────────────────────────────────────────────────
  if (step === 'year') {
    return (
      <div className="space-y-3">
        {/* Progress */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-200 text-gray-500 text-[10px] font-black flex-shrink-0">✓</div>
          <div className="h-px flex-1 bg-[#111827]" />
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-200 text-gray-500 text-[10px] font-black flex-shrink-0">✓</div>
          <div className="h-px flex-1 bg-[#111827]" />
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-[#111827] text-white text-[11px] font-black flex-shrink-0">3</div>
        </div>

        {/* Back */}
        <button type="button" onClick={() => { setStep('model'); setYear(''); }}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-[#111827] transition cursor-pointer group -mt-1">
          <svg className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
          </svg>
          Trocar modelo
        </button>

        {/* Resumo */}
        <div className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 border-2 border-gray-200 rounded-xl">
          <BrandLogo brand={brand} size={36} />
          <div>
            <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">{brand}</p>
            <p className="text-sm font-black text-[#111827]">{model?.name}</p>
          </div>
          <span className="ml-auto text-emerald-500 text-lg">✓</span>
        </div>

        <p className="text-xs font-bold text-gray-600">Selecione o ano do veículo</p>

        {/* Grid anos */}
        <div className="grid grid-cols-4 gap-1.5 max-h-[200px] overflow-y-auto rounded-xl border-2 border-gray-100 bg-gray-50 p-2">
          {yearsList.map((y) => (
            <button key={y} type="button" onClick={() => setYear(y)}
              className={`py-2.5 rounded-lg text-sm font-bold transition-all duration-150 cursor-pointer border-2 ${
                year === y
                  ? 'bg-[#111827] text-white border-[#111827] shadow-md scale-105'
                  : 'bg-white border-gray-200 text-gray-700 hover:border-[#111827] hover:text-[#111827]'
              }`}>
              {y}
            </button>
          ))}
        </div>

        {/* CTA */}
        <button type="button" onClick={handleCheckout} disabled={!year} id={id}
          className="w-full rounded-xl bg-[#FF5A00] py-4 text-sm font-black text-white uppercase tracking-wider shadow-lg hover:bg-[#e64f00] hover:shadow-xl hover:-translate-y-0.5 disabled:bg-gray-300 disabled:text-gray-400 disabled:shadow-none disabled:translate-y-0 disabled:cursor-not-allowed transition-all duration-200 cursor-pointer">
          {year ? `Comprar agora — ${model?.name} ${year}` : 'Selecione o ano acima'}
        </button>
      </div>
    );
  }

  return null;
}
