import { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import VehicleSelector from './components/VehicleSelector';
import Accordion from './components/Accordion';
import Checkout from './components/Checkout';
import Ticker from './components/Ticker';
import { CHECKOUT_URLS } from './data/vehicles';
import { trackMetaEvent, generateEventId } from './utils/metaPixel';

export default function App() {
  const images = [
    '/produto-1.jpg',
    '/produto-2.jpg',
    '/produto-3.webp',
    '/produto-4.webp'
  ];

  const [activeImgIndex, setActiveImgIndex] = useState(0);
  const [selectedKit, setSelectedKit] = useState('premium'); // 'basico' or 'premium'
  const [showCheckout, setShowCheckout] = useState(false);
  const [addedUpsells, setAddedUpsells] = useState([]);
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [locationText, setLocationText] = useState('sua região');

  // Rastreia o evento ViewContent no carregamento inicial da Landing Page e busca localização do lead
  useEffect(() => {
    const eventId = generateEventId();
    trackMetaEvent('ViewContent', eventId, {
      content_name: 'Tapete Bandeja Premium Sob Medida + Lixeira de Brinde',
      content_category: 'Automotivo',
      value: 72.90,
      currency: 'BRL'
    });

    const fetchLocation = async () => {
      try {
        const response = await fetch('https://ipapi.co/json/');
        if (response.ok) {
          const data = await response.json();
          if (data.city && data.region_code) {
            setLocationText(`${data.city} - ${data.region_code}`);
            return;
          }
        }
      } catch (e) {
        console.log('Erro no ipapi.co, tentando ipwhois...');
      }

      try {
        const response = await fetch('https://ipwhois.app/json/');
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.city && data.region_code) {
            setLocationText(`${data.city} - ${data.region_code}`);
          }
        }
      } catch (e) {
        console.log('Erro ao buscar localização.');
      }
    };
    fetchLocation();
  }, []);

  // Calculate pricing values dynamically
  const originalPrice = selectedKit === 'basico' ? 197.00 : 297.00;
  const currentPrice = selectedKit === 'basico' ? 72.90 : 124.90;
  const savings = originalPrice - currentPrice;


  if (showCheckout) {
    return (
      <Checkout
        vehicle={selectedVehicle}
        kit={selectedKit}
        upsellItems={addedUpsells}
        onClose={() => {
          setShowCheckout(false);
          setAddedUpsells([]);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-white text-[#111827]">
      {/* 0. Scrolling Ticker */}
      <Ticker />

      {/* 2. Navbar */}
      <Navbar />

      {/* 3. Hero / Product Configurator Section */}
      <section id="produto" className="max-w-7xl mx-auto px-4 py-6 lg:py-10 grid lg:grid-cols-2 gap-8 lg:gap-12">
        {/* Left Column: Image Gallery */}
        <div>
          <div className="bg-gray-50 rounded-2xl overflow-hidden aspect-square border border-gray-100 shadow-inner">
            <img
              src={images[activeImgIndex]}
              alt="Tapete automotivo premium"
              className="w-full h-full object-cover transition-all duration-300"
              width="1024"
              height="1024"
            />
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {images.map((img, idx) => (
              <button
                key={idx}
                onClick={() => setActiveImgIndex(idx)}
                className={`aspect-square rounded-lg overflow-hidden border-2 transition duration-150 ${
                  activeImgIndex === idx ? 'border-[#FF5A00]' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <img src={img} alt={`Miniatura ${idx + 1}`} className="w-full h-full object-cover" loading="lazy" />
              </button>
            ))}
          </div>
        </div>

        {/* Right Column: Product details & selection */}
        <div>
          <span className="inline-block bg-[#FF5A00] text-white text-xs font-bold px-3 py-1 rounded">
            -40% OFF
          </span>
          
          <h1 className="mt-3 text-2xl sm:text-3xl lg:text-4xl font-extrabold leading-tight text-[#111827]">
            Tapete Bandeja Premium 100% Sob Medida Para Seu Veículo + Lixeira Portátil para Carro
          </h1>

          {/* Ratings & Social Proof */}
          <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
            <div className="flex items-center gap-0.5" aria-label="5 estrelas">
              {Array.from({ length: 5 }).map((_, i) => (
                <svg key={i} width="16" height="16" viewBox="0 0 24 24" fill="#FF5A00">
                  <path d="M12 2l2.9 6.9L22 10l-5.5 4.8L18.2 22 12 18.3 5.8 22l1.7-7.2L2 10l7.1-1.1L12 2z"></path>
                </svg>
              ))}
            </div>
            <span className="font-semibold text-[#111827]">(4.9)</span>
            <span>· 2.847 avaliações</span>
          </div>

          {/* Shopee Official Partner trust notice */}
          <div className="mt-4 bg-[#FFF5F2] border border-[#FFE2DA] rounded-xl px-4 py-3 text-sm text-gray-700 flex items-center gap-4">
            <svg viewBox="0 0 264.00031 375.41" className="h-10 w-auto flex-shrink-0" xmlns="http://www.w3.org/2000/svg">
              <path d="m174.212 201.122c-1.496 12.868-9.297 23.287-21.379 28.438-6.77 2.854-15.811 4.418-23.063 3.953-11.157-.465-21.616-3.229-31.378-8.137-3.377-1.859-8.581-5.344-12.551-8.598-.979-.93-1.143-1.395-.433-2.357.312-.564 1.009-1.596 2.438-3.686 2.179-3.081 2.412-3.488 2.644-3.883.697-1 1.759-1.091 2.869-.301.152.155.152.155.236.23.148.162.148.162.546.465.411.315.709.465.782.643 10.461 8.189 22.638 12.838 34.931 13.303 17.063-.23 29.325-7.902 31.584-19.758 2.326-12.903-7.843-24.167-27.729-30.448-6.265-1.859-22.031-8.156-24.942-9.908-13.629-7.983-20.026-18.461-19.096-31.455 1.395-17.958 18.078-31.324 39.163-31.441 9.359 0 18.793 1.951 27.743 5.716 3.228 1.373 8.989 4.494 10.905 5.986 1.15.852 1.395 1.781.686 2.822-.236.635-.93 1.581-2.128 3.609v0c-1.747 2.664-1.812 2.775-2.129 3.361-.622.978-1.511 1.056-2.695.356-9.566-6.506-20.356-9.762-32.145-9.994-14.643.232-25.653 8.96-26.362 20.919-.146 10.743 7.877 18.569 25.252 24.462 35.339 11.385 48.819 24.686 46.251 45.703m-43.576-185.385c22.96 0 41.717 21.785 42.646 49.095h-85.237c.82-27.31 19.632-49.095 42.591-49.095m119.001 54.269c0-2.85-2.206-5.174-5.021-5.174h-.184-55.101c-1.394-36.032-27.168-64.832-58.695-64.832-31.546 0-57.253 28.8-58.628 64.832h-55.332c-2.775.063-4.977 2.336-4.977 5.174 0 .164 0 .236 0 .4h-.063l7.859 173.798c0 .47.092.944.092 1.509 0 .11.015.144.015.351v.266l.058.092c1.183 12.117 9.937 21.777 21.901 22.25v.092h175.509c.092 0 .146 0 .237 0 .136 0 .136 0 .236 0h .364v-.092c12.134-.295 22.069-10.133 23.016-22.383v0l .053-.225c0-.115 0-.24 0-.351 0-.354.092-.579.092-.947l8.569-174.524v0c0-.064 0-.163 0-.236" fill="#EE4D2D" transform="translate(2.0003134 2)"/>
              <path d="m230.675 327.736c1.523-4.819 5.84-7.896 10.92-7.896 4.979 0 9.646 3.324 11.17 7.896l.248.259h-22.383zm27.174 6.861c.069 0 .069 0 .179 0 .071 0 .071 0 .071 0 1.016-.021 1.901-1.016 1.901-2.034 0-.133-.004-.248-.014-.258.004 0 .004 0 .004-.117 0-10.547-8.241-18.921-18.397-18.921-10.13 0-18.281 8.374-18.281 18.921 0 .811 0 1.614.147 2.406l.012.003.07.23c.499 3.714 2.056 7.128 4.595 9.926v0c2.795 3.134 6.602 5.327 10.918 6.094v0 0h .254c.254 0 .292 0 .508.053 5.586.704 10.623-.053 14.729-2.186 1.016-.54 2.031-1.173 2.791-1.681.256-.249.508-.484.764-.548 0-.209.13-.209.234-.209.848-1.016.994-1.337.33-2.29-.564-1.016-1.074-1.772-1.58-2.539-.256-.249-.296-.508-.508-.612 0-.145 0-.145-.004-.145-.024 0-.024 0-.054 0h-.012c-.53-.767-.946-.767-1.454-.259-.026 0-.256.259-.26.259-4.059 3.555-9.645 4.757-15.126 3.555-1.037-.259-1.909-.571-2.897-1.016-3.36-1.782-5.838-4.829-6.602-8.384v-.249h27.682zm-70.842-6.861c1.523-4.819 5.832-7.896 10.945-7.896 5.006 0 9.615 3.324 11.17 7.896l.223.259h-22.342zm27.219 6.861c.076 0 .076 0 .186 0 .016 0 .016 0 .016 0 1.016-.021 1.957-1.016 1.957-2.034 0-.133-.004-.248-.014-.258.002 0 .002 0 .002-.117 0-10.547-8.297-18.921-18.434-18.921-10.09 0-18.303 8.374-18.303 18.921 0 .811 0 1.614.207 2.406l.014.003.041.23c.508 3.714 2.031 7.128 4.57 9.926v0c2.785 3.134 6.602 5.327 10.91 6.094v0 0h .265c.243 0 .341 0 .503.053 5.586.704 10.664-.053 14.727-2.186 1.022-.54 2.031-1.173 2.791-1.681.256-.249.508-.484.764-.548 0-.209.186-.209.252-.209.886-1.016 1.014-1.337.366-2.29-.618-1.016-1.126-1.772-1.634-2.539-.254-.249-.258-.508-.508-.612 0-.145 0-.145 0-.145 0 0 0 0-.004 0h-.01c-.531-.767-1.002-.767-1.51-.259l-.258.259c-4.063 3.555-9.648 4.757-15.072 3.555-1.038-.259-1.936-.571-2.949-1.016-3.313-1.782-5.848-4.829-6.597-8.384l-.005-.249h27.727zm-60.489 10.405c-6.85 0-12.436-5.329-12.635-12.189v-.633c.199-6.724 5.785-12.164 12.635-12.164 6.863 0 12.521 5.613 12.521 12.55.001 6.85-5.657 12.436-12.521 12.436m0-31.664c-4.549 0-8.795 1.525-12.197 4.324l-.438.412v-3.543c0-1.016-.136-1.193-1.128-1.193h-4.35c-.983 0-1.158.178-1.158 1.193v55.761c0 .866.175 1.118 1.158 1.118h4.35c.971 0 1.128-.252 1.128-1.118v-23.259l.438.259c3.404 2.788 7.648 4.312 12.197 4.312 10.662 0 19.295-8.536 19.295-19.038 0-10.665-8.633-19.228-19.295-19.228m-45.253 31.176c-6.988 0-12.573-5.492-12.573-12.324 0-6.83 5.586-12.324 12.573-12.324 6.977 0 12.57 5.494 12.57 12.324.001 6.831-5.593 12.324-12.57 12.324m0-31.247c-10.665 0-19.299 8.374-19.299 18.947 0 10.508 8.634 18.884 19.299 18.884 10.664 0 19.303-8.376 19.303-18.884 0-10.573-8.639-18.947-19.303-18.947m-43.039.358c-3.83 0-7.619 1.223-10.765 3.574l-.377.321v-25.901c0-.953-.284-1.205-1.136-1.205h-4.606c-.891 0-1.144.252-1.144 1.205v58.973c0 1.012.254 1.271 1.144 1.271h4.606c.852 0 1.136-.303 1.136-1.271v-19.301c.097-6.05 5.047-10.913 11.143-10.913 6.208 0 11.169 4.923 11.169 11.02v19.194c0 1.012.176 1.271 1.145 1.271h4.571c1.015 0 1.14-.259 1.14-1.271v-19.303c-.001-9.648-8.126-17.664-18.026-17.664m-63.991 27.492l-.011.041c-.683.959-.987 1.305-1.123 1.563-.51.757-.429 1.152.373 1.772 1.788 1.523 4.194 3.047 5.783 3.813 4.443 2.28 9.209 3.298 14.304 3.55 3.279.037 7.464-.76 10.513-2.026 5.585-2.539 9.133-7.368 9.737-13.273.991-9.658-5.294-15.672-21.448-20.525l-.011-.003c-7.573-2.514-11.121-5.775-11.122-10.201.246-5.006 4.869-8.813 11.132-9.03 4.984.031 9.427 1.462 13.825 4.281.932.509 1.314.392 1.95-.473.091-.034.254-.292 1.127-1.559h.005c.769-1.024 1.023-1.524 1.026-1.524.533-1.016.505-1.431-.483-2.031-.914-.764-3.514-2.031-4.979-2.664-4.188-1.654-8.503-2.414-12.74-2.414-9.73.252-17.342 6.602-17.849 14.888-.264 5.935 2.781 10.753 9.132 14.308 1.779 1.016 8.257 3.479 11.303 4.323 8.633 2.539 13.193 7.167 12.204 12.695-.788 5.071-6.052 8.374-13.361 8.609-5.324-.235-10.717-2.106-15.35-5.563-.021-.003-.136-.221-.38-.259-.293-.249-.293-.249-.377-.265-.898-.751-1.512-.737-2.037.265-.118.001-.806 1.117-1.143 1.702" fill="#EE4D2D" transform="translate(2.0003134 2)"/>
            </svg>
            <div className="flex-1 text-sm text-gray-700 leading-normal">
              <span className="font-bold text-[#EE4D2D]">Parceiro Oficial da Shopee</span>
              <span className="mx-1.5 text-gray-300">·</span>
              <span>Sua compra é 100% segura e garantida com o suporte oficial Shopee.</span>
            </div>
          </div>

          {/* Pricing Box */}
          <div className="mt-5">
            <div className="text-sm text-gray-400 line-through">
              R$ {originalPrice.toFixed(2).replace('.', ',')}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-extrabold text-[#FF5A00]">
                R$ {currentPrice.toFixed(2).replace('.', ',')}
              </span>
              <span className="text-sm text-gray-500 font-medium">à vista no PIX</span>
            </div>
          </div>

          {/* PIX Discount Notice */}
          <div className="mt-3 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-xl px-4 py-3 text-sm font-medium flex items-center gap-2">
            <svg viewBox="308 0 36 24" className="h-5 w-auto text-[#32B4A4] flex-shrink-0" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M322.844 15.4258C323.094 15.4267 323.341 15.378 323.571 15.2826C323.802 15.1872 324.011 15.0469 324.187 14.87L326.124 12.9324C326.193 12.8668 326.284 12.8302 326.38 12.8302C326.474 12.8302 326.566 12.8668 326.635 12.9324L328.58 14.878C328.756 15.0547 328.965 15.1947 329.196 15.29C329.426 15.3852 329.674 15.4339 329.923 15.433H330.305L327.85 17.8873C327.667 18.0698 327.451 18.2147 327.213 18.3135C326.975 18.4123 326.719 18.4632 326.462 18.4632C326.204 18.4632 325.948 18.4123 325.71 18.3135C325.472 18.2147 325.256 18.0698 325.073 17.8873L322.608 15.4258H322.844ZM329.923 8.56908C329.674 8.56832 329.427 8.61703 329.196 8.71235C328.966 8.80769 328.757 8.94775 328.58 9.12447L326.638 11.071C326.571 11.1384 326.479 11.1764 326.38 11.1764C326.288 11.1764 326.196 11.1384 326.128 11.071L324.191 9.13285C324.015 8.95591 323.806 8.81565 323.575 8.72024C323.345 8.62483 323.098 8.57616 322.848 8.57707H322.608L325.073 6.11395C325.442 5.74585 325.941 5.53906 326.462 5.53906C326.982 5.53906 327.481 5.74585 327.85 6.11395L330.305 8.56867L329.923 8.56908Z" fill="currentColor" />
              <path d="M320.575 10.6108L322.041 9.14431H322.844C323.196 9.1447 323.534 9.28408 323.784 9.53156L325.721 11.4693C325.808 11.5561 325.91 11.625 326.024 11.672C326.137 11.7191 326.258 11.7432 326.38 11.7432C326.503 11.7432 326.624 11.7191 326.737 11.672C326.85 11.625 326.953 11.5561 327.039 11.4693L328.984 9.52399C329.234 9.27623 329.572 9.13702 329.924 9.13672H330.876L332.348 10.6092C332.716 10.9774 332.923 11.4767 332.923 11.9973C332.923 12.5179 332.716 13.0172 332.348 13.3854L330.876 14.8579H329.923C329.571 14.8579 329.233 14.7181 328.983 14.4707L327.039 12.5245C326.861 12.3551 326.625 12.2605 326.38 12.2605C326.134 12.2605 325.899 12.3551 325.721 12.5245L323.783 14.4623C323.533 14.7097 323.196 14.8495 322.844 14.8495H322.041L320.575 13.387C320.393 13.2048 320.248 12.9884 320.15 12.7501C320.051 12.512 320 12.2568 320 11.9989C320 11.7411 320.051 11.4858 320.15 11.2476C320.248 11.0095 320.393 10.7931 320.575 10.6108Z" fill="currentColor" />
            </svg>
            5% de desconto no pagamento via PIX
          </div>

          {/* Savings Badge */}
          <div className="mt-3 bg-orange-50 border border-orange-100 text-[#111827] rounded-xl px-4 py-3 text-sm">
            🎉 Você está economizando <b className="text-[#FF5A00]">R$ {savings.toFixed(2).replace('.', ',')}</b> nesta oferta!
          </div>


          {/* Real-time viewers */}
          <div className="mt-3 text-sm text-gray-600 flex items-center gap-2">
            <span className="animate-pulse-fast text-red-500">👁️</span>
            <span>
              <b className="text-[#111827]">47 pessoas</b> estão vendo este produto agora
            </span>
          </div>

          {/* Vehicle Configurator Selector */}
          <div className="mt-6 bg-gradient-to-br from-[#FFFBF9] to-white rounded-2xl p-5 border border-[#FFE2DA]/70 shadow-sm">
            <label className="block text-sm font-extrabold mb-3 text-[#111827]">Selecione o seu Veículo</label>
            <VehicleSelector 
              id="cta-hero" 
              buyUrl={CHECKOUT_URLS[selectedKit]} 
              onCheckout={(vehicleInfo) => {
                setSelectedVehicle(vehicleInfo);
                setShowCheckout(true);
              }}
            />
            {/* Trust badges below CTA */}
            <div className="mt-4 flex flex-wrap justify-center items-center gap-x-6 gap-y-2 text-[11px] text-gray-500 font-semibold border-t border-gray-100 pt-3">
              <span className="flex items-center gap-1.5">🔒 Compra Segura</span>
              <span className="flex items-center gap-1.5">🚚 Frete com Rastreio</span>
              <span className="flex items-center gap-1.5">🔄 7 Dias de Garantia</span>
            </div>
          </div>

          {/* Kit Selection Card Option */}
          <div className="mt-6">
            <h3 className="font-bold mb-3 text-[#111827]">Escolha seu Kit</h3>
            <div className="space-y-3">
              {/* Basic Kit */}
              <label
                onClick={() => setSelectedKit('basico')}
                className={`block border-2 rounded-xl p-4 cursor-pointer transition ${
                  selectedKit === 'basico' ? 'border-[#FF5A00] bg-orange-50/40 shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="kit"
                      checked={selectedKit === 'basico'}
                      onChange={() => setSelectedKit('basico')}
                      className="mt-1 accent-[#FF5A00] h-4 w-4"
                    />
                    <div>
                      <div className="font-bold text-[#111827]">Kit Essencial Cabine (Sem Porta-Malas)</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-extrabold text-[#111827]">R$ 72,90</div>
                    <div className="text-xs text-gray-400 line-through">R$ 197,00</div>
                  </div>
                </div>
                <ul className="mt-3 ml-7 space-y-1 text-sm text-gray-600">
                  <li>✔ 3 tapetes internos cortados sob medida</li>
                  <li>✔ Proteção completa contra sujeira, líquidos e desgaste</li>
                  <li>🎁 Brinde: Lixeira Premium para Carro</li>
                </ul>
              </label>

              {/* Premium Kit */}
              <label
                onClick={() => setSelectedKit('premium')}
                className={`block border-2 rounded-xl p-4 cursor-pointer transition relative ${
                  selectedKit === 'premium' 
                    ? 'border-[#FF5A00] bg-[#FFF8F6] shadow-lg ring-1 ring-[#FF5A00]' 
                    : 'border-orange-200/60 bg-orange-50/10 hover:border-orange-300 shadow-sm'
                }`}
              >
                <span className="absolute -top-2.5 right-4 bg-gradient-to-r from-orange-500 to-red-500 text-white text-[10px] font-extrabold px-3 py-1 rounded-full shadow-md uppercase tracking-wider">
                  Mais Vendido
                </span>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="kit"
                      checked={selectedKit === 'premium'}
                      onChange={() => setSelectedKit('premium')}
                      className="mt-1 accent-[#FF5A00] h-4 w-4"
                    />
                    <div>
                      <div className="font-bold text-[#111827] text-base md:text-lg">Kit Premium Completo (Cabine + Porta-Malas)</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-extrabold text-[#FF5A00] text-lg">R$ 124,90</div>
                    <div className="text-xs text-gray-400 line-through">R$ 297,00</div>
                  </div>
                </div>
                <ul className="mt-3 ml-7 space-y-1 text-sm text-gray-700 font-medium">
                  <li className="text-emerald-700">✔ Cobertura total (Cabine + Porta-Malas)</li>
                  <li>✔ Tapete traseiro inteiriço com cobertura do túnel central</li>
                  <li>✔ Mantém o carpete original novo e intacto</li>
                  <li>🎁 Brinde: Lixeira Premium para Carro</li>
                </ul>
              </label>
            </div>
          </div>

          {/* Accordion list */}
          <div className="mt-8">
            <Accordion />
          </div>
        </div>
      </section>

      {/* 4. Benefits / Features Section */}
      <section id="beneficios" className="bg-white border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-4 py-12 text-center">
          <div className="text-xs font-bold tracking-widest text-[#FF5A00] uppercase">Como Ele Protege</div>
          <h2 className="text-2xl sm:text-3xl font-extrabold mt-2 text-[#111827]">
            Por Que Escolher Nosso Tapete?
          </h2>
          <p className="mt-2 text-sm text-gray-600 max-w-2xl mx-auto">
            Cada detalhe foi pensado para proteger seu carro e oferecer praticidade no dia a dia.
          </p>
        </div>

        {/* Feature 1 */}
        <div className="bg-white">
          <div className="max-w-6xl mx-auto px-4 py-10 grid md:grid-cols-2 gap-8 items-center">
            <div className="rounded-2xl overflow-hidden shadow-md border border-gray-100">
              <img
                src="/feature-fixacao.jpg"
                alt="Base pinada antiderrapante"
                className="w-full h-auto object-cover"
                loading="lazy"
              />
            </div>
            <div>
              <div className="text-xs font-bold tracking-widest text-[#FF5A00] uppercase">#1 Característica</div>
              <h3 className="text-2xl sm:text-3xl font-extrabold mt-2 text-[#111827]">Base pinada antiderrapante</h3>
              <div className="text-sm font-semibold text-gray-500 mt-1">Borracha Premium de Alta Performance</div>
              <p className="mt-3 text-gray-600 leading-relaxed">
                Fabricado com borracha de altíssima qualidade, nosso tapete oferece durabilidade excepcional e resistência a desgaste. A base pinada garante fixação segura, evitando deslocamentos durante a condução.
              </p>
              <ul className="mt-4 space-y-2">
                <li className="flex items-center gap-2 text-sm text-gray-700">
                  <span className="text-emerald-500 font-bold">✓</span> Material de qualidade automotiva
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-700">
                  <span className="text-emerald-500 font-bold">✓</span> Espessura de 7mm para maior proteção
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-700">
                  <span className="text-emerald-500 font-bold">✓</span> Resistente a raios UV e ressecamento
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-700">
                  <span className="text-emerald-500 font-bold">✓</span> Não deforma com o tempo
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Feature 2 (Alternated) */}
        <div className="bg-[#F3F4F6] border-y border-gray-100">
          <div className="max-w-6xl mx-auto px-4 py-10 grid md:grid-cols-2 gap-8 items-center">
            <div className="rounded-2xl overflow-hidden shadow-md border border-gray-100 md:order-2">
              <img
                src="/feature-highlight-2.webp"
                alt="Praticidade no dia a dia"
                className="w-full h-auto object-cover"
                loading="lazy"
              />
            </div>
            <div className="md:order-1">
              <div className="text-xs font-bold tracking-widest text-[#FF5A00] uppercase">#2 Característica</div>
              <h3 className="text-2xl sm:text-3xl font-extrabold mt-2 text-[#111827]">Praticidade no dia a dia</h3>
              <div className="text-sm font-semibold text-gray-500 mt-1">100% Impermeável e Fácil de Limpar</div>
              <p className="mt-3 text-gray-600 leading-relaxed">
                Bordas elevadas que contêm qualquer líquido derramado, protegendo o assoalho original do seu veículo. Limpeza simples: basta remover e lavar com água.
              </p>
              <ul className="mt-4 space-y-2">
                <li className="flex items-center gap-2 text-sm text-gray-700">
                  <span className="text-emerald-500 font-bold">✓</span> Bordas elevadas de 5cm
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-700">
                  <span className="text-emerald-500 font-bold">✓</span> Contém água, lama e areia
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-700">
                  <span className="text-emerald-500 font-bold">✓</span> Limpa em segundos com água
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Feature 3 */}
        <div className="bg-white">
          <div className="max-w-6xl mx-auto px-4 py-10 grid md:grid-cols-2 gap-8 items-center">
            <div className="rounded-2xl overflow-hidden shadow-md border border-gray-100">
              <img
                src="/feature-ilhos.jpg"
                alt="Instalação perfeita e segura"
                className="w-full h-auto object-cover"
                loading="lazy"
              />
            </div>
            <div>
              <div className="text-xs font-bold tracking-widest text-[#FF5A00] uppercase">#3 Característica</div>
              <h3 className="text-2xl sm:text-3xl font-extrabold mt-2 text-[#111827]">Instalação perfeita e segura</h3>
              <div className="text-sm font-semibold text-gray-500 mt-1">Ilhós de Fixação Original</div>
              <p className="mt-3 text-gray-600 leading-relaxed">
                Sistema de fixação idêntico ao original de fábrica. Os ilhós de alta resistência garantem que o tapete permaneça sempre no lugar, proporcionando máxima segurança.
              </p>
              <ul className="mt-4 space-y-2">
                <li className="flex items-center gap-2 text-sm text-gray-700">
                  <span className="text-emerald-500 font-bold">✓</span> Ilhós metálicos reforçados
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-700">
                  <span className="text-emerald-500 font-bold">✓</span> Compatível com fixadores originais
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-700">
                  <span className="text-emerald-500 font-bold">✓</span> Instalação em menos de 1 minuto
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-700">
                  <span className="text-emerald-500 font-bold">✓</span> Não interfere nos pedais
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Feature 4 (Alternated) */}
        <div className="bg-[#F3F4F6] border-t border-gray-100">
          <div className="max-w-6xl mx-auto px-4 py-10 grid md:grid-cols-2 gap-8 items-center">
            <div className="rounded-2xl overflow-hidden shadow-md border border-gray-100 md:order-2">
              <img
                src="/feature-highlight-1.webp"
                alt="Encaixe perfeito garantido"
                className="w-full h-auto object-cover"
                loading="lazy"
              />
            </div>
            <div className="md:order-1">
              <div className="text-xs font-bold tracking-widest text-[#FF5A00] uppercase">#4 Característica</div>
              <h3 className="text-2xl sm:text-3xl font-extrabold mt-2 text-[#111827]">Encaixe perfeito garantido</h3>
              <div className="text-sm font-semibold text-gray-500 mt-1">100% Sob Medida Para Seu Veículo</div>
              <p className="mt-3 text-gray-600 leading-relaxed">
                Cada tapete é fabricado especialmente para o modelo do seu carro, utilizando moldes exclusivos que garantem cobertura total e acabamento impecável.
              </p>
              <ul className="mt-4 space-y-2">
                <li className="flex items-center gap-2 text-sm text-gray-700">
                  <span className="text-emerald-500 font-bold">✓</span> Moldes exclusivos por modelo
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-700">
                  <span className="text-emerald-500 font-bold">✓</span> Cobertura total do assoalho
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-700">
                  <span className="text-emerald-500 font-bold">✓</span> Acabamento premium
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-700">
                  <span className="text-emerald-500 font-bold">✓</span> Valoriza o interior do veículo
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 5. 8 Reasons to Choose Section */}
      <section className="bg-gradient-to-b from-white to-gray-50/50 py-16 border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="text-xs font-bold tracking-widest text-[#FF5A00] uppercase">Diferenciais CarTapetes</span>
            <h2 className="text-2xl sm:text-3xl font-extrabold mt-2 text-[#111827]">
              8 Razões para Escolher Nossos Tapetes
            </h2>
            <p className="mt-3 text-sm text-gray-500 max-w-lg mx-auto">
              Nossa engenharia e seleção de materiais oferecem o mais alto nível de proteção, durabilidade e sofisticação para o seu veículo.
            </p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: (
                  <svg className="w-6 h-6 text-[#FF5A00]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                ),
                bgClass: 'bg-orange-50',
                title: 'Proteção Total',
                desc: 'Protege integralmente contra água, lama, sujeira e resíduos químicos.'
              },
              {
                icon: (
                  <svg className="w-6 h-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z" />
                  </svg>
                ),
                bgClass: 'bg-blue-50',
                title: 'Impermeável',
                desc: 'Material 100% à prova d\'água que impede a penetração de qualquer líquido.'
              },
              {
                icon: (
                  <svg className="w-6 h-6 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 21l18-18M8.5 7.5l2 2m2.5-4.5l2 2m2.5-4.5l2 2m-11 11l2 2m2.5-4.5l2 2m2.5-4.5l2 2" />
                  </svg>
                ),
                bgClass: 'bg-purple-50',
                title: 'Sob Medida',
                desc: 'Escaneamento 3D exclusivo para encaixe perfeito no modelo do seu veículo.'
              },
              {
                icon: (
                  <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                ),
                bgClass: 'bg-emerald-50',
                title: 'Antiderrapante',
                desc: 'Base com sistema de travamento para fixação 100% segura no assoalho.'
              },
              {
                icon: (
                  <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ),
                bgClass: 'bg-amber-50',
                title: 'Alta Durabilidade',
                desc: 'Borracha premium de altíssima performance resistente ao desgaste diário.'
              },
              {
                icon: (
                  <svg className="w-6 h-6 text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                ),
                bgClass: 'bg-cyan-50',
                title: 'Fácil Limpeza',
                desc: 'Lave em poucos segundos usando apenas água corrente e sabão neutro.'
              },
              {
                icon: (
                  <svg className="w-6 h-6 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                ),
                bgClass: 'bg-rose-50',
                title: 'Instalação Rápida',
                desc: 'Coloque e ajuste no seu carro em menos de 1 minuto sem ferramentas.'
              },
              {
                icon: (
                  <svg className="w-6 h-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138z" />
                  </svg>
                ),
                bgClass: 'bg-indigo-50',
                title: 'Garantia Incondicional',
                desc: 'Garantia total de fábrica por 30 dias para sua completa tranquilidade.'
              }
            ].map((reason, idx) => (
              <div key={idx} className="bg-white border border-gray-100 p-6 rounded-2xl shadow-xs hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex flex-col items-center text-center">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${reason.bgClass}`}>
                  {reason.icon}
                </div>
                <h4 className="font-bold text-gray-900 text-sm md:text-base mb-1">{reason.title}</h4>
                <p className="text-xs text-gray-500 leading-relaxed">{reason.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. Comparison Section */}
      <section className="bg-gray-50 py-16 border-y border-gray-100">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-10">
            <span className="text-xs font-bold tracking-widest text-[#FF5A00] uppercase">Comparativo</span>
            <h2 className="text-2xl sm:text-3xl font-extrabold mt-2 text-[#111827]">
              Nossos Tapetes vs Tapetes Comuns
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              Veja por que o Tapete Bandeja CarTapetes é a escolha inteligente e segura para o seu carro.
            </p>
          </div>

          <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th className="text-left p-5 font-semibold text-gray-700">Diferenciais</th>
                  <th className="p-5 font-extrabold text-[#FF5A00] text-center bg-[#FFF8F6] relative border-x border-orange-100/50">
                    <span className="absolute -top-0 left-1/2 -translate-x-1/2 bg-[#FF5A00] text-white text-[9px] font-black px-2.5 py-0.5 rounded-b-md shadow-xs tracking-wider uppercase">
                      Exclusivo
                    </span>
                    CarTapetes
                  </th>
                  <th className="p-5 font-semibold text-gray-400 text-center">Tapetes Comuns</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {[
                  { name: 'Encaixe 100% Sob Medida', premium: true, common: false },
                  { name: 'Material Impermeável e Lavável', premium: true, common: false },
                  { name: 'Base Antiderrapante Pinada', premium: true, common: false },
                  { name: 'Espessura e Durabilidade de Longa Duração', premium: true, common: false },
                  { name: 'Bordas de Contenção de Líquidos (5cm)', premium: true, common: false },
                  { name: 'Instalação Rápida com Presilhas Originais', premium: true, common: false },
                  { name: 'Garantia Incondicional de 30 Dias', premium: true, common: false },
                  { name: 'Selo RA1000 - Excelência em Atendimento', premium: true, common: false },
                ].map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-50/40 transition-colors duration-150">
                    <td className="p-5 font-semibold text-gray-800">{row.name}</td>
                    <td className="p-5 text-center bg-[#FFF8F6] border-x border-orange-100/50 font-bold text-gray-900">
                      {row.premium ? (
                        <div className="mx-auto w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shadow-xs border border-emerald-200 font-bold">
                          ✓
                        </div>
                      ) : (
                        <div className="mx-auto w-6 h-6 rounded-full bg-red-50 flex items-center justify-center text-red-500 shadow-xs border border-red-100 font-bold">
                          ✗
                        </div>
                      )}
                    </td>
                    <td className="p-5 text-center text-gray-400">
                      {row.common ? (
                        <div className="mx-auto w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shadow-xs border border-emerald-200 font-bold">
                          ✓
                        </div>
                      ) : (
                        <div className="mx-auto w-6 h-6 rounded-full bg-red-50 flex items-center justify-center text-red-400 shadow-xs border border-red-100 font-bold">
                          ✗
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 7. Reclame Aqui Badge Section */}
      <section className="bg-white py-14">
        <div className="max-w-lg mx-auto px-4 text-center">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition duration-200">
            <img
              src="/reclame-aqui-logo.png"
              alt="Reclame Aqui"
              className="h-12 mx-auto object-contain"
              loading="lazy"
            />
            <h3 className="mt-4 text-lg font-bold text-[#111827]">Reputação certificada no Reclame Aqui</h3>
            <p className="mt-2 text-sm text-gray-600 leading-relaxed">
              A CarTapetes possui selo RA1000, a mais alta classificação do Reclame Aqui, concedida exclusivamente a empresas com excelência no atendimento ao consumidor e alto índice de resolução de problemas.
            </p>
            <div className="mt-5 grid grid-cols-3 gap-3 border-t border-gray-100 pt-5">
              <div>
                <div className="text-2xl font-extrabold text-[#111827]">9.2</div>
                <div className="text-[10px] uppercase tracking-wider text-gray-400 mt-0.5">nota geral</div>
              </div>
              <div>
                <div className="text-2xl font-extrabold text-[#111827]">98%</div>
                <div className="text-[10px] uppercase tracking-wider text-gray-400 mt-0.5">resolvidos</div>
              </div>
              <div>
                <div className="text-base font-extrabold text-emerald-600 mt-1">🏆 RA1000</div>
                <div className="text-[10px] uppercase tracking-wider text-gray-400 mt-1">certificado</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7.5 Guarantee Section */}
      <section className="bg-white py-14 border-t border-gray-100">
        <div className="max-w-4xl mx-auto px-4 grid md:grid-cols-3 gap-8 items-center">
          <div className="md:col-span-1 flex justify-center">
            <div className="relative w-40 h-40 flex items-center justify-center bg-orange-50 border-4 border-dashed border-[#FF5A00]/40 rounded-full shadow-inner">
              <span className="text-6xl select-none">🛡️</span>
              <span className="absolute -bottom-2 bg-[#FF5A00] text-white text-[10px] font-black px-3.5 py-1.5 rounded-full uppercase tracking-wider shadow-sm">
                7 dias de garantia
              </span>
            </div>
          </div>
          <div className="md:col-span-2 space-y-4 text-center md:text-left">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#111827] leading-tight">
              Satisfação Garantida ou seu Dinheiro de Volta!
            </h2>
            <p className="text-gray-600 text-sm leading-relaxed">
              Temos tanta certeza da qualidade e do encaixe sob medida do nosso tapete bandeja que oferecemos uma <b>garantia de satisfação incondicional de 7 dias</b>. 
            </p>
            <p className="text-gray-600 text-sm leading-relaxed">
              Se você instalar no seu carro e não gostar do acabamento, do encaixe ou do material, basta entrar em contato com o nosso suporte via WhatsApp. Nós providenciaremos a devolução sem burocracia e reembolsaremos 100% do seu valor pago. O seu risco é zero!
            </p>
          </div>
        </div>
      </section>

      {/* 8. Testimonials Section */}
      <section id="avaliacoes" className="bg-[#F3F4F6] py-14 border-t border-gray-200/50">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-center text-2xl sm:text-3xl font-extrabold mb-8 text-[#111827]">
            O que Nossos Clientes Dizem
          </h2>

          {/* Average Rating Card */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6 max-w-md mx-auto mb-10 shadow-sm flex flex-col sm:flex-row items-center gap-6">
            <div className="text-center sm:border-r sm:border-gray-100 sm:pr-8 flex-shrink-0">
              <div className="text-5xl font-black text-[#111827]">4.9</div>
              <div className="flex items-center gap-0.5 justify-center mt-2" aria-label="4.9 estrelas">
                {Array.from({ length: 5 }).map((_, i) => (
                  <svg key={i} width="18" height="18" viewBox="0 0 24 24" fill="#FF5A00">
                    <path d="M12 2l2.9 6.9L22 10l-5.5 4.8L18.2 22 12 18.3 5.8 22l1.7-7.2L2 10l7.1-1.1L12 2z"></path>
                  </svg>
                ))}
              </div>
              <div className="text-xs text-gray-400 mt-1.5">2.847 avaliações</div>
            </div>
            
            <div className="flex-1 w-full space-y-2">
              {[
                { stars: 5, pct: 82 },
                { stars: 4, pct: 12 },
                { stars: 3, pct: 4 },
                { stars: 2, pct: 1 },
                { stars: 1, pct: 1 }
              ].map((row) => (
                <div key={row.stars} className="flex items-center gap-2 text-xs">
                  <span className="w-3 text-gray-500 font-semibold text-right">{row.stars}</span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-[#FF5A00]" style={{ width: `${row.pct}%` }}></div>
                  </div>
                  <span className="w-8 text-right text-gray-400 font-medium">{row.pct}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Testimonial Cards Grid */}
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                img: '/review-1.jpg',
                name: 'Carlos M.',
                loc: 'São Paulo, SP · 12/03/2026',
                initial: 'C',
                text: '“Tapetes de qualidade excelente! Encaixaram perfeitamente no meu Civic. Já enfrentei dias de chuva e o assoalho ficou completamente seco. Super recomendo!”'
              },
              {
                img: '/review-2.jpg',
                name: 'Ana Paula S.',
                loc: 'Curitiba, PR · 05/03/2026',
                initial: 'A',
                text: '“Comprei o kit completo com porta-malas e valeu cada centavo. O acabamento é impecável e o encaixe é perfeito. Instalei sozinha em 2 minutos.”'
              },
              {
                img: '/review-3.jpg',
                name: 'Roberto F.',
                loc: 'Belo Horizonte, MG · 28/02/2026',
                initial: 'R',
                text: '“Já comprei vários tapetes genéricos e nenhum se compara. Esses são sob medida, não escorregam e a limpeza é muito fácil. Melhor custo-benefício!”'
              }
            ].map((review, idx) => (
              <div key={idx} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 flex flex-col hover:shadow-md transition duration-200">
                <div className="h-48 overflow-hidden bg-gray-50">
                  <img
                    src={review.img}
                    alt={`Foto de ${review.name}`}
                    className="w-full h-full object-cover hover:scale-105 transition duration-300"
                    loading="lazy"
                  />
                </div>
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-0.5" aria-label="5 estrelas">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <svg key={i} width="16" height="16" viewBox="0 0 24 24" fill="#FF5A00">
                          <path d="M12 2l2.9 6.9L22 10l-5.5 4.8L18.2 22 12 18.3 5.8 22l1.7-7.2L2 10l7.1-1.1L12 2z"></path>
                        </svg>
                      ))}
                    </div>
                    <p className="mt-3 text-sm text-gray-600 leading-relaxed italic">{review.text}</p>
                  </div>
                  
                  <div className="mt-5 flex items-center gap-3 border-t border-gray-50 pt-4">
                    <div className="w-9 h-9 rounded-full bg-[#FF5A00] text-white flex items-center justify-center text-sm font-bold shadow-sm">
                      {review.initial}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-[#111827]">{review.name}</div>
                      <div className="text-[10px] text-gray-400 font-medium">{review.loc}</div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 9. Final CTA Selection Block */}
      <section className="bg-gray-50/50 py-16 border-t border-gray-100">
        <div className="max-w-md mx-auto px-4">
          <h2 className="text-center text-2xl sm:text-3xl font-extrabold mb-8 text-[#111827]">Garanta o Seu Agora!</h2>
          <div className="bg-gradient-to-br from-[#FFF9F6] via-white to-white rounded-3xl p-7 md:p-8 border-2 border-[#FFE2DA] shadow-xl relative ring-1 ring-orange-100/30">
            {/* Featured tag */}
            <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-orange-500 to-[#FF5A00] text-white text-[10px] font-black px-4 py-1 rounded-full shadow-md uppercase tracking-wider">
              Oferta Especial
            </span>
            <VehicleSelector 
              id="cta-final" 
              buyUrl={CHECKOUT_URLS.premium} 
              onCheckout={(vehicleInfo) => {
                setSelectedVehicle(vehicleInfo);
                setShowCheckout(true);
              }}
            />
          </div>
          {/* Trust Badges Under Final CTA */}
          <div className="mt-4 flex flex-wrap justify-center items-center gap-x-4 gap-y-1.5 text-[11px] text-gray-500 font-semibold text-center">
            <span className="flex items-center gap-1">🔒 Compra Segura</span>
            <span>•</span>
            <span className="flex items-center gap-1">🚚 Frete Grátis</span>
            <span>•</span>
            <span className="flex items-center gap-1">🔄 Reembolso Garantido</span>
          </div>
        </div>
      </section>

      {/* 10. Footer Section */}
      <footer className="bg-[#111827] text-white py-10">
        <div className="max-w-6xl mx-auto px-4 grid sm:grid-cols-3 gap-8 text-center text-sm pb-8 border-b border-gray-800">
          <div className="flex flex-col items-center gap-2">
            <span className="text-3xl">🔒</span>
            <b className="text-white">Compra Segura</b>
            <span className="text-gray-400 text-xs">Site protegido por SSL</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <span className="text-3xl">🚚</span>
            <b className="text-white">Entrega para Todo Brasil</b>
            <span className="text-gray-400 text-xs">Frete grátis sem valor mínimo</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <span className="text-3xl">💬</span>
            <b className="text-white">Suporte ao Cliente</b>
            <span className="text-gray-400 text-xs">Atendimento pós-venda via WhatsApp</span>
          </div>
        </div>

        <div className="text-center text-xs text-gray-500 mt-8 px-4 font-medium">
          © {new Date().getFullYear()} CARTAPETES · Todos os direitos reservados
        </div>

        <div className="text-center text-xs text-gray-400 mt-6 px-4 space-y-3">
          <div>CarTapetes Ltda.</div>
          <div>CNPJ: 03.570.101/0001-96</div>
          <div>Endereço: Rua Rua Irma Amelia, 155, São Paulo, Cep 03156-150</div>
          
          <div className="flex items-center justify-center gap-2 text-gray-300 hover:text-white transition duration-150">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"></path>
            </svg>
            <span>Suporte WhatsApp: (11) 91101-6413</span>
          </div>

          <div className="flex items-center justify-center gap-2 flex-wrap text-gray-400">
            <a href="/politica-privacidade.html" className="underline hover:text-white transition">Política de Privacidade</a>
            <span>·</span>
            <a href="/termos-uso.html" className="underline hover:text-white transition">Termos de Uso</a>
            <span>·</span>
            <a href="/trocas-devolucoes.html" className="underline hover:text-white transition">Trocas e Devoluções</a>
          </div>
        </div>
      </footer>

      {/* 11. Mobile Sticky Buy Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 p-3 flex items-center justify-between gap-4 sm:hidden shadow-[0_-4px_12px_rgba(0,0,0,0.08)]">
        <div>
          <div className="text-[10px] text-gray-400 line-through">
            R$ {originalPrice.toFixed(2).replace('.', ',')}
          </div>
          <div className="text-xl font-black text-[#FF5A00] leading-none">
            R$ {currentPrice.toFixed(2).replace('.', ',')}
          </div>
        </div>
        <a
          href="#produto"
          className="flex-1 max-w-[200px] bg-[#FF5A00] text-white font-bold py-3.5 rounded-xl text-xs text-center uppercase tracking-wide shadow-sm hover:bg-[#e64f00] transition duration-150"
        >
          Comprar agora
        </a>
      </div>

      {/* 12. Botão Flutuante do WhatsApp */}
      <a
        href="https://wa.me/5511911016413?text=Ol%C3%A1%2C%20gostaria%20de%20saber%20mais%20sobre%20os%20tapetes%20bandeja%20premium."
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-20 sm:bottom-6 right-6 z-50 flex items-center bg-[#25D366] text-white p-3.5 rounded-full shadow-2xl hover:bg-[#20ba5a] hover:scale-105 active:scale-95 transition-all duration-300 group"
        aria-label="Fale conosco no WhatsApp"
      >
        {/* Ícone Original do WhatsApp em SVG */}
        <svg
          className="w-6 h-6"
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>

        {/* Texto oculto por padrão que expande ao passar o mouse (Desktop) */}
        <span className="max-w-0 overflow-hidden whitespace-nowrap text-sm font-bold text-white transition-all duration-300 ease-out group-hover:max-w-[150px] group-hover:ml-2 hidden sm:inline">
          Dúvidas? Fale Conosco
        </span>
      </a>
    </div>
  );
}
