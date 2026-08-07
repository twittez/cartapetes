import { useEffect, useState } from 'react';

/**
 * BlockedPage — exibida quando o IP do usuário atingiu o limite de pedidos.
 * Bloqueia acesso à estrutura do site com tela de aviso.
 */
export default function BlockedPage() {
  const [countdown, setCountdown] = useState(null);

  useEffect(() => {
    // Trava o scroll da página principal
    document.body.style.overflow = 'hidden';

    // Remove qualquer interação com elementos de fundo
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  return (
    <div
      id="blocked-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
        color: '#fff',
        textAlign: 'center',
        padding: '24px',
        userSelect: 'none',
      }}
    >
      {/* Ícone de bloqueio */}
      <div style={{
        width: 100,
        height: 100,
        borderRadius: '50%',
        background: 'rgba(239, 68, 68, 0.15)',
        border: '2px solid rgba(239, 68, 68, 0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 32,
        animation: 'pulse 2s infinite',
      }}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
      </div>

      {/* Título */}
      <h1 style={{
        fontSize: 'clamp(22px, 5vw, 36px)',
        fontWeight: 800,
        letterSpacing: '-0.5px',
        marginBottom: 12,
        color: '#fff',
      }}>
        Acesso Temporariamente Restrito
      </h1>

      {/* Subtítulo */}
      <p style={{
        fontSize: 'clamp(14px, 3vw, 18px)',
        color: 'rgba(255,255,255,0.65)',
        maxWidth: 480,
        lineHeight: 1.6,
        marginBottom: 40,
      }}>
        Identificamos múltiplos pedidos originados do seu dispositivo.
        Por segurança, o acesso foi temporariamente suspenso.
      </p>

      {/* Separador */}
      <div style={{
        width: 60,
        height: 2,
        background: 'linear-gradient(90deg, transparent, rgba(239,68,68,0.6), transparent)',
        marginBottom: 32,
      }} />

      {/* Contato */}
      <p style={{
        fontSize: 14,
        color: 'rgba(255,255,255,0.45)',
        marginBottom: 8,
      }}>
        Se acredita que isso é um erro, entre em contato:
      </p>
      <a
        href="https://wa.me/5511999999999?text=Estou%20com%20o%20acesso%20bloqueado%20no%20site%20CartaPetes"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          background: 'rgba(34, 197, 94, 0.15)',
          border: '1px solid rgba(34, 197, 94, 0.3)',
          color: '#22c55e',
          padding: '10px 24px',
          borderRadius: 12,
          textDecoration: 'none',
          fontSize: 15,
          fontWeight: 600,
          transition: 'all 0.2s',
        }}
        onMouseEnter={e => { e.target.style.background = 'rgba(34,197,94,0.25)'; }}
        onMouseLeave={e => { e.target.style.background = 'rgba(34,197,94,0.15)'; }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="#22c55e">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
        Suporte via WhatsApp
      </a>

      {/* Rodapé */}
      <p style={{
        position: 'absolute',
        bottom: 20,
        fontSize: 12,
        color: 'rgba(255,255,255,0.2)',
      }}>
        CartaPetes © {new Date().getFullYear()} — Proteção Anti-Fraude
      </p>

      <style>{`
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.3); }
          50% { box-shadow: 0 0 0 16px rgba(239, 68, 68, 0); }
        }
      `}</style>
    </div>
  );
}
