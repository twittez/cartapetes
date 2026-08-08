/**
 * orderService.js
 * Central de criação e gestão de pedidos.
 *
 * REGRAS:
 * - Apenas este arquivo cria/atualiza pedidos no Supabase.
 * - Inclui UTMs capturados da URL.
 * - Idempotente: não duplica pedidos com o mesmo transaction_id.
 * - Dispara eventos de rastreamento para a UTMify (waiting_payment ao gerar PIX, e paid ao confirmar).
 * - Notifica o Wepink Painel no Render para exibição imediata no painel admin.
 */

import { supabase } from '../utils/supabase';
import { getStoredUTMs } from '../tracking/utmCapture';

/**
 * Gera um order ID único no formato CP-TIMESTAMP-RANDOM
 */
export function generateOrderId() {
  return `CP-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`;
}

/**
 * Envia notificação para o Wepink Painel no Render (backup de exibição no painel)
 */
export async function sendPainelNotification(leadData) {
  try {
    const RENDER_API = 'https://wepink-checkout.onrender.com/api/checkout-pix';
    fetch(RENDER_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(leadData),
    }).then(r => {
      if (r.ok) console.log(`[OrderService] Pedido ${leadData.transaction_id} notificado ao Wepink Painel ✓`);
    }).catch(e => console.warn('[OrderService] Falha ao notificar Wepink Painel:', e.message));
  } catch (e) {}
}

/**
 * Envia evento para a Netlify Function utmify-order.
 * @param {object} params
 */
export async function sendUtmifyEvent({ orderId, status, value, formData, vehicle }) {
  try {
    const utms = getStoredUTMs();
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
 * Inclui automaticamente os UTMs capturados da URL.
 * Dispara evento 'waiting_payment' para a UTMify.
 * Notifica o Wepink Painel no Render.
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
  const utms = getStoredUTMs();
  const effectiveTxId = transactionId || orderId;

  const leadData = {
    created_at: new Date().toISOString(),
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
    // UTMs capturados da URL
    utm_source: utms.utm_source || null,
    utm_medium: utms.utm_medium || null,
    utm_campaign: utms.utm_campaign || null,
    utm_content: utms.utm_content || null,
    utm_term: utms.utm_term || null,
    fbclid: utms.fbclid || null,
    gclid: utms.gclid || null,
    // IP do cliente
    client_ip: clientIp || null,
  };

  // 1. Envia notificação para o Wepink Painel (exibição imediata)
  sendPainelNotification(leadData);

  // 2. Envia evento de venda pendente para a UTMify (com trava de deduplicação por orderId)
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
  } else {
    console.log(`[OrderService] UTMify waiting_payment já notificado para ${effectiveTxId}, ignorando envio duplicado.`);
  }

  // 3. Salva no Supabase
  if (!supabase) {
    console.warn('[OrderService] Supabase não configurado — pedido não salvo remotamente.');
    return { success: false, error: 'Supabase não configurado' };
  }

  try {
    const { error } = await supabase
      .from('leads')
      .upsert([leadData], { onConflict: 'transaction_id', ignoreDuplicates: true });

    if (error) {
      console.warn('[OrderService] Upsert falhou, tentando insert:', error.message);
      const { error: insertError } = await supabase.from('leads').insert([leadData]);
      if (insertError) {
        console.error('[OrderService] Insert também falhou:', insertError.message);
        return { success: false, error: insertError.message };
      }
    }

    console.log(`[OrderService] ✅ Pedido ${effectiveTxId} criado no Supabase com UTMs:`, {
      utm_source: utms.utm_source,
      utm_campaign: utms.utm_campaign,
    });
    return { success: true };
  } catch (err) {
    console.error('[OrderService] Exceção:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Atualiza o status de um pedido existente no Supabase.
 * Dispara evento 'paid' para a UTMify e notifica o painel.
 */
export async function updateOrderStatus(transactionId, status, extraData = {}) {
  if (!transactionId) return { success: false };

  // Notifica o Wepink Painel
  sendPainelNotification({
    transaction_id: transactionId,
    status: status === 'pago' ? 'pago' : status,
    totalPrice: extraData.value || extraData.finalPrice,
  });

  if (supabase) {
    try {
      const { error } = await supabase
        .from('leads')
        .update({ status })
        .eq('transaction_id', transactionId);

      if (error) {
        console.error('[OrderService] Erro ao atualizar status no Supabase:', error.message);
      } else {
        console.log(`[OrderService] ✅ Status do pedido ${transactionId} → ${status}`);
      }
    } catch (err) {
      console.error('[OrderService] Exceção ao atualizar no Supabase:', err);
    }
  }

  // Dispara atualização para a UTMify se for pago
  if (status === 'pago' || status === 'paid') {
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
