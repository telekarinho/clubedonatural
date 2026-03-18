/* ============================================
   CLUBE DO NATURAL — Admin Estoque
   Gestao de inventario com suporte OFFLINE
   ============================================ */

const AdminEstoque = (() => {
  const container = () => document.getElementById('estoque-content');

  let currentStoreFilter = 'todas';
  let searchTerm = '';
  let statusFilter = 'todos';
  let categoryFilter = 'todas';

  const STATUS_COLORS = {
    ok:     { bg: '#E8F5E9', text: '#2E7D32', label: 'OK' },
    baixo:  { bg: '#FFF8E1', text: '#F57F17', label: 'Baixo' },
    zerado: { bg: '#FFEBEE', text: '#C62828', label: 'Zerado' },
  };

  /* ------------------------------------------
     HELPERS
  ------------------------------------------ */
  function getStoreLabel(lojaId) {
    const store = DataStores.find(s => s.id === lojaId);
    return store ? store.nome.split(' - ')[1] || store.nome : lojaId;
  }

  function getStockStatus(qty, min) {
    if (qty === 0) return 'zerado';
    if (qty <= min) return 'baixo';
    return 'ok';
  }

  function getProducts() {
    // Use live product data with localStorage overrides
    const overrides = Storage.get('product_stock_overrides') || {};
    return DataProducts.filter(p => p.ativo !== false).map(p => {
      const estoque = { ...(p.estoque || {}), ...(overrides[p.id] || {}) };
      return { ...p, estoque };
    });
  }

  function buildStockRows() {
    const products = getProducts();
    const rows = [];

    products.forEach(p => {
      const stores = currentStoreFilter && currentStoreFilter !== 'todas'
        ? [currentStoreFilter]
        : Object.keys(p.estoque || {});

      stores.forEach(storeId => {
        const qty = (p.estoque && p.estoque[storeId]) || 0;
        const min = p.estoqueMinimo || 0;
        const status = getStockStatus(qty, min);

        // Apply filters
        if (statusFilter !== 'todos' && status !== statusFilter) return;
        if (categoryFilter !== 'todas' && p.categoria !== categoryFilter) return;
        if (searchTerm) {
          const term = searchTerm.toLowerCase();
          if (!p.nome.toLowerCase().includes(term) &&
              !p.categoria.toLowerCase().includes(term) &&
              !storeId.toLowerCase().includes(term)) return;
        }

        rows.push({
          productId: p.id,
          nome: p.nome,
          categoria: p.categoria,
          loja: storeId,
          quantidade: qty,
          minimo: min,
          status,
          ncm: p.ncm || '',
          unidade: p.unidadeMedida || 'UN',
        });
      });
    });

    return rows;
  }

  function saveStockOverride(productId, storeId, newQty) {
    const overrides = Storage.get('product_stock_overrides') || {};
    if (!overrides[productId]) overrides[productId] = {};
    overrides[productId][storeId] = Math.max(0, newQty);
    Storage.set('product_stock_overrides', overrides);
  }

  function getStockQty(productId, storeId) {
    const overrides = Storage.get('product_stock_overrides') || {};
    if (overrides[productId] && overrides[productId][storeId] !== undefined) {
      return overrides[productId][storeId];
    }
    const product = DataProducts.find(p => p.id === productId);
    return (product && product.estoque && product.estoque[storeId]) || 0;
  }

  function addMovement(movement) {
    const movements = Storage.get('stock_movements') || [];
    movements.unshift({
      id: 'mov-' + Utils.generateId(),
      timestamp: new Date().toISOString(),
      usuario: (AppState.get('user') || {}).nome || 'Admin',
      ...movement,
    });
    Storage.set('stock_movements', movements);
    queueSync(movement);
  }

  function queueSync(operation) {
    const queue = Storage.get('sync_queue_estoque') || [];
    queue.push({
      id: 'sync-' + Utils.generateId(),
      timestamp: new Date().toISOString(),
      operation,
      synced: false,
    });
    Storage.set('sync_queue_estoque', queue);
  }

  function getCategoryLabel(catId) {
    const cat = DataCategories.find(c => c.id === catId);
    return cat ? cat.nome : catId;
  }

  /* ------------------------------------------
     MODALS
  ------------------------------------------ */
  function createModal(title, bodyHTML, onConfirm) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:10001;display:flex;align-items:center;justify-content:center;padding:16px;';

    const modal = document.createElement('div');
    modal.style.cssText = 'background:#fff;border-radius:12px;max-width:480px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.3);';

    modal.innerHTML = `
      <div style="padding:16px 20px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center;">
        <h3 style="margin:0;font-size:18px;color:#1B4332;">${title}</h3>
        <button class="modal-close" style="background:none;border:none;font-size:22px;cursor:pointer;color:#888;padding:4px 8px;">&#10005;</button>
      </div>
      <div style="padding:20px;" class="modal-body">${bodyHTML}</div>
      <div style="padding:12px 20px;border-top:1px solid #eee;display:flex;gap:8px;justify-content:flex-end;">
        <button class="modal-cancel" style="background:#f5f5f5;color:#555;border:1px solid #ddd;padding:8px 20px;border-radius:8px;cursor:pointer;font-size:14px;">Cancelar</button>
        <button class="modal-confirm" style="background:#2D6A4F;color:#fff;border:none;padding:8px 20px;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600;">Confirmar</button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    modal.querySelector('.modal-close').addEventListener('click', close);
    modal.querySelector('.modal-cancel').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    const escHandler = (e) => {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', escHandler); }
    };
    document.addEventListener('keydown', escHandler);

    modal.querySelector('.modal-confirm').addEventListener('click', () => {
      if (onConfirm(modal)) close();
    });

    return modal;
  }

  function showEntradaModal(productId, storeId, productName) {
    const html = `
      <div style="margin-bottom:14px;">
        <label style="font-size:13px;color:#555;display:block;margin-bottom:4px;">Produto</label>
        <div style="font-weight:600;color:#1B4332;">${productName} (${getStoreLabel(storeId)})</div>
      </div>
      <div style="margin-bottom:14px;">
        <label style="font-size:13px;color:#555;display:block;margin-bottom:4px;">Quantidade</label>
        <input type="number" class="input-qty" min="1" value="1" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:8px;font-size:14px;">
      </div>
      <div style="margin-bottom:14px;">
        <label style="font-size:13px;color:#555;display:block;margin-bottom:4px;">Motivo</label>
        <select class="input-reason" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:8px;font-size:14px;">
          <option value="Compra Fornecedor">Compra Fornecedor</option>
          <option value="Devolucao">Devolu\u00e7\u00e3o</option>
          <option value="Ajuste">Ajuste</option>
        </select>
      </div>
      <div>
        <label style="font-size:13px;color:#555;display:block;margin-bottom:4px;">Observa\u00e7\u00e3o</label>
        <textarea class="input-note" rows="2" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:8px;font-size:14px;resize:vertical;"></textarea>
      </div>
    `;

    createModal('+Entrada de Estoque', html, (modal) => {
      const qty = parseInt(modal.querySelector('.input-qty').value) || 0;
      if (qty <= 0) { Toast.error('Quantidade deve ser maior que zero'); return false; }
      const reason = modal.querySelector('.input-reason').value;
      const note = modal.querySelector('.input-note').value;

      const currentQty = getStockQty(productId, storeId);
      saveStockOverride(productId, storeId, currentQty + qty);
      addMovement({
        tipo: 'entrada',
        productId,
        productName,
        loja: storeId,
        quantidade: qty,
        motivo: reason,
        nota: note,
        estoqueAnterior: currentQty,
        estoqueNovo: currentQty + qty,
      });

      Toast.success(`+${qty} unidades de ${productName}`);
      render(currentStoreFilter);
      return true;
    });
  }

  function showSaidaModal(productId, storeId, productName) {
    const currentQty = getStockQty(productId, storeId);
    const html = `
      <div style="margin-bottom:14px;">
        <label style="font-size:13px;color:#555;display:block;margin-bottom:4px;">Produto</label>
        <div style="font-weight:600;color:#1B4332;">${productName} (${getStoreLabel(storeId)})</div>
        <div style="font-size:12px;color:#888;margin-top:2px;">Estoque atual: ${currentQty}</div>
      </div>
      <div style="margin-bottom:14px;">
        <label style="font-size:13px;color:#555;display:block;margin-bottom:4px;">Quantidade</label>
        <input type="number" class="input-qty" min="1" max="${currentQty}" value="1" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:8px;font-size:14px;">
      </div>
      <div style="margin-bottom:14px;">
        <label style="font-size:13px;color:#555;display:block;margin-bottom:4px;">Motivo</label>
        <select class="input-reason" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:8px;font-size:14px;">
          <option value="Venda">Venda</option>
          <option value="Perda">Perda</option>
          <option value="Vencimento">Vencimento</option>
          <option value="Uso Interno">Uso Interno</option>
        </select>
      </div>
      <div>
        <label style="font-size:13px;color:#555;display:block;margin-bottom:4px;">Observa\u00e7\u00e3o</label>
        <textarea class="input-note" rows="2" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:8px;font-size:14px;resize:vertical;"></textarea>
      </div>
    `;

    createModal('-Sa\u00edda de Estoque', html, (modal) => {
      const qty = parseInt(modal.querySelector('.input-qty').value) || 0;
      if (qty <= 0) { Toast.error('Quantidade deve ser maior que zero'); return false; }
      if (qty > currentQty) { Toast.error('Quantidade excede o estoque atual'); return false; }
      const reason = modal.querySelector('.input-reason').value;
      const note = modal.querySelector('.input-note').value;

      saveStockOverride(productId, storeId, currentQty - qty);
      addMovement({
        tipo: 'saida',
        productId,
        productName,
        loja: storeId,
        quantidade: qty,
        motivo: reason,
        nota: note,
        estoqueAnterior: currentQty,
        estoqueNovo: currentQty - qty,
      });

      Toast.success(`-${qty} unidades de ${productName}`);
      render(currentStoreFilter);
      return true;
    });
  }

  function showTransferirModal(productId, storeId, productName) {
    const currentQty = getStockQty(productId, storeId);
    const otherStores = DataStores.filter(s => s.id !== storeId);
    const html = `
      <div style="margin-bottom:14px;">
        <label style="font-size:13px;color:#555;display:block;margin-bottom:4px;">Produto</label>
        <div style="font-weight:600;color:#1B4332;">${productName}</div>
        <div style="font-size:12px;color:#888;margin-top:2px;">Origem: ${getStoreLabel(storeId)} (estoque: ${currentQty})</div>
      </div>
      <div style="margin-bottom:14px;">
        <label style="font-size:13px;color:#555;display:block;margin-bottom:4px;">Loja Destino</label>
        <select class="input-dest" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:8px;font-size:14px;">
          ${otherStores.map(s => `<option value="${s.id}">${s.nome.split(' - ')[1] || s.nome}</option>`).join('')}
        </select>
      </div>
      <div style="margin-bottom:14px;">
        <label style="font-size:13px;color:#555;display:block;margin-bottom:4px;">Quantidade</label>
        <input type="number" class="input-qty" min="1" max="${currentQty}" value="1" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:8px;font-size:14px;">
      </div>
    `;

    createModal('Transferir Estoque', html, (modal) => {
      const qty = parseInt(modal.querySelector('.input-qty').value) || 0;
      const destId = modal.querySelector('.input-dest').value;
      if (qty <= 0) { Toast.error('Quantidade deve ser maior que zero'); return false; }
      if (qty > currentQty) { Toast.error('Quantidade excede o estoque atual'); return false; }

      const destQty = getStockQty(productId, destId);
      saveStockOverride(productId, storeId, currentQty - qty);
      saveStockOverride(productId, destId, destQty + qty);
      addMovement({
        tipo: 'transferencia',
        productId,
        productName,
        loja: storeId,
        lojaDestino: destId,
        quantidade: qty,
        motivo: 'Transfer\u00eancia entre lojas',
        nota: `${getStoreLabel(storeId)} -> ${getStoreLabel(destId)}`,
        estoqueAnterior: currentQty,
        estoqueNovo: currentQty - qty,
      });

      Toast.success(`${qty}x ${productName} transferido para ${getStoreLabel(destId)}`);
      render(currentStoreFilter);
      return true;
    });
  }

  function showAjustarModal(productId, storeId, productName) {
    const currentQty = getStockQty(productId, storeId);
    const html = `
      <div style="margin-bottom:14px;">
        <label style="font-size:13px;color:#555;display:block;margin-bottom:4px;">Produto</label>
        <div style="font-weight:600;color:#1B4332;">${productName} (${getStoreLabel(storeId)})</div>
        <div style="font-size:12px;color:#888;margin-top:2px;">Estoque atual (sistema): ${currentQty}</div>
      </div>
      <div style="margin-bottom:14px;">
        <label style="font-size:13px;color:#555;display:block;margin-bottom:4px;">Quantidade Real (contagem f\u00edsica)</label>
        <input type="number" class="input-qty" min="0" value="${currentQty}" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:8px;font-size:14px;">
      </div>
      <div>
        <label style="font-size:13px;color:#555;display:block;margin-bottom:4px;">Observa\u00e7\u00e3o</label>
        <textarea class="input-note" rows="2" placeholder="Ex: Contagem f\u00edsica do invent\u00e1rio" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:8px;font-size:14px;resize:vertical;"></textarea>
      </div>
    `;

    createModal('Ajuste de Invent\u00e1rio', html, (modal) => {
      const newQty = parseInt(modal.querySelector('.input-qty').value);
      if (isNaN(newQty) || newQty < 0) { Toast.error('Quantidade inv\u00e1lida'); return false; }
      const note = modal.querySelector('.input-note').value;

      saveStockOverride(productId, storeId, newQty);
      addMovement({
        tipo: 'ajuste',
        productId,
        productName,
        loja: storeId,
        quantidade: newQty - currentQty,
        motivo: 'Ajuste de invent\u00e1rio',
        nota: note || 'Contagem f\u00edsica',
        estoqueAnterior: currentQty,
        estoqueNovo: newQty,
      });

      Toast.success(`Estoque de ${productName} ajustado para ${newQty}`);
      render(currentStoreFilter);
      return true;
    });
  }

  /* ------------------------------------------
     MOVEMENT HISTORY MODAL
  ------------------------------------------ */
  function showHistoryModal(productId, storeId, productName) {
    const movements = (Storage.get('stock_movements') || []).filter(m =>
      m.productId === productId && m.loja === storeId
    );

    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:10001;display:flex;align-items:center;justify-content:center;padding:16px;';

    const modal = document.createElement('div');
    modal.style.cssText = 'background:#fff;border-radius:12px;max-width:700px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.3);';

    const tipoColors = {
      entrada: '#2E7D32',
      saida: '#C62828',
      transferencia: '#1565C0',
      ajuste: '#F57F17',
      auto_deducao: '#7B1FA2',
    };

    modal.innerHTML = `
      <div style="padding:16px 20px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center;">
        <h3 style="margin:0;font-size:18px;color:#1B4332;">Hist\u00f3rico - ${productName} (${getStoreLabel(storeId)})</h3>
        <button class="modal-close" style="background:none;border:none;font-size:22px;cursor:pointer;color:#888;padding:4px 8px;">&#10005;</button>
      </div>
      <div style="padding:20px;overflow-x:auto;">
        ${movements.length === 0 ? '<p style="text-align:center;color:#999;">Nenhuma movimenta\u00e7\u00e3o registrada</p>' : `
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead>
            <tr style="border-bottom:2px solid #eee;">
              <th style="text-align:left;padding:8px 6px;">Data/Hora</th>
              <th style="text-align:left;padding:8px 6px;">Tipo</th>
              <th style="text-align:right;padding:8px 6px;">Qtd</th>
              <th style="text-align:left;padding:8px 6px;">Motivo</th>
              <th style="text-align:left;padding:8px 6px;">Usu\u00e1rio</th>
              <th style="text-align:left;padding:8px 6px;">Obs</th>
            </tr>
          </thead>
          <tbody>
            ${movements.map(m => `
              <tr style="border-bottom:1px solid #f0f0f0;">
                <td style="padding:8px 6px;white-space:nowrap;">${Utils.formatDateTime(m.timestamp)}</td>
                <td style="padding:8px 6px;">
                  <span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;color:#fff;background:${tipoColors[m.tipo] || '#888'};">
                    ${m.tipo}
                  </span>
                </td>
                <td style="padding:8px 6px;text-align:right;font-weight:600;color:${m.tipo === 'entrada' ? '#2E7D32' : m.tipo === 'saida' || m.tipo === 'auto_deducao' ? '#C62828' : '#333'};">
                  ${m.tipo === 'entrada' ? '+' : m.tipo === 'saida' || m.tipo === 'auto_deducao' ? '-' : ''}${Math.abs(m.quantidade)}
                </td>
                <td style="padding:8px 6px;">${m.motivo || '-'}</td>
                <td style="padding:8px 6px;">${m.usuario || '-'}</td>
                <td style="padding:8px 6px;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${(m.nota || '').replace(/"/g, '&quot;')}">${m.nota || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        `}
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    modal.querySelector('.modal-close').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
    });
  }

  /* ------------------------------------------
     AUTO-DEDUCT ON ORDER CONFIRMATION
  ------------------------------------------ */
  function autoDeductStock(order) {
    if (!order || !order.items || !order.loja) return;
    order.items.forEach(item => {
      const currentQty = getStockQty(item.productId, order.loja);
      const deductQty = item.quantidade || 1;
      const newQty = Math.max(0, currentQty - deductQty);
      saveStockOverride(item.productId, order.loja, newQty);
      addMovement({
        tipo: 'auto_deducao',
        productId: item.productId,
        productName: item.nome,
        loja: order.loja,
        quantidade: deductQty,
        motivo: 'Dedu\u00e7\u00e3o autom\u00e1tica - Pedido ' + (order.numero || ''),
        nota: 'Pedido confirmado',
        estoqueAnterior: currentQty,
        estoqueNovo: newQty,
      });
    });
  }

  /* ------------------------------------------
     EXPORT CSV
  ------------------------------------------ */
  function exportCSV() {
    const rows = buildStockRows();
    const header = 'Produto;Categoria;Loja;Quantidade;Minimo;Status';
    const lines = rows.map(r =>
      `${r.nome};${getCategoryLabel(r.categoria)};${getStoreLabel(r.loja)};${r.quantidade};${r.minimo};${STATUS_COLORS[r.status].label}`
    );
    const csv = [header, ...lines].join('\n');

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(csv).then(() => {
        Toast.success('CSV copiado para a \u00e1rea de transfer\u00eancia!');
      }).catch(() => {
        fallbackCopy(csv);
      });
    } else {
      fallbackCopy(csv);
    }
  }

  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;left:-9999px;';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    Toast.success('CSV copiado!');
  }

  /* ------------------------------------------
     RENDER
  ------------------------------------------ */
  function render(storeFilter) {
    const el = container();
    if (!el) return;

    currentStoreFilter = storeFilter || 'todas';
    const rows = buildStockRows();

    // KPI counts
    const allRows = (() => {
      const saved = { searchTerm, statusFilter, categoryFilter };
      searchTerm = ''; statusFilter = 'todos'; categoryFilter = 'todas';
      const all = buildStockRows();
      searchTerm = saved.searchTerm; statusFilter = saved.statusFilter; categoryFilter = saved.categoryFilter;
      return all;
    })();

    const totalProdutos = new Set(allRows.map(r => r.productId)).size;
    const estoqueOk = allRows.filter(r => r.status === 'ok').length;
    const estoqueBaixo = allRows.filter(r => r.status === 'baixo').length;
    const estoqueZerado = allRows.filter(r => r.status === 'zerado').length;

    // Categories for filter
    const categories = [...new Set(DataProducts.map(p => p.categoria))];

    el.innerHTML = `
      <style>
        .estoque-kpis { display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:20px; }
        .estoque-kpi {
          background:#fff;border-radius:10px;padding:16px;text-align:center;
          box-shadow:0 1px 4px rgba(0,0,0,0.06);border-left:4px solid transparent;
        }
        .estoque-kpi__value { font-size:28px;font-weight:700;color:#1B4332; }
        .estoque-kpi__label { font-size:12px;color:#888;margin-top:4px; }
        .estoque-action-bar {
          display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:16px;
        }
        .estoque-action-bar input,
        .estoque-action-bar select {
          padding:8px 12px;border:1px solid #ddd;border-radius:8px;font-size:14px;background:#fff;
        }
        .estoque-action-bar input[type="search"] { flex:1;min-width:200px;max-width:350px; }
        .estoque-btn {
          background:#2D6A4F;color:#fff;border:none;padding:8px 16px;border-radius:8px;
          cursor:pointer;font-size:13px;font-weight:600;white-space:nowrap;
        }
        .estoque-btn:hover { background:#1B4332; }
        .estoque-btn--outline {
          background:#fff;color:#2D6A4F;border:1px solid #2D6A4F;
        }
        .estoque-btn--outline:hover { background:#E8F5E9; }
        .estoque-table-wrap { overflow-x:auto; }
        .estoque-table {
          width:100%;border-collapse:collapse;font-size:13px;background:#fff;border-radius:10px;overflow:hidden;
          box-shadow:0 1px 4px rgba(0,0,0,0.06);
        }
        .estoque-table th {
          text-align:left;padding:10px 12px;background:#f8f9fa;font-weight:600;color:#555;
          border-bottom:2px solid #eee;white-space:nowrap;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;
        }
        .estoque-table td { padding:10px 12px;border-bottom:1px solid #f0f0f0;vertical-align:middle; }
        .estoque-table tr:hover td { background:#f8fdf9; }
        .estoque-badge {
          display:inline-block;padding:3px 10px;border-radius:10px;font-size:11px;font-weight:600;
        }
        .estoque-actions { display:flex;gap:4px;flex-wrap:wrap; }
        .estoque-actions button {
          padding:4px 8px;border-radius:6px;border:1px solid #ddd;background:#fff;
          cursor:pointer;font-size:11px;white-space:nowrap;transition:background 0.15s;
        }
        .estoque-actions button:hover { background:#f0f0f0; }
        .estoque-actions .btn-entrada { color:#2E7D32;border-color:#2E7D32; }
        .estoque-actions .btn-entrada:hover { background:#E8F5E9; }
        .estoque-actions .btn-saida { color:#C62828;border-color:#C62828; }
        .estoque-actions .btn-saida:hover { background:#FFEBEE; }
        .estoque-actions .btn-transferir { color:#1565C0;border-color:#1565C0; }
        .estoque-actions .btn-transferir:hover { background:#E3F2FD; }
        .estoque-actions .btn-ajustar { color:#F57F17;border-color:#F57F17; }
        .estoque-actions .btn-ajustar:hover { background:#FFF8E1; }
        .estoque-actions .btn-historico { color:#555; }
        @media (max-width:768px) {
          .estoque-kpis { grid-template-columns:repeat(2,1fr); }
          .estoque-actions { flex-direction:column; }
        }
      </style>

      <!-- KPI Cards -->
      <div class="estoque-kpis">
        <div class="estoque-kpi" style="border-left-color:#1B4332;">
          <div class="estoque-kpi__value">${totalProdutos}</div>
          <div class="estoque-kpi__label">Total Produtos</div>
        </div>
        <div class="estoque-kpi" style="border-left-color:#2E7D32;">
          <div class="estoque-kpi__value" style="color:#2E7D32;">${estoqueOk}</div>
          <div class="estoque-kpi__label">Estoque OK</div>
        </div>
        <div class="estoque-kpi" style="border-left-color:#F57F17;">
          <div class="estoque-kpi__value" style="color:#F57F17;">${estoqueBaixo}</div>
          <div class="estoque-kpi__label">Estoque Baixo</div>
        </div>
        <div class="estoque-kpi" style="border-left-color:#C62828;">
          <div class="estoque-kpi__value" style="color:#C62828;">${estoqueZerado}</div>
          <div class="estoque-kpi__label">Estoque Zerado</div>
        </div>
      </div>

      <!-- Action Bar -->
      <div class="estoque-action-bar">
        <input type="search" class="estoque-search" placeholder="Buscar produto..." value="${searchTerm}">
        <select class="estoque-status-filter">
          <option value="todos"${statusFilter === 'todos' ? ' selected' : ''}>Todos</option>
          <option value="ok"${statusFilter === 'ok' ? ' selected' : ''}>OK</option>
          <option value="baixo"${statusFilter === 'baixo' ? ' selected' : ''}>Baixo</option>
          <option value="zerado"${statusFilter === 'zerado' ? ' selected' : ''}>Zerado</option>
        </select>
        <select class="estoque-cat-filter">
          <option value="todas"${categoryFilter === 'todas' ? ' selected' : ''}>Todas Categorias</option>
          ${categories.map(c => `<option value="${c}"${categoryFilter === c ? ' selected' : ''}>${getCategoryLabel(c)}</option>`).join('')}
        </select>
        <button class="estoque-btn estoque-btn--outline btn-export">Exportar CSV</button>
      </div>

      <!-- Table -->
      <div class="estoque-table-wrap">
        <table class="estoque-table">
          <thead>
            <tr>
              <th>Produto</th>
              <th>Categoria</th>
              <th>Loja</th>
              <th>Quantidade</th>
              <th>M\u00ednimo</th>
              <th>Status</th>
              <th>A\u00e7\u00f5es</th>
            </tr>
          </thead>
          <tbody>
            ${rows.length === 0 ? `<tr><td colspan="7" style="text-align:center;padding:24px;color:#999;">Nenhum produto encontrado</td></tr>` :
              rows.map(r => {
                const sc = STATUS_COLORS[r.status];
                return `
                <tr>
                  <td style="font-weight:600;color:#1B4332;">${r.nome}</td>
                  <td>${getCategoryLabel(r.categoria)}</td>
                  <td>${getStoreLabel(r.loja)}</td>
                  <td style="font-weight:600;">${r.quantidade}</td>
                  <td>${r.minimo}</td>
                  <td>
                    <span class="estoque-badge" style="background:${sc.bg};color:${sc.text};">${sc.label}</span>
                  </td>
                  <td>
                    <div class="estoque-actions">
                      <button class="btn-entrada" data-pid="${r.productId}" data-store="${r.loja}" data-name="${r.nome}">+Entrada</button>
                      <button class="btn-saida" data-pid="${r.productId}" data-store="${r.loja}" data-name="${r.nome}">-Sa\u00edda</button>
                      <button class="btn-transferir" data-pid="${r.productId}" data-store="${r.loja}" data-name="${r.nome}">Transferir</button>
                      <button class="btn-ajustar" data-pid="${r.productId}" data-store="${r.loja}" data-name="${r.nome}">Ajustar</button>
                      <button class="btn-historico" data-pid="${r.productId}" data-store="${r.loja}" data-name="${r.nome}" title="Hist\u00f3rico">&#128196;</button>
                    </div>
                  </td>
                </tr>
                `;
              }).join('')}
          </tbody>
        </table>
      </div>

      <!-- Offline indicator -->
      <div style="text-align:center;margin-top:16px;font-size:12px;color:#888;">
        ${!navigator.onLine ? '<span style="color:#C62828;">&#9679; Offline</span> \u2014 Opera\u00e7\u00f5es ser\u00e3o sincronizadas quando a conex\u00e3o voltar' : ''}
        ${(() => {
          const queue = Storage.get('sync_queue_estoque') || [];
          const pending = queue.filter(q => !q.synced).length;
          return pending > 0 ? `<span style="color:#F57F17;">&#9679; ${pending} opera\u00e7\u00e3o(oes) pendente(s) de sync</span>` : '';
        })()}
      </div>
    `;

    // Bind events
    bindEvents(el);
  }

  function bindEvents(el) {
    // Search
    const searchInput = el.querySelector('.estoque-search');
    if (searchInput) {
      searchInput.addEventListener('input', Utils.debounce((e) => {
        searchTerm = e.target.value;
        render(currentStoreFilter);
      }, 400));
      searchInput.focus();
    }

    // Status filter
    const statusSelect = el.querySelector('.estoque-status-filter');
    if (statusSelect) {
      statusSelect.addEventListener('change', (e) => {
        statusFilter = e.target.value;
        render(currentStoreFilter);
      });
    }

    // Category filter
    const catSelect = el.querySelector('.estoque-cat-filter');
    if (catSelect) {
      catSelect.addEventListener('change', (e) => {
        categoryFilter = e.target.value;
        render(currentStoreFilter);
      });
    }

    // Export
    const btnExport = el.querySelector('.btn-export');
    if (btnExport) btnExport.addEventListener('click', exportCSV);

    // Action buttons
    el.querySelectorAll('.btn-entrada').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        showEntradaModal(btn.dataset.pid, btn.dataset.store, btn.dataset.name);
      });
    });
    el.querySelectorAll('.btn-saida').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        showSaidaModal(btn.dataset.pid, btn.dataset.store, btn.dataset.name);
      });
    });
    el.querySelectorAll('.btn-transferir').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        showTransferirModal(btn.dataset.pid, btn.dataset.store, btn.dataset.name);
      });
    });
    el.querySelectorAll('.btn-ajustar').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        showAjustarModal(btn.dataset.pid, btn.dataset.store, btn.dataset.name);
      });
    });
    el.querySelectorAll('.btn-historico').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        showHistoryModal(btn.dataset.pid, btn.dataset.store, btn.dataset.name);
      });
    });
  }

  /* ------------------------------------------
     PUBLIC API
  ------------------------------------------ */
  return {
    render,
    autoDeductStock,
  };
})();
