-- ============================================================
-- MIGRATION 001: REFATORAÇÃO DE SCHEMAS CARTAPETES
-- ============================================================

-- 1. TABELA DE PEDIDOS (leads)
CREATE TABLE IF NOT EXISTS public.leads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    transaction_id TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    nome TEXT,
    email TEXT,
    cpf TEXT,
    telefone TEXT,
    cep TEXT,
    rua TEXT,
    numero TEXT,
    complemento TEXT,
    bairro TEXT,
    cidade TEXT,
    estado TEXT,
    vehicle TEXT,
    kit TEXT,
    upsell_items JSONB DEFAULT '[]'::jsonb,
    perfume_upsell BOOLEAN DEFAULT false,
    final_price NUMERIC(10,2) DEFAULT 0.00,
    payment_method TEXT DEFAULT 'pix',
    status TEXT DEFAULT 'pendente', -- 'pendente', 'pago', 'cancelado', 'expirado', 'negado'
    tracking_code TEXT,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    utm_content TEXT,
    utm_term TEXT,
    fbclid TEXT,
    gclid TEXT,
    origem_trafego TEXT DEFAULT 'Direto',
    client_ip TEXT
);

-- Garantir constraint de unicidade no transaction_id se a tabela já existir
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'leads_transaction_id_key'
    ) THEN
        ALTER TABLE public.leads ADD CONSTRAINT leads_transaction_id_key UNIQUE (transaction_id);
    END IF;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- Índices de performance para busca no painel admin
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON public.leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_transaction_id ON public.leads(transaction_id);

-- 2. TABELA DE VISITANTES ONLINE (online_leads)
CREATE TABLE IF NOT EXISTS public.online_leads (
    session_id TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    last_seen TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    ip TEXT,
    cidade TEXT DEFAULT 'São Paulo',
    estado TEXT DEFAULT 'SP',
    nome TEXT,
    email TEXT,
    status_etapa TEXT DEFAULT 'Loja', -- 'Loja', 'Checkout', 'Pagamento', 'Rastreio'
    dispositivo TEXT DEFAULT 'Desktop',
    navegador TEXT,
    url_atual TEXT,
    modelo_carro TEXT,
    origem_trafego TEXT DEFAULT 'Direto',
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    utm_content TEXT,
    utm_term TEXT,
    fbclid TEXT,
    gclid TEXT
);

CREATE INDEX IF NOT EXISTS idx_online_leads_last_seen ON public.online_leads(last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_online_leads_etapa ON public.online_leads(status_etapa);

-- 3. TABELA DE EVENTOS AO VIVO (events)
CREATE TABLE IF NOT EXISTS public.events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    session_id TEXT,
    event_type TEXT NOT NULL, -- 'page_view', 'vehicle_selected', 'initiate_checkout', 'payment_generated', 'purchase'
    description TEXT,
    vehicle TEXT,
    amount NUMERIC(10,2),
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_events_created_at ON public.events(created_at DESC);

-- Habilitar RLS e publicar para Supabase Realtime
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.online_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso público/anônimo para leitura e escrita
DROP POLICY IF EXISTS "Public read leads" ON public.leads;
CREATE POLICY "Public read leads" ON public.leads FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public insert leads" ON public.leads;
CREATE POLICY "Public insert leads" ON public.leads FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public update leads" ON public.leads;
CREATE POLICY "Public update leads" ON public.leads FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Public read online_leads" ON public.online_leads;
CREATE POLICY "Public read online_leads" ON public.online_leads FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public insert/update online_leads" ON public.online_leads;
CREATE POLICY "Public insert/update online_leads" ON public.online_leads FOR ALL USING (true);

DROP POLICY IF EXISTS "Public events" ON public.events;
CREATE POLICY "Public events" ON public.events FOR ALL USING (true);

-- Adicionar tabelas à publicação Realtime se necessário
ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.online_leads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.events;
