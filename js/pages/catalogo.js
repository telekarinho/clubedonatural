/* ============================================
   CLUBE DO NATURAL — Catálogo Page Controller
   ============================================ */

const CatalogoPage = {
  init() {
    Search.init();
    Filters.init();
    Cart.init();
    Toast.init();

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
    const filters = AppState.get('filters');
    if (filters.organico) products = products.filter(p => p.selos.includes('organico'));
    if (filters.vegano) products = products.filter(p => p.selos.includes('vegano'));
    if (filters.semGluten) products = products.filter(p => p.selos.includes('sem_gluten'));
    if (filters.integral) products = products.filter(p => p.selos.includes('integral'));

    // Sort
    const sortBy = AppState.get('sortBy');
    switch (sortBy) {
      case 'menor-preco':
        products.sort((a, b) => a.variacoes[0].preco - b.variacoes[0].preco);
        break;
      case 'maior-preco':
        products.sort((a, b) => b.variacoes[0].preco - a.variacoes[0].preco);
        break;
      case 'a-z':
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
  CatalogoPage.init();
});
