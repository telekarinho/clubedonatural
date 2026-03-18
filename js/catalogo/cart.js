/* ============================================
   CLUBE DO NATURAL — Cart Sidebar
   ============================================ */

const Cart = {
  init() {
    this.bindEvents();
    AppState.on('cart', () => this.render());
    AppState.on('cartOpen', (open) => {
      if (open) this.openSidebar();
      else this.closeSidebar();
    });
    this.updateBadge();
  },

  bindEvents() {
    // Cart button in header
    document.querySelectorAll('.cart-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        AppState.set('cartOpen', !AppState.get('cartOpen'));
      });
    });

    // Close button
    const closeBtn = document.getElementById('cart-close');
    if (closeBtn) closeBtn.addEventListener('click', () => AppState.set('cartOpen', false));

    // Backdrop
    const backdrop = document.getElementById('cart-backdrop');
    if (backdrop) backdrop.addEventListener('click', () => AppState.set('cartOpen', false));

    // Checkout button
    const checkoutBtn = document.getElementById('cart-checkout-btn');
    if (checkoutBtn) {
      checkoutBtn.addEventListener('click', () => {
        if (AppState.getCartCount() === 0) {
          Toast.warning('Carrinho vazio!');
          return;
        }
        AppState.set('cartOpen', false);
        window.location.href = 'checkout.html';
      });
    }
  },

  openSidebar() {
    const sidebar = document.getElementById('cart-sidebar');
    const backdrop = document.getElementById('cart-backdrop');
    if (sidebar) sidebar.classList.add('active');
    if (backdrop) backdrop.classList.add('active');
    document.body.style.overflow = 'hidden';
    this.render();
  },

  closeSidebar() {
    const sidebar = document.getElementById('cart-sidebar');
    const backdrop = document.getElementById('cart-backdrop');
    if (sidebar) sidebar.classList.remove('active');
    if (backdrop) backdrop.classList.remove('active');
    document.body.style.overflow = '';
  },

  render() {
    const itemsContainer = document.getElementById('cart-items');
    const emptyState = document.getElementById('cart-empty');
    const footer = document.getElementById('cart-footer');
    const cart = AppState.get('cart');

    if (!itemsContainer) return;

    this.updateBadge();

    if (!cart || cart.length === 0) {
      itemsContainer.innerHTML = '';
      if (emptyState) emptyState.style.display = 'block';
      if (footer) footer.style.display = 'none';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';
    if (footer) footer.style.display = 'block';

    itemsContainer.innerHTML = cart.map(item => `
      <div class="cart-item" data-key="${item.key}">
        <div class="cart-item-info">
          <div class="cart-item-name">
            ${item.nome}
            ${item.isSubscription ? '<span class="badge badge-recorrente" style="font-size:10px;">🔄 Assinatura</span>' : ''}
          </div>
          <div class="cart-item-detail">${item.peso}</div>
          <div class="cart-item-price">
            ${item.isSubscription && item.precoOriginal !== item.preco ?
              `<span class="price-old">${Utils.formatBRL(item.precoOriginal)}</span> ` : ''
            }${Utils.formatBRL(item.preco)}
          </div>
        </div>
        <div class="cart-item-actions">
          <div class="qty-control">
            <button class="cart-qty-btn" data-key="${item.key}" data-delta="-1">−</button>
            <span class="qty-value">${item.quantidade}</span>
            <button class="cart-qty-btn" data-key="${item.key}" data-delta="1">+</button>
          </div>
          <button class="cart-remove-btn" data-key="${item.key}" title="Remover">🗑️</button>
        </div>
      </div>
    `).join('');

    // Subtotal
    const subtotal = AppState.getCartTotal();
    const subtotalEl = document.getElementById('cart-subtotal');
    if (subtotalEl) subtotalEl.textContent = Utils.formatBRL(subtotal);

    const totalEl = document.getElementById('cart-total');
    if (totalEl) totalEl.textContent = Utils.formatBRL(subtotal); // taxa será adicionada no checkout

    // Subscription items summary
    const subItems = AppState.getCartSubscriptionItems();
    const subSummary = document.getElementById('cart-sub-summary');
    if (subSummary) {
      if (subItems.length > 0) {
        const totalSavings = subItems.reduce((sum, item) =>
          sum + (item.precoOriginal - item.preco) * item.quantidade, 0
        );
        subSummary.innerHTML = `
          <div style="background:linear-gradient(135deg,#E8F5E9,#C8E6C9);padding:var(--space-3);border-radius:var(--radius-md);margin-top:var(--space-3);font-size:var(--fs-sm);">
            🔄 <strong>${subItems.length} item(ns) recorrente(s)</strong><br>
            <span style="color:var(--verde-medio);">Economia: ${Utils.formatBRL(totalSavings)} por entrega</span>
          </div>
        `;
        subSummary.style.display = 'block';
      } else {
        subSummary.style.display = 'none';
      }
    }

    // Bind cart item events
    itemsContainer.querySelectorAll('.cart-qty-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        AppState.updateCartQty(btn.dataset.key, parseInt(btn.dataset.delta));
      });
    });

    itemsContainer.querySelectorAll('.cart-remove-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        AppState.removeFromCart(btn.dataset.key);
        Toast.info('Item removido do carrinho');
      });
    });
  },

  updateBadge() {
    const count = AppState.getCartCount();
    document.querySelectorAll('.cart-badge').forEach(badge => {
      if (count > 0) {
        badge.textContent = count > 99 ? '99+' : count;
        badge.style.display = 'flex';
      } else {
        badge.style.display = 'none';
      }
    });
  },
};
