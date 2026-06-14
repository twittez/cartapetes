export default function Navbar() {
  return (
    <header className="sticky top-0 z-40 bg-black border-b border-gray-900 shadow-md">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-4">
        {/* Navigation Links (Desktop) */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-gray-300">
          <a href="#produto" className="hover:text-[#FF5A00] transition-colors">Produto</a>
          <a href="#beneficios" className="hover:text-[#FF5A00] transition-colors">Benefícios</a>
          <a href="#avaliacoes" className="hover:text-[#FF5A00] transition-colors">Avaliações</a>
        </nav>

        {/* Brand Logo Image */}
        <a href="#" className="flex-grow md:flex-grow-0 flex justify-center">
          <img 
            src="/logo-whats-cropped.png" 
            alt="CarTapetes Logo" 
            className="h-20 sm:h-24 w-auto object-contain" 
          />
        </a>

        {/* Icons */}
        <div className="flex items-center gap-3 text-white">
          <button aria-label="Buscar" className="p-2 hover:text-[#FF5A00] transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </button>
          
          <button aria-label="Conta" className="p-2 hover:text-[#FF5A00] transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          </button>
          
          <button aria-label="Carrinho" className="p-2 relative hover:text-[#FF5A00] transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="21" r="1"></circle>
              <circle cx="20" cy="21" r="1"></circle>
              <path d="M1 1h4l2.7 12.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"></path>
            </svg>
            <span className="absolute -top-0.5 -right-0.5 bg-[#FF5A00] text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
              0
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
