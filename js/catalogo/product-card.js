/* ============================================
   CLUBE DO NATURAL — Product Card Renderer
   Classes match catalogo.css exactly
   ============================================ */

const ProductCard = {
  render(product) {
    const defaultVariacao = product.variacoes[0];
    const hasRecurrence = product.recorrencia && product.recorrencia.elegivel;
    const category = DataCategories.find(c => c.id === product.categoria);

    // Selos badges
    const selosHTML = product.selos.map(selo =>
      `<span class="badge badge-${selo}">${Utils.seloIcon(selo)} ${Utils.seloLabel(selo)}</span>`
    ).join('');

    // Recurrence badge
    let recurrenceBadge = '';
    if (hasRecurrence) {
      recurrenceBadge = `<span class="product-card__recurrence">🔄 Receba todo mês</span>`;
    }

    // Subscription price line
    let subscriptionPrice = '';
    if (hasRecurrence) {
      const savings = Utils.calcSubscriptionSavings(
        defaultVariacao.preco,
        product.recorrencia.descontoPercent,
        product.recorrencia.frequenciaSugerida
      );
      subscriptionPrice = `<span class="product-card__price-sub">🔄 ${Utils.formatBRL(savings.precoAssinatura)}/mês na assinatura</span>`;
    }

    const card = document.createElement('div');
    card.className = 'product-card';
    card.dataset.id = product.id;
    card.innerHTML = `
      <div class="product-card__image-wrap">
        <div class="product-card__badges">${selosHTML}</div>
        ${recurrenceBadge}
      </div>
      <div class="product-card__body">
        <span class="product-card__category">${category ? category.icone + ' ' + category.nome : ''}</span>
        <h4 class="product-card__name">${product.nome}</h4>
        <div class="product-card__price-wrap">
          <span class="product-card__price">${Utils.formatBRL(defaultVariacao.preco)}</span>
          <span style="font-size:var(--fs-xs);color:var(--cinza-500);margin-left:var(--space-1);">${defaultVariacao.peso}</span>
        </div>
        ${subscriptionPrice}
        <button class="product-card__add-btn" data-product-id="${product.id}">
          + Adicionar
        </button>
      </div>
    `;

    // Click on card opens detail
    card.addEventListener('click', (e) => {
      if (!e.target.closest('.product-card__add-btn')) {
        ProductDetail.open(product);
      }
    });

    // Quick add button
    const addBtn = card.querySelector('.product-card__add-btn');
    addBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      AppState.addToCart(product, defaultVariacao, 1);
      Toast.success(`${product.nome} adicionado ao carrinho!`);
      addBtn.style.transform = 'scale(0.95)';
      setTimeout(() => addBtn.style.transform = '', 150);
    });

    return card;
  },

  renderGrid(products, container) {
    container.innerHTML = '';
    if (products.length === 0) {
      container.innerHTML = `
        <div class="product-grid__empty">
          <span class="product-grid__empty-icon">🔍</span>
          <div class="product-grid__empty-text">Nenhum produto encontrado</div>
          <div class="product-grid__empty-sub">Tente buscar por outro termo ou limpar os filtros</div>
        </div>
      `;
      return;
    }

    products.forEach(product => {
      const card = this.render(product);
      card.style.animation = `fadeIn 0.3s ease forwards`;
      container.appendChild(card);
    });
  },
};
