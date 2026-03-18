/* ============================================
   CLUBE DO NATURAL — Product Detail (Bottom Sheet)
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
      `<span class="badge badge-${selo}">${Utils.seloIcon(selo)} ${Utils.seloLabel(selo)}</span>`
    ).join('');

    // Variações
    const variacoesHTML = p.variacoes.map((v, i) => `
      <button class="detail-variation ${i === 0 ? 'active' : ''}" data-index="${i}">
        <span class="detail-variation-weight">${v.peso}</span>
        <span class="detail-variation-price">${Utils.formatBRL(v.preco)}</span>
      </button>
    `).join('');

    // Benefícios
    const beneficiosHTML = p.beneficios ? p.beneficios.map(b =>
      `<li>✅ ${b}</li>`
    ).join('') : '';

    // Como usar
    const comoUsarHTML = p.comoUsar ? p.comoUsar.map(c =>
      `<li>👉 ${c}</li>`
    ).join('') : '';

    // Combina com
    const combinaHTML = p.combinaCom ? p.combinaCom.map(id => {
      const related = DataProducts.find(pr => pr.id === id);
      if (!related) return '';
      return `<a href="#" class="detail-related-item" data-id="${id}">${related.nome}</a>`;
    }).filter(Boolean).join('') : '';

    // Info nutricional
    let nutricionalHTML = '';
    if (p.infoNutricional) {
      const info = p.infoNutricional;
      nutricionalHTML = `
        <table class="detail-nutrition-table">
          <tr><td>Porção</td><td>${info.porcao}</td></tr>
          <tr><td>Calorias</td><td>${info.calorias} kcal</td></tr>
          <tr><td>Proteínas</td><td>${info.proteinas}</td></tr>
          <tr><td>Gorduras</td><td>${info.gorduras}</td></tr>
          <tr><td>Carboidratos</td><td>${info.carboidratos}</td></tr>
          <tr><td>Fibras</td><td>${info.fibras}</td></tr>
        </table>
      `;
    }

    // Recorrência
    let recurrenceHTML = '';
    if (hasRecurrence) {
      const savings = Utils.calcSubscriptionSavings(
        this.selectedVariacao.preco,
        p.recorrencia.descontoPercent,
        p.recorrencia.frequenciaSugerida
      );
      recurrenceHTML = `
        <div class="recurrence-box">
          <div class="recurrence-title">🔄 Assine e Economize</div>
          <p style="font-size: var(--fs-sm); margin-bottom: var(--space-3);">${p.recorrencia.fraseVenda}</p>
          <div style="display:flex;gap:var(--space-4);margin-bottom:var(--space-3);">
            <div style="flex:1;text-align:center;padding:var(--space-3);background:var(--cinza-100);border-radius:var(--radius-md);">
              <div style="font-size:var(--fs-xs);color:var(--cinza-600);">Avulso</div>
              <div style="font-size:var(--fs-lg);font-weight:700;">${Utils.formatBRL(this.selectedVariacao.preco)}</div>
            </div>
            <div style="flex:1;text-align:center;padding:var(--space-3);background:linear-gradient(135deg,#E8F5E9,#C8E6C9);border-radius:var(--radius-md);border:2px solid var(--verde-claro);">
              <div style="font-size:var(--fs-xs);color:var(--verde-medio);font-weight:600;">Assinatura</div>
              <div style="font-size:var(--fs-lg);font-weight:700;color:var(--verde-escuro);">${Utils.formatBRL(savings.precoAssinatura)}</div>
            </div>
          </div>
          <div class="recurrence-savings">
            Economize ${Utils.formatBRL(savings.economiaAnual)}/ano (${savings.comprasAno} entregas)
          </div>
          <div style="margin-top:var(--space-3);display:flex;gap:var(--space-2);flex-wrap:wrap;">
            <button class="detail-freq-btn ${this.selectedFrequency === 7 ? 'active' : ''}" data-freq="7">Semanal</button>
            <button class="detail-freq-btn ${this.selectedFrequency === 14 ? 'active' : ''}" data-freq="14">Quinzenal</button>
            <button class="detail-freq-btn ${this.selectedFrequency === 30 ? 'active' : ''}" data-freq="30">Mensal</button>
            <button class="detail-freq-btn ${this.selectedFrequency === 60 ? 'active' : ''}" data-freq="60">Bimestral</button>
          </div>
          <button class="btn btn-primary btn-full" style="margin-top:var(--space-3);" id="detail-subscribe-btn">
            🔄 Assinar ${Utils.formatBRL(savings.precoAssinatura)}/entrega
          </button>
        </div>
      `;
    }

    // Share
    const shareURL = `${window.location.origin}/produto.html?id=${p.id}`;
    const shareText = `${p.nome} - ${p.curiosidade || p.descricao}`;
    const whatsappShare = Utils.whatsappLink('', `Olha esse produto incrível do Clube do Natural!\n\n*${p.nome}*\n${p.descricao}\n\n${shareURL}`);

    const sheet = document.getElementById('product-detail');
    if (!sheet) return;

    sheet.innerHTML = `
      <div class="bottom-sheet-handle"></div>
      <div class="detail-content">
        <div class="detail-image"></div>
        <div class="detail-body">
          <div class="detail-badges">${selosHTML}</div>
          <span class="product-card-category">${category ? category.icone + ' ' + category.nome : ''}</span>
          <h2 class="detail-name">${p.nome}</h2>
          <p class="detail-description">${p.descricao}</p>

          <div class="detail-variations">${variacoesHTML}</div>

          ${recurrenceHTML}

          ${beneficiosHTML ? `
          <div class="detail-section">
            <h4>💪 Benefícios</h4>
            <ul class="detail-list">${beneficiosHTML}</ul>
          </div>` : ''}

          ${comoUsarHTML ? `
          <div class="detail-section">
            <h4>📖 Como Usar</h4>
            <ul class="detail-list">${comoUsarHTML}</ul>
          </div>` : ''}

          ${combinaHTML ? `
          <div class="detail-section">
            <h4>🤝 Combina Com</h4>
            <div class="detail-related">${combinaHTML}</div>
          </div>` : ''}

          ${nutricionalHTML ? `
          <div class="detail-section">
            <h4>📊 Informação Nutricional</h4>
            ${nutricionalHTML}
          </div>` : ''}

          ${p.curiosidade ? `
          <div class="detail-section detail-curiosity">
            <h4>💡 Você Sabia?</h4>
            <p>${p.curiosidade}</p>
            <a href="${whatsappShare}" target="_blank" class="btn btn-whatsapp btn-sm" style="margin-top:var(--space-2);">
              📲 Compartilhar curiosidade
            </a>
          </div>` : ''}

          ${p.contraindicacoes ? `
          <div class="detail-section" style="background:var(--amarelo-claro);padding:var(--space-3);border-radius:var(--radius-md);">
            <h4 style="font-size:var(--fs-sm);">⚠️ Contraindicações</h4>
            <p style="font-size:var(--fs-sm);">${p.contraindicacoes}</p>
          </div>` : ''}
        </div>
      </div>
      <div class="detail-footer">
        <div class="qty-control">
          <button id="detail-qty-minus">−</button>
          <span class="qty-value" id="detail-qty">${this.quantidade}</span>
          <button id="detail-qty-plus">+</button>
        </div>
        <button class="btn btn-primary" id="detail-add-btn" style="flex:1;">
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
    if (backdrop) {
      backdrop.onclick = () => this.close();
    }

    // Variations
    sheet.querySelectorAll('.detail-variation').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index);
        this.selectedVariacao = this.currentProduct.variacoes[idx];
        sheet.querySelectorAll('.detail-variation').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
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
        sheet.querySelectorAll('.detail-freq-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.render(); // re-render to update savings calculation
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
