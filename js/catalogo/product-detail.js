/* ============================================
   CLUBE DO NATURAL — Product Detail (Bottom Sheet)
   Uses bottom-sheet classes from components.css
   ============================================ */

const ProductDetail = {
  currentProduct: null,
  selectedVariacao: null,
  quantidade: 1,
  isSubscription: false,
  selectedFrequency: 30,

  open(product) {
    this.currentProduct = product;
    this.selectedVariacao = product.variacoes[0];
    this.quantidade = 1;
    this.isSubscription = false;
    this.selectedFrequency = product.recorrencia ? product.recorrencia.frequenciaSugerida : 30;
    this.render();

    const backdrop = document.getElementById('product-detail-backdrop');
    const sheet = document.getElementById('product-detail');
    if (backdrop) backdrop.classList.add('active');
    if (sheet) sheet.classList.add('active');
    document.body.style.overflow = 'hidden';
  },

  close() {
    const backdrop = document.getElementById('product-detail-backdrop');
    const sheet = document.getElementById('product-detail');
    if (backdrop) backdrop.classList.remove('active');
    if (sheet) sheet.classList.remove('active');
    document.body.style.overflow = '';
    this.currentProduct = null;
  },

  render() {
    const p = this.currentProduct;
    if (!p) return;

    const category = DataCategories.find(c => c.id === p.categoria);
    const hasRecurrence = p.recorrencia && p.recorrencia.elegivel;

    // Selos
    const selosHTML = p.selos.map(selo =>
      `<span class="badge badge-${selo}" style="font-size:var(--fs-xs);">${Utils.seloIcon(selo)} ${Utils.seloLabel(selo)}</span>`
    ).join('');

    // Variations
    const variacoesHTML = p.variacoes.map((v, i) => `
      <button class="detail-variation ${i === 0 ? 'active' : ''}" data-index="${i}"
        style="padding:var(--space-2) var(--space-3);border:2px solid ${i===0?'var(--verde-medio)':'var(--cinza-300)'};border-radius:var(--radius-md);background:${i===0?'var(--verde-medio)':'var(--branco)'};color:${i===0?'var(--branco)':'var(--cinza-700)'};cursor:pointer;font-family:inherit;transition:all 150ms ease;">
        <span style="display:block;font-size:var(--fs-xs);font-weight:var(--fw-semibold);">${v.peso}</span>
        <span style="display:block;font-size:var(--fs-sm);font-weight:var(--fw-bold);">${Utils.formatBRL(v.preco)}</span>
      </button>
    `).join('');

    // Benefits
    const beneficiosHTML = p.beneficios ? p.beneficios.map(b =>
      `<li style="padding:var(--space-2) 0;border-bottom:1px solid var(--cinza-100);font-size:var(--fs-sm);color:var(--cinza-700);">
        <span style="color:var(--verde-claro);font-weight:var(--fw-bold);margin-right:var(--space-2);">✓</span>${b}
      </li>`
    ).join('') : '';

    // How to use
    const comoUsarHTML = p.comoUsar ? p.comoUsar.map(c =>
      `<li style="padding:var(--space-2) 0;border-bottom:1px solid var(--cinza-100);font-size:var(--fs-sm);color:var(--cinza-700);">
        <span style="margin-right:var(--space-2);">👉</span>${c}
      </li>`
    ).join('') : '';

    // Combina com
    const combinaHTML = p.combinaCom ? p.combinaCom.map(id => {
      const related = DataProducts.find(pr => pr.id === id);
      if (!related) return '';
      return `
        <div class="detail-related-item" data-id="${id}" style="flex-shrink:0;width:100px;text-align:center;cursor:pointer;">
          <div style="width:100%;aspect-ratio:1;border-radius:var(--radius-md);background:linear-gradient(135deg,#a8e6cf,#88d8a8);margin-bottom:var(--space-1);"></div>
          <span style="font-size:var(--fs-xs);color:var(--cinza-700);display:block;">${related.nome}</span>
        </div>
      `;
    }).filter(Boolean).join('') : '';

    // Nutritional info
    let nutricionalHTML = '';
    if (p.infoNutricional) {
      const info = p.infoNutricional;
      nutricionalHTML = `
        <table style="width:100%;border-collapse:collapse;font-size:var(--fs-sm);">
          <tr style="background:var(--cinza-100);"><td style="padding:var(--space-2) var(--space-3);font-weight:var(--fw-semibold);">Porção</td><td style="padding:var(--space-2) var(--space-3);">${info.porcao}</td></tr>
          <tr><td style="padding:var(--space-2) var(--space-3);border-bottom:1px solid var(--cinza-200);">Calorias</td><td style="padding:var(--space-2) var(--space-3);border-bottom:1px solid var(--cinza-200);">${info.calorias} kcal</td></tr>
          <tr><td style="padding:var(--space-2) var(--space-3);border-bottom:1px solid var(--cinza-200);">Proteínas</td><td style="padding:var(--space-2) var(--space-3);border-bottom:1px solid var(--cinza-200);">${info.proteinas}</td></tr>
          <tr><td style="padding:var(--space-2) var(--space-3);border-bottom:1px solid var(--cinza-200);">Gorduras</td><td style="padding:var(--space-2) var(--space-3);border-bottom:1px solid var(--cinza-200);">${info.gorduras}</td></tr>
          <tr><td style="padding:var(--space-2) var(--space-3);border-bottom:1px solid var(--cinza-200);">Carboidratos</td><td style="padding:var(--space-2) var(--space-3);border-bottom:1px solid var(--cinza-200);">${info.carboidratos}</td></tr>
          <tr><td style="padding:var(--space-2) var(--space-3);">Fibras</td><td style="padding:var(--space-2) var(--space-3);">${info.fibras}</td></tr>
        </table>
      `;
    }

    // Recurrence box
    let recurrenceHTML = '';
    if (hasRecurrence) {
      const savings = Utils.calcSubscriptionSavings(
        this.selectedVariacao.preco,
        p.recorrencia.descontoPercent,
        p.recorrencia.frequenciaSugerida
      );
      recurrenceHTML = `
        <div class="recurrence-box" style="margin:var(--space-4) 0;">
          <div class="recurrence-title">🔄 Assine e Economize</div>
          <p style="font-size:var(--fs-sm);margin-bottom:var(--space-3);color:var(--cinza-700);">${p.recorrencia.fraseVenda}</p>
          <div style="display:flex;gap:var(--space-3);margin-bottom:var(--space-3);">
            <div style="flex:1;text-align:center;padding:var(--space-3);background:var(--cinza-100);border-radius:var(--radius-md);">
              <div style="font-size:var(--fs-xs);color:var(--cinza-600);">Avulso</div>
              <div style="font-size:var(--fs-lg);font-weight:700;">${Utils.formatBRL(this.selectedVariacao.preco)}</div>
            </div>
            <div style="flex:1;text-align:center;padding:var(--space-3);background:linear-gradient(135deg,#E8F5E9,#C8E6C9);border-radius:var(--radius-md);border:2px solid var(--verde-claro);">
              <div style="font-size:var(--fs-xs);color:var(--verde-medio);font-weight:600;">Assinatura</div>
              <div style="font-size:var(--fs-lg);font-weight:700;color:var(--verde-escuro);">${Utils.formatBRL(savings.precoAssinatura)}</div>
            </div>
          </div>
          <div class="recurrence-savings" style="text-align:center;margin-bottom:var(--space-3);">
            💰 Economize ${Utils.formatBRL(savings.economiaAnual)}/ano (${savings.comprasAno} entregas)
          </div>
          <div style="display:flex;gap:var(--space-2);flex-wrap:wrap;margin-bottom:var(--space-3);">
            ${[{f:7,l:'Semanal'},{f:14,l:'Quinzenal'},{f:30,l:'Mensal'},{f:60,l:'Bimestral'}].map(o =>
              `<button class="detail-freq-btn ${this.selectedFrequency === o.f ? 'active' : ''}" data-freq="${o.f}"
                style="flex:1;min-width:70px;padding:var(--space-2);border:2px solid ${this.selectedFrequency===o.f?'var(--verde-medio)':'var(--cinza-300)'};border-radius:var(--radius-md);background:${this.selectedFrequency===o.f?'var(--verde-medio)':'var(--branco)'};color:${this.selectedFrequency===o.f?'var(--branco)':'var(--cinza-700)'};cursor:pointer;font-family:inherit;font-size:var(--fs-xs);font-weight:var(--fw-semibold);transition:all 150ms ease;">
                ${o.l}
              </button>`
            ).join('')}
          </div>
          <button class="btn btn-primary btn-full" id="detail-subscribe-btn">
            🔄 Assinar ${Utils.formatBRL(savings.precoAssinatura)}/entrega
          </button>
        </div>
      `;
    }

    // Share links
    const shareURL = `${window.location.origin}/produto.html?id=${p.id}`;
    const whatsappShare = Utils.whatsappLink('', `Olha esse produto incrível do Clube do Natural!\n\n*${p.nome}*\n${p.descricao}\n\n${shareURL}`);

    const sheet = document.getElementById('product-detail');
    if (!sheet) return;

    sheet.innerHTML = `
      <div class="bottom-sheet-handle"></div>
      <div style="flex:1;overflow-y:auto;padding:0 var(--space-4) var(--space-4);-webkit-overflow-scrolling:touch;">
        <!-- Image placeholder -->
        <div style="width:100%;border-radius:var(--radius-lg);overflow:hidden;margin-bottom:var(--space-4);background:linear-gradient(135deg,#a8e6cf 0%,#88d8a8 50%,#69c98e 100%);aspect-ratio:4/3;display:flex;align-items:center;justify-content:center;font-size:4rem;">
          ${DataCategories.find(c => c.id === p.categoria)?.icone || '🌿'}
        </div>

        <!-- Badges -->
        <div style="display:flex;flex-wrap:wrap;gap:var(--space-2);margin-bottom:var(--space-3);">
          ${selosHTML}
        </div>

        <!-- Category -->
        <span style="font-size:var(--fs-sm);color:var(--verde-medio);font-weight:var(--fw-medium);text-transform:uppercase;letter-spacing:0.04em;">
          ${category ? category.icone + ' ' + category.nome : ''}
        </span>

        <!-- Name -->
        <h2 style="font-size:var(--fs-xl);font-weight:var(--fw-bold);color:var(--cinza-900);margin:var(--space-1) 0 var(--space-2);">${p.nome}</h2>

        <!-- Description -->
        <p style="font-size:var(--fs-base);color:var(--cinza-700);line-height:var(--lh-relaxed);margin-bottom:var(--space-4);">${p.descricao}</p>

        <!-- Variations -->
        <div style="display:flex;gap:var(--space-2);flex-wrap:wrap;margin-bottom:var(--space-4);">
          ${variacoesHTML}
        </div>

        <!-- Recurrence -->
        ${recurrenceHTML}

        <!-- Benefits -->
        ${beneficiosHTML ? `
        <div style="margin-bottom:var(--space-4);">
          <h4 style="font-size:var(--fs-md);font-weight:var(--fw-bold);color:var(--cinza-900);margin-bottom:var(--space-2);padding-bottom:var(--space-2);border-bottom:2px solid var(--cinza-200);">💪 Benefícios</h4>
          <ul style="list-style:none;padding:0;margin:0;">${beneficiosHTML}</ul>
        </div>` : ''}

        <!-- Como Usar -->
        ${comoUsarHTML ? `
        <div style="margin-bottom:var(--space-4);">
          <h4 style="font-size:var(--fs-md);font-weight:var(--fw-bold);color:var(--cinza-900);margin-bottom:var(--space-2);padding-bottom:var(--space-2);border-bottom:2px solid var(--cinza-200);">📖 Como Usar</h4>
          <ul style="list-style:none;padding:0;margin:0;">${comoUsarHTML}</ul>
        </div>` : ''}

        <!-- Combina Com -->
        ${combinaHTML ? `
        <div style="margin-bottom:var(--space-4);">
          <h4 style="font-size:var(--fs-md);font-weight:var(--fw-bold);color:var(--cinza-900);margin-bottom:var(--space-2);padding-bottom:var(--space-2);border-bottom:2px solid var(--cinza-200);">🤝 Combina Com</h4>
          <div style="display:flex;gap:var(--space-3);overflow-x:auto;padding-bottom:var(--space-2);scrollbar-width:none;">${combinaHTML}</div>
        </div>` : ''}

        <!-- Info Nutricional -->
        ${nutricionalHTML ? `
        <div style="margin-bottom:var(--space-4);">
          <h4 style="font-size:var(--fs-md);font-weight:var(--fw-bold);color:var(--cinza-900);margin-bottom:var(--space-2);padding-bottom:var(--space-2);border-bottom:2px solid var(--cinza-200);">📊 Informação Nutricional</h4>
          ${nutricionalHTML}
        </div>` : ''}

        <!-- Curiosidade -->
        ${p.curiosidade ? `
        <div style="background:var(--amarelo-claro);padding:var(--space-4);border-radius:var(--radius-lg);margin-bottom:var(--space-4);">
          <h4 style="font-size:var(--fs-md);font-weight:var(--fw-bold);margin-bottom:var(--space-2);">💡 Você Sabia?</h4>
          <p style="font-size:var(--fs-sm);color:var(--cinza-800);line-height:var(--lh-relaxed);margin-bottom:var(--space-3);">${p.curiosidade}</p>
          <div style="display:flex;gap:var(--space-2);">
            <a href="${whatsappShare}" target="_blank" class="btn btn-whatsapp btn-sm">📲 Compartilhar</a>
          </div>
        </div>` : ''}

        <!-- Contraindicações -->
        ${p.contraindicacoes ? `
        <div style="background:var(--vermelho-claro);padding:var(--space-3);border-radius:var(--radius-md);margin-bottom:var(--space-4);border-left:4px solid var(--vermelho);">
          <h4 style="font-size:var(--fs-sm);font-weight:var(--fw-bold);margin-bottom:var(--space-1);">⚠️ Contraindicações</h4>
          <p style="font-size:var(--fs-sm);color:var(--cinza-700);">${p.contraindicacoes}</p>
        </div>` : ''}
      </div>

      <!-- Fixed bottom action bar -->
      <div style="flex-shrink:0;display:flex;align-items:center;gap:var(--space-3);padding:var(--space-3) var(--space-4);border-top:1px solid var(--cinza-200);background:var(--branco);">
        <div class="qty-control">
          <button id="detail-qty-minus">−</button>
          <span class="qty-value" id="detail-qty">${this.quantidade}</span>
          <button id="detail-qty-plus">+</button>
        </div>
        <button class="btn btn-primary" id="detail-add-btn" style="flex:1;padding:var(--space-3);">
          Adicionar ${Utils.formatBRL(this.selectedVariacao.preco * this.quantidade)}
        </button>
      </div>
    `;

    this.bindEvents();
  },

  bindEvents() {
    const sheet = document.getElementById('product-detail');
    if (!sheet) return;

    // Close backdrop
    const backdrop = document.getElementById('product-detail-backdrop');
    if (backdrop) backdrop.onclick = () => this.close();

    // Variations
    sheet.querySelectorAll('.detail-variation').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index);
        this.selectedVariacao = this.currentProduct.variacoes[idx];
        // Update variation styles
        sheet.querySelectorAll('.detail-variation').forEach(b => {
          b.style.borderColor = 'var(--cinza-300)';
          b.style.background = 'var(--branco)';
          b.style.color = 'var(--cinza-700)';
        });
        btn.style.borderColor = 'var(--verde-medio)';
        btn.style.background = 'var(--verde-medio)';
        btn.style.color = 'var(--branco)';
        this.updatePrice();
      });
    });

    // Quantity
    const qtyMinus = sheet.querySelector('#detail-qty-minus');
    const qtyPlus = sheet.querySelector('#detail-qty-plus');
    if (qtyMinus) qtyMinus.onclick = () => { if (this.quantidade > 1) { this.quantidade--; this.updatePrice(); } };
    if (qtyPlus) qtyPlus.onclick = () => { this.quantidade++; this.updatePrice(); };

    // Add to cart
    const addBtn = sheet.querySelector('#detail-add-btn');
    if (addBtn) {
      addBtn.onclick = () => {
        AppState.addToCart(this.currentProduct, this.selectedVariacao, this.quantidade, false);
        Toast.success(`${this.currentProduct.nome} adicionado ao carrinho!`);
        this.close();
      };
    }

    // Subscribe
    const subBtn = sheet.querySelector('#detail-subscribe-btn');
    if (subBtn) {
      subBtn.onclick = () => {
        AppState.addToCart(this.currentProduct, this.selectedVariacao, this.quantidade, true, this.selectedFrequency);
        Toast.success(`Assinatura de ${this.currentProduct.nome} adicionada!`);
        this.close();
      };
    }

    // Frequency buttons
    sheet.querySelectorAll('.detail-freq-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.selectedFrequency = parseInt(btn.dataset.freq);
        this.render(); // re-render to update savings
      });
    });

    // Related products
    sheet.querySelectorAll('.detail-related-item').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const related = DataProducts.find(p => p.id === link.dataset.id);
        if (related) this.open(related);
      });
    });
  },

  updatePrice() {
    const sheet = document.getElementById('product-detail');
    if (!sheet) return;

    const qtyEl = sheet.querySelector('#detail-qty');
    const addBtn = sheet.querySelector('#detail-add-btn');

    if (qtyEl) qtyEl.textContent = this.quantidade;
    if (addBtn) {
      const total = this.selectedVariacao.preco * this.quantidade;
      addBtn.textContent = `Adicionar ${Utils.formatBRL(total)}`;
    }
  },
};
