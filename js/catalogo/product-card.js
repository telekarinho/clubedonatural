/* ============================================
   CLUBE DO NATURAL — Product Card Renderer
   ============================================ */

const ProductCard = {
  render(product) {
    const defaultVariacao = product.variacoes[0];
    const hasRecurrence = product.recorrencia && product.recorrencia.elegivel;
    const category = DataCategories.find(c => c.id === product.categoria);

    let selosHTML = product.selos.map(selo =>
      `<span class="badge badge-${selo}">${Utils.seloIcon(selo)} ${Utils.seloLabel(selo)}</span>`
    ).join('');

    let recurrenceBadge = '';
    if (hasRecurrence) {
      recurrenceBadge = `<span class="product-card-recurrence-badge">🔄 Receba todo m\u00eas</span>`;
    }

    let subscriptionPrice = '';
    if (hasRecurrence) {
      const savings = Utils.calcSubscriptionSavings(
        defaultVariacao.preco,
        product.recorrencia.descontoPercent,
        product.recorrencia.frequenciaSugerida
      );
      subscriptionPrice = `<span class="product-card-sub-price">ou ${Utils.formatBRL(savings.precoAssinatura)}/m\u00eas na assinatura</span>`;
    }

    const card = document.createElement('div');
    card.className = 'product-card';
    card.dataset.id = product.id;
    card.innerHTML = `
      <div class="product-card-image">
        <div class="product-card-badges">${selosHTML}</div>
        ${recurrenceBadge}
      </div>
      <div class="product-card-body">
        <span class="product-card-category">${category ? category.icone + ' ' + category.nome : ''}</span>
        <h4 class="product-card-name">${product.nome}</h4>
        <div class="product-card-pricing">
          <span class="price">${Utils.formatBRL(defaultVariacao.preco)}</span>
          <span class="product-card-weight">${defaultVariacao.peso}</span>
        </div>
        ${subscriptionPrice}
        <button class="btn btn-primary btn-full product-card-add" data-product-id="${product.id}">
          Adicionar
        </button>
      </div>
    `;

    // Click on card (not the button) opens detail
    card.addEventListener('click', (e) => {
      if (!e.target.closest('.product-card-add')) {
        ProductDetail.open(product);
      }
    });

    // Quick add button
    const addBtn = card.querySelector('.product-card-add');
    addBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      AppState.addToCart(product, defaultVariacao, 1);
      Toast.success(`${product.nome} adicionado ao carrinho!`);

      // Pulse animation
      addBtn.style.transform = 'scale(0.95)';
      setTimeout(() => addBtn.style.transform = '', 150);
    });

    return card;
  },

  renderGrid(products, container) {
    container.innerHTML = '';
    if (products.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="grid-column: 1/-1;">
          <div class="empty-state-icon">🔍</div>
          <div class="empty-state-title">Nenhum produto encontrado</div>
          <div class="empty-state-text">Tente buscar por outro termo ou limpar os filtros</div>
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
