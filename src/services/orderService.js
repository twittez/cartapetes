/**
 * orderService.js
 * ÚNICA fonte de criação de pedidos no Supabase.
 *
 * REGRAS:
 * - Apenas este arquivo cria pedidos
 * - Usa transaction_id único gerado aqui
 * - Inclui UTMs capturados da URL
 * - Idempotente: não duplica pedidos com o mesmo transaction_id
 * - NÃO envia nada para UTMify (só o beehive-webhook.js faz isso)
 * - NÃO chama o Render (o Render só lê o Supabase)
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
 * Cria um pedido com status 'pendente' no Supabase.
 * Inclui automaticamente os UTMs capturados da URL.
 *
 * @param {object} params
 * @param {string} params.orderId - ID único do pedido (gerado por generateOrderId)
 * @param {string} params.transactionId - ID da transação da Beehive (data.id)
 * @param {object} params.formData - Dados do formulário do cliente
 * @param {number} params.finalPrice - Valor final calculado
 * @param {string} params.vehicle - Veículo selecionado
 * @param {string} params.kit - Kit selecionado (basico/premium)
 * @param {Array}  params.upsellItems - Itens de upsell
 * @param {boolean} params.perfumeUpsell - Upsell de perfume
 * @param {string} params.paymentMethod - Método de pagamento
 * @param {string} params.trackingCode - Código de rastreio
 * @param {string} [params.clientIp] - IP do cliente (injetado pelo beehive-pix.js)
 * @returns {Promise<{success: boolean, error?: string}>}
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
    // IP do cliente (para controle de fraude)
    client_ip: clientIp || null,
  };

  if (!supabase) {
    console.warn('[OrderService] Supabase não configurado — pedido não salvo remotamente.');
    return { success: false, error: 'Supabase não configurado' };
  }

  try {
    // Usa upsert para garantir idempotência: se já existir com esse transaction_id, ignora
    const { error } = await supabase
      .from('leads')
      .upsert([leadData], { onConflict: 'transaction_id', ignoreDuplicates: true });

    if (error) {
      // Fallback: tenta insert simples se upsert falhar (schema sem UNIQUE constraint ainda)
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
 * Chamado pelo polling local (quando Beehive webhook não chegar a tempo).
 *
 * @param {string} transactionId
 * @param {string} status - 'pago' | 'negado' | 'pendente'
 */
export async function updateOrderStatus(transactionId, status) {
  if (!supabase || !transactionId) return { success: false };

  try {
    const { error } = await supabase
      .from('leads')
      .update({ status })
      .eq('transaction_id', transactionId);

    if (error) {
      console.error('[OrderService] Erro ao atualizar status:', error.message);
      return { success: false, error: error.message };
    }

    console.log(`[OrderService] ✅ Status do pedido ${transactionId} → ${status}`);
    return { success: true };
  } catch (err) {
    console.error('[OrderService] Exceção ao atualizar:', err);
    return { success: false, error: err.message };
  }
}
