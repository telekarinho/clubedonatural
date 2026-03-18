/* ============================================
   CLUBE DO NATURAL — Catálogo Page Controller
   ============================================ */

const CatalogoPage = {
  init() {
    Search.init();
    Filters.init();

    this.filterAndRender();
  },

  getFilteredProducts() {
    let products = DataProducts.filter(p => p.ativo);

    // Category filter
    const category = AppState.get('currentCategory');
    if (category && category !== 'todos') {
      products = products.filter(p => p.categoria === category);
    }

    // Search query
    const query = AppState.get('searchQuery');
    if (query) {
      products = products.filter(p =>
        p.nome.toLowerCase().includes(query) ||
        p.descricao.toLowerCase().includes(query) ||
        (p.beneficios && p.beneficios.some(b => b.toLowerCase().includes(query)))
      );
    }

    // Selo filters
    const filters = AppState.get('filters') || {};
    if (filters.organico) products = products.filter(p => p.selos.includes('organico'));
    if (filters.vegano) products = products.filter(p => p.selos.includes('vegano'));
    if (filters.sem_gluten) products = products.filter(p => p.selos.includes('sem_gluten'));
    if (filters.sem_lactose) products = products.filter(p => p.selos.includes('sem_lactose'));
    if (filters.integral) products = products.filter(p => p.selos.includes('integral'));
    if (filters.sem_acucar) products = products.filter(p => p.selos.includes('sem_acucar'));

    // Sort
    const sortBy = AppState.get('sortBy');
    switch (sortBy) {
      case 'menor_preco':
        products.sort((a, b) => a.variacoes[0].preco - b.variacoes[0].preco);
        break;
      case 'maior_preco':
        products.sort((a, b) => b.variacoes[0].preco - a.variacoes[0].preco);
        break;
      case 'az':
        products.sort((a, b) => a.nome.localeCompare(b.nome));
        break;
      default: // relevancia - destaques primeiro
        products.sort((a, b) => (b.destaque ? 1 : 0) - (a.destaque ? 1 : 0));
    }

    return products;
  },

  filterAndRender() {
    const products = this.getFilteredProducts();
    const grid = document.getElementById('product-grid');
    const count = document.getElementById('results-count');

    if (grid) ProductCard.renderGrid(products, grid);
    if (count) count.textContent = `${products.length} produto${products.length !== 1 ? 's' : ''}`;
  },
};

// Auto-init when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  Storage.init();
  AppState.restore();
  Toast.init();
  Cart.init();

  // === Hamburger Menu Toggle ===
  const hamburgerBtn = document.getElementById('btn-hamburger');
  const mainNav = document.getElementById('main-nav');
  if (hamburgerBtn && mainNav) {
    hamburgerBtn.addEventListener('click', () => {
      const isOpen = mainNav.classList.toggle('open');
      hamburgerBtn.textContent = isOpen ? '\u2715' : '\u2630';
      hamburgerBtn.setAttribute('aria-expanded', isOpen);
    });
    mainNav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        mainNav.classList.remove('open');
        hamburgerBtn.textContent = '\u2630';
        hamburgerBtn.setAttribute('aria-expanded', 'false');
      });
    });
    document.addEventListener('click', (e) => {
      if (!mainNav.contains(e.target) && !hamburgerBtn.contains(e.target)) {
        mainNav.classList.remove('open');
        hamburgerBtn.textContent = '\u2630';
        hamburgerBtn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // LGPD Cookie Banner
  if (!Storage.getConsent()) {
    const banner = document.getElementById('cookie-banner');
    if (banner) banner.classList.add('active');
  }
  const acceptCookies = document.getElementById('cookie-accept');
  if (acceptCookies) {
    acceptCookies.addEventListener('click', () => {
      Storage.setConsent({ analytics: true, marketing: true });
      const b = document.getElementById('cookie-banner');
      if (b) b.classList.remove('active');
    });
  }
  const rejectCookies = document.getElementById('cookie-reject');
  if (rejectCookies) {
    rejectCookies.addEventListener('click', () => {
      Storage.setConsent({ analytics: false, marketing: false });
      const b = document.getElementById('cookie-banner');
      if (b) b.classList.remove('active');
    });
  }

  CatalogoPage.init();
});
