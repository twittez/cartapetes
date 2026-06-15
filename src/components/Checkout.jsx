import { useState, useEffect } from 'react';
import { trackMetaEvent, generateEventId, getHashedUserData, getCookie } from '../utils/metaPixel';

export default function Checkout({ vehicle, kit, upsellItems = [], onClose }) {
  const [step, setStep] = useState(1); // 1: Identificação, 2: Entrega, 3: Pagamento, 4: Sucesso/Pix QR
  const [paymentMethod, setPaymentMethod] = useState('pix'); // 'pix', 'card'
  const [showMobileSummary, setShowMobileSummary] = useState(false);
  
  // Form States
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    cpf: '',
    telefone: '',
    cep: '',
    rua: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    estado: 'SP',
    // Card info
    cardNumber: '',
    cardName: '',
    cardExpiry: '',
    cardCvv: '',
    installments: '1'
  });

  const [formErrors, setFormErrors] = useState({});
  const [shippingMethod, setShippingMethod] = useState('pac'); // 'pac', 'sedex', 'full'
  const [perfumeUpsell, setPerfumeUpsell] = useState(false);

  // Pricing calculations
  const originalPrice = kit === 'basico' ? 197.00 : 297.00;
  const basePrice = kit === 'basico' ? 72.90 : 124.90;
  const upsellTotal = upsellItems.reduce((sum, item) => sum + item.price, 0) + (perfumeUpsell ? 14.90 : 0);
  const subtotal = basePrice + upsellTotal;
  const shippingCost = shippingMethod === 'pac' ? 0 : shippingMethod === 'sedex' ? 12.90 : 18.90;
  const isPix = paymentMethod === 'pix';
  const finalPrice = (isPix ? subtotal * 0.95 : subtotal) + shippingCost; // 5% discount on PIX
  
  const originalUpsellTotal = upsellItems.reduce((sum, item) => {
    if (item.id === 'organizador') return sum + 89.90;
    if (item.id === 'aromatizador') return sum + 29.90;
    if (item.id === 'kit_limpeza') return sum + 39.90;
    return sum + item.price;
  }, 0) + (perfumeUpsell ? 29.90 : 0);
  const totalOriginalPrice = originalPrice + originalUpsellTotal;
  const savings = totalOriginalPrice - finalPrice;

  // WinnerPay API states
  const [pixCode, setPixCode] = useState('');
  const [pixPaid, setPixPaid] = useState(false);
  const [apiError, setApiError] = useState('');
  const [isApiLoading, setIsApiLoading] = useState(false);
  const [transactionId, setTransactionId] = useState('');
  const [copied, setCopied] = useState(false);

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Testimonial carousel state
  const [testimonialIndex, setTestimonialIndex] = useState(0);

  // Auto scroll testimonials
  useEffect(() => {
    const interval = setInterval(() => {
      setTestimonialIndex(prev => (prev === 0 ? 1 : 0));
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Mask inputs
  const maskCPF = (value) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2')
      .replace(/(-\d{2})\d+?$/, '$1');
  };

  const maskPhone = (value) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d)/, '$1-$2')
      .replace(/(-\d{4})\d+?$/, '$1');
  };

  const maskCEP = (value) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{5})(\d)/, '$1-$2')
      .replace(/(-\d{3})\d+?$/, '$1');
  };

  const maskCard = (value) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{4})(\d)/, '$1 $2')
      .replace(/(\d{4})(\d)/, '$1 $2')
      .replace(/(\d{4})(\d)/, '$1 $2')
      .replace(/(\d{4})\d+?$/, '$1');
  };

  const maskExpiry = (value) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{2})(\d)/, '$1/$2')
      .replace(/(\d{2})\d+?$/, '$1');
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    let maskedValue = value;

    if (name === 'cpf') maskedValue = maskCPF(value);
    if (name === 'telefone') maskedValue = maskPhone(value);
    if (name === 'cep') maskedValue = maskCEP(value);
    if (name === 'cardNumber') maskedValue = maskCard(value);
    if (name === 'cardExpiry') maskedValue = maskExpiry(value);
    if (name === 'cardCvv') maskedValue = value.replace(/\D/g, '').substring(0, 4);

    setFormData(prev => ({ ...prev, [name]: maskedValue }));
    if (formErrors[name]) {
      setFormErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  // Real CEP auto-fill using ViaCEP API
  useEffect(() => {
    const cleanCep = formData.cep.replace(/\D/g, '');
    if (cleanCep.length === 8) {
      const fetchAddress = async () => {
        try {
          const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
          if (response.ok) {
            const data = await response.json();
            if (!data.erro) {
              setFormData(prev => ({
                ...prev,
                rua: data.logradouro || '',
                bairro: data.bairro || '',
                cidade: data.localidade || '',
                estado: data.uf || 'SP'
              }));
              setFormErrors(prev => ({ ...prev, cep: '' }));
            } else {
              setFormErrors(prev => ({ ...prev, cep: 'CEP não encontrado.' }));
            }
          }
        } catch (err) {
          console.error('Erro ao buscar CEP:', err);
        }
      };
      fetchAddress();
    }
  }, [formData.cep]);

  // Polling WinnerPay status check
  useEffect(() => {
    let intervalId;
    if (step === 4 && paymentMethod === 'pix' && transactionId && !pixPaid) {
      intervalId = setInterval(async () => {
        try {
          const response = await fetch(
            `/winnerpay-api/dashboard/transactions/${transactionId}`,
            {
              method: 'GET',
              headers: {
                'X-Client-Id': '657c5bb7-ce8d-4243-9e9f-a8aa5e157fab',
                'X-Client-Secret': '262e504fe6aec6db99249f4ee30e6288816028cc97e1b352a21e1992964c2de1',
              }
            }
          );
          if (response.ok) {
            const data = await response.json();
            if (data.success && data.transaction) {
              const status = data.transaction.status.toLowerCase();
              if (status === 'paid' || status === 'completed') {
                setPixPaid(true);
                clearInterval(intervalId);
                
                let purchaseEventId = generateEventId();
                try {
                  const pendingData = JSON.parse(localStorage.getItem('cartapetes_purchase_data') || '{}');
                  if (pendingData.eventId) {
                    purchaseEventId = pendingData.eventId;
                  }
                } catch (e) {}

                localStorage.setItem('cartapetes_purchase_data', JSON.stringify({
                  value: finalPrice,
                  currency: 'BRL',
                  eventId: purchaseEventId,
                  kit: kit,
                  upsellItems: upsellItems,
                  nome: formData.nome,
                  email: formData.email,
                  telefone: formData.telefone,
                  cep: formData.cep,
                  cidade: formData.cidade,
                  estado: formData.estado
                }));

                window.location.href = '/obrigado.html';
              }
            }
          }
        } catch (err) {
          console.error('Error checking payment status:', err);
        }
      }, 3000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [step, paymentMethod, transactionId, pixPaid]);

  const handleCreatePix = async () => {
    setIsApiLoading(true);
    setApiError('');
    try {
      const purchaseEventId = generateEventId();

      localStorage.setItem('cartapetes_purchase_data', JSON.stringify({
        value: finalPrice,
        currency: 'BRL',
        eventId: purchaseEventId,
        kit: kit,
        upsellItems: upsellItems,
        perfumeUpsell: perfumeUpsell,
        nome: formData.nome,
        email: formData.email,
        telefone: formData.telefone,
        cep: formData.cep,
        cidade: formData.cidade,
        estado: formData.estado
      }));

      const postbackOrigin = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? 'https://seguro.cartapetes.com.br'
        : window.location.origin;

      const winnerpayBody = {
        amount: parseFloat(finalPrice.toFixed(2)),
        description: `Tapete Bandeja Premium - ${vehicle || 'Carro'}`,
        postbackUrl: postbackOrigin + '/winnerpay-webhook',
        metadata: {
          order_id: `ORD-${Date.now()}`,
          product: {
            name: `Kit ${kit === 'basico' ? 'Básico' : 'Proteção Total'} - ${vehicle}${upsellItems.length > 0 ? ' + ' + upsellItems.map(i => i.title).join(', ') : ''}${perfumeUpsell ? ' + Perfume Automotivo' : ''}`
          },
          upsell_items: [...upsellItems, ...(perfumeUpsell ? [{ id: 'perfume', title: 'Perfume Automotivo Premium', price: 14.90 }] : [])],
          tracking: {
            eventId: purchaseEventId,
            fbp: getCookie('_fbp') || '',
            fbc: getCookie('_fbc') || '',
            userAgent: navigator.userAgent,
            sourceUrl: window.location.origin + '/obrigado.html',
            nome: formData.nome,
            email: formData.email,
            telefone: formData.telefone,
            cep: formData.cep,
            cidade: formData.cidade,
            estado: formData.estado
          }
        },
        customer: {
          name: formData.nome,
          email: formData.email,
          document: {
            type: "CPF",
            number: formData.cpf.replace(/\D/g, '')
          }
        }
      };

      console.log('Creating PIX on WinnerPay via proxy...', winnerpayBody);

      const response = await fetch('/winnerpay-api/financial/receber-pix', {
        method: 'POST',
        headers: {
          'X-Client-Id': '657c5bb7-ce8d-4243-9e9f-a8aa5e157fab',
          'X-Client-Secret': '262e504fe6aec6db99249f4ee30e6288816028cc97e1b352a21e1992964c2de1',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(winnerpayBody),
      });

      const data = await response.json();
      console.log('WinnerPay response:', data);

      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || 'Erro ao criar pagamento PIX');
      }

      setPixCode(data.pix_copia_e_cola || data.qr_code_data);
      setTransactionId(data.transaction ? data.transaction.transaction_id : (data.pix_key || "TXN_" + Date.now()));
      setStep(4);
    } catch (err) {
      console.error('WinnerPay API Error:', err);
      setApiError(err.message || 'Erro de conexão com o provedor de pagamentos.');
    } finally {
      setIsApiLoading(false);
    }
  };

  const getCardBrand = (number) => {
    const cleanNumber = number.replace(/\s?/g, '');
    if (cleanNumber.startsWith('4')) return 'visa';
    if (/^5[1-5]/.test(cleanNumber)) return 'mastercard';
    if (/^3[47]/.test(cleanNumber)) return 'amex';
    if (/^(6011|622|64|65)/.test(cleanNumber)) return 'discover';
    if (/^(5067|4576|4011)/.test(cleanNumber)) return 'elo';
    return 'unknown';
  };

  const validateStep1 = () => {
    const errors = {};
    if (!formData.nome.trim()) errors.nome = 'Insira o nome completo.';
    if (!formData.email.includes('@')) errors.email = 'Insira um e-mail válido.';
    if (formData.cpf.replace(/\D/g, '').length !== 11) errors.cpf = 'Insira um CPF válido.';
    if (formData.telefone.replace(/\D/g, '').length < 10) errors.telefone = 'Insira um celular válido.';

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateStep2 = () => {
    const errors = {};
    if (formData.cep.replace(/\D/g, '').length !== 8) errors.cep = 'Insira um CEP válido.';
    if (!formData.rua.trim()) errors.rua = 'Rua é obrigatória.';
    if (!formData.numero.trim()) errors.numero = 'Número é obrigatório.';
    if (!formData.bairro.trim()) errors.bairro = 'Bairro é obrigatório.';
    if (!formData.cidade.trim()) errors.cidade = 'Cidade é obrigatória.';

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateCardDetails = () => {
    const errors = {};
    if (formData.cardNumber.replace(/\D/g, '').length !== 16) errors.cardNumber = 'Número de cartão inválido.';
    if (!formData.cardName.trim()) errors.cardName = 'Insira o nome impresso no cartão.';
    if (formData.cardExpiry.length !== 5) errors.cardExpiry = 'Validade inválida.';
    if (formData.cardCvv.length < 3) errors.cardCvv = 'CVV inválido.';

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNext = async (e) => {
    e.preventDefault();
    if (step === 1) {
      if (validateStep1()) {
        const eventId = generateEventId();
        getHashedUserData(formData).then(hashedUser => {
          trackMetaEvent('InitiateCheckout', eventId, {
            value: finalPrice,
            currency: 'BRL',
            content_name: `Kit ${kit === 'basico' ? 'Básico' : 'Proteção Total'} - ${vehicle || 'Carro'}`,
          }, hashedUser);
        });
        setStep(2);
      }
    } else if (step === 2) {
      if (validateStep2()) {
        setStep(3);
      }
    } else if (step === 3) {
      if (paymentMethod === 'pix') {
        await handleCreatePix();
      } else {
        if (validateCardDetails()) {
          const purchaseEventId = generateEventId();
          localStorage.setItem('cartapetes_purchase_data', JSON.stringify({
            value: finalPrice,
            currency: 'BRL',
            eventId: purchaseEventId,
            kit: kit,
            upsellItems: upsellItems,
            perfumeUpsell: perfumeUpsell,
            nome: formData.nome,
            email: formData.email,
            telefone: formData.telefone,
            cep: formData.cep,
            cidade: formData.cidade,
            estado: formData.estado
          }));
          window.location.href = '/obrigado.html';
        }
      }
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(prev => prev - 1);
      setFormErrors({});
    } else {
      onClose();
    }
  };

  const handleCopyPix = () => {
    if (pixCode) {
      navigator.clipboard.writeText(pixCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Testimonials list
  const testimonials = [
    {
      stars: 5,
      name: 'Cliente Satisfeita',
      text: 'Atendimento excelente e compra rápida. Gostei muito do resultado!',
      avatar: '/review-2.jpg'
    },
    {
      stars: 5,
      name: 'Cliente Verificada',
      text: 'Produto chegou no prazo e a experiência foi incrível.',
      avatar: '/review-1.jpg'
    }
  ];


  // Helper for credit card installment calculation
  const getInstallmentOptions = () => {
    const rates = {
      1: 0,
      2: 4.98,
      3: 7.47,
      4: 9.96,
      5: 12.45,
      6: 14.94,
      7: 17.43,
      8: 19.92,
      9: 22.41,
      10: 24.90,
      11: 27.39,
      12: 29.88
    };
    
    return Object.entries(rates).map(([install, rate]) => {
      const installNum = parseInt(install);
      const factor = 1 + (rate / 100);
      const totalWithTax = (subtotal + shippingCost) * factor; // Interest calculated on total cost including shipping
      const valuePerInstallment = totalWithTax / installNum;
      
      const labelText = rate === 0 
        ? `${installNum}x de R$ ${valuePerInstallment.toFixed(2).replace('.', ',')} sem juros`
        : `${installNum}x de R$ ${valuePerInstallment.toFixed(2).replace('.', ',')} (Total: R$ ${totalWithTax.toFixed(2).replace('.', ',')})`;
      
      return (
        <option key={installNum} value={installNum}>
          {labelText}
        </option>
      );
    });
  };

  return (
    <div className="min-h-screen bg-[#FFFFFF] text-slate-800 fontRubik pb-16 antialiased">
      
      {/* Header with centered CarTapetes logo */}
      <div className="bg-white px-0" style={{ background: '#000000' }}>
        <div className="mx-auto max-w-2xl lg:max-w-7xl py-[1rem] pb-[1rem] px-4 md:py-[1.25rem] md:pb-[1rem] sm:px-0 flex justify-center">
          <div>
            <img 
              src="https://assetsglobalbr.com/u/checkout/12008281.jpeg" 
              alt="CarTapetes" 
              className="max-w-[130px] md:max-w-[150px]"
            />
          </div>
        </div>
      </div>

      {/* Black Offer Banner */}
      <div className="w-full mb-0 border-0 outline-none max-lg:w-screen max-lg:min-w-screen max-lg:relative max-lg:left-1/2 max-lg:-translate-x-1/2" style={{ background: '#000000', color: '#FFF' }}>
        <div className="mx-auto max-w-2xl lg:max-w-7xl w-full max-sm:px-4 items-center max-sm:py-2.5 md:py-3.5 px-2 md:px-0 text-[12px] md:text-[13px] flex justify-center text-center">
          <div className="w-full text-center">
            <p><strong>Parabéns!</strong> Você ganhou <strong>Frete Grátis + Seguro Entrega.</strong></p>
            <p><strong><u>5% OFF em pagamentos via Pix!</u></strong></p>
          </div>
        </div>
      </div>

      {/* Mobile order summary accordion */}
      <div className="lg:hidden bg-[#f3f4f6] border-b border-[#e2e8f0]">
        <button
          onClick={() => setShowMobileSummary(!showMobileSummary)}
          className="w-full px-4 py-3 flex items-center justify-between text-xs font-semibold text-slate-500 hover:bg-slate-200/55 transition"
        >
          <span className="flex items-center gap-1.5">
            🛒 Resumo do pedido
            <span className={`text-[8px] transition-transform duration-200 ${showMobileSummary ? 'rotate-180' : ''}`}>▼</span>
          </span>
          <span className="text-sm font-black text-slate-800">
            R$ {finalPrice.toFixed(2).replace('.', ',')}
          </span>
        </button>

        {showMobileSummary && (
          <div className="p-4 bg-white border-t border-[#e2e8f0] space-y-4 text-xs animate-fadeIn">
            <div className="flex gap-3">
              <div className="w-12 h-12 bg-slate-50 rounded border border-[#e2e8f0] flex-shrink-0">
                <img src="/produto-1.jpg" alt="Produto" className="w-full h-full object-cover" />
              </div>
              <div className="flex-1">
                <div className="font-bold text-slate-800 line-clamp-1">
                  Tapete Bandeja Premium + Lixeira de Brinde
                </div>
                <div className="text-slate-400 mt-0.5 font-mono text-[10px]">
                  Veículo: <span className="text-slate-700 font-bold">{vehicle}</span>
                </div>
                <div className="text-slate-400 font-mono text-[10px]">
                  Kit: <span className="text-slate-700 font-bold">{kit === 'basico' ? 'Kit Essencial Cabine' : 'Kit Premium Completo'}</span>
                </div>
              </div>
            </div>
            
            {(upsellItems.length > 0 || perfumeUpsell) && (
              <div className="space-y-1 text-slate-500 pb-2 border-b border-[#e2e8f0]">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Acessórios</div>
                {upsellItems.map(item => (
                  <div key={item.id} className="flex justify-between">
                    <span>✚ {item.title}</span>
                    <span>R$ {item.price.toFixed(2).replace('.', ',')}</span>
                  </div>
                ))}
                {perfumeUpsell && (
                  <div className="flex justify-between">
                    <span>✚ Perfume Automotivo Premium</span>
                    <span>R$ 14,90</span>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-1.5 text-slate-500 pt-1">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>R$ {subtotal.toFixed(2).replace('.', ',')}</span>
              </div>
              <div className="flex justify-between">
                <span>Envio ({shippingMethod === 'pac' ? 'PAC' : shippingMethod === 'sedex' ? 'SEDEX' : 'Jadlog'})</span>
                <span className={shippingMethod === 'pac' ? 'text-emerald-600 font-bold' : 'text-slate-800 font-bold'}>
                  {shippingMethod === 'pac' ? 'Grátis' : `R$ ${shippingCost.toFixed(2).replace('.', ',')}`}
                </span>
              </div>
              {isPix && (
                <div className="flex justify-between text-emerald-600 font-bold">
                  <span>Desconto Pix (5%)</span>
                  <span>- R$ {(subtotal * 0.05).toFixed(2).replace('.', ',')}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Main Grid Container */}
      <div className="flex-1 w-full mx-auto px-4 md:px-6 lg:max-w-[74rem] mt-6 md:mb-10">
        <div className="grid lg:grid-cols-3 gap-6">
          
          {/* Left Column: Form Steps */}
          <div className="lg:col-span-2 space-y-4">
            
            {/* Progress Indicators Bar */}
            <div className="bg-white rounded-[0.5rem] border border-[#e2e8f0] p-4 flex items-center justify-between shadow-xs select-none">
              {/* Step 1 */}
              <div className="flex items-center gap-2 flex-1 justify-center">
                <span className={`w-5 h-5 flex items-center justify-center rounded-full text-[11px] font-bold ${
                  step >= 1 ? 'bg-black text-white' : 'bg-[#e2e8f0] text-[#94a3b8]'
                }`}>
                  {step > 1 ? '✓' : '1'}
                </span>
                <span className={`text-[11px] sm:text-xs ${
                  step >= 1 ? 'font-bold text-[#0f172a]' : 'text-slate-400'
                }`}>
                  Identificação
                </span>
              </div>
              
              {/* Separator */}
              <div className="text-slate-300 mx-1">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </div>
              
              {/* Step 2 */}
              <div className="flex items-center gap-2 flex-1 justify-center">
                <span className={`w-5 h-5 flex items-center justify-center rounded-full text-[11px] font-bold ${
                  step >= 2 ? 'bg-black text-white' : 'bg-[#e2e8f0] text-[#94a3b8]'
                }`}>
                  {step > 2 ? '✓' : '2'}
                </span>
                <span className={`text-[11px] sm:text-xs ${
                  step >= 2 ? 'font-bold text-[#0f172a]' : 'text-slate-400'
                }`}>
                  Entrega
                </span>
              </div>
              
              {/* Separator */}
              <div className="text-slate-300 mx-1">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </div>
              
              {/* Step 3 */}
              <div className="flex items-center gap-2 flex-1 justify-center">
                <span className={`w-5 h-5 flex items-center justify-center rounded-full text-[11px] font-bold ${
                  step >= 3 ? 'bg-black text-white' : 'bg-[#e2e8f0] text-[#94a3b8]'
                }`}>
                  3
                </span>
                <span className={`text-[11px] sm:text-xs ${
                  step >= 3 ? 'font-bold text-[#0f172a]' : 'text-slate-400'
                }`}>
                  Pagamento
                </span>
              </div>
            </div>

            {/* STEP 1: IDENTIFICACAO */}
            <div className="bg-white rounded-[0.5rem] border border-[#e2e8f0] p-5 shadow-xs">
              {step === 1 ? (
                <form onSubmit={handleNext} className="space-y-4">
                  <div className="flex justify-between items-baseline border-b border-slate-100 pb-3">
                    <div>
                      <h2 className="text-[15px] font-bold text-[#0f172a] flex items-center gap-1.5">
                        1. Identificação
                      </h2>
                      <p className="text-[11px] text-slate-400 mt-0.5">Preencha seus dados para envio do pedido.</p>
                    </div>
                    <span className="text-[11px] font-bold text-slate-400">1 de 3</span>
                  </div>

                  <div className="space-y-3 pt-2">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Nome completo</label>
                      <input
                        type="text"
                        name="nome"
                        value={formData.nome}
                        onChange={handleChange}
                        placeholder="Digite seu nome completo"
                        className={`w-full border rounded-[0.5rem] h-11 px-3 text-[14px] outline-none focus:ring-1 focus:ring-[#3bae8a] focus:border-[#3bae8a] bg-white transition ${formErrors.nome ? 'border-red-500 bg-red-50/10' : 'border-[#e2e8f0]'}`}
                      />
                      {formErrors.nome && <span className="text-red-500 text-[11px] mt-1 block">{formErrors.nome}</span>}
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">E-mail</label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        placeholder="Digite seu e-mail"
                        className={`w-full border rounded-[0.5rem] h-11 px-3 text-[14px] outline-none focus:ring-1 focus:ring-[#3bae8a] focus:border-[#3bae8a] bg-white transition ${formErrors.email ? 'border-red-500 bg-red-50/10' : 'border-[#e2e8f0]'}`}
                      />
                      {formErrors.email && <span className="text-red-500 text-[11px] mt-1 block">{formErrors.email}</span>}
                    </div>

                    <div className="grid sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1">
                          CPF
                          <span className="text-slate-400 cursor-help" title="Precisamos do seu CPF para emitir a nota fiscal de envio.">ⓘ</span>
                        </label>
                        <input
                          type="text"
                          name="cpf"
                          value={formData.cpf}
                          onChange={handleChange}
                          placeholder="000.000.000-00"
                          className={`w-full border rounded-[0.5rem] h-11 px-3 text-[14px] outline-none focus:ring-1 focus:ring-[#3bae8a] focus:border-[#3bae8a] bg-white transition ${formErrors.cpf ? 'border-red-500 bg-red-50/10' : 'border-[#e2e8f0]'}`}
                        />
                        {formErrors.cpf && <span className="text-red-500 text-[11px] mt-1 block">{formErrors.cpf}</span>}
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">Celular/Whatsapp</label>
                        <input
                          type="text"
                          name="telefone"
                          value={formData.telefone}
                          onChange={handleChange}
                          placeholder="+55 (00) 00000-0000"
                          className={`w-full border rounded-[0.5rem] h-11 px-3 text-[14px] outline-none focus:ring-1 focus:ring-[#3bae8a] focus:border-[#3bae8a] bg-white transition ${formErrors.telefone ? 'border-red-500 bg-red-50/10' : 'border-[#e2e8f0]'}`}
                        />
                        {formErrors.telefone && <span className="text-red-500 text-[11px] mt-1 block">{formErrors.telefone}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Pix notice card */}
                  <div className="bg-slate-50/50 rounded-[0.5rem] p-3.5 text-[11.5px] font-medium text-slate-600 flex items-center justify-center gap-2 border border-[#e2e8f0] mt-4 animate-shake-subtle">
                    <svg viewBox="308 0 36 24" className="w-9 h-6 flex-shrink-0 shadow-sm border border-slate-200 rounded bg-white" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path fillRule="evenodd" clipRule="evenodd" d="M344 21C344 22.65 342.65 24 341 24H311C309.35 24 308 22.65 308 21V3C308 1.35 309.35 0 311 0H341C342.65 0 344 1.35 344 3V21Z" fill="white" />
                      <path d="M341 0H311C309.35 0 308 1.35 308 3V21C308 22.65 309.35 24 311 24H341C342.65 24 344 22.65 344 21V3C344 1.35 342.65 0 341 0ZM341 0.6C342.324 0.6 343.4 1.6764 343.4 3V21C343.4 22.3236 342.324 23.4 341 23.4H311C309.676 23.4 308.6 22.3236 308.6 21V3C308.6 1.6764 309.676 0.6 311 0.6H341Z" fill="#B3B3B3" />
                      <path d="M322.844 15.4258C323.094 15.4267 323.341 15.378 323.571 15.2826C323.802 15.1872 324.011 15.0469 324.187 14.87L326.124 12.9324C326.193 12.8668 326.284 12.8302 326.38 12.8302C326.474 12.8302 326.566 12.8668 326.635 12.9324L328.58 14.878C328.756 15.0547 328.965 15.1947 329.196 15.29C329.426 15.3852 329.674 15.4339 329.923 15.433H330.305L327.85 17.8873C327.667 18.0698 327.451 18.2147 327.213 18.3135C326.975 18.4123 326.719 18.4632 326.462 18.4632C326.204 18.4632 325.948 18.4123 325.71 18.3135C325.472 18.2147 325.256 18.0698 325.073 17.8873L322.608 15.4258H322.844ZM329.923 8.56908C329.674 8.56832 329.427 8.61703 329.196 8.71235C328.966 8.80769 328.757 8.94775 328.581 9.12447L326.638 11.071C326.571 11.1384 326.479 11.1764 326.383 11.1764C326.288 11.1764 326.196 11.1384 326.128 11.071L324.191 9.13285C324.015 8.95591 323.806 8.81565 323.575 8.72024C323.345 8.62483 323.098 8.57616 322.848 8.57707H322.608L325.073 6.11395C325.442 5.74585 325.941 5.53906 326.462 5.53906C326.982 5.53906 327.481 5.74585 327.85 6.11395L330.305 8.56867L329.923 8.56908Z" fill="#24bfa5" />
                      <path d="M320.575 10.6108L322.041 9.14431H322.844C323.196 9.1447 323.534 9.28408 323.784 9.53156L325.721 11.4693C325.808 11.5561 325.91 11.625 326.024 11.672C326.137 11.7191 326.258 11.7432 326.38 11.7432C326.503 11.7432 326.624 11.7191 326.737 11.672C326.85 11.625 326.953 11.5561 327.039 11.4693L328.984 9.52399C329.234 9.27623 329.572 9.13702 329.924 9.13672H330.876L332.348 10.6092C332.716 10.9774 332.923 11.4767 332.923 11.9973C332.923 12.5179 332.716 13.0172 332.348 13.3854L330.876 14.8579H329.923C329.571 14.8579 329.233 14.7181 328.983 14.4707L327.039 12.5245C326.861 12.3551 326.625 12.2605 326.38 12.2605C326.134 12.2605 325.899 12.3551 325.721 12.5245L323.783 14.4623C323.533 14.7097 323.196 14.8495 322.844 14.8495H322.041L320.575 13.387C320.393 13.2048 320.248 12.9884 320.15 12.7501C320.051 12.512 320 12.2568 320 11.9989C320 11.7411 320.051 11.4858 320.15 11.2476C320.248 11.0095 320.393 10.7931 320.575 10.6108Z" fill="#24bfa5" />
                    </svg>
                    <span>Você ganhou <b className="text-[#24bfa5] font-extrabold">5% de desconto</b> pagando com Pix</span>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-[#3bae8a] hover:bg-[#2d8f70] text-white font-extrabold h-12 rounded-[0.5rem] text-[14px] text-center transition cursor-pointer mt-4"
                  >
                    Ir Para Entrega
                  </button>
                </form>
              ) : (
                <div className="flex justify-between items-start text-xs animate-fadeIn">
                  <div className="space-y-1">
                    <h3 className="font-bold text-[#0f172a] text-sm">Identificação</h3>
                    <div className="text-slate-600 mt-2 space-y-0.5 font-mono text-[11px]">
                      <div className="font-bold text-slate-700 uppercase font-sans text-xs">{formData.nome || 'CarTapetes Lead'}</div>
                      <div>{formData.email}</div>
                      <div>{formData.telefone}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => setStep(1)}
                    className="text-slate-400 hover:text-slate-600 flex items-center gap-1 font-bold text-[10px] uppercase border border-slate-100 hover:border-slate-200 px-2.5 py-1 rounded-[0.25rem] transition"
                  >
                    Editar 🖊️
                  </button>
                </div>
              )}
            </div>

            {/* STEP 2: ENTREGA */}
            <div className="bg-white rounded-[0.5rem] border border-[#e2e8f0] p-5 shadow-xs">
              {step === 2 ? (
                <form onSubmit={handleNext} className="space-y-4">
                  <div className="flex justify-between items-baseline border-b border-slate-100 pb-3">
                    <div>
                      <h2 className="text-[15px] font-bold text-[#0f172a] flex items-center gap-1.5">
                        2. Entrega
                      </h2>
                      <p className="text-[11px] text-slate-400 mt-0.5">Informe o endereço de entrega de seu pedido.</p>
                    </div>
                    <span className="text-[11px] font-bold text-slate-400">2 de 3</span>
                  </div>

                  <div className="space-y-3 pt-2">
                    <div className="relative">
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">CEP</label>
                      <div className="flex items-center gap-3">
                        <div className="relative flex-1">
                          <input
                            type="text"
                            name="cep"
                            value={formData.cep}
                            onChange={handleChange}
                            placeholder="00000-000"
                            className={`w-full border rounded-[0.5rem] h-11 px-3 pr-10 text-[14px] outline-none focus:ring-1 focus:ring-[#3bae8a] focus:border-[#3bae8a] bg-white transition ${formErrors.cep ? 'border-red-500 bg-red-50/10' : 'border-[#e2e8f0]'}`}
                          />
                          {formData.cep.replace(/\D/g, '').length === 8 && !formErrors.cep && (
                            <span className="absolute right-3.5 bottom-3.5 text-emerald-600 font-bold text-xs">✓</span>
                          )}
                        </div>
                        {formData.cep.replace(/\D/g, '').length === 8 && !formErrors.cep && formData.cidade && (
                          <div className="text-xs font-bold text-slate-700 whitespace-nowrap bg-slate-50 border border-[#e2e8f0] px-3 py-2.5 rounded-[0.5rem] h-11 flex items-center justify-center">
                            {formData.estado}/{formData.cidade}
                          </div>
                        )}
                      </div>
                      {formErrors.cep && <span className="text-red-500 text-[11px] mt-1 block">{formErrors.cep}</span>}
                    </div>

                    {formData.cep.replace(/\D/g, '').length === 8 && (
                      <div className="space-y-3 animate-fadeIn">
                        <div className="relative">
                          <label className="block text-[11px] font-bold text-slate-500 mb-1">Endereço</label>
                          <input
                            type="text"
                            name="rua"
                            value={formData.rua}
                            onChange={handleChange}
                            placeholder="Ex: Rua Bento Gonçalves"
                            className={`w-full border rounded-[0.5rem] h-11 px-3 pr-10 text-[14px] outline-none focus:ring-1 focus:ring-[#3bae8a] focus:border-[#3bae8a] bg-white transition ${formErrors.rua ? 'border-red-500 bg-red-50/10' : 'border-[#e2e8f0]'}`}
                          />
                          {formData.rua.trim().length > 3 && (
                            <span className="absolute right-3.5 bottom-3.5 text-emerald-600 font-bold text-xs">✓</span>
                          )}
                          {formErrors.rua && <span className="text-red-500 text-[11px] mt-1 block">{formErrors.rua}</span>}
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-500 mb-1">Nº</label>
                            <input
                              type="text"
                              name="numero"
                              value={formData.numero}
                              onChange={handleChange}
                              placeholder="Número"
                              className={`w-full border rounded-[0.5rem] h-11 px-3 text-[14px] outline-none focus:ring-1 focus:ring-red-300 focus:border-red-300 transition ${formErrors.numero ? 'border-red-400 bg-red-50' : 'border-[#e2e8f0] bg-white'}`}
                            />
                            {formErrors.numero && (
                              <span className="text-red-600 text-[10px] mt-1 block leading-tight font-bold">Número é obrigatório</span>
                            )}
                          </div>

                          <div className="col-span-2 relative">
                            <label className="block text-[11px] font-bold text-slate-500 mb-1">Bairro</label>
                            <input
                              type="text"
                              name="bairro"
                              value={formData.bairro}
                              onChange={handleChange}
                              placeholder="Bairro"
                              className={`w-full border rounded-[0.5rem] h-11 px-3 pr-10 text-[14px] outline-none focus:ring-1 focus:ring-[#3bae8a] focus:border-[#3bae8a] bg-white transition ${formErrors.bairro ? 'border-red-500 bg-red-50/10' : 'border-[#e2e8f0]'}`}
                            />
                            {formData.bairro.trim().length > 2 && (
                              <span className="absolute right-3.5 bottom-3.5 text-emerald-600 font-bold text-xs">✓</span>
                            )}
                            {formErrors.bairro && <span className="text-red-500 text-[11px] mt-1 block">{formErrors.bairro}</span>}
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-500 mb-1">Complemento (Opcional)</label>
                          <input
                            type="text"
                            name="complemento"
                            value={formData.complemento}
                            onChange={handleChange}
                            placeholder="Apto, bloco, referência"
                            className="w-full border border-[#e2e8f0] bg-white rounded-[0.5rem] h-11 px-3 text-[14px] outline-none focus:ring-1 focus:ring-[#3bae8a] focus:border-[#3bae8a]"
                          />
                        </div>

                        {/* Shipping Option */}
                        <div className="pt-3 border-t border-slate-100 space-y-2">
                          <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Escolha o frete:</label>
                          
                          {/* PAC */}
                          <div
                            onClick={() => setShippingMethod('pac')}
                            className={`border rounded-[0.5rem] p-3.5 flex items-center justify-between cursor-pointer transition ${
                              shippingMethod === 'pac' ? 'border-black bg-slate-50/60 shadow-xs' : 'border-[#e2e8f0] hover:border-slate-350 bg-white'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <input 
                                type="radio" 
                                name="shipping" 
                                checked={shippingMethod === 'pac'}
                                onChange={() => setShippingMethod('pac')}
                                className="accent-black h-4 w-4 cursor-pointer"
                              />
                              <div className="flex items-center gap-3.5">
                                <img src="/pac.png" alt="Correios PAC" className="h-6 w-auto object-contain max-w-[60px]" />
                                <div className="text-xs">
                                  <div className="font-extrabold text-slate-800">PAC</div>
                                  <div className="text-slate-400 mt-0.5">
                                    {formData.estado === 'SP' ? '2 a 5 dias úteis' : '5 a 8 dias úteis'}
                                  </div>
                                </div>
                              </div>
                            </div>
                            <span className="font-extrabold text-emerald-600 text-xs">Grátis</span>
                          </div>

                          {/* SEDEX */}
                          <div
                            onClick={() => setShippingMethod('sedex')}
                            className={`border rounded-[0.5rem] p-3.5 flex items-center justify-between cursor-pointer transition ${
                              shippingMethod === 'sedex' ? 'border-black bg-slate-50/60 shadow-xs' : 'border-[#e2e8f0] hover:border-slate-350 bg-white'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <input 
                                type="radio" 
                                name="shipping" 
                                checked={shippingMethod === 'sedex'}
                                onChange={() => setShippingMethod('sedex')}
                                className="accent-black h-4 w-4 cursor-pointer"
                              />
                              <div className="flex items-center gap-3.5">
                                <img src="/sedex.png" alt="Correios SEDEX" className="h-6 w-auto object-contain max-w-[60px]" />
                                <div className="text-xs">
                                  <div className="font-extrabold text-slate-800">SEDEX</div>
                                  <div className="text-slate-400 mt-0.5">
                                    {formData.estado === 'SP' ? '1 a 2 dias úteis' : '2 a 4 dias úteis'}
                                  </div>
                                </div>
                              </div>
                            </div>
                            <span className="font-extrabold text-slate-800 text-xs">R$ 12,90</span>
                          </div>

                          {/* FULL */}
                          <div
                            onClick={() => setShippingMethod('full')}
                            className={`border rounded-[0.5rem] p-3.5 flex items-center justify-between cursor-pointer transition ${
                              shippingMethod === 'full' ? 'border-black bg-slate-50/60 shadow-xs' : 'border-[#e2e8f0] hover:border-slate-350 bg-white'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <input 
                                type="radio" 
                                name="shipping" 
                                checked={shippingMethod === 'full'}
                                onChange={() => setShippingMethod('full')}
                                className="accent-black h-4 w-4 cursor-pointer"
                              />
                              <div className="flex items-center gap-3.5">
                                <img src="/jadlog.png" alt="Jadlog" className="h-6 w-auto object-contain max-w-[60px]" />
                                <div className="text-xs">
                                  <div className="font-extrabold text-slate-800">Jadlog</div>
                                  <div className="text-slate-400 mt-0.5">
                                    {formData.estado === 'SP' ? '1 a 2 dias úteis' : '3 dias úteis'}
                                  </div>
                                </div>
                              </div>
                            </div>
                            <span className="font-extrabold text-slate-800 text-xs">R$ 18,90</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 flex gap-3">
                    <button
                      type="button"
                      onClick={handleBack}
                      className="flex-1 border border-slate-300 text-slate-600 font-semibold h-12 rounded-[0.5rem] text-[14px] text-center transition hover:bg-slate-50 cursor-pointer"
                    >
                      Voltar
                    </button>
                    <button
                      type="submit"
                      className="flex-2 bg-[#3bae8a] hover:bg-[#2d8f70] text-white font-extrabold h-12 rounded-[0.5rem] text-[14px] text-center transition cursor-pointer"
                    >
                      Ir Para Pagamento
                    </button>
                  </div>
                </form>
              ) : (
                step > 2 && (
                  <div className="flex justify-between items-start text-xs animate-fadeIn">
                    <div className="space-y-1">
                      <h3 className="font-bold text-[#0f172a] text-sm">Enviar para</h3>
                      <div className="text-slate-600 mt-2 space-y-1 font-mono text-[11px]">
                        <div>{formData.rua}, {formData.numero}</div>
                        <div>{formData.bairro}, {formData.cidade}/{formData.estado} {formData.cep.replace(/\D/g, '')}</div>
                        
                        <div className="pt-2 border-t border-slate-50 mt-2">
                          <div className="font-bold text-slate-400 uppercase text-[9px] tracking-wider font-sans">Frete selecionado</div>
                          <div className="text-slate-800 font-bold font-sans mt-0.5">
                            {shippingMethod === 'pac' ? 'PAC - Grátis' : shippingMethod === 'sedex' ? 'SEDEX - R$ 12,90' : 'Jadlog - R$ 18,90'}
                          </div>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setStep(2)}
                      className="text-slate-400 hover:text-slate-600 flex items-center gap-1 font-bold text-[10px] uppercase border border-slate-100 hover:border-slate-200 px-2.5 py-1 rounded-[0.25rem] transition"
                    >
                      Editar 🖊️
                    </button>
                  </div>
                )
              )}
              {step < 2 && (
                <div className="text-slate-400 text-xs font-semibold">
                  ② Entrega
                </div>
              )}
            </div>

            {/* STEP 3: PAGAMENTO */}
            <div className="bg-white rounded-[0.5rem] border border-[#e2e8f0] p-5 shadow-xs">
              {step === 3 ? (
                <form onSubmit={handleNext} className="space-y-4">
                  <div className="flex justify-between items-baseline border-b border-slate-100 pb-3">
                    <div>
                      <h2 className="text-[15px] font-bold text-[#0f172a] flex items-center gap-1.5">
                        3. Pagamento
                      </h2>
                      <p className="text-[11px] text-slate-400 mt-0.5">Todas as transações são seguras e criptografadas.</p>
                    </div>
                    <span className="text-[11px] font-bold text-slate-400">3 de 3</span>
                  </div>

                  <div className="space-y-3 pt-2">
                    
                    {/* Pix Option Card */}
                    <label
                      onClick={() => setPaymentMethod('pix')}
                      className={`border rounded-[0.5rem] p-4 flex flex-col cursor-pointer transition relative ${
                        paymentMethod === 'pix' ? 'border-black bg-slate-50/50 shadow-xs' : 'border-[#e2e8f0] hover:border-slate-355 bg-white'
                      }`}
                    >
                      <span className="absolute -top-2.5 right-4 bg-[#3bae8a] text-white text-[9px] font-bold px-2 py-0.5 rounded shadow-sm uppercase tracking-wide">
                        5% DE DESCONTO
                      </span>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="payment"
                            checked={paymentMethod === 'pix'}
                            onChange={() => setPaymentMethod('pix')}
                            className="accent-black h-4 w-4 cursor-pointer"
                          />
                          <svg viewBox="308 0 36 24" className="w-9 h-6 flex-shrink-0 shadow-sm border border-slate-200 rounded bg-white" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path fillRule="evenodd" clipRule="evenodd" d="M344 21C344 22.65 342.65 24 341 24H311C309.35 24 308 22.65 308 21V3C308 1.35 309.35 0 311 0H341C342.65 0 344 1.35 344 3V21Z" fill="white" />
                            <path d="M341 0H311C309.35 0 308 1.35 308 3V21C308 22.65 309.35 24 311 24H341C342.65 24 344 22.65 344 21V3C344 1.35 342.65 0 341 0ZM341 0.6C342.324 0.6 343.4 1.6764 343.4 3V21C343.4 22.3236 342.324 23.4 341 23.4H311C309.676 23.4 308.6 22.3236 308.6 21V3C308.6 1.6764 309.676 0.6 311 0.6H341Z" fill="#B3B3B3" />
                            <path d="M322.844 15.4258C323.094 15.4267 323.341 15.378 323.571 15.2826C323.802 15.1872 324.011 15.0469 324.187 14.87L326.124 12.9324C326.193 12.8668 326.284 12.8302 326.38 12.8302C326.474 12.8302 326.566 12.8668 326.635 12.9324L328.58 14.878C328.756 15.0547 328.965 15.1947 329.196 15.29C329.426 15.3852 329.674 15.4339 329.923 15.433H330.305L327.85 17.8873C327.667 18.0698 327.451 18.2147 327.213 18.3135C326.975 18.4123 326.719 18.4632 326.462 18.4632C326.204 18.4632 325.948 18.4123 325.71 18.3135C325.472 18.2147 325.256 18.0698 325.073 17.8873L322.608 15.4258H322.844ZM329.923 8.56908C329.674 8.56832 329.427 8.61703 329.196 8.71235C328.966 8.80769 328.757 8.94775 328.58 9.12447L326.638 11.071C326.571 11.1384 326.479 11.1764 326.383 11.1764C326.288 11.1764 326.196 11.1384 326.128 11.071L324.191 9.13285C324.015 8.95591 323.806 8.81565 323.575 8.72024C323.345 8.62483 323.098 8.57616 322.848 8.57707H322.608L325.073 6.11395C325.442 5.74585 325.941 5.53906 326.462 5.53906C326.982 5.53906 327.481 5.74585 327.85 6.11395L330.305 8.56867L329.923 8.56908Z" fill="#24bfa5" />
                            <path d="M320.575 10.6108L322.041 9.14431H322.844C323.196 9.1447 323.534 9.28408 323.784 9.53156L325.721 11.4693C325.808 11.5561 325.91 11.625 326.024 11.672C326.137 11.7191 326.258 11.7432 326.38 11.7432C326.503 11.7432 326.624 11.7191 326.737 11.672C326.85 11.625 326.953 11.5561 327.039 11.4693L328.984 9.52399C329.234 9.27623 329.572 9.13702 329.924 9.13672H330.876L332.348 10.6092C332.716 10.9774 332.923 11.4767 332.923 11.9973C332.923 12.5179 332.716 13.0172 332.348 13.3854L330.876 14.8579H329.923C329.571 14.8579 329.233 14.7181 328.983 14.4707L327.039 12.5245C326.861 12.3551 326.625 12.2605 326.38 12.2605C326.134 12.2605 325.899 12.3551 325.721 12.5245L323.783 14.4623C323.533 14.7097 323.196 14.8495 322.844 14.8495H322.041L320.575 13.387C320.393 13.2048 320.248 12.9884 320.15 12.7501C320.051 12.512 320 12.2568 320 11.9989C320 11.7411 320.051 11.4858 320.15 11.2476C320.248 11.0095 320.393 10.7931 320.575 10.6108Z" fill="#24bfa5" />
                          </svg>
                          <div className="text-xs">
                            <div className="font-extrabold text-[#0f172a]">PIX</div>
                            <div className="text-[9px] text-[#24bfa5] font-extrabold mt-0.5">Aprovação imediata</div>
                          </div>
                        </div>
                      </div>

                      {paymentMethod === 'pix' && (
                        <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-500 space-y-2 animate-fadeIn">
                          <p>O código Pix expira em 30 minutos após finalizar a compra.</p>
                          <p className="font-bold text-slate-800 flex items-baseline gap-1">
                            Valor no Pix: <span className="text-[#24bfa5] text-[15px] font-extrabold">R$ {finalPrice.toFixed(2).replace('.', ',')}</span>
                          </p>
                        </div>
                      )}
                    </label>

                    {/* Credit Card Option Card */}
                    <label
                      onClick={() => setPaymentMethod('card')}
                      className={`border rounded-[0.5rem] p-4 flex items-center justify-between cursor-pointer transition relative ${
                        paymentMethod === 'card' ? 'border-black bg-slate-50/50 shadow-xs' : 'border-[#e2e8f0] hover:border-slate-355 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="payment"
                          checked={paymentMethod === 'card'}
                          onChange={() => setPaymentMethod('card')}
                          className="accent-black h-4 w-4 cursor-pointer"
                        />
                        <span className="text-lg">💳</span>
                        <span className="text-xs font-bold text-slate-800">Cartão de crédito</span>
                      </div>
                    </label>

                    {/* Credit Card Inputs */}
                    {paymentMethod === 'card' && (
                      <div className="border border-[#e2e8f0] rounded-[0.5rem] p-4 bg-slate-50/20 space-y-3.5 animate-fadeIn">
                        <div className="relative">
                          <label className="block text-[11px] font-bold text-slate-500 mb-1">Número do Cartão</label>
                          <input
                            type="text"
                            name="cardNumber"
                            value={formData.cardNumber}
                            onChange={handleChange}
                            placeholder="0000 0000 0000 0000"
                            className={`w-full border rounded-[0.5rem] h-11 px-3 text-[14px] outline-none focus:ring-1 focus:ring-[#3bae8a] focus:border-[#3bae8a] bg-white transition ${formErrors.cardNumber ? 'border-red-500 bg-red-50/10' : 'border-[#e2e8f0]'}`}
                          />
                          {getCardBrand(formData.cardNumber) !== 'unknown' && (
                            <span className="absolute right-3 bottom-3 text-[10px] bg-slate-200 px-2 py-0.5 rounded font-black uppercase tracking-wider text-slate-600">
                              {getCardBrand(formData.cardNumber)}
                            </span>
                          )}
                          {formErrors.cardNumber && <span className="text-red-500 text-[11px] mt-1 block">{formErrors.cardNumber}</span>}
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-500 mb-1">Nome como está no Cartão</label>
                          <input
                            type="text"
                            name="cardName"
                            value={formData.cardName}
                            onChange={handleChange}
                            placeholder="JOAO S SANTOS"
                            className={`w-full border rounded-[0.5rem] h-11 px-3 text-[14px] outline-none focus:ring-1 focus:ring-[#3bae8a] focus:border-[#3bae8a] bg-white transition ${formErrors.cardName ? 'border-red-500 bg-red-50/10' : 'border-[#e2e8f0]'}`}
                          />
                          {formErrors.cardName && <span className="text-red-500 text-[11px] mt-1 block">{formErrors.cardName}</span>}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-500 mb-1">Validade (MM/AA)</label>
                            <input
                              type="text"
                              name="cardExpiry"
                              value={formData.cardExpiry}
                              onChange={handleChange}
                              placeholder="12/30"
                              className={`w-full border rounded-[0.5rem] h-11 px-3 text-[14px] outline-none focus:ring-1 focus:ring-[#3bae8a] focus:border-[#3bae8a] bg-white transition ${formErrors.cardExpiry ? 'border-red-500 bg-red-50/10' : 'border-[#e2e8f0]'}`}
                            />
                            {formErrors.cardExpiry && <span className="text-red-500 text-[11px] mt-1 block">{formErrors.cardExpiry}</span>}
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-500 mb-1">CVV</label>
                            <input
                              type="text"
                              name="cardCvv"
                              value={formData.cardCvv}
                              onChange={handleChange}
                              placeholder="123"
                              className={`w-full border rounded-[0.5rem] h-11 px-3 text-[14px] outline-none focus:ring-1 focus:ring-[#3bae8a] focus:border-[#3bae8a] bg-white transition ${formErrors.cardCvv ? 'border-red-500 bg-red-50/10' : 'border-[#e2e8f0]'}`}
                            />
                            {formErrors.cardCvv && <span className="text-red-500 text-[11px] mt-1 block">{formErrors.cardCvv}</span>}
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-500 mb-1">Parcelas</label>
                          <select
                            name="installments"
                            value={formData.installments}
                            onChange={handleChange}
                            className="w-full border border-[#e2e8f0] bg-white rounded-[0.5rem] h-11 px-3 text-[14px] outline-none focus:ring-1 focus:ring-[#3bae8a] focus:border-[#3bae8a] cursor-pointer"
                          >
                            {getInstallmentOptions()}
                          </select>
                        </div>
                      </div>
                    )}

                  </div>

                  {/* Order Bump: Car Perfume */}
                  <div 
                    onClick={() => setPerfumeUpsell(!perfumeUpsell)}
                    className={`mt-4 border-2 rounded-[0.5rem] p-4 relative overflow-hidden transition-all duration-300 cursor-pointer select-none ${
                      perfumeUpsell 
                        ? 'border-amber-400 bg-amber-50/50 shadow-sm scale-[1.01]' 
                        : 'border-dashed border-slate-300 bg-slate-50/30 hover:border-slate-400 hover:bg-slate-50/60'
                    }`}
                  >
                    <div className="absolute top-0 right-0 bg-amber-500 text-white text-[8px] font-black px-2.5 py-0.5 rounded-bl uppercase tracking-wider animate-pulse">
                      Oferta Exclusiva
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="flex items-center h-full" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={perfumeUpsell}
                          onChange={(e) => setPerfumeUpsell(e.target.checked)}
                          className="h-5 w-5 rounded text-amber-600 focus:ring-amber-500 accent-amber-500 cursor-pointer transition-colors duration-200"
                        />
                      </div>
                      
                      {/* Product Thumbnail */}
                      <div className="w-14 h-14 sm:w-16 sm:h-16 flex-shrink-0 rounded-lg overflow-hidden border border-amber-200/50 bg-white shadow-xs">
                        <img 
                          src="/aromatizador_carro.png" 
                          alt="Perfume Automotivo Gel Premium" 
                          className="w-full h-full object-cover transform hover:scale-105 transition-transform duration-300"
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                          <span className="font-extrabold text-slate-800 text-xs sm:text-[13px] leading-tight">
                            Perfume Automotivo Luxo
                          </span>
                          <span className="bg-red-500 text-white text-[9px] font-black px-1.5 py-0.2 rounded uppercase tracking-wider">
                            -50%
                          </span>
                        </div>
                        <p className="text-slate-500 leading-tight text-[10px] sm:text-[11px] mb-1.5">
                          Aromatizador Gel Premium de alta fixação com fragrância importada Vanilla Black. Deixe seu veículo com aquele aroma agradável e sofisticado de carro novo.
                        </p>
                        <div className="flex items-baseline gap-2">
                          <span className="text-[13px] font-extrabold text-amber-600">R$ 14,90</span>
                          <span className="text-[10px] line-through text-slate-400">R$ 29,90</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {apiError && (
                    <div className="bg-red-50 border border-red-200 text-red-700 rounded-[0.5rem] p-3 text-xs font-semibold">
                      ⚠️ {apiError}
                    </div>
                  )}

                  <div className="pt-2 flex gap-3">
                    <button
                      type="button"
                      onClick={handleBack}
                      disabled={isApiLoading}
                      className="flex-1 border border-slate-300 text-slate-600 font-semibold h-12 rounded-[0.5rem] text-[14px] text-center transition hover:bg-slate-50 cursor-pointer"
                    >
                      Voltar
                    </button>
                    <button
                      type="submit"
                      disabled={isApiLoading}
                      className="flex-2 bg-[#3bae8a] hover:bg-[#2d8f70] text-white font-extrabold h-12 rounded-[0.5rem] text-[14px] text-center transition cursor-pointer flex items-center justify-center"
                    >
                      {isApiLoading ? (
                        <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      ) : (
                        'Finalizar Compra'
                      )}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="text-slate-400 text-xs font-semibold">
                  ③ Pagamento
                </div>
              )}
            </div>

            {/* STEP 4: SUCCESS / PIX QR */}
            {step === 4 && (
              <div className="bg-white rounded-[0.5rem] border border-[#e2e8f0] p-6 shadow-xs text-center space-y-6 animate-fadeIn">
                
                {!pixPaid ? (
                  <div className="space-y-6 py-2">
                    <div className="mx-auto w-12 h-12 bg-[#009EE3]/10 text-[#009EE3] rounded-full flex items-center justify-center text-xl shadow-inner">
                      ⚡
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-[#0f172a]">Quase lá! Conclua o pagamento via Pix</h3>
                      <p className="text-[11px] text-slate-400 mt-1">Escaneie o QR Code ou copie o código abaixo para pagar.</p>
                    </div>

                    {/* Dynamic QR Code from API */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-[#e2e8f0] max-w-[220px] mx-auto shadow-inner flex items-center justify-center">
                      <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(pixCode)}`}
                        alt="QR Code Pix"
                        className="w-44 h-44 rounded-lg bg-white p-1"
                      />
                    </div>

                    {/* Copy code input */}
                    <div className="space-y-1.5 max-w-sm mx-auto">
                      <label className="block text-[10px] text-slate-400 uppercase font-bold text-center">Código Copia e Cola</label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          readOnly
                          value={pixCode || 'Gerando código...'}
                          className="flex-1 bg-slate-50 border border-[#e2e8f0] rounded-[0.5rem] px-2.5 py-1.5 text-xs text-slate-500 font-mono outline-none"
                        />
                        <button
                          type="button"
                          onClick={handleCopyPix}
                          className="bg-[#3bae8a] hover:bg-[#2d8f70] text-white font-bold px-3 py-1.5 rounded-[0.5rem] text-xs transition cursor-pointer"
                        >
                          {copied ? 'Copiado!' : 'Copiar'}
                        </button>
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-500 leading-relaxed max-w-sm mx-auto">
                      Abra o app do seu banco, vá na seção **Pix** e selecione **Pix Copia e Cola**. A aprovação leva segundos!
                    </div>

                    <button
                      onClick={onClose}
                      className="w-full max-w-xs bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 rounded-[0.5rem] text-xs uppercase tracking-wide transition cursor-pointer"
                    >
                      Voltar para a Loja
                    </button>
                  </div>
                ) : (
                  <div className="space-y-6 py-4">
                    <div className="mx-auto w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-2xl shadow-inner animate-bounce">
                      ✓
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-[#0f172a]">Pagamento Aprovado!</h3>
                      <p className="text-xs text-slate-400 mt-1">Obrigado pela sua compra, {formData.nome.split(' ')[0]}!</p>
                    </div>

                    <div className="bg-slate-50 rounded-[0.5rem] p-5 border border-[#e2e8f0] max-w-md mx-auto text-left space-y-3 text-xs text-slate-700">
                      <div className="font-extrabold border-b border-[#e2e8f0] pb-2 text-slate-800 uppercase text-[11px]">Resumo da Entrega</div>
                      <div><b>Produto:</b> Tapete Bandeja Premium ({kit === 'basico' ? 'Kit Essencial Cabine' : 'Kit Premium Completo'}){(upsellItems.length > 0 || perfumeUpsell) && ` + ${[...upsellItems.map(i => i.title), ...(perfumeUpsell ? ['Perfume Automotivo Premium'] : [])].join(', ')}`}</div>
                      <div><b>Veículo:</b> {vehicle}</div>
                      <div><b>Endereço:</b> {formData.rua}, {formData.numero} {formData.complemento && `(${formData.complemento})`} - {formData.bairro}, {formData.cidade}/{formData.estado}</div>
                      <div><b>Rastreio:</b> O código de rastreamento será enviado no e-mail: <i>{formData.email}</i>.</div>
                    </div>

                    <button
                      onClick={onClose}
                      className="w-full max-w-xs bg-[#3bae8a] hover:bg-[#2d8f70] text-white font-extrabold py-3 rounded-[0.5rem] text-xs uppercase tracking-wide transition cursor-pointer"
                    >
                      Voltar para a Loja
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Testimonials List - Trust Badges */}
            {step === 1 && (
              <div className="mt-6 space-y-4 pt-2">
                {[
                  {
                    name: 'Entrega Rápida',
                    photo: 'https://assetsglobalbr.com/u/testimonies/c103d0d5.png',
                    testimony: 'Nossas entregas são realizadas pelo sistema dos Correios e empresas como Jadlog ou Caniao.'
                  },
                  {
                    name: 'Garantia Incondicional',
                    photo: 'https://assetsglobalbr.com/u/testimonies/2f15f298.png',
                    testimony: 'Todos os nossos produtos possuem garantia incondicional de 90 dias contra defeitos de fabricação, contanto a partir da data de entrega.'
                  },
                  {
                    name: 'Trocas e Devoluções',
                    photo: 'https://assetsglobalbr.com/u/testimonies/4dfb056d.png',
                    testimony: 'Aqui sua satisfação é prioridade: todos os pedidos tem direito a Trocas ou Devoluções garantidas em até 7 dias após o recebimento.'
                  }
                ].map((item, idx) => (
                  <div key={idx} className="bg-[#f5f5f5] rounded-[0.5rem] p-4 flex gap-4 items-start border border-[#e2e8f0] animate-fadeIn">
                    <img 
                      src={item.photo} 
                      alt={item.name} 
                      className="w-10 h-10 object-contain flex-shrink-0" 
                    />
                    <div className="space-y-1 flex-1">
                      <div className="flex justify-between items-center">
                        <h4 className="font-bold text-[12px] text-[#0f172a]">{item.name}</h4>
                      </div>
                      <p className="text-slate-500 text-[11.5px] leading-relaxed">
                        {item.testimony}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

          </div>

          {/* Right Column: Desktop Order Summary */}
          <div className="hidden lg:block space-y-4 sticky top-28">
            <div className="bg-white rounded-[0.5rem] p-5 border border-[#e2e8f0] shadow-xs space-y-4">
              <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-3 text-xs uppercase tracking-wider">
                Resumo da Compra
              </h3>

              {/* Product description row */}
              <div className="flex gap-3">
                <div className="w-14 h-14 bg-slate-50 rounded border border-[#e2e8f0] flex-shrink-0">
                  <img src="/produto-1.jpg" alt="Produto" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 text-xs">
                  <div className="font-bold text-slate-800 leading-normal line-clamp-2">
                    Tapete Bandeja Premium 100% Sob Medida
                  </div>
                  <div className="text-slate-400 mt-1 font-mono text-[10px]">
                    Veículo: <span className="text-[#FF5A00] font-bold">{vehicle || 'Não selecionado'}</span>
                  </div>
                  <div className="text-slate-400 font-mono text-[10px]">
                    Kit: <span className="text-slate-800 font-bold">{kit === 'basico' ? 'Kit Essencial Cabine' : 'Kit Premium Completo'}</span>
                  </div>
                </div>
              </div>

              {(upsellItems.length > 0 || perfumeUpsell) && (
                <>
                  <hr className="border-slate-100" />
                  <div className="space-y-2">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Acessórios:</div>
                    {upsellItems.map(item => (
                      <div key={item.id} className="flex justify-between items-center text-xs text-slate-600">
                        <span className="line-clamp-1 flex-1 pr-2">✚ {item.title}</span>
                        <span className="font-bold text-slate-800">R$ {item.price.toFixed(2).replace('.', ',')}</span>
                      </div>
                    ))}
                    {perfumeUpsell && (
                      <div className="flex justify-between items-center text-xs text-slate-600">
                        <span className="line-clamp-1 flex-1 pr-2">✚ Perfume Automotivo Premium</span>
                        <span className="font-bold text-slate-800">R$ 14,90</span>
                      </div>
                    )}
                  </div>
                </>
              )}

              <hr className="border-slate-100" />

              {/* Price lines */}
              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Preço Original</span>
                  <span className="line-through">R$ {totalOriginalPrice.toFixed(2).replace('.', ',')}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal</span>
                  <span>R$ {subtotal.toFixed(2).replace('.', ',')}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Envio ({shippingMethod === 'pac' ? 'PAC' : shippingMethod === 'sedex' ? 'SEDEX' : 'Jadlog'})</span>
                  <span className={shippingMethod === 'pac' ? 'text-emerald-600 font-bold' : 'text-slate-800 font-bold'}>
                    {shippingMethod === 'pac' ? 'Grátis' : `R$ ${shippingCost.toFixed(2).replace('.', ',')}`}
                  </span>
                </div>
                {isPix && (
                  <div className="flex justify-between text-emerald-600 font-bold">
                    <span>Desconto Pix (5%)</span>
                    <span>- R$ {(subtotal * 0.05).toFixed(2).replace('.', ',')}</span>
                  </div>
                )}
              </div>

              <hr className="border-slate-100" />

              {/* Final Total */}
              <div className="flex items-baseline justify-between">
                <span className="font-bold text-slate-800 text-xs uppercase">Valor Total</span>
                <div className="text-right">
                  <div className="text-2xl font-black text-[#FF5A00]">
                    R$ {finalPrice.toFixed(2).replace('.', ',')}
                  </div>
                  {isPix && <span className="text-[10px] text-emerald-600 font-bold block mt-0.5">Desconto Pix applied!</span>}
                </div>
              </div>

              {/* Security certification block */}
              <div className="bg-slate-50 rounded-lg p-3 text-[10px] text-slate-400 flex items-start gap-2 border border-[#e2e8f0]">
                <span className="text-xs">🛡️</span>
                <span className="leading-relaxed font-medium">
                  Seus dados estão 100% seguros. Criptografia SSL e ambiente de pagamento verificado.
                </span>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Checkout Footer containing accepted payments & CNPJ details */}
      <footer className="shrink-0 bg-slate-100 shadow-sm p-6 lg:p-8 lg:mt-4" style={{ background: '#f3f4f6', color: '#000000' }}>
        <div className="max-w-4xl mx-auto text-center text-[11px] text-slate-600 space-y-5">
          
          <div className="font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-2">Formas de pagamento:</div>
          
          {/* Payment cards brand SVGs spritesheet layout centered */}
          <div className="flex flex-wrap items-center justify-center gap-2 max-w-sm mx-auto">
            {/* Defs block injected inside the first SVG to be referenced by others */}
            <svg width="37.5" height="25" viewBox="44 0 36 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="shadow-sm border border-slate-200 rounded">
              <defs>
                <linearGradient id="paint0_linear_4004_5355" x1="103.579" y1="11.6368" x2="106.255" y2="15.5585" gradientUnits="userSpaceOnUse">
                  <stop stop-color="#E25416"></stop>
                  <stop offset="1" stop-color="#F9A020"></stop>
                </linearGradient>
                <clipPath id="clip1_4004_5355"><rect width="36" height="24" fill="white" transform="translate(44)"></rect></clipPath>
                <clipPath id="clip2_4004_5355"><rect width="36" height="24" fill="white" transform="translate(88)"></rect></clipPath>
                <clipPath id="clip3_4004_5355"><rect width="36" height="24" fill="white" transform="translate(132)"></rect></clipPath>
                <clipPath id="clip4_4004_5355"><rect width="36" height="24" fill="white" transform="translate(176)"></rect></clipPath>
                <clipPath id="clip5_4004_5355"><rect width="36" height="24" fill="white" transform="translate(220)"></rect></clipPath>
                <clipPath id="clip6_4004_5355"><rect width="36" height="24" fill="white" transform="translate(264)"></rect></clipPath>
                <clipPath id="clip7_4004_5355"><rect width="36" height="24" fill="white" transform="translate(308)"></rect></clipPath>
                <clipPath id="clip9_4004_5355"><rect width="36" height="24" fill="white" transform="translate(396)"></rect></clipPath>
              </defs>
              <g clip-path="url(#clip1_4004_5355)">
                <path fill-rule="evenodd" clip-rule="evenodd" d="M79.5383 20.9994C79.5383 22.6494 78.6499 23.5379H46.9999C45.3499 23.5379 44.4614 22.6494 44.4614 20.9994L44.4614 2.9994C44.4614 1.3494 45.3499 0.460938 46.9999 0.460938H76.9999C78.6499 0.460938 79.5383 1.3494 79.5383 2.9994V20.9994Z" fill="#152884"></path>
                <path fill-rule="evenodd" clip-rule="evenodd" d="M44.4614 14.0814V21.0018C44.4614 22.6518 45.3499 23.5379 46.9999 23.5379H76.7691C78.4191 23.5379 79.5383 22.6518 79.5383 21.0018V14.9022C72.9791 12.7158 62.3498 9.53277 44.4614 14.0814Z" fill="#FFED00"></path>
                <path fill-rule="evenodd" clip-rule="evenodd" d="M44.4614 11.7785L44.4614 15.2819C62.3498 10.7339 72.9791 13.9169 79.5383 16.1021V12.4433C74.967 10.7477 62.156 6.95211 44.4614 11.7785Z" fill="#EB212E"></path>
                <path fill-rule="evenodd" clip-rule="evenodd" d="M55.4648 9.6953C56.3643 7.20953 58.4228 5.06273 62 5.08613C65.5766 5.11013 67.9622 7.15313 68.606 9.8261C63.9968 9.3473 60.9243 9.2633 55.4648 9.6953Z" fill="#FFED00"></path>
                <path fill-rule="evenodd" clip-rule="evenodd" d="M54.361 16.3945L51.9268 20.0257H52.8106L53.509 18.9265H56.1627L56.9014 20.0257H57.8511L55.2574 16.3945H54.361ZM53.7549 18.5332H53.756L53.7537 18.5368L53.7549 18.5332ZM53.756 18.5332L54.4521 17.4743C54.5931 17.2559 54.7083 17.0212 54.7941 16.7759C54.9285 17.0356 55.0785 17.2871 55.2423 17.5288L55.904 18.5332H53.756ZM64.6989 20.0224V17.3951H65.3973V17.7928C65.5347 17.6363 65.7039 17.5108 65.8929 17.4239C66.0519 17.3632 66.2211 17.3327 66.3915 17.3344C66.6645 17.3351 66.9351 17.3824 67.1919 17.4743L66.9237 17.8931C66.7407 17.8288 66.5481 17.7959 66.3537 17.7952C66.1959 17.7928 66.0399 17.8228 65.8941 17.8835C65.7729 17.9303 65.6709 18.016 65.6049 18.1276C65.5179 18.2867 65.4729 18.4655 65.4753 18.6472V20.0231L64.6989 20.0224ZM70.4907 19.997C70.7811 19.931 71.0624 19.8314 71.3288 19.6994L71.3151 19.7066C71.336 19.8266 71.3895 19.9389 71.4699 20.0306H72.2828C72.1928 19.943 72.1251 19.8345 72.086 19.715C72.0404 19.4565 72.0231 19.193 72.0356 18.9302V18.3369C72.0423 18.1989 72.0291 18.0609 71.9979 17.9265C71.9499 17.8034 71.8659 17.6973 71.756 17.6234C71.5892 17.5238 71.4056 17.4561 71.2143 17.4237C70.8992 17.3642 70.5795 17.3378 70.2591 17.3438C69.9092 17.3397 69.5601 17.3709 69.2169 17.4362C68.9721 17.4758 68.7381 17.5665 68.5299 17.7014C68.3733 17.8142 68.2545 17.9714 68.1891 18.1526L68.9487 18.2126C69.0219 18.0374 69.1605 17.8977 69.3357 17.8233C69.5967 17.7369 69.872 17.699 70.1468 17.7129C70.4499 17.6954 70.7523 17.747 71.0324 17.8634C71.1776 17.9337 71.2652 18.0854 71.2532 18.2462V18.3621C70.7936 18.4406 70.3304 18.4917 69.8649 18.5157C69.5577 18.5366 69.3273 18.5606 69.1749 18.5829C68.984 18.6098 68.7969 18.6566 68.6163 18.7226C68.4657 18.7773 68.3289 18.8649 68.2155 18.9782C68.1189 19.0706 68.0631 19.1978 68.0619 19.3317C68.0619 19.5513 68.1957 19.7306 68.4681 19.8722C68.7405 20.0138 69.1275 20.0834 69.6315 20.0834C69.92 20.0853 70.208 20.0565 70.4907 19.997ZM69.9927 18.8768C70.4193 18.8492 70.8441 18.7928 71.2635 18.7076L71.2641 18.8665C71.2755 19.0256 71.2311 19.1833 71.1381 19.3124C70.9983 19.4612 70.8201 19.568 70.6227 19.6208C70.3635 19.6993 70.0935 19.7372 69.8223 19.7324C69.5865 19.7444 69.3513 19.7041 69.1335 19.6136C68.9775 19.5337 68.8977 19.4348 68.8977 19.316C68.9013 19.2325 68.9409 19.1552 69.0069 19.1048C69.0963 19.034 69.2019 18.986 69.3141 18.9649C69.5379 18.9193 69.7647 18.89 69.9927 18.8768ZM62.1153 19.638V20.0232L62.8125 20.0239V17.3964H62.0343V18.8071C62.0463 18.9876 62.0013 19.1676 61.9059 19.3212C61.7943 19.458 61.6419 19.5559 61.4715 19.6008C61.2597 19.6704 61.0377 19.7047 60.8151 19.7028C60.6141 19.7088 60.4137 19.6752 60.2259 19.6039C60.0891 19.5552 59.9775 19.4551 59.9145 19.3243C59.8743 19.1712 59.8587 19.0123 59.8671 18.8539V17.3971H59.0889V19.0243C59.0829 19.1652 59.0985 19.3068 59.1363 19.4431C59.1825 19.5739 59.2659 19.6884 59.3763 19.7724C59.5335 19.8811 59.7117 19.9572 59.8989 19.9956C60.1473 20.0563 60.4017 20.0856 60.6573 20.0839C61.2705 20.0839 61.7571 19.9351 62.1153 19.638Z" fill="#152884"></path>
                <path d="M77 0H47C45.35 0 44 1.35 44 3V21C44 22.65 45.35 24 47 24H77C78.65 24 80 22.65 80 21V3C80 1.35 78.65 0 77 0ZM77 0.6C78.3236 0.6 79.4 1.6764 79.4 3V21C79.4 22.3236 78.3236 23.4 77 23.4H47C45.6764 23.4 44.6 22.3236 44.6 21V3C44.6 1.6764 45.6764 0.6 47 0.6H77Z" fill="#B3B3B3"></path>
              </g>
            </svg>

            {/* SVG 1: Mastercard */}
            <svg width="37.5" height="25" viewBox="88 0 36 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="shadow-sm border border-slate-200 rounded">
              <g clip-path="url(#clip2_4004_5355)">
                <path fill-rule="evenodd" clip-rule="evenodd" d="M124 21C124 22.65 122.65 24 121 24H91C89.35 24 88 22.65 88 21V3C88 1.35 89.35 0 91 0H121C122.65 0 124 1.35 124 3V21Z" fill="white"></path>
                <path fill-rule="evenodd" clip-rule="evenodd" d="M123.419 16.6172V20.8296C123.419 21.216 123.34 21.5844 123.197 21.9198C123.054 22.2551 122.849 22.5584 122.594 22.8128C122.34 23.0673 122.037 23.2728 121.701 23.416C121.365 23.5587 120.997 23.6378 120.611 23.6378H107.998H95.3848L123.419 16.6172Z" fill="#F16821"></path>
                <path fill-rule="evenodd" clip-rule="evenodd" d="M106.876 9.94922C105.642 9.94922 104.641 10.9133 104.641 12.1024C104.641 13.3668 105.598 14.313 106.876 14.313C108.121 14.313 109.103 13.3554 109.103 12.1286C109.103 10.9063 108.127 9.94922 106.876 9.94922Z" fill="url(#paint0_linear_4004_5355)"></path>
                <path fill-rule="evenodd" clip-rule="evenodd" d="M101.037 12.0979C101.037 13.342 102.014 14.3067 103.271 14.3067C103.626 14.3067 103.931 14.237 104.305 14.0593V13.0876C103.974 13.418 103.683 13.551 103.309 13.551C102.477 13.551 101.886 12.9482 101.886 12.0916C101.886 11.2791 102.496 10.6384 103.271 10.6384C103.664 10.6384 103.962 10.7778 104.305 11.1148V10.143C103.943 9.95887 103.645 9.88281 103.29 9.88281C102.04 9.88281 101.037 10.8674 101.037 12.0979ZM111.204 14.3191H110.759L108.964 9.9777H109.864L110.993 12.8212L112.136 9.9777H113.031L111.204 14.3191ZM113.406 9.9777V14.211L115.747 14.2117V13.4944H114.231V12.352H115.69V11.6347H114.231V10.695H115.747V9.9777H113.406ZM119.385 14.211L118.052 12.4275C118.673 12.3016 119.016 11.8757 119.016 11.2288C119.016 10.4348 118.472 9.9777 117.519 9.9777H116.294V14.211H117.12V12.5105H117.228L118.37 14.211H119.385ZM118.167 11.2746C118.167 11.6997 117.886 11.9286 117.361 11.9286H117.12V10.6462H117.373C117.886 10.6468 118.167 10.8623 118.167 11.2746ZM99.317 14.314C98.688 14.314 98.2315 14.0667 97.8511 13.5079L98.3843 12.994C98.5742 13.3615 98.8919 13.5584 99.2844 13.5584C99.6532 13.5584 99.9255 13.3046 99.9255 12.9619C99.9255 12.7842 99.8444 12.6321 99.6795 12.5234C99.5964 12.4729 99.4314 12.3962 99.108 12.283C98.3338 12.0037 98.0672 11.7058 98.0672 11.1215C98.0672 10.4304 98.6387 9.91004 99.3867 9.91004C99.8501 9.91004 100.276 10.0685 100.631 10.3792L100.2 10.9444C99.9831 10.7027 99.7811 10.6011 99.5331 10.6011C99.1782 10.6011 98.9168 10.8044 98.9168 11.071C98.9168 11.2998 99.0645 11.42 99.5586 11.6041C100.498 11.9474 100.777 12.2517 100.777 12.9243C100.777 13.7418 100.174 14.314 99.317 14.314ZM97.5391 9.9777H96.7151V14.211H97.5391V9.9777ZM96.3347 12.0976C96.3347 10.8472 95.4013 9.9777 94.0627 9.9777H92.8506V14.211H94.0556C94.6968 14.211 95.1603 14.0589 95.5663 13.722C96.0489 13.3231 96.3347 12.7196 96.3347 12.0976ZM95.0274 13.1581C95.3131 12.9043 95.4838 12.4984 95.4838 12.0917C95.4838 11.6859 95.3131 11.292 95.0274 11.0376C94.7544 10.7902 94.4309 10.6949 93.8978 10.6949H93.6753V13.4944H93.8978C94.4309 13.4944 94.7672 13.3927 95.0274 13.1581Z" fill="#221F1F"></path>
                <path fill-rule="evenodd" clip-rule="evenodd" d="M104.891 12.3574C104.891 11.1683 105.893 10.2044 107.126 10.2044C107.695 10.2044 108.206 10.4019 108.595 10.7317C108.19 10.251 107.575 9.94922 106.871 9.94922C105.638 9.94922 104.636 10.9133 104.636 12.1024C104.636 12.7973 104.925 13.3956 105.398 13.7939C105.079 13.4135 104.891 12.9168 104.891 12.3574Z" fill="#A3310B"></path>
                <path d="M121 0H91C89.35 0 88 1.35 88 3V21C88 22.65 89.35 24 91 24H121C122.65 24 124 22.65 124 21V3C124 1.35 122.65 0 121 0ZM121 0.6C122.324 0.6 123.4 1.6764 123.4 3V21C123.4 22.3236 122.324 23.4 121 23.4H91C89.6764 23.4 88.6 22.3236 88.6 21V3C88.6 1.6764 89.6764 0.6 91 0.6H121Z" fill="#B3B3B3"></path>
              </g>
            </svg>

            {/* SVG 2: Elo */}
            <svg width="37.5" height="25" viewBox="132 0 36 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="shadow-sm border border-slate-200 rounded">
              <g clip-path="url(#clip3_4004_5355)">
                <path fill-rule="evenodd" clip-rule="evenodd" d="M168 21C168 22.65 166.65 24 165 24H135C133.35 24 132 22.65 132 21V3C132 1.35 133.35 0 135 0H165C166.65 0 168 1.35 168 3V21Z" fill="white"></path>
                <path d="M165 0H135C133.35 0 132 1.35 132 3V21C132 22.65 133.35 24 135 24H165C166.65 24 168 22.65 168 21V3C168 1.35 166.65 0 165 0ZM165 0.6C166.324 0.6 167.4 1.6764 167.4 3V21C167.4 22.3236 166.324 23.4 165 23.4H135C133.676 23.4 132.6 22.3236 132.6 21V3C132.6 1.6764 133.676 0.6 135 0.6H165Z" fill="#B3B3B3"></path>
                <path fill-rule="evenodd" clip-rule="evenodd" d="M152.903 17.0539C155.571 17.0539 157.733 14.8916 157.733 12.2242C157.733 9.55683 155.571 7.39453 152.903 7.39453C150.236 7.39453 148.074 9.55683 148.074 12.2242C148.074 14.8916 150.236 17.0539 152.903 17.0539Z" fill="#F79E1B"></path>
                <path fill-rule="evenodd" clip-rule="evenodd" d="M146.983 17.0422C149.651 17.0422 151.813 14.8799 151.813 12.2124C151.813 9.54512 149.651 7.38281 146.983 7.38281C144.316 7.38281 142.154 9.54512 142.154 12.2124C142.154 14.8799 144.316 17.0422 146.983 17.0422Z" fill="#EB001B"></path>
                <path fill-rule="evenodd" clip-rule="evenodd" d="M148.074 12.2143C148.07 13.7667 148.799 15.1495 149.934 16.0358C151.075 15.1545 151.81 13.7757 151.814 12.2238C151.817 10.6714 151.089 9.28865 149.953 8.40234C148.812 9.28246 148.077 10.6619 148.074 12.2143Z" fill="#FF5F00"></path>
              </g>
            </svg>

            {/* SVG 3: Amex */}
            <svg width="37.5" height="25" viewBox="176 0 36 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="shadow-sm border border-slate-200 rounded">
              <g clip-path="url(#clip4_4004_5355)">
                <path fill-rule="evenodd" clip-rule="evenodd" d="M212 21C212 22.65 210.65 24 209 24H179C177.35 24 176 22.65 176 21V3C176 1.35 177.35 0 179 0H209C210.65 0 212 1.35 212 3V21Z" fill="white"></path>
                <path d="M209 0H179C177.35 0 176 1.35 176 3V21C176 22.65 177.35 24 179 24H209C210.65 24 212 22.65 212 21V3C212 1.35 210.65 0 209 0ZM209 0.6C210.324 0.6 211.4 1.6764 211.4 3V21C211.4 22.3236 210.324 23.4 209 23.4H179C177.676 23.4 176.6 22.3236 176.6 21V3C176.6 1.6764 177.676 0.6 179 0.6H209Z" fill="#B3B3B3"></path>
                <path fill-rule="evenodd" clip-rule="evenodd" d="M192.326 17.4541C192.477 17.4598 192.745 17.4699 192.776 17.4767C193.832 17.4767 195.748 17.4448 195.862 17.428C197.961 17.1332 199.512 16.0551 200.481 14.1649C200.763 13.6163 200.918 13.0237 200.957 12.4053C201.067 10.6312 200.469 9.13863 199.151 7.94747C198.29 7.17021 197.268 6.72022 196.125 6.53794C196.023 6.52136 195.919 6.51269 195.815 6.50401C195.757 6.49914 195.698 6.49428 195.64 6.48801C195.599 6.4838 193.853 6.46094 192.797 6.46094C192.731 6.46931 192.538 6.47855 192.354 6.48736C192.195 6.495 192.042 6.50232 191.985 6.50847C190.66 6.65465 189.517 7.18586 188.588 8.1466C187.843 8.91785 187.385 9.84245 187.193 10.8971C187.164 11.0556 187.147 11.2161 187.13 11.3766C187.122 11.4585 187.113 11.5404 187.103 11.622C187.1 11.6489 187.093 11.6756 187.085 11.7021C187.083 11.7129 187.08 11.7237 187.077 11.7345V12.2664C187.083 12.307 187.088 12.3477 187.094 12.3884C187.105 12.4698 187.116 12.5512 187.126 12.6327C187.253 13.7264 187.683 14.6877 188.398 15.5215C189.091 16.3289 189.946 16.8937 190.96 17.2138C191.373 17.3444 191.795 17.4274 192.228 17.4503C192.238 17.4508 192.276 17.4522 192.326 17.4541ZM192.707 6.90254C195.53 6.93563 197.72 9.25537 197.697 11.9619C197.718 14.6992 195.466 17.0418 192.593 17.0141C189.867 16.9876 187.587 14.7978 187.588 11.9541C187.589 9.1152 189.89 6.87005 192.707 6.90254Z" fill="#074C95"></path>
                <path fill-rule="evenodd" clip-rule="evenodd" d="M193.81 14.9061C193.81 12.9377 193.81 10.9796 193.81 9.01953C194.681 9.29864 195.758 10.3088 195.826 11.8133C195.896 13.3841 194.846 14.5434 193.81 14.9061Z" fill="#074C95"></path>
                <path fill-rule="evenodd" clip-rule="evenodd" d="M191.484 14.911C190.524 14.5747 189.381 13.4587 189.47 11.7755C189.544 10.3791 190.533 9.34074 191.484 9.01953V14.911Z" fill="#074C95"></path>
              </g>
            </svg>

            {/* SVG 4: Diners */}
            <svg width="37.5" height="25" viewBox="220 0 36 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="shadow-sm border border-slate-200 rounded">
              <g clip-path="url(#clip5_4004_5355)">
                <path fill-rule="evenodd" clip-rule="evenodd" d="M256 21C256 22.65 254.65 24 253 24H223C221.35 24 220 22.65 220 21V3C220 1.35 221.35 0 223 0H253C254.65 0 256 1.35 256 3V21Z" fill="white"></path>
                <path d="M253 0H223C221.35 0 220 1.35 220 3V21C220 22.65 221.35 24 223 24H253C254.65 24 256 22.65 256 21V3C256 1.35 254.65 0 253 0ZM253 0.6C254.324 0.6 255.4 1.6764 255.4 3V21C255.4 22.3236 254.324 23.4 253 23.4H223C221.676 23.4 220.6 22.3236 220.6 21V3C220.6 1.6764 221.676 0.6 223 0.6H253Z" fill="#B3B3B3"></path>
                <path fill-rule="evenodd" clip-rule="evenodd" d="M243.052 14.7944C242.943 15.0549 242.834 15.3154 242.725 15.58C242.733 15.5819 242.741 15.5839 242.747 15.5854C242.758 15.5884 242.766 15.5904 242.774 15.5901C242.866 15.5901 242.959 15.5902 243.051 15.5904C243.561 15.5912 244.07 15.5919 244.58 15.5874C244.618 15.5874 244.676 15.5398 244.69 15.501C244.799 15.2163 244.904 14.9303 245.001 14.6417C245.032 14.5499 245.077 14.5198 245.173 14.5205C245.872 14.5245 246.572 14.5258 247.271 14.5198C247.387 14.5191 247.432 14.5506 247.453 14.6658C247.492 14.8849 247.539 15.1022 247.586 15.3208C247.604 15.4089 247.623 15.4973 247.642 15.586H249.345C249.342 15.5699 249.34 15.5544 249.338 15.5393C249.333 15.5058 249.328 15.4742 249.322 15.4434C249.265 15.1707 249.208 14.8981 249.151 14.6254C248.728 12.6036 248.304 10.5816 247.885 8.55863C247.864 8.45951 247.824 8.44075 247.734 8.44142C247.263 8.44477 246.793 8.44476 246.322 8.44276C245.911 8.44142 245.631 8.63296 245.474 9.00935C245 10.1407 244.527 11.2718 244.053 12.4029C243.72 13.2 243.386 13.9972 243.052 14.7944ZM246.809 11.6058C246.909 12.0837 247.009 12.5637 247.111 13.0484C246.593 13.0484 246.099 13.0484 245.58 13.0477C245.902 12.1623 246.218 11.2883 246.535 10.4144C246.544 10.4157 246.553 10.4164 246.561 10.417C246.644 10.8128 246.727 11.2086 246.809 11.6058Z" fill="#152884"></path>
                <path fill-rule="evenodd" clip-rule="evenodd" d="M243.152 8.63342C243.045 9.13437 242.938 9.62933 242.832 10.1283C242.629 10.0606 242.436 9.98693 242.238 9.93201C241.8 9.81081 241.354 9.75857 240.906 9.84561C240.744 9.87709 240.578 9.9454 240.443 10.0392C240.145 10.2461 240.136 10.5877 240.426 10.8066C240.648 10.9741 240.898 11.1027 241.137 11.2473C241.433 11.4268 241.747 11.5828 242.025 11.7871C242.734 12.3068 242.97 13.0288 242.729 13.8747C242.503 14.671 241.944 15.1485 241.198 15.4358C240.515 15.6989 239.803 15.7365 239.083 15.6783C238.631 15.6414 238.185 15.5623 237.755 15.4123C237.684 15.3876 237.614 15.3588 237.534 15.3279C237.646 14.8029 237.757 14.2879 237.864 13.7835C238.17 13.8914 238.463 14.0146 238.767 14.0977C239.221 14.2209 239.687 14.2658 240.15 14.162C240.33 14.1218 240.514 14.0394 240.663 13.9309C240.941 13.7273 240.962 13.3523 240.702 13.1259C240.506 12.9558 240.273 12.8272 240.051 12.6899C239.717 12.4837 239.357 12.3129 239.044 12.0791C237.998 11.2989 238.184 10.1202 238.728 9.41435C239.131 8.89059 239.684 8.6006 240.312 8.44522C241.237 8.21618 242.151 8.28181 243.049 8.5919C243.082 8.60394 243.112 8.61735 243.152 8.63342Z" fill="#152884"></path>
                <path fill-rule="evenodd" clip-rule="evenodd" d="M237.787 8.45547C237.738 8.68987 237.691 8.92025 237.641 9.14997C237.195 11.2388 236.746 13.3276 236.304 15.4172C236.275 15.5532 236.229 15.5994 236.086 15.596C235.581 15.586 235.077 15.592 234.573 15.592C234.527 15.592 234.481 15.592 234.416 15.592C234.464 15.3683 234.508 15.1588 234.553 14.9498C235.009 12.8153 235.467 10.6809 235.922 8.54588C235.936 8.47958 235.951 8.44141 236.031 8.44141C236.595 8.44476 237.159 8.44342 237.722 8.44408C237.739 8.44542 237.755 8.45011 237.787 8.45547Z" fill="#152884"></path>
                <path fill-rule="evenodd" clip-rule="evenodd" d="M226.501 8.44086H226.638C227.617 8.44086 228.596 8.44019 229.576 8.44086C230.093 8.44086 230.409 8.70473 230.505 9.21104C230.758 10.5499 231.012 11.8886 231.265 13.2273C231.266 13.2354 231.27 13.2434 231.283 13.2783C231.31 13.218 231.331 13.1771 231.348 13.1343C231.951 11.612 232.554 10.0897 233.152 8.5661C233.191 8.46497 233.242 8.43685 233.345 8.43751C233.896 8.4422 234.447 8.43952 234.998 8.43952H235.142C235.114 8.51118 235.093 8.56945 235.069 8.62637C234.113 10.9095 233.156 13.1919 232.201 15.4756C232.167 15.556 232.13 15.5915 232.036 15.5901C231.46 15.5854 230.883 15.5854 230.307 15.5901C230.217 15.5908 230.186 15.562 230.164 15.4763C229.679 13.5917 229.189 11.7084 228.705 9.82321C228.632 9.53991 228.477 9.34367 228.213 9.21774C227.682 8.96459 227.122 8.80385 226.554 8.66723C226.526 8.66053 226.498 8.65182 226.461 8.64178C226.468 8.60561 226.473 8.57347 226.48 8.54132C226.486 8.51386 226.492 8.48507 226.501 8.44086Z" fill="#152884"></path>
              </g>
            </svg>

            {/* SVG 5: Discover */}
            <svg width="37.5" height="25" viewBox="264 0 36 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="shadow-sm border border-slate-200 rounded">
              <g clip-path="url(#clip6_4004_5355)">
                <path fill-rule="evenodd" clip-rule="evenodd" d="M300 21C300 22.65 298.65 24 297 24H267C265.35 24 264 22.65 264 21V3C264 1.35 265.35 0 267 0H297C298.65 0 300 1.35 300 3V21Z" fill="white"></path>
                <path d="M297 0H267C265.35 0 264 1.35 264 3V21C264 22.65 265.35 24 267 24H297C298.65 24 300 22.65 300 21V3C300 1.35 298.65 0 297 0ZM297 0.6C298.324 0.6 299.4 1.6764 299.4 3V21C299.4 22.3236 298.324 23.4 297 23.4H267C265.676 23.4 264.6 22.3236 264.6 21V3C264.6 1.6764 265.676 0.6 267 0.6H297Z" fill="#B3B3B3"></path>
                <path d="M273.149 10.6705L273.921 12.2764H272.317L273.149 10.6705ZM287.331 13.1864H284.647V12.3163H287.331V11.5253H284.647V10.8135H287.331V10.141L289.321 11.9369L287.331 13.7411V13.1864ZM290.111 11.3031L288.795 10.0215H283.516V13.9774H288.621L290.068 12.6798L291.524 13.9774H292.884L290.805 11.9757L292.945 10.0215H291.525L290.111 11.3031ZM282.507 10.0215H280.665L279.279 12.6723L277.788 10.0215H275.946V13.859L274.043 10.0215H272.316L270.281 13.9774H271.526L271.938 13.0756H274.306L274.78 13.9774H277.069V10.7572L278.691 13.9774H279.761L281.375 10.8123V13.9774H282.506L282.507 10.0215ZM272.74 13.8953L272.326 14.7689H268.615L271.544 9.23047H278.538L279.244 10.4535L279.904 9.23047H282.388H283.641H289.334L290.14 9.9909L291.005 9.23047H295.384L292.275 11.9932L295.25 14.7689H291.012L290.064 13.9534L289.124 14.7689H283.641H282.388H273.997L273.542 13.8953H272.74Z" fill="#129AD7"></path>
              </g>
            </svg>

            {/* SVG 6: Aura */}
            <svg width="37.5" height="25" viewBox="308 0 36 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="shadow-sm border border-slate-200 rounded">
              <g clip-path="url(#clip7_4004_5355)">
                <path fill-rule="evenodd" clip-rule="evenodd" d="M344 21C344 22.65 342.65 24 341 24H311C309.35 24 308 22.65 308 21V3C308 1.35 309.35 0 311 0H341C342.65 0 344 1.35 344 3V21Z" fill="white"></path>
                <path d="M341 0H311C309.35 0 308 1.35 308 3V21C308 22.65 309.35 24 311 24H341C342.65 24 344 22.65 344 21V3C344 1.35 342.65 0 341 0ZM341 0.6C342.324 0.6 343.4 1.6764 343.4 3V21C343.4 22.3236 342.324 23.4 341 23.4H311C309.676 23.4 308.6 22.3236 308.6 21V3C308.6 1.6764 309.676 0.6 311 0.6H341Z" fill="#B3B3B3"></path>
                <path d="M322.844 15.4258C323.094 15.4267 323.341 15.378 323.571 15.2826C323.802 15.1872 324.011 15.0469 324.187 14.87L326.124 12.9324C326.193 12.8668 326.284 12.8302 326.38 12.8302C326.474 12.8302 326.566 12.8668 326.635 12.9324L328.58 14.878C328.756 15.0547 328.965 15.1947 329.196 15.29C329.426 15.3852 329.674 15.4339 329.923 15.433H330.305L327.85 17.8873C327.667 18.0698 327.451 18.2147 327.213 18.3135C326.975 18.4123 326.719 18.4632 326.462 18.4632C326.204 18.4632 325.948 18.4123 325.71 18.3135C325.472 18.2147 325.256 18.0698 325.073 17.8873L322.608 15.4258H322.844ZM329.923 8.56908C329.674 8.56832 329.427 8.61703 329.196 8.71235C328.966 8.80769 328.757 8.94775 328.581 9.12447L326.638 11.071C326.571 11.1384 326.479 11.1764 326.383 11.1764C326.288 11.1764 326.196 11.1384 326.128 11.071L324.191 9.13285C324.015 8.95591 323.806 8.81565 323.575 8.72024C323.345 8.62483 323.098 8.57616 322.848 8.57707H322.608L325.073 6.11395C325.442 5.74585 325.941 5.53906 326.462 5.53906C326.982 5.53906 327.481 5.74585 327.85 6.11395L330.305 8.56867L329.923 8.56908Z" fill="#4AB7A8"></path>
                <path d="M320.575 10.6108L322.041 9.14431H322.844C323.196 9.1447 323.534 9.28408 323.784 9.53156L325.721 11.4693C325.808 11.5561 325.91 11.625 326.024 11.672C326.137 11.7191 326.258 11.7432 326.38 11.7432C326.503 11.7432 326.624 11.7191 326.737 11.672C326.85 11.625 326.953 11.5561 327.039 11.4693L328.984 9.52399C329.234 9.27623 329.572 9.13702 329.924 9.13672H330.876L332.348 10.6092C332.716 10.9774 332.923 11.4767 332.923 11.9973C332.923 12.5179 332.716 13.0172 332.348 13.3854L330.876 14.8579H329.923C329.571 14.8579 329.233 14.7181 328.983 14.4707L327.039 12.5245C326.861 12.3551 326.625 12.2605 326.38 12.2605C326.134 12.2605 325.899 12.3551 325.721 12.5245L323.783 14.4623C323.533 14.7097 323.196 14.8495 322.844 14.8495H322.041L320.575 13.387C320.393 13.2048 320.248 12.9884 320.15 12.7501C320.051 12.512 320 12.2568 320 11.9989C320 11.7411 320.051 11.4858 320.15 11.2476C320.248 11.0095 320.393 10.7931 320.575 10.6108Z" fill="#4AB7A8"></path>
              </g>
            </svg>

            {/* SVG 7: Hippo */}
            <svg width="37.5" height="25" viewBox="396 0 36 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="shadow-sm border border-slate-200 rounded">
              <g clip-path="url(#clip9_4004_5355)">
                <path fill-rule="evenodd" clip-rule="evenodd" d="M432 21C432 22.65 430.65 24 429 24H399C397.35 24 396 22.65 396 21V3C396 1.35 397.35 0 399 0H429C430.65 0 432 1.35 432 3V21Z" fill="white"></path>
                <path d="M429 0H399C397.35 0 396 1.35 396 3V21C396 22.65 397.35 24 399 24H429C430.65 24 432 22.65 432 21V3C432 1.35 430.65 0 429 0ZM429 0.6C430.324 0.6 431.4 1.6764 431.4 3V21C431.4 22.3236 430.324 23.4 429 23.4H399C397.676 23.4 396.6 22.3236 396.6 21V3C396.6 1.6764 397.676 0.6 399 0.6H429Z" fill="#B3B3B3"></path>
                <path fill-rule="evenodd" clip-rule="evenodd" d="M420.282 8.62109V14.3966L421.284 14.8122L420.81 15.9511L419.818 15.5393C419.596 15.4429 419.445 15.2953 419.33 15.1294C419.22 14.9591 419.138 14.7264 419.138 14.413V8.62173L420.282 8.62109ZM424.453 11.2019C424.257 11.2019 424.07 11.2334 423.895 11.2921L423.505 10.1241C423.81 10.0226 424.131 9.97022 424.453 9.97086C425.9 9.97086 427.108 10.9988 427.385 12.3648L426.178 12.6108C426.015 11.8067 425.304 11.2019 424.453 11.2019ZM422.471 15.1997L423.286 14.2771C422.922 13.9549 422.693 13.4837 422.693 12.9584C422.693 12.4337 422.922 11.9632 423.286 11.641L422.47 10.7184C421.851 11.2664 421.461 12.0673 421.461 12.9584C421.46 13.8502 421.851 14.6517 422.471 15.1997ZM426.178 13.3151C426.014 14.1179 425.304 14.722 424.453 14.722C424.263 14.722 424.074 14.6918 423.894 14.6312L423.503 15.7992C423.809 15.9014 424.13 15.9537 424.453 15.953C425.899 15.953 427.106 14.9264 427.385 13.5616L426.178 13.3151ZM412.681 12.9157C412.706 11.2646 414.065 9.94594 415.716 9.97123C417.117 9.99265 418.277 10.974 418.581 12.2787L413.164 14.5945C412.85 14.1133 412.671 13.535 412.681 12.9157ZM413.921 13.1444C413.913 13.075 413.908 13.0044 413.91 12.9325C413.926 11.9594 414.726 11.183 415.699 11.1988C416.228 11.2058 416.698 11.4486 417.016 11.8232L413.921 13.1444ZM415.643 14.7238C416.132 14.7308 416.575 14.5378 416.901 14.22L417.76 15.1022C417.211 15.6401 416.455 15.9662 415.626 15.9536C415.078 15.946 414.542 15.7871 414.079 15.4938L414.734 14.4507C414.998 14.6179 415.308 14.7182 415.643 14.7238Z" fill="#221F1F"></path>
                <path fill-rule="evenodd" clip-rule="evenodd" d="M408.342 12.8672C408.074 14.1827 406.911 15.1722 405.516 15.1722C405.205 15.1722 404.896 15.1224 404.601 15.024L403.96 16.938C404.462 17.1058 404.987 17.1909 405.516 17.1902C407.886 17.1902 409.863 15.5083 410.319 13.2727L408.342 12.8672Z" fill="#ED412F"></path>
                <path fill-rule="evenodd" clip-rule="evenodd" d="M402.268 15.9625L403.605 14.4508C403.009 13.9223 402.632 13.151 402.632 12.2908C402.632 11.4312 403.009 10.66 403.605 10.1321L402.268 8.62109C401.254 9.51916 400.615 10.8302 400.615 12.2914C400.615 13.7527 401.254 15.0645 402.268 15.9625Z" fill="#1AA5DF"></path>
                <path fill-rule="evenodd" clip-rule="evenodd" d="M404.601 9.54845C404.895 9.45005 405.204 9.40029 405.515 9.40029C406.911 9.40029 408.075 10.3917 408.342 11.7078L410.319 11.3049C409.866 9.06728 407.887 7.38282 405.515 7.38282C404.987 7.38219 404.463 7.46732 403.961 7.63445L404.601 9.54845Z" fill="#FFCA32"></path>
              </g>
            </svg>
          </div>

          <div className="flex justify-center items-center mt-4 text-[#898792]">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" className="lucide lucide-lock mr-1.5 size-4 text-[#24bfa5]">
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span className="text-[10px] font-bold text-slate-800 leading-tight">PAGAMENTO 100% SEGURO</span>
          </div>

          <div className="space-y-1 mt-6 text-slate-500 text-[10px]">
            <div className="font-bold text-slate-700 text-xs">CarTapetes Ltda.</div>
            <div>CNPJ: 03.570.101/0001-96 | Endereço: Rua Rua Irma Amelia, 155, São Paulo, Cep 03156-150</div>
            <div className="text-slate-400 mt-2">© 2026 CarTapetes. Todos os direitos reservados.</div>
          </div>
        </div>
      </footer>

    </div>
  );
}

