/* ============================================
   CLUBE DO NATURAL — Admin Lojas
   Gestão de lojas / filiais
   ============================================ */

const AdminLojas = (() => {
  const container = () => document.getElementById('lojas-content');

  let currentStoreFilter = 'todas';
  let detailStoreId = null;

  const STATUS_BADGES = {
    aberta:      { bg: '#E8F5E9', color: '#2E7D32', label: 'Aberta' },
    fechada:     { bg: '#FFEBEE', color: '#C62828', label: 'Fechada' },
    manutencao:  { bg: '#FFF8E1', color: '#F57F17', label: 'Manutenção' },
  };

  /* ------------------------------------------
     DATA
  ------------------------------------------ */
  function getStores() {
    const custom = Storage.get('stores_custom') || [];
    const deleted = new Set(Storage.get('stores_deleted') || []);
    const customIds = new Set(custom.map(s => s.id));
    const merged = [
      ...DataStores.filter(s => !customIds.has(s.id) && !deleted.has(s.id)),
      ...custom,
    ];
    if (currentStoreFilter && currentStoreFilter !== 'todas') {
      return merged.filter(s => s.id === currentStoreFilter);
    }
    return merged;
  }

  function getAllStores() {
    const custom = Storage.get('stores_custom') || [];
    const deleted = new Set(Storage.get('stores_deleted') || []);
    const customIds = new Set(custom.map(s => s.id));
    return [
      ...DataStores.filter(s => !customIds.has(s.id) && !deleted.has(s.id)),
      ...custom,
    ];
  }

  function saveStore(store) {
    const custom = Storage.get('stores_custom') || [];
    const idx = custom.findIndex(s => s.id === store.id);
    if (idx !== -1) custom[idx] = store;
    else custom.push(store);
    Storage.set('stores_custom', custom);
  }

  /* ------------------------------------------
     KPIs per store
  ------------------------------------------ */
  function getStoreKPIs(storeId) {
    const orders = (Storage.get('orders') || []).filter(o => o.loja === storeId);
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const todayOrders = orders.filter(o => o.data.slice(0, 10) === todayStr);

    const vendasHoje = todayOrders.reduce((s, o) => s + o.total, 0);
    const pedidosHoje = todayOrders.length;

    // Low stock
    let estoqueBaixo = 0;
    DataProducts.forEach(p => {
      if (!p.estoque || !p.estoqueMinimo) return;
      if ((p.estoque[storeId] || 0) < p.estoqueMinimo) estoqueBaixo++;
    });

    return { vendasHoje, pedidosHoje, estoqueBaixo };
  }

  /* ------------------------------------------
     RENDER
  ------------------------------------------ */
  function render(storeFilter) {
    const el = container();
    if (!el) return;

    currentStoreFilter = storeFilter || 'todas';

    if (detailStoreId) {
      renderDetail(el);
      return;
    }

    const stores = getStores();

    el.innerHTML = `
      <style>
        .lojas-header {
          display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px;
        }
        .lojas-btn-nova {
          background:#2D6A4F;color:#fff;border:none;padding:10px 20px;border-radius:8px;
          cursor:pointer;font-size:14px;font-weight:600;white-space:nowrap;
        }
        .lojas-btn-nova:hover { background:#1B4332; }
        .lojas-grid {
          display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px;
        }
        .loja-card {
          background:#fff;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.08);
          overflow:hidden;transition:box-shadow 0.2s,transform 0.15s;cursor:pointer;
        }
        .loja-card:hover { box-shadow:0 6px 20px rgba(0,0,0,0.12);transform:translateY(-2px); }
        .loja-card__header {
          padding:16px 20px;display:flex;justify-content:space-between;align-items:center;
          border-bottom:1px solid #f0f0f0;
        }
        .loja-card__name { font-size:16px;font-weight:700;color:#1B4332;margin:0; }
        .loja-card__status {
          display:inline-block;padding:4px 12px;border-radius:12px;font-size:12px;font-weight:600;
        }
        .loja-card__body { padding:16px 20px; }
        .loja-card__info { font-size:13px;color:#555;margin:4px 0;display:flex;align-items:center;gap:6px; }
        .loja-card__actions {
          padding:12px 20px;border-top:1px solid #f0f0f0;display:flex;gap:8px;
        }
        .loja-card__btn {
          flex:1;padding:8px;border:1px solid #ddd;border-radius:8px;background:#fff;
          cursor:pointer;font-size:13px;font-weight:600;text-align:center;transition:background 0.2s;
        }
        .loja-card__btn:hover { background:#f0f0f0; }
        .loja-card__btn--primary { background:#2D6A4F;color:#fff;border-color:#2D6A4F; }
        .loja-card__btn--primary:hover { background:#1B4332; }
        .loja-card__btn--danger { background:#fff;color:#C62828;border-color:#C62828; }
        .loja-card__btn--danger:hover { background:#FFEBEE; }
      </style>

      <div class="lojas-header">
        <h3 style="margin:0;color:#1B4332;font-size:18px;">${stores.length} loja(s)</h3>
        <button class="lojas-btn-nova">+ Nova Loja</button>
      </div>

      <div class="lojas-grid">
        ${stores.map(s => {
          const badge = STATUS_BADGES[s.status] || STATUS_BADGES.aberta;
          return `
            <div class="loja-card" data-store-id="${s.id}">
              <div class="loja-card__header">
                <h4 class="loja-card__name">${s.nome}</h4>
                <span class="loja-card__status" style="background:${badge.bg};color:${badge.color};">${badge.label}</span>
              </div>
              <div class="loja-card__body">
                <p class="loja-card__info">📍 ${s.endereco}</p>
                <p class="loja-card__info">📞 ${s.telefone || '—'}</p>
                <p class="loja-card__info">🕐 Seg-Sex: ${s.horario ? s.horario.seg_sex : '—'}</p>
                <p class="loja-card__info">🕐 Sáb: ${s.horario ? s.horario.sabado : '—'} | Dom: ${s.horario ? s.horario.domingo : '—'}</p>
              </div>
              <div class="loja-card__actions">
                <button class="loja-card__btn" data-action="detail" data-id="${s.id}">Ver Detalhes</button>
                <button class="loja-card__btn loja-card__btn--primary" data-action="editar" data-id="${s.id}">Editar</button>
                <button class="loja-card__btn loja-card__btn--danger" data-action="excluir" data-id="${s.id}" data-nome="${s.nome}">Excluir</button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    // Bind events
    el.querySelector('.lojas-btn-nova').addEventListener('click', () => showStoreModal(null));

    el.querySelectorAll('.loja-card__btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        const id = btn.dataset.id;
        if (action === 'editar') showStoreModal(id);
        else if (action === 'excluir') deleteStore(id, btn.dataset.nome);
        else if (action === 'detail') {
          detailStoreId = id;
          render(currentStoreFilter);
        }
      });
    });

    // Card click goes to detail
    el.querySelectorAll('.loja-card').forEach(card => {
      card.addEventListener('click', () => {
        detailStoreId = card.dataset.storeId;
        render(currentStoreFilter);
      });
    });
  }

  /* ------------------------------------------
     DETAIL VIEW
  ------------------------------------------ */
  function renderDetail(el) {
    const allStores = getAllStores();
    const store = allStores.find(s => s.id === detailStoreId);
    if (!store) {
      detailStoreId = null;
      render(currentStoreFilter);
      return;
    }

    const kpis = getStoreKPIs(store.id);
    const recentOrders = (Storage.get('orders') || [])
      .filter(o => o.loja === store.id)
      .sort((a, b) => new Date(b.data) - new Date(a.data))
      .slice(0, 10);

    const badge = STATUS_BADGES[store.status] || STATUS_BADGES.aberta;

    el.innerHTML = `
      <div style="margin-bottom:20px;">
        <button class="lojas-btn-back" style="background:none;border:1px solid #ddd;padding:8px 16px;border-radius:8px;cursor:pointer;font-size:14px;color:#555;">
          ← Voltar para Lojas
        </button>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px;">
        <div>
          <h2 style="margin:0;color:#1B4332;font-size:22px;">${store.nome}</h2>
          <p style="margin:4px 0 0;color:#666;font-size:14px;">📍 ${store.endereco} — ${store.cidade}/${store.estado}</p>
        </div>
        <span class="loja-card__status" style="background:${badge.bg};color:${badge.color};padding:6px 16px;border-radius:12px;font-size:14px;font-weight:600;">
          ${badge.label}
        </span>
      </div>

      <!-- KPIs -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:24px;">
        <div style="background:#fff;border-radius:10px;padding:16px;box-shadow:0 2px 6px rgba(0,0,0,0.06);text-align:center;">
          <div style="font-size:24px;font-weight:700;color:#2D6A4F;">${Utils.formatBRL(kpis.vendasHoje)}</div>
          <div style="font-size:13px;color:#888;">Vendas Hoje</div>
        </div>
        <div style="background:#fff;border-radius:10px;padding:16px;box-shadow:0 2px 6px rgba(0,0,0,0.06);text-align:center;">
          <div style="font-size:24px;font-weight:700;color:#1B4332;">${kpis.pedidosHoje}</div>
          <div style="font-size:13px;color:#888;">Pedidos Hoje</div>
        </div>
        <div style="background:#fff;border-radius:10px;padding:16px;box-shadow:0 2px 6px rgba(0,0,0,0.06);text-align:center;">
          <div style="font-size:24px;font-weight:700;color:${kpis.estoqueBaixo > 0 ? '#C62828' : '#2E7D32'};">${kpis.estoqueBaixo}</div>
          <div style="font-size:13px;color:#888;">Estoque Baixo</div>
        </div>
      </div>

      <!-- Store Info -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px;">
        <div style="background:#fff;border-radius:10px;padding:16px;box-shadow:0 2px 6px rgba(0,0,0,0.06);">
          <h4 style="margin:0 0 10px;color:#1B4332;font-size:14px;">Informações</h4>
          <p style="margin:4px 0;font-size:13px;color:#555;">CNPJ: ${store.cnpj || '—'}</p>
          <p style="margin:4px 0;font-size:13px;color:#555;">IE: ${store.ie || '—'}</p>
          <p style="margin:4px 0;font-size:13px;color:#555;">CEP: ${store.cep || '—'}</p>
          <p style="margin:4px 0;font-size:13px;color:#555;">Telefone: ${store.telefone || '—'}</p>
          <p style="margin:4px 0;font-size:13px;color:#555;">WhatsApp: ${store.whatsapp || '—'}</p>
        </div>
        <div style="background:#fff;border-radius:10px;padding:16px;box-shadow:0 2px 6px rgba(0,0,0,0.06);">
          <h4 style="margin:0 0 10px;color:#1B4332;font-size:14px;">Horários</h4>
          <p style="margin:4px 0;font-size:13px;color:#555;">Seg-Sex: ${store.horario ? store.horario.seg_sex : '—'}</p>
          <p style="margin:4px 0;font-size:13px;color:#555;">Sábado: ${store.horario ? store.horario.sabado : '—'}</p>
          <p style="margin:4px 0;font-size:13px;color:#555;">Domingo: ${store.horario ? store.horario.domingo : '—'}</p>
          <h4 style="margin:16px 0 10px;color:#1B4332;font-size:14px;">Taxas de Entrega</h4>
          ${(store.taxasEntrega || []).map(t => `
            <p style="margin:4px 0;font-size:13px;color:#555;">${t.label}</p>
          `).join('')}
          <p style="margin:8px 0 0;font-size:13px;color:#888;">Raio de entrega: ${store.raioEntrega || '—'} km</p>
        </div>
      </div>

      <!-- Recent Orders -->
      <div style="background:#fff;border-radius:10px;padding:16px;box-shadow:0 2px 6px rgba(0,0,0,0.06);">
        <h4 style="margin:0 0 12px;color:#1B4332;font-size:14px;">Pedidos Recentes</h4>
        ${recentOrders.length === 0
          ? '<p style="color:#999;text-align:center;padding:20px;">Nenhum pedido</p>'
          : `
            <div class="table-responsive">
              <table class="admin-table admin-table--compact" style="font-size:13px;">
                <thead>
                  <tr><th>Pedido</th><th>Cliente</th><th>Total</th><th>Status</th><th>Data</th></tr>
                </thead>
                <tbody>
                  ${recentOrders.map(o => `
                    <tr>
                      <td><strong>${o.numero}</strong></td>
                      <td>${o.cliente.nome}</td>
                      <td>${Utils.formatBRL(o.total)}</td>
                      <td>${o.status}</td>
                      <td>${Utils.formatDateTime(o.data)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `
        }
      </div>
    `;

    el.querySelector('.lojas-btn-back').addEventListener('click', () => {
      detailStoreId = null;
      render(currentStoreFilter);
    });
  }

  /* ------------------------------------------
     DELETE STORE
  ------------------------------------------ */
  function deleteStore(storeId, storeName) {
    if (!confirm(`Tem certeza que deseja excluir a loja "${storeName}"?\n\nEsta ação não pode ser desfeita.`)) return;

    // Remove from custom stores
    const custom = Storage.get('stores_custom') || [];
    const filtered = custom.filter(s => s.id !== storeId);
    Storage.set('stores_custom', filtered);

    // Also check if it's a default store — mark as deleted
    const defaultStore = DataStores.find(s => s.id === storeId);
    if (defaultStore) {
      const deleted = Storage.get('stores_deleted') || [];
      if (!deleted.includes(storeId)) {
        deleted.push(storeId);
        Storage.set('stores_deleted', deleted);
      }
    }

    Toast.success(`Loja "${storeName}" excluída!`);
    render(currentStoreFilter);
  }

  /* ------------------------------------------
     STORE MODAL (New / Edit)
  ------------------------------------------ */
  function showStoreModal(storeId) {
    const allStores = getAllStores();
    const store = storeId ? allStores.find(s => s.id === storeId) : null;
    const isEdit = !!store;
    const title = isEdit ? 'Editar Loja' : 'Nova Loja';

    const s = store || {
      id: '', nome: '', endereco: '', cidade: '', estado: 'SP', cep: '',
      cnpj: '', ie: '', telefone: '', whatsapp: '',
      horario: { seg_sex: '08:00 - 20:00', sabado: '08:00 - 18:00', domingo: '09:00 - 14:00' },
      taxasEntrega: [
        { distanciaMax: 2, valor: 0, label: 'Até 2km - Grátis' },
        { distanciaMax: 5, valor: 5.99, label: 'Até 5km - R$ 5,99' },
        { distanciaMax: 10, valor: 9.99, label: 'Até 10km - R$ 9,99' },
      ],
      raioEntrega: 10,
      status: 'aberta',
    };

    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px;';

    const modal = document.createElement('div');
    modal.style.cssText = 'background:#fff;border-radius:12px;max-width:750px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.3);';

    modal.innerHTML = `
      <div style="padding:20px 24px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center;">
        <h2 style="margin:0;font-size:20px;color:#1B4332;">${title}</h2>
        <button class="modal-close" style="background:none;border:none;font-size:24px;cursor:pointer;color:#888;">✕</button>
      </div>
      <div style="padding:20px 24px;">
        <form class="loja-form">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div style="grid-column:1/-1;">
              <label style="display:block;font-size:13px;font-weight:600;margin-bottom:4px;">Nome</label>
              <input type="text" name="nome" value="${s.nome}" required style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:8px;font-size:14px;box-sizing:border-box;">
            </div>
            <div style="grid-column:1/-1;">
              <label style="display:block;font-size:13px;font-weight:600;margin-bottom:4px;">Endereço</label>
              <input type="text" name="endereco" value="${s.endereco}" required style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:8px;font-size:14px;box-sizing:border-box;">
            </div>
            <div>
              <label style="display:block;font-size:13px;font-weight:600;margin-bottom:4px;">Cidade</label>
              <input type="text" name="cidade" value="${s.cidade || ''}" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:8px;font-size:14px;box-sizing:border-box;">
            </div>
            <div>
              <label style="display:block;font-size:13px;font-weight:600;margin-bottom:4px;">Estado</label>
              <input type="text" name="estado" value="${s.estado || ''}" maxlength="2" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:8px;font-size:14px;box-sizing:border-box;">
            </div>
            <div>
              <label style="display:block;font-size:13px;font-weight:600;margin-bottom:4px;">CEP</label>
              <input type="text" name="cep" value="${s.cep || ''}" maxlength="9" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:8px;font-size:14px;box-sizing:border-box;">
            </div>
            <div>
              <label style="display:block;font-size:13px;font-weight:600;margin-bottom:4px;">CNPJ</label>
              <input type="text" name="cnpj" value="${s.cnpj || ''}" maxlength="18" placeholder="00.000.000/0000-00" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:8px;font-size:14px;box-sizing:border-box;">
            </div>
            <div>
              <label style="display:block;font-size:13px;font-weight:600;margin-bottom:4px;">Inscrição Estadual</label>
              <input type="text" name="ie" value="${s.ie || ''}" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:8px;font-size:14px;box-sizing:border-box;">
            </div>
            <div>
              <label style="display:block;font-size:13px;font-weight:600;margin-bottom:4px;">Telefone</label>
              <input type="tel" name="telefone" value="${s.telefone || ''}" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:8px;font-size:14px;box-sizing:border-box;">
            </div>
            <div>
              <label style="display:block;font-size:13px;font-weight:600;margin-bottom:4px;">WhatsApp</label>
              <input type="text" name="whatsapp" value="${s.whatsapp || ''}" placeholder="5511999990000" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:8px;font-size:14px;box-sizing:border-box;">
            </div>
            <div>
              <label style="display:block;font-size:13px;font-weight:600;margin-bottom:4px;">Status</label>
              <select name="status" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:8px;font-size:14px;box-sizing:border-box;">
                <option value="aberta" ${s.status === 'aberta' ? 'selected' : ''}>Aberta</option>
                <option value="fechada" ${s.status === 'fechada' ? 'selected' : ''}>Fechada</option>
                <option value="manutencao" ${s.status === 'manutencao' ? 'selected' : ''}>Manutenção</option>
              </select>
            </div>
          </div>

          <!-- Horários -->
          <fieldset style="border:1px solid #eee;border-radius:8px;padding:16px;margin-top:16px;">
            <legend style="font-weight:700;color:#1B4332;padding:0 8px;font-size:14px;">Horários</legend>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">
              <div>
                <label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px;">Seg - Sex</label>
                <input type="text" name="horario_seg_sex" value="${s.horario ? s.horario.seg_sex : ''}" placeholder="08:00 - 20:00" style="width:100%;padding:6px 10px;border:1px solid #ddd;border-radius:6px;font-size:13px;box-sizing:border-box;">
              </div>
              <div>
                <label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px;">Sábado</label>
                <input type="text" name="horario_sabado" value="${s.horario ? s.horario.sabado : ''}" placeholder="08:00 - 18:00" style="width:100%;padding:6px 10px;border:1px solid #ddd;border-radius:6px;font-size:13px;box-sizing:border-box;">
              </div>
              <div>
                <label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px;">Domingo</label>
                <input type="text" name="horario_domingo" value="${s.horario ? s.horario.domingo : ''}" placeholder="Fechado" style="width:100%;padding:6px 10px;border:1px solid #ddd;border-radius:6px;font-size:13px;box-sizing:border-box;">
              </div>
            </div>
          </fieldset>

          <!-- Taxas de Entrega -->
          <fieldset style="border:1px solid #eee;border-radius:8px;padding:16px;margin-top:16px;">
            <legend style="font-weight:700;color:#1B4332;padding:0 8px;font-size:14px;">Taxas de Entrega</legend>
            <div class="taxas-container">
              ${(s.taxasEntrega || []).map((t, i) => `
                <div class="taxa-row" style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">
                  <input type="number" name="taxa_dist_${i}" value="${t.distanciaMax}" min="0" placeholder="Dist. máx (km)" style="flex:1;padding:6px 10px;border:1px solid #ddd;border-radius:6px;font-size:13px;">
                  <input type="number" name="taxa_val_${i}" value="${t.valor}" step="0.01" min="0" placeholder="Valor (R$)" style="flex:1;padding:6px 10px;border:1px solid #ddd;border-radius:6px;font-size:13px;">
                  <button type="button" class="btn-remove-taxa" style="background:#FFEBEE;color:#C62828;border:none;padding:4px 10px;border-radius:6px;cursor:pointer;">✕</button>
                </div>
              `).join('')}
            </div>
            <button type="button" class="btn-add-taxa" style="background:#E8F5E9;color:#2E7D32;border:none;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600;">+ Adicionar Faixa</button>

            <div style="margin-top:12px;">
              <label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px;">Raio de Entrega (km)</label>
              <input type="number" name="raioEntrega" value="${s.raioEntrega || 10}" min="0" style="width:120px;padding:6px 10px;border:1px solid #ddd;border-radius:6px;font-size:13px;">
            </div>
          </fieldset>

          <div style="display:flex;gap:12px;justify-content:flex-end;margin-top:20px;">
            <button type="button" class="modal-cancel" style="background:#f5f5f5;color:#666;border:1px solid #ddd;padding:10px 24px;border-radius:8px;cursor:pointer;font-size:14px;">Cancelar</button>
            <button type="submit" style="background:#2D6A4F;color:#fff;border:none;padding:10px 24px;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600;">${isEdit ? 'Salvar' : 'Criar'}</button>
          </div>
        </form>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // CNPJ mask
    const cnpjInput = modal.querySelector('input[name="cnpj"]');
    cnpjInput.addEventListener('input', () => {
      let v = cnpjInput.value.replace(/\D/g, '').slice(0, 14);
      if (v.length > 12) v = `${v.slice(0,2)}.${v.slice(2,5)}.${v.slice(5,8)}/${v.slice(8,12)}-${v.slice(12)}`;
      else if (v.length > 8) v = `${v.slice(0,2)}.${v.slice(2,5)}.${v.slice(5,8)}/${v.slice(8)}`;
      else if (v.length > 5) v = `${v.slice(0,2)}.${v.slice(2,5)}.${v.slice(5)}`;
      else if (v.length > 2) v = `${v.slice(0,2)}.${v.slice(2)}`;
      cnpjInput.value = v;
    });

    // Add/remove taxa rows
    const taxaContainer = modal.querySelector('.taxas-container');
    modal.querySelector('.btn-add-taxa').addEventListener('click', () => {
      const count = taxaContainer.querySelectorAll('.taxa-row').length;
      const row = document.createElement('div');
      row.className = 'taxa-row';
      row.style.cssText = 'display:flex;gap:8px;align-items:center;margin-bottom:8px;';
      row.innerHTML = `
        <input type="number" name="taxa_dist_${count}" min="0" placeholder="Dist. máx (km)" style="flex:1;padding:6px 10px;border:1px solid #ddd;border-radius:6px;font-size:13px;">
        <input type="number" name="taxa_val_${count}" step="0.01" min="0" placeholder="Valor (R$)" style="flex:1;padding:6px 10px;border:1px solid #ddd;border-radius:6px;font-size:13px;">
        <button type="button" class="btn-remove-taxa" style="background:#FFEBEE;color:#C62828;border:none;padding:4px 10px;border-radius:6px;cursor:pointer;">✕</button>
      `;
      taxaContainer.appendChild(row);
      row.querySelector('.btn-remove-taxa').addEventListener('click', () => row.remove());
    });
    modal.querySelectorAll('.btn-remove-taxa').forEach(btn => {
      btn.addEventListener('click', () => btn.closest('.taxa-row').remove());
    });

    // Close
    const close = () => overlay.remove();
    modal.querySelector('.modal-close').addEventListener('click', close);
    modal.querySelector('.modal-cancel').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    // Submit
    modal.querySelector('.loja-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const form = e.target;

      // Gather taxas
      const taxas = [];
      taxaContainer.querySelectorAll('.taxa-row').forEach(row => {
        const distInput = row.querySelector('input[type="number"]:first-child');
        const valInput = row.querySelectorAll('input[type="number"]')[1];
        if (distInput && valInput) {
          const dist = parseFloat(distInput.value) || 0;
          const val = parseFloat(valInput.value) || 0;
          taxas.push({
            distanciaMax: dist,
            valor: val,
            label: `Até ${dist}km - ${val === 0 ? 'Grátis' : Utils.formatBRL(val)}`,
          });
        }
      });

      const storeData = {
        ...(store || {}),
        id: store ? store.id : Utils.slugify(form.nome.value) || Utils.generateId(),
        nome: form.nome.value.trim(),
        endereco: form.endereco.value.trim(),
        cidade: form.cidade.value.trim(),
        estado: form.estado.value.trim().toUpperCase(),
        cep: form.cep.value.trim(),
        cnpj: form.cnpj.value.trim(),
        ie: form.ie.value.trim(),
        telefone: form.telefone.value.trim(),
        whatsapp: form.whatsapp.value.trim(),
        status: form.status.value,
        horario: {
          seg_sex: form.horario_seg_sex.value.trim(),
          sabado: form.horario_sabado.value.trim(),
          domingo: form.horario_domingo.value.trim(),
        },
        taxasEntrega: taxas,
        raioEntrega: parseFloat(form.raioEntrega.value) || 10,
      };

      saveStore(storeData);
      close();
      Toast.success(isEdit ? 'Loja atualizada!' : 'Loja criada!');
      render(currentStoreFilter);
    });
  }

  /* ------------------------------------------
     PUBLIC API
  ------------------------------------------ */
  return { render };
})();
