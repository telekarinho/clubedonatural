/* ============================================
   CLUBE DO NATURAL — Filters (Category + Selos)
   ============================================ */

const Filters = {
  init() {
    // Category pills
    document.querySelectorAll('.category-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.category-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        AppState.set('currentCategory', pill.dataset.category);
        CatalogoPage.filterAndRender();
      });
    });

    // Selo filter toggles
    document.querySelectorAll('.selo-filter').forEach(toggle => {
      toggle.addEventListener('click', () => {
        toggle.classList.toggle('active');
        const filters = AppState.get('filters');
        const selo = toggle.dataset.selo;
        filters[selo] = !filters[selo];
        AppState.set('filters', { ...filters });
        CatalogoPage.filterAndRender();
      });
    });

    // Check URL params for initial category
    const urlParams = new URLSearchParams(window.location.search);
    const cat = urlParams.get('cat');
    if (cat) {
      AppState.set('currentCategory', cat);
      document.querySelectorAll('.category-pill').forEach(p => {
        p.classList.toggle('active', p.dataset.category === cat);
      });
    }
  },
};
