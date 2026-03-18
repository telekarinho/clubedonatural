/* ============================================
   CLUBE DO NATURAL — Admin NF (Notas Fiscais)
   Cupom nao-fiscal, NFC-e e historico
   ============================================ */

const AdminNF = (() => {
  const container = () => document.getElementById('nf-content');

  let currentStoreFilter = 'todas';
  let activeTab = 'cupom';
  let historySearch = '';
  let historyDateFilter = '';

  /* ------------------------------------------
     HELPERS
  ------------------------------------------ */
  function getStoreId() {
    if (currentStoreFilter && currentStoreFilter !== 'todas') return currentStoreFilter;
    return DataStores.length > 0 ? DataStores[0].id : 'default';
  }

  function getStore(storeId) {
    return DataStores.find(s => s.id === storeId) || DataStores[0] || {};
  }

  function getStoreLabel(lojaId) {
    const store = DataStores.find(s => s.id === lojaId);
    return store ? store.nome.split(' - ')[1] || store.nome : lojaId;
  }

  function getNotas() {
    return Storage.get('notas_fiscais') || [];
  }

  function saveNotas(notas) {
    Storage.set('notas_fiscais', notas);
  }

  function getNextNumber(storeId, tipo) {
    const seqKey = 'nf_seq';
    const seq = Storage.get(seqKey) || {};
    const key = `${storeId}_${tipo}`;
    const next = (seq[key] || 0) + 1;
    seq[key] = next;
    Storage.set(seqKey, seq);
    return next;
  }

  function getCurrentNumber(storeId, tipo) {
    const seq = Storage.get('nf_seq') || {};
    const key = `${storeId}_${tipo}`;
    return (seq[key] || 0) + 1;
  }

  function findOrder(numero) {
    const orders = Storage.get('orders') || [];
    return orders.find(o => o.numero === numero || o.id === numero);
  }

  function generateAccessKey() {
    // Mock 44-digit access key
    let key = '';
    for (let i = 0; i < 44; i++) key += Math.floor(Math.random() * 10);
    return key;
  }

  function formatAccessKey(key) {
    return key.replace(/(\d{4})/g, '$1 ').trim();
  }

  /* ------------------------------------------
     MODAL HELPER
  ------------------------------------------ */
  function createModal(title, bodyHTML, opts) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:10001;display:flex;align-items:center;justify-content:center;padding:16px;';

    const modal = document.createElement('div');
    modal.style.cssText = `background:#fff;border-radius:12px;max-width:${opts && opts.maxWidth || '560px'};width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.3);`;

    const showFooter = !opts || opts.footer !== false;

    modal.innerHTML = `
      <div style="padding:16px 20px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center;">
        <h3 style="margin:0;font-size:18px;color:#1B4332;">${title}</h3>
        <button class="modal-close" style="background:none;border:none;font-size:22px;cursor:pointer;color:#888;padding:4px 8px;">&#10005;</button>
      </div>
      <div style="padding:20px;" class="modal-body">${bodyHTML}</div>
      ${showFooter ? `
      <div style="padding:12px 20px;border-top:1px solid #eee;display:flex;gap:8px;justify-content:flex-end;" class="modal-footer">
        <button class="modal-cancel" style="background:#f5f5f5;color:#555;border:1px solid #ddd;padding:8px 20px;border-radius:8px;cursor:pointer;font-size:14px;">Fechar</button>
      </div>
      ` : ''}
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    modal.querySelector('.modal-close').addEventListener('click', close);
    const cancelBtn = modal.querySelector('.modal-cancel');
    if (cancelBtn) cancelBtn.addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
    });

    return { modal, overlay, close };
  }

  /* ------------------------------------------
     CUPOM NAO FISCAL
  ------------------------------------------ */
  function showGerarCupomModal() {
    const storeId = getStoreId();
    const store = getStore(storeId);
    const nextNum = getCurrentNumber(storeId, 'cupom');

    const html = `
      <div style="margin-bottom:14px;">
        <label style="font-size:13px;color:#555;display:block;margin-bottom:4px;">N\u00famero do Pedido</label>
        <div style="display:flex;gap:8px;">
          <input type="text" class="input-pedido" placeholder="Ex: CDN202603180001" style="flex:1;padding:8px 12px;border:1px solid #ddd;border-radius:8px;font-size:14px;">
          <button class="btn-buscar-pedido" style="background:#2D6A4F;color:#fff;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;">Buscar</button>
        </div>
      </div>
      <div class="cupom-preview-area" style="margin-top:16px;"></div>
    `;

    const { modal, close } = createModal('Gerar Cupom N\u00e3o-Fiscal', html, { maxWidth: '520px' });

    modal.querySelector('.btn-buscar-pedido').addEventListener('click', () => {
      const pedidoNum = modal.querySelector('.input-pedido').value.trim();
      if (!pedidoNum) { Toast.error('Informe o n\u00famero do pedido'); return; }
      const order = findOrder(pedidoNum);
      if (!order) { Toast.error('Pedido n\u00e3o encontrado'); return; }

      const previewArea = modal.querySelector('.cupom-preview-area');
      const cupomNum = String(nextNum).padStart(6, '0');
      const now = new Date();

      previewArea.innerHTML = `
        <div style="background:#f8f9fa;border:1px dashed #ccc;border-radius:8px;padding:20px;font-family:'Courier New',monospace;font-size:12px;max-width:320px;margin:0 auto;">
          <div style="text-align:center;font-weight:700;font-size:14px;margin-bottom:4px;">${store.nome || 'Clube do Natural'}</div>
          <div style="text-align:center;font-size:11px;margin-bottom:2px;">${store.endereco || ''}</div>
          <div style="text-align:center;font-size:11px;margin-bottom:8px;">CNPJ: ${store.cnpj ? Utils.formatCNPJ(store.cnpj) : '--'}</div>
          <div style="text-align:center;font-weight:700;margin-bottom:4px;">CUPOM N\u00c3O FISCAL</div>
          <div style="border-top:1px dashed #999;margin:6px 0;"></div>
          <div style="display:flex;justify-content:space-between;"><span>Cupom:</span><span style="font-weight:700;">${cupomNum}</span></div>
          <div style="display:flex;justify-content:space-between;"><span>Pedido:</span><span>${order.numero}</span></div>
          <div style="display:flex;justify-content:space-between;"><span>Data:</span><span>${Utils.formatDateTime(now)}</span></div>
          <div style="display:flex;justify-content:space-between;"><span>Cliente:</span><span>${order.cliente.nome}</span></div>
          <div style="border-top:1px dashed #999;margin:6px 0;"></div>
          <div style="font-weight:700;margin-bottom:4px;">ITENS:</div>
          ${order.items.map(it => `
            <div>${it.quantidade}x ${it.nome} (${it.peso})</div>
            <div style="display:flex;justify-content:space-between;"><span></span><span>${Utils.formatBRL(it.preco * it.quantidade)}</span></div>
          `).join('')}
          <div style="border-top:1px dashed #999;margin:6px 0;"></div>
          <div style="display:flex;justify-content:space-between;"><span>Subtotal:</span><span>${Utils.formatBRL(order.subtotal)}</span></div>
          <div style="display:flex;justify-content:space-between;"><span>Entrega:</span><span>${order.taxaEntrega > 0 ? Utils.formatBRL(order.taxaEntrega) : 'Gr\u00e1tis'}</span></div>
          <div style="display:flex;justify-content:space-between;font-weight:700;font-size:14px;"><span>TOTAL:</span><span>${Utils.formatBRL(order.total)}</span></div>
          <div style="border-top:1px dashed #999;margin:6px 0;"></div>
          <div style="display:flex;justify-content:space-between;"><span>Pagamento:</span><span>${order.pagamento === 'pix' ? 'PIX' : order.pagamento === 'credito' ? 'Cart\u00e3o Cr\u00e9dito' : order.pagamento === 'debito' ? 'Cart\u00e3o D\u00e9bito' : 'Dinheiro'}</span></div>
          <div style="border-top:1px dashed #999;margin:6px 0;"></div>
          <div style="text-align:center;margin-top:6px;">Obrigado pela prefer\u00eancia!</div>
          <div style="text-align:center;">Clube do Natural</div>
        </div>

        <div style="display:flex;gap:8px;justify-content:center;margin-top:16px;">
          <button class="btn-print-cupom" style="background:#1B4332;color:#fff;border:none;padding:8px 20px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;">Imprimir</button>
          <button class="btn-save-cupom" style="background:#2D6A4F;color:#fff;border:none;padding:8px 20px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;">Salvar Cupom</button>
        </div>
      `;

      // Print
      previewArea.querySelector('.btn-print-cupom').addEventListener('click', () => {
        printCupom(store, order, cupomNum, now);
      });

      // Save
      previewArea.querySelector('.btn-save-cupom').addEventListener('click', () => {
        const num = getNextNumber(storeId, 'cupom');
        const notas = getNotas();
        notas.unshift({
          id: 'nf-' + Utils.generateId(),
          numero: String(num).padStart(6, '0'),
          tipo: 'cupom',
          data: now.toISOString(),
          loja: storeId,
          pedido: order.numero,
          cliente: order.cliente.nome,
          valor: order.total,
          status: 'emitida',
          items: order.items,
        });
        saveNotas(notas);
        Toast.success('Cupom salvo com sucesso!');
        close();
        render(currentStoreFilter);
      });
    });
  }

  function printCupom(store, order, cupomNum, date) {
    const w = window.open('', '_blank', 'width=320,height=600');
    if (!w) { Toast.error('Popup bloqueado. Permita popups para imprimir.'); return; }

    w.document.write(`
      <!DOCTYPE html>
      <html><head><title>Cupom ${cupomNum}</title>
      <style>
        body { font-family:'Courier New',monospace;font-size:12px;width:280px;margin:0 auto;padding:10px; }
        .center { text-align:center; }
        .line { border-top:1px dashed #000;margin:6px 0; }
        .row { display:flex;justify-content:space-between; }
        .bold { font-weight:bold; }
        .big { font-size:16px; }
        @media print { body { margin:0; } }
      </style></head><body>
        <div class="center bold big">${store.nome || 'Clube do Natural'}</div>
        <div class="center">${store.endereco || ''}</div>
        <div class="center">CNPJ: ${store.cnpj ? Utils.formatCNPJ(store.cnpj) : '--'}</div>
        <div class="center bold">CUPOM N\u00c3O FISCAL</div>
        <div class="line"></div>
        <div class="row"><span>Cupom:</span><span class="bold">${cupomNum}</span></div>
        <div class="row"><span>Pedido:</span><span>${order.numero}</span></div>
        <div class="row"><span>Data:</span><span>${Utils.formatDateTime(date)}</span></div>
        <div class="row"><span>Cliente:</span><span>${order.cliente.nome}</span></div>
        <div class="line"></div>
        <div class="bold">ITENS:</div>
        ${order.items.map(it => `
          <div>${it.quantidade}x ${it.nome} (${it.peso})</div>
          <div class="row"><span></span><span>${Utils.formatBRL(it.preco * it.quantidade)}</span></div>
        `).join('')}
        <div class="line"></div>
        <div class="row"><span>Subtotal:</span><span>${Utils.formatBRL(order.subtotal)}</span></div>
        <div class="row"><span>Entrega:</span><span>${order.taxaEntrega > 0 ? Utils.formatBRL(order.taxaEntrega) : 'Gr\u00e1tis'}</span></div>
        <div class="row bold big"><span>TOTAL:</span><span>${Utils.formatBRL(order.total)}</span></div>
        <div class="line"></div>
        <div class="center" style="margin-top:8px;">Obrigado pela prefer\u00eancia!</div>
        <div class="center">Clube do Natural</div>
        <script>window.print();<\/script>
      </body></html>
    `);
    w.document.close();
  }

  /* ------------------------------------------
     NFC-e
  ------------------------------------------ */
  function renderNFCeTab() {
    const storeId = getStoreId();
    const store = getStore(storeId);
    const nextNum = getCurrentNumber(storeId, 'nfce');

    return `
      <div style="background:#fff;border-radius:10px;padding:20px;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;">
          <div>
            <label style="font-size:13px;color:#555;display:block;margin-bottom:4px;">N\u00famero do Pedido</label>
            <div style="display:flex;gap:8px;">
              <input type="text" class="nfce-pedido" placeholder="Ex: CDN202603180001" style="flex:1;padding:8px 12px;border:1px solid #ddd;border-radius:8px;font-size:14px;">
              <button class="btn-nfce-buscar" style="background:#2D6A4F;color:#fff;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;">Buscar</button>
            </div>
          </div>
          <div>
            <label style="font-size:13px;color:#555;display:block;margin-bottom:4px;">CPF/CNPJ do Cliente (opcional)</label>
            <input type="text" class="nfce-cpf" placeholder="000.000.000-00" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:8px;font-size:14px;">
          </div>
        </div>

        <!-- Dados da Loja (auto-preenchidos) -->
        <div style="background:#f8f9fa;border-radius:8px;padding:14px;margin-bottom:16px;">
          <h4 style="margin:0 0 8px;font-size:13px;color:#1B4332;">Dados do Emitente</h4>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13px;">
            <div><span style="color:#888;">Raz\u00e3o Social:</span> ${store.nome || '--'}</div>
            <div><span style="color:#888;">CNPJ:</span> ${store.cnpj ? Utils.formatCNPJ(store.cnpj) : '--'}</div>
            <div><span style="color:#888;">IE:</span> ${store.ie || '--'}</div>
            <div><span style="color:#888;">Endere\u00e7o:</span> ${store.endereco || '--'}</div>
          </div>
        </div>

        <div style="margin-bottom:14px;">
          <label style="font-size:13px;color:#555;display:block;margin-bottom:4px;">CFOP</label>
          <input type="text" class="nfce-cfop" value="5.102" style="width:200px;padding:8px 12px;border:1px solid #ddd;border-radius:8px;font-size:14px;">
          <span style="font-size:11px;color:#888;margin-left:8px;">5.102 = Venda de mercadoria adquirida</span>
        </div>

        <div style="background:#FFF8E1;border-radius:8px;padding:10px 14px;margin-bottom:16px;font-size:12px;color:#E65100;">
          <strong>Nota:</strong> Integra\u00e7\u00e3o com SEFAZ em fase futura. A NFC-e gerada abaixo \u00e9 uma pr\u00e9via do documento que ser\u00e1 transmitido. Os campos de ICMS e assinatura digital ser\u00e3o habilitados com a homologa\u00e7\u00e3o.
        </div>

        <div class="nfce-preview-area"></div>
      </div>
    `;
  }

  function loadNFCeOrder(el) {
    const pedidoNum = el.querySelector('.nfce-pedido').value.trim();
    if (!pedidoNum) { Toast.error('Informe o n\u00famero do pedido'); return; }

    const order = findOrder(pedidoNum);
    if (!order) { Toast.error('Pedido n\u00e3o encontrado'); return; }

    const storeId = getStoreId();
    const store = getStore(storeId);
    const cpfInput = el.querySelector('.nfce-cpf').value.trim();
    const cfop = el.querySelector('.nfce-cfop').value.trim() || '5.102';
    const accessKey = generateAccessKey();
    const nextNum = getCurrentNumber(storeId, 'nfce');
    const nfceNum = String(nextNum).padStart(9, '0');
    const now = new Date();

    const previewArea = el.querySelector('.nfce-preview-area');

    // Get NCM data from DataProducts
    const itemsWithNCM = order.items.map(item => {
      const product = DataProducts.find(p => p.id === item.productId);
      return {
        ...item,
        ncm: (product && product.ncm) || '0000.00.00',
        unidade: (product && product.unidadeMedida) || 'UN',
      };
    });

    previewArea.innerHTML = `
      <div style="border:1px solid #ddd;border-radius:8px;overflow:hidden;margin-top:8px;">
        <!-- DANFE Header -->
        <div style="background:#f8f9fa;padding:14px;border-bottom:1px solid #ddd;text-align:center;">
          <div style="font-weight:700;font-size:16px;color:#1B4332;">${store.nome || 'Clube do Natural'}</div>
          <div style="font-size:12px;color:#555;">${store.endereco || ''} - ${store.cidade || ''} / ${store.estado || ''}</div>
          <div style="font-size:12px;color:#555;">CNPJ: ${store.cnpj ? Utils.formatCNPJ(store.cnpj) : '--'} | IE: ${store.ie || '--'}</div>
          <div style="margin-top:8px;font-weight:700;font-size:14px;">DANFE NFC-e - Documento Auxiliar</div>
          <div style="font-size:12px;color:#888;">N\u00famero: ${nfceNum} | S\u00e9rie: 001</div>
        </div>

        <!-- Items -->
        <div style="padding:14px;">
          <table style="width:100%;border-collapse:collapse;font-size:12px;">
            <thead>
              <tr style="border-bottom:2px solid #eee;">
                <th style="text-align:left;padding:4px;">C\u00f3d/NCM</th>
                <th style="text-align:left;padding:4px;">Descri\u00e7\u00e3o</th>
                <th style="text-align:center;padding:4px;">Qtd</th>
                <th style="text-align:center;padding:4px;">UN</th>
                <th style="text-align:right;padding:4px;">Vl.Unit</th>
                <th style="text-align:right;padding:4px;">Vl.Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsWithNCM.map(it => `
                <tr style="border-bottom:1px solid #f0f0f0;">
                  <td style="padding:4px;font-size:11px;color:#888;">${it.ncm}</td>
                  <td style="padding:4px;">${it.nome} (${it.peso})</td>
                  <td style="text-align:center;padding:4px;">${it.quantidade}</td>
                  <td style="text-align:center;padding:4px;">${it.unidade}</td>
                  <td style="text-align:right;padding:4px;">${Utils.formatBRL(it.preco)}</td>
                  <td style="text-align:right;padding:4px;font-weight:600;">${Utils.formatBRL(it.preco * it.quantidade)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div style="border-top:2px solid #eee;padding-top:8px;margin-top:8px;">
            <div style="display:flex;justify-content:space-between;font-size:13px;margin:4px 0;">
              <span>Subtotal</span><span>${Utils.formatBRL(order.subtotal)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:13px;margin:4px 0;">
              <span>Frete</span><span>${order.taxaEntrega > 0 ? Utils.formatBRL(order.taxaEntrega) : 'R$ 0,00'}</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:16px;font-weight:700;margin:8px 0;color:#1B4332;">
              <span>TOTAL</span><span>${Utils.formatBRL(order.total)}</span>
            </div>
          </div>

          <div style="margin-top:8px;font-size:12px;">
            <div style="display:flex;justify-content:space-between;"><span>CFOP:</span><span>${cfop}</span></div>
            ${cpfInput ? `<div style="display:flex;justify-content:space-between;"><span>CPF/CNPJ Consumidor:</span><span>${cpfInput.length <= 14 ? Utils.formatCPF(cpfInput) : Utils.formatCNPJ(cpfInput)}</span></div>` : '<div style="color:#888;">Consumidor n\u00e3o identificado</div>'}
            <div style="display:flex;justify-content:space-between;"><span>Data Emiss\u00e3o:</span><span>${Utils.formatDateTime(now)}</span></div>
          </div>

          <!-- ICMS info -->
          <div style="background:#f8f9fa;border-radius:6px;padding:8px 10px;margin-top:10px;font-size:11px;color:#888;">
            <strong>Tributa\u00e7\u00e3o:</strong> ICMS - campos habilitados ap\u00f3s homologa\u00e7\u00e3o SEFAZ
          </div>

          <!-- Access Key -->
          <div style="text-align:center;margin-top:12px;padding:10px;background:#f8f9fa;border-radius:6px;">
            <div style="font-size:10px;color:#888;margin-bottom:4px;">Chave de Acesso</div>
            <div style="font-family:monospace;font-size:11px;word-break:break-all;color:#333;">${formatAccessKey(accessKey)}</div>
          </div>

          <!-- QR Code placeholder -->
          <div style="text-align:center;margin-top:12px;">
            <div style="display:inline-block;width:120px;height:120px;border:2px dashed #ccc;border-radius:8px;display:flex;align-items:center;justify-content:center;margin:0 auto;">
              <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;width:100%;height:100%;">
                <span style="font-size:32px;">&#9633;</span>
                <span style="font-size:10px;color:#888;">QR Code</span>
                <span style="font-size:9px;color:#aaa;">SEFAZ</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style="display:flex;gap:8px;justify-content:center;margin-top:16px;">
        <button class="btn-nfce-print" style="background:#1B4332;color:#fff;border:none;padding:8px 20px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;">Imprimir DANFE</button>
        <button class="btn-nfce-save" style="background:#2D6A4F;color:#fff;border:none;padding:8px 20px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;">Gerar NFC-e</button>
      </div>
    `;

    // Print DANFE
    previewArea.querySelector('.btn-nfce-print').addEventListener('click', () => {
      printDANFE(store, order, itemsWithNCM, nfceNum, cfop, cpfInput, accessKey, now);
    });

    // Save NFC-e
    previewArea.querySelector('.btn-nfce-save').addEventListener('click', () => {
      const num = getNextNumber(storeId, 'nfce');
      const notas = getNotas();
      notas.unshift({
        id: 'nf-' + Utils.generateId(),
        numero: String(num).padStart(9, '0'),
        tipo: 'nfce',
        data: now.toISOString(),
        loja: storeId,
        pedido: order.numero,
        cliente: order.cliente.nome,
        cpfCnpj: cpfInput || null,
        valor: order.total,
        cfop,
        chaveAcesso: accessKey,
        status: 'emitida',
        items: itemsWithNCM,
      });
      saveNotas(notas);
      Toast.success('NFC-e gerada com sucesso!');
      render(currentStoreFilter);
    });
  }

  function printDANFE(store, order, items, nfceNum, cfop, cpf, accessKey, date) {
    const w = window.open('', '_blank', 'width=400,height=700');
    if (!w) { Toast.error('Popup bloqueado.'); return; }

    w.document.write(`
      <!DOCTYPE html>
      <html><head><title>DANFE NFC-e ${nfceNum}</title>
      <style>
        body { font-family:'Courier New',monospace;font-size:11px;width:300px;margin:0 auto;padding:10px; }
        .center { text-align:center; }
        .line { border-top:1px dashed #000;margin:6px 0; }
        .row { display:flex;justify-content:space-between; }
        .bold { font-weight:bold; }
        .big { font-size:14px; }
        table { width:100%;border-collapse:collapse; }
        th,td { padding:2px 4px;text-align:left;font-size:11px; }
        th { border-bottom:1px solid #000; }
        @media print { body { margin:0; } }
      </style></head><body>
        <div class="center bold big">${store.nome || 'Clube do Natural'}</div>
        <div class="center">${store.endereco || ''}</div>
        <div class="center">CNPJ: ${store.cnpj ? Utils.formatCNPJ(store.cnpj) : '--'} | IE: ${store.ie || '--'}</div>
        <div class="line"></div>
        <div class="center bold">DANFE NFC-e</div>
        <div class="center">N\u00ba ${nfceNum} | S\u00e9rie: 001</div>
        <div class="center">${Utils.formatDateTime(date)}</div>
        <div class="line"></div>
        <table>
          <tr><th>Item</th><th>Qtd</th><th>UN</th><th style="text-align:right">Total</th></tr>
          ${items.map(it => `
            <tr><td>${it.nome}</td><td>${it.quantidade}</td><td>${it.unidade}</td><td style="text-align:right">${Utils.formatBRL(it.preco * it.quantidade)}</td></tr>
          `).join('')}
        </table>
        <div class="line"></div>
        <div class="row bold big"><span>TOTAL:</span><span>${Utils.formatBRL(order.total)}</span></div>
        <div class="row"><span>CFOP:</span><span>${cfop}</span></div>
        ${cpf ? `<div class="row"><span>CPF/CNPJ:</span><span>${cpf}</span></div>` : ''}
        <div class="line"></div>
        <div class="center" style="font-size:9px;word-break:break-all;">Chave: ${formatAccessKey(accessKey)}</div>
        <div class="center" style="margin-top:8px;font-size:10px;">[QR Code SEFAZ]</div>
        <div class="line"></div>
        <div class="center">Consulte em www.nfce.fazenda.sp.gov.br</div>
        <script>window.print();<\/script>
      </body></html>
    `);
    w.document.close();
  }

  /* ------------------------------------------
     HISTORY TAB
  ------------------------------------------ */
  function renderHistoryTab() {
    const storeId = getStoreId();
    let notas = getNotas();

    // Filter by store
    if (currentStoreFilter && currentStoreFilter !== 'todas') {
      notas = notas.filter(n => n.loja === storeId);
    }

    // Search
    if (historySearch) {
      const term = historySearch.toLowerCase();
      notas = notas.filter(n =>
        (n.numero || '').toLowerCase().includes(term) ||
        (n.cliente || '').toLowerCase().includes(term) ||
        (n.pedido || '').toLowerCase().includes(term)
      );
    }

    // Date filter
    if (historyDateFilter) {
      notas = notas.filter(n => n.data && n.data.startsWith(historyDateFilter));
    }

    const statusColors = {
      emitida:   { bg: '#E8F5E9', text: '#2E7D32', label: 'Emitida' },
      cancelada: { bg: '#FFEBEE', text: '#C62828', label: 'Cancelada' },
      pendente:  { bg: '#FFF8E1', text: '#F57F17', label: 'Pendente' },
    };

    return `
      <div style="margin-bottom:16px;display:flex;gap:10px;flex-wrap:wrap;">
        <input type="search" class="history-search" placeholder="Buscar por n\u00famero, cliente..." value="${historySearch}"
          style="flex:1;min-width:200px;padding:8px 12px;border:1px solid #ddd;border-radius:8px;font-size:14px;">
        <input type="date" class="history-date" value="${historyDateFilter}"
          style="padding:8px 12px;border:1px solid #ddd;border-radius:8px;font-size:14px;">
      </div>

      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:13px;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
          <thead>
            <tr style="border-bottom:2px solid #eee;">
              <th style="text-align:left;padding:10px 12px;background:#f8f9fa;font-weight:600;color:#555;font-size:12px;text-transform:uppercase;">N\u00famero</th>
              <th style="text-align:left;padding:10px 12px;background:#f8f9fa;font-weight:600;color:#555;font-size:12px;text-transform:uppercase;">Tipo</th>
              <th style="text-align:left;padding:10px 12px;background:#f8f9fa;font-weight:600;color:#555;font-size:12px;text-transform:uppercase;">Data</th>
              <th style="text-align:left;padding:10px 12px;background:#f8f9fa;font-weight:600;color:#555;font-size:12px;text-transform:uppercase;">Cliente</th>
              <th style="text-align:right;padding:10px 12px;background:#f8f9fa;font-weight:600;color:#555;font-size:12px;text-transform:uppercase;">Valor</th>
              <th style="text-align:center;padding:10px 12px;background:#f8f9fa;font-weight:600;color:#555;font-size:12px;text-transform:uppercase;">Status</th>
              <th style="text-align:center;padding:10px 12px;background:#f8f9fa;font-weight:600;color:#555;font-size:12px;text-transform:uppercase;">A\u00e7\u00f5es</th>
            </tr>
          </thead>
          <tbody>
            ${notas.length === 0 ? '<tr><td colspan="7" style="text-align:center;padding:24px;color:#999;">Nenhuma nota encontrada</td></tr>' :
              notas.map(n => {
                const sc = statusColors[n.status] || statusColors.pendente;
                return `
                <tr style="border-bottom:1px solid #f0f0f0;">
                  <td style="padding:10px 12px;font-weight:600;">${n.numero}</td>
                  <td style="padding:10px 12px;">
                    <span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;
                      background:${n.tipo === 'nfce' ? '#E3F2FD' : '#F3E5F5'};
                      color:${n.tipo === 'nfce' ? '#1565C0' : '#7B1FA2'};">
                      ${n.tipo === 'nfce' ? 'NFC-e' : 'Cupom'}
                    </span>
                  </td>
                  <td style="padding:10px 12px;">${Utils.formatDateTime(n.data)}</td>
                  <td style="padding:10px 12px;">${n.cliente || '--'}</td>
                  <td style="padding:10px 12px;text-align:right;font-weight:600;">${Utils.formatBRL(n.valor)}</td>
                  <td style="padding:10px 12px;text-align:center;">
                    <span style="display:inline-block;padding:3px 10px;border-radius:10px;font-size:11px;font-weight:600;
                      background:${sc.bg};color:${sc.text};">${sc.label}</span>
                  </td>
                  <td style="padding:10px 12px;text-align:center;">
                    <div style="display:flex;gap:4px;justify-content:center;">
                      <button class="btn-ver-nota" data-id="${n.id}" style="padding:4px 8px;border-radius:6px;border:1px solid #ddd;background:#fff;cursor:pointer;font-size:11px;">Ver</button>
                      <button class="btn-imprimir-nota" data-id="${n.id}" style="padding:4px 8px;border-radius:6px;border:1px solid #ddd;background:#fff;cursor:pointer;font-size:11px;">Imprimir</button>
                      ${n.status === 'emitida' ? `<button class="btn-cancelar-nota" data-id="${n.id}" style="padding:4px 8px;border-radius:6px;border:1px solid #C62828;background:#fff;color:#C62828;cursor:pointer;font-size:11px;">Cancelar</button>` : ''}
                    </div>
                  </td>
                </tr>
                `;
              }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function showNotaDetail(notaId) {
    const notas = getNotas();
    const nota = notas.find(n => n.id === notaId);
    if (!nota) return;

    const store = getStore(nota.loja);
    const statusColors = {
      emitida:   { bg: '#E8F5E9', text: '#2E7D32', label: 'Emitida' },
      cancelada: { bg: '#FFEBEE', text: '#C62828', label: 'Cancelada' },
      pendente:  { bg: '#FFF8E1', text: '#F57F17', label: 'Pendente' },
    };
    const sc = statusColors[nota.status] || statusColors.pendente;

    const html = `
      <div style="margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <span style="font-size:12px;color:#888;">${nota.tipo === 'nfce' ? 'NFC-e' : 'Cupom N\u00e3o-Fiscal'}</span>
          <div style="font-size:20px;font-weight:700;color:#1B4332;">#${nota.numero}</div>
        </div>
        <span style="display:inline-block;padding:4px 12px;border-radius:10px;font-size:12px;font-weight:600;background:${sc.bg};color:${sc.text};">${sc.label}</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:13px;margin-bottom:14px;">
        <div><span style="color:#888;">Data:</span> ${Utils.formatDateTime(nota.data)}</div>
        <div><span style="color:#888;">Pedido:</span> ${nota.pedido || '--'}</div>
        <div><span style="color:#888;">Cliente:</span> ${nota.cliente || '--'}</div>
        <div><span style="color:#888;">Loja:</span> ${getStoreLabel(nota.loja)}</div>
        ${nota.cpfCnpj ? `<div><span style="color:#888;">CPF/CNPJ:</span> ${nota.cpfCnpj}</div>` : ''}
        ${nota.cfop ? `<div><span style="color:#888;">CFOP:</span> ${nota.cfop}</div>` : ''}
      </div>
      ${nota.chaveAcesso ? `
        <div style="background:#f8f9fa;border-radius:6px;padding:8px;margin-bottom:14px;">
          <div style="font-size:10px;color:#888;">Chave de Acesso</div>
          <div style="font-family:monospace;font-size:11px;word-break:break-all;">${formatAccessKey(nota.chaveAcesso)}</div>
        </div>
      ` : ''}
      ${nota.items ? `
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead>
            <tr style="border-bottom:1px solid #eee;">
              <th style="text-align:left;padding:4px;">Item</th>
              <th style="text-align:center;padding:4px;">Qtd</th>
              <th style="text-align:right;padding:4px;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${nota.items.map(it => `
              <tr style="border-bottom:1px solid #f5f5f5;">
                <td style="padding:4px;">${it.nome} (${it.peso})</td>
                <td style="text-align:center;padding:4px;">${it.quantidade}</td>
                <td style="text-align:right;padding:4px;">${Utils.formatBRL(it.preco * it.quantidade)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : ''}
      <div style="text-align:right;font-size:16px;font-weight:700;color:#1B4332;margin-top:8px;">
        Total: ${Utils.formatBRL(nota.valor)}
      </div>
    `;

    createModal(`${nota.tipo === 'nfce' ? 'NFC-e' : 'Cupom'} #${nota.numero}`, html);
  }

  function reprintNota(notaId) {
    const notas = getNotas();
    const nota = notas.find(n => n.id === notaId);
    if (!nota) return;

    const store = getStore(nota.loja);
    const order = findOrder(nota.pedido);

    if (nota.tipo === 'cupom' && order) {
      printCupom(store, order, nota.numero, new Date(nota.data));
    } else if (nota.tipo === 'nfce' && order) {
      const itemsWithNCM = (nota.items || order.items).map(item => {
        const product = DataProducts.find(p => p.id === item.productId);
        return { ...item, ncm: item.ncm || (product && product.ncm) || '0000.00.00', unidade: item.unidade || 'UN' };
      });
      printDANFE(store, order, itemsWithNCM, nota.numero, nota.cfop || '5.102', nota.cpfCnpj || '', nota.chaveAcesso || generateAccessKey(), new Date(nota.data));
    } else {
      Toast.error('Dados do pedido n\u00e3o encontrados para reimpress\u00e3o');
    }
  }

  function cancelNota(notaId) {
    const notas = getNotas();
    const idx = notas.findIndex(n => n.id === notaId);
    if (idx === -1) return;

    if (!confirm('Tem certeza que deseja cancelar esta nota?')) return;

    notas[idx].status = 'cancelada';
    notas[idx].dataCancelamento = new Date().toISOString();
    saveNotas(notas);
    Toast.success('Nota cancelada');
    render(currentStoreFilter);
  }

  /* ------------------------------------------
     RENDER
  ------------------------------------------ */
  function render(storeFilter) {
    const el = container();
    if (!el) return;

    currentStoreFilter = storeFilter || 'todas';

    el.innerHTML = `
      <style>
        .nf-tabs { display:flex;gap:0;margin-bottom:20px;border-bottom:2px solid #eee; }
        .nf-tab {
          padding:10px 20px;cursor:pointer;font-size:14px;font-weight:600;color:#888;
          border-bottom:2px solid transparent;margin-bottom:-2px;transition:all 0.2s;
        }
        .nf-tab:hover { color:#2D6A4F; }
        .nf-tab--active { color:#1B4332;border-bottom-color:#2D6A4F; }
        @media (max-width:480px) { .nf-tab { padding:8px 12px;font-size:13px; } }
      </style>

      <!-- Tabs -->
      <div class="nf-tabs">
        <div class="nf-tab ${activeTab === 'cupom' ? 'nf-tab--active' : ''}" data-tab="cupom">Cupom N\u00e3o-Fiscal</div>
        <div class="nf-tab ${activeTab === 'nfce' ? 'nf-tab--active' : ''}" data-tab="nfce">NFC-e</div>
        <div class="nf-tab ${activeTab === 'historico' ? 'nf-tab--active' : ''}" data-tab="historico">Hist\u00f3rico</div>
      </div>

      <!-- Tab Content -->
      <div class="nf-tab-content">
        ${activeTab === 'cupom' ? renderCupomTab() : ''}
        ${activeTab === 'nfce' ? renderNFCeTab() : ''}
        ${activeTab === 'historico' ? renderHistoryTab() : ''}
      </div>
    `;

    bindEvents(el);
  }

  function renderCupomTab() {
    return `
      <div style="text-align:center;padding:30px;">
        <div style="font-size:48px;margin-bottom:12px;">&#128462;</div>
        <h3 style="margin:0 0 8px;color:#1B4332;">Cupom N\u00e3o-Fiscal</h3>
        <p style="color:#888;margin:0 0 20px;font-size:14px;">Gere cupons n\u00e3o-fiscais para seus pedidos com layout t\u00e9rmico 80mm.</p>
        <button class="btn-gerar-cupom" style="background:#2D6A4F;color:#fff;border:none;padding:12px 28px;border-radius:8px;cursor:pointer;font-size:15px;font-weight:600;">Gerar Cupom</button>
      </div>
    `;
  }

  function bindEvents(el) {
    // Tabs
    el.querySelectorAll('.nf-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        activeTab = tab.dataset.tab;
        render(currentStoreFilter);
      });
    });

    // Gerar Cupom
    const btnGerarCupom = el.querySelector('.btn-gerar-cupom');
    if (btnGerarCupom) btnGerarCupom.addEventListener('click', showGerarCupomModal);

    // NFC-e buscar
    const btnNfceBuscar = el.querySelector('.btn-nfce-buscar');
    if (btnNfceBuscar) {
      btnNfceBuscar.addEventListener('click', () => loadNFCeOrder(el));
    }

    // History search
    const histSearch = el.querySelector('.history-search');
    if (histSearch) {
      histSearch.addEventListener('input', Utils.debounce((e) => {
        historySearch = e.target.value;
        render(currentStoreFilter);
      }, 400));
    }

    // History date filter
    const histDate = el.querySelector('.history-date');
    if (histDate) {
      histDate.addEventListener('change', (e) => {
        historyDateFilter = e.target.value;
        render(currentStoreFilter);
      });
    }

    // History action buttons
    el.querySelectorAll('.btn-ver-nota').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        showNotaDetail(btn.dataset.id);
      });
    });

    el.querySelectorAll('.btn-imprimir-nota').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        reprintNota(btn.dataset.id);
      });
    });

    el.querySelectorAll('.btn-cancelar-nota').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        cancelNota(btn.dataset.id);
      });
    });
  }

  /* ------------------------------------------
     PUBLIC API
  ------------------------------------------ */
  return {
    render,
  };
})();
