/* ============================================
   CLUBE DO NATURAL — Admin App Bootstrap
   SPA shell: auth, navigation, sync, store selector
   ============================================ */

const AdminApp = (() => {
  // Page title map
  const PAGE_TITLES = {
    dashboard: 'Dashboard',
    pedidos: 'Pedidos',
    assinaturas: 'Assinaturas',
    estoque: 'Estoque',
    caixa: 'Caixa',
    financeiro: 'Financeiro',
    nf: 'Notas Fiscais',
    produtos: 'Produtos',
    lojas: 'Lojas',
    funcionarios: 'Funcionários',
    clientes: 'Clientes',
    relatorios: 'Relatórios',
    config: 'Configurações',
    usuarios: 'Usuários',
    restock: 'Pedido de Compra',
    metas: 'Metas & Pontos',
    afiliados: 'Afiliados',
  };

  // DOM references (populated on init)
  let els = {};

  // Clock interval
  let clockInterval = null;

  /* ------------------------------------------
     INIT
  ------------------------------------------ */
  function init() {
    // Cache DOM elements
    els = {
      adminShell: document.getElementById('admin-shell'),
      sidebar: document.getElementById('admin-sidebar'),
      sidebarOverlay: document.getElementById('sidebar-overlay'),
      sidebarUserName: document.getElementById('sidebar-user-name'),
      sidebarUserCargo: document.getElementById('sidebar-user-cargo'),
      hamburger: document.getElementById('btn-sidebar-toggle'),
      pageTitle: document.getElementById('admin-page-title'),
      connectionStatus: document.getElementById('connection-status'),
      storeSelector: document.getElementById('store-selector'),
      headerDatetime: document.getElementById('header-datetime'),
      syncBanner: document.getElementById('sync-banner'),
      syncPendingCount: document.getElementById('sync-pending-count'),
      adminPages: document.getElementById('admin-pages'),
      pedidosBadge: document.getElementById('pedidos-badge'),
      btnLogout: document.getElementById('btn-logout'),
    };

    // Initialize core modules
    Storage.init();
    AppState.restore();
    Toast.init();

    // Check auth state (uses Firebase Auth via CdnAuth.guard)
    checkAuth();

    // Bind events
    bindEvents();

    // Start clock
    updateClock();
    clockInterval = setInterval(updateClock, 1000);

    // Online/offline detection
    updateConnectionStatus();
    window.addEventListener('online', updateConnectionStatus);
    window.addEventListener('offline', updateConnectionStatus);

    // Sync banner
    updateSyncBanner();

    // Service Worker message listener
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.addEventListener('message', onSWMessage);
    }

    // Update order badge
    updatePedidosBadge();
  }

  /* ------------------------------------------
     AUTH (Firebase Google login via CdnAuth)
  ------------------------------------------ */
  function checkAuth() {
    const user = AppState.get('user');
    if (user) {
      showAdminShell(user);
    }
    // If no user yet, CdnAuth.guard onReady will set it and re-trigger
  }

  function showAdminShell(user) {
    els.adminShell.hidden = false;
    renderUserInfo(user);
    populateStoreSelector(user);

    // Navigate to default page
    const activePage = AppState.get('activeAdminPage') || 'dashboard';
    navigateTo(activePage);

    // Hide sidebar links user has no permission for
    applyPermissions(user);
  }

  function handleLogout() {
    AppState.set('user', null);
    AppState.set('isAdmin', false);
    if (typeof Storage !== 'undefined' && Storage.remove) Storage.remove('user');
    if (typeof CdnAuth !== 'undefined') {
      CdnAuth.signOut();
    } else {
      window.location.href = '/login.html';
    }
  }

  function renderUserInfo(user) {
    els.sidebarUserName.textContent = user.nome;
    const cargoLabels = {
      dono: 'Proprietário',
      gerente: 'Gerente',
      atendente: 'Atendente',
      caixa: 'Caixa',
      estoquista: 'Estoquista',
      motoboy: 'Motoboy',
    };
    els.sidebarUserCargo.textContent = cargoLabels[user.cargo] || user.cargo;
  }

  function populateStoreSelector(user) {
    if (!els.storeSelector) return;
    const stores = (typeof AppState !== 'undefined' && AppState.getAccessibleStoreIds)
      ? AppState.getAccessibleStoreIds()
      : [];
    const sourceStores = Array.isArray(window.DataStores) ? window.DataStores : [];

    if (user && user.cargo === 'dono') {
      els.storeSelector.innerHTML = '<option value="todas">Todas as Lojas</option>' +
        sourceStores.map(store => `<option value="${store.id}">${store.nome.split(' - ')[1] || store.nome}</option>`).join('');
      els.storeSelector.disabled = false;
      return;
    }

    const allowedStores = sourceStores.filter(store => stores.includes(store.id));
    els.storeSelector.innerHTML = allowedStores.map(store =>
      `<option value="${store.id}">${store.nome.split(' - ')[1] || store.nome}</option>`
    ).join('');

    if (allowedStores.length === 0) {
      els.storeSelector.innerHTML = '<option value="">Sem loja vinculada</option>';
      els.storeSelector.disabled = true;
      return;
    }

    els.storeSelector.value = allowedStores[0].id;
    els.storeSelector.disabled = true;
  }

  function applyPermissions(user) {
    const links = document.querySelectorAll('.sidebar__link[data-page]');
    links.forEach(link => {
      const page = link.dataset.page;
      if (!user.permissions.includes(page)) {
        link.style.display = 'none';
      } else {
        link.style.display = '';
      }
    });
  }

  /* ------------------------------------------
     NAVIGATION
  ------------------------------------------ */
  function navigateTo(page) {
    // Verify permission
    const user = AppState.get('user');
    if (user && !user.permissions.includes(page)) {
      Toast.error('Sem permissão para esta página');
      return;
    }

    // Update active page
    AppState.set('activeAdminPage', page);

    // Toggle page sections
    const pages = els.adminPages.querySelectorAll('.admin-page');
    pages.forEach(p => {
      p.classList.toggle('admin-page--active', p.dataset.page === page);
    });

    // Update sidebar active link
    const links = document.querySelectorAll('.sidebar__link[data-page]');
    links.forEach(link => {
      link.classList.toggle('sidebar__link--active', link.dataset.page === page);
    });

    // Update page title
    els.pageTitle.textContent = PAGE_TITLES[page] || page;
    document.title = `${PAGE_TITLES[page] || page} — Admin — Clube do Natural`;

    // Close mobile sidebar
    closeSidebar();

    // Trigger page-specific render
    triggerPageRender(page);
  }

  async function triggerPageRender(page) {
    const selectedStore = els.storeSelector.value;

    // Store-scoped users stay locked to their assigned unit
    const user = AppState.get('user');
    const isStoreScopedUser = user && typeof AppState !== 'undefined' && AppState.isNetworkAdmin && !AppState.isNetworkAdmin();
    const effectiveStore = (isStoreScopedUser && AppState.get('userStoreId'))
      ? AppState.get('userStoreId')
      : selectedStore;

    if (isStoreScopedUser && AppState.get('userStoreId')) {
      els.storeSelector.value = AppState.get('userStoreId');
      els.storeSelector.disabled = true;
    }

    switch (page) {
      case 'dashboard':
        if (typeof AdminDashboard !== 'undefined') AdminDashboard.render(effectiveStore);
        break;
      case 'pedidos':
        if (typeof AdminPedidos !== 'undefined') await AdminPedidos.render(effectiveStore);
        break;
      case 'assinaturas':
        if (typeof AdminAssinaturas !== 'undefined') AdminAssinaturas.render(effectiveStore);
        break;
      case 'estoque':
        if (typeof AdminEstoque !== 'undefined') await AdminEstoque.render(effectiveStore);
        break;
      case 'caixa':
        if (typeof AdminCaixa !== 'undefined') AdminCaixa.render(effectiveStore);
        break;
      case 'financeiro':
        if (typeof AdminFinanceiro !== 'undefined') await AdminFinanceiro.render(effectiveStore);
        break;
      case 'nf':
        if (typeof AdminNF !== 'undefined') AdminNF.render(effectiveStore);
        break;
      case 'produtos':
        if (typeof AdminProdutos !== 'undefined') await AdminProdutos.render(effectiveStore);
        break;
      case 'lojas':
        if (typeof AdminLojas !== 'undefined') await AdminLojas.render(effectiveStore);
        break;
      case 'funcionarios':
        if (typeof AdminFuncionarios !== 'undefined') await AdminFuncionarios.render(effectiveStore);
        break;
      case 'clientes':
        if (typeof AdminClientes !== 'undefined') AdminClientes.render(effectiveStore);
        break;
      case 'relatorios':
        if (typeof AdminRelatorios !== 'undefined') AdminRelatorios.render(effectiveStore);
        break;
      case 'restock':
        if (typeof AdminRestock !== 'undefined') await AdminRestock.render(effectiveStore);
        break;
      case 'metas':
        if (typeof AdminMetas !== 'undefined') AdminMetas.render(effectiveStore);
        break;
      case 'afiliados':
        if (typeof AdminAfiliados !== 'undefined') AdminAfiliados.render(effectiveStore);
        break;
      case 'config':
        renderConfigPage();
        break;
      case 'usuarios':
        if (typeof UsersAdmin !== 'undefined') UsersAdmin.init();
        break;
    }
  }

  /* ------------------------------------------
     SIDEBAR MOBILE
  ------------------------------------------ */
  function toggleSidebar() {
    els.sidebar.classList.toggle('admin-sidebar--open');
    els.sidebarOverlay.hidden = !els.sidebar.classList.contains('admin-sidebar--open');
  }

  function closeSidebar() {
    els.sidebar.classList.remove('admin-sidebar--open');
    els.sidebarOverlay.hidden = true;
  }

  /* ------------------------------------------
     CONNECTION STATUS
  ------------------------------------------ */
  function updateConnectionStatus() {
    const online = navigator.onLine;
    const dot = els.connectionStatus.querySelector('.status-dot');
    const text = els.connectionStatus.querySelector('.status-text');

    if (online) {
      dot.className = 'status-dot status-dot--online';
      text.textContent = 'Online';
    } else {
      dot.className = 'status-dot status-dot--offline';
      text.textContent = 'Offline';
    }

    updateSyncBanner();
  }

  /* ------------------------------------------
     SYNC BANNER
  ------------------------------------------ */
  function updateSyncBanner() {
    const queue = Storage.get('sync_queue') || [];
    const count = queue.length;

    if (!navigator.onLine && count > 0) {
      els.syncBanner.hidden = false;
      els.syncPendingCount.textContent = count;
    } else if (!navigator.onLine) {
      els.syncBanner.hidden = false;
      els.syncPendingCount.textContent = '0';
    } else {
      els.syncBanner.hidden = true;
    }
  }

  /* ------------------------------------------
     CLOCK
  ------------------------------------------ */
  function updateClock() {
    const now = new Date();
    els.headerDatetime.textContent = new Intl.DateTimeFormat('pt-BR', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(now);
  }

  /* ------------------------------------------
     STORE SELECTOR
  ------------------------------------------ */
  function onStoreChange() {
    const activePage = AppState.get('activeAdminPage') || 'dashboard';
    triggerPageRender(activePage);
  }

  /* ------------------------------------------
     PEDIDOS BADGE
  ------------------------------------------ */
  function updatePedidosBadge() {
    const orders = Storage.get('orders') || [];
    const scopedOrders = (typeof AppState !== 'undefined' && AppState.isNetworkAdmin && !AppState.isNetworkAdmin())
      ? orders.filter(o => o.loja === AppState.getUserStoreId())
      : orders;
    const pendingCount = scopedOrders.filter(o =>
      o.status === 'pendente' || o.status === 'preparando'
    ).length;

    if (pendingCount > 0) {
      els.pedidosBadge.textContent = pendingCount;
      els.pedidosBadge.hidden = false;
    } else {
      els.pedidosBadge.hidden = true;
    }
  }

  /* ------------------------------------------
     SERVICE WORKER MESSAGES
  ------------------------------------------ */
  function onSWMessage(event) {
    if (event.data && event.data.type === 'SYNC_COMPLETE') {
      Toast.success('Sincronização concluída!');
      updateSyncBanner();
      // Re-render current page with fresh data
      const activePage = AppState.get('activeAdminPage') || 'dashboard';
      triggerPageRender(activePage);
      updatePedidosBadge();
    }
  }

  /* ------------------------------------------
     EVENT BINDINGS
  ------------------------------------------ */
  function bindEvents() {
    // Logout
    els.btnLogout.addEventListener('click', handleLogout);

    // Sidebar navigation
    document.querySelectorAll('.sidebar__link[data-page]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const page = link.dataset.page;
        navigateTo(page);
      });
    });

    // Hamburger toggle
    els.hamburger.addEventListener('click', toggleSidebar);

    // Sidebar overlay click to close
    els.sidebarOverlay.addEventListener('click', closeSidebar);

    // Store selector change
    els.storeSelector.addEventListener('change', onStoreChange);

    // Keyboard: Escape closes sidebar
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeSidebar();
    });

    // Listen for storage changes (other tabs)
    window.addEventListener('storage', () => {
      updateSyncBanner();
      updatePedidosBadge();
    });
  }

  /* ------------------------------------------
     PUBLIC API
  ------------------------------------------ */
  /* ------------------------------------------
     CONFIG PAGE
  ------------------------------------------ */
  function getSettings() {
    try { return JSON.parse(localStorage.getItem('cdn_settings') || '{}'); } catch(e) { return {}; }
  }
  function saveSettings(s) {
    localStorage.setItem('cdn_settings', JSON.stringify(s));
    // Also save to Firestore for sync across devices
    if (typeof FirestoreService !== 'undefined' && FirestoreService.ready) {
      try { CdnFirebase.db.collection('meta').doc('settings').set(s, { merge: true }); } catch(e) {}
    }
  }

  function renderConfigPage() {
    const el = document.getElementById('config-content');
    if (!el) return;
    const s = getSettings();

    el.innerHTML = `
      <div style="max-width:700px;">
        <h2 style="color:#1B4332;margin-bottom:24px;">⚙️ Configurações do Sistema</h2>

        <!-- Assinaturas -->
        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:20px;">
          <h3 style="margin:0 0 16px;font-size:16px;color:#1B4332;">🔄 Assinaturas Recorrentes</h3>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
            <div>
              <label style="display:block;font-size:13px;font-weight:600;color:#555;margin-bottom:4px;">Desconto da Assinatura (%)</label>
              <input type="number" id="cfg-sub-discount" min="0" max="50" step="1" value="${s.subscriptionDiscount || 15}"
                style="width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;font-size:15px;box-sizing:border-box;">
              <span style="font-size:11px;color:#999;">Desconto aplicado em vendas por assinatura no PDV e catálogo</span>
            </div>
            <div>
              <label style="display:block;font-size:13px;font-weight:600;color:#555;margin-bottom:4px;">Frequências Disponíveis</label>
              <div style="display:flex;flex-direction:column;gap:6px;margin-top:4px;">
                <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;">
                  <input type="checkbox" id="cfg-freq-semanal" ${(s.frequencies || ['semanal','quinzenal','mensal']).includes('semanal') ? 'checked' : ''}> Semanal
                </label>
                <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;">
                  <input type="checkbox" id="cfg-freq-quinzenal" ${(s.frequencies || ['semanal','quinzenal','mensal']).includes('quinzenal') ? 'checked' : ''}> Quinzenal
                </label>
                <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;">
                  <input type="checkbox" id="cfg-freq-mensal" ${(s.frequencies || ['semanal','quinzenal','mensal']).includes('mensal') ? 'checked' : ''}> Mensal
                </label>
              </div>
            </div>
          </div>
        </div>

        <!-- Gamificação -->
        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:20px;">
          <h3 style="margin:0 0 16px;font-size:16px;color:#1B4332;">🎯 Gamificação & Metas</h3>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
            <div>
              <label style="display:block;font-size:13px;font-weight:600;color:#555;margin-bottom:4px;">Pontos por Assinatura Fechada</label>
              <input type="number" id="cfg-pts-assinatura" min="0" max="100" step="1" value="${s.pointsPerSubscription || 20}"
                style="width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;font-size:15px;box-sizing:border-box;">
            </div>
            <div>
              <label style="display:block;font-size:13px;font-weight:600;color:#555;margin-bottom:4px;">Pontos por Venda Finalizada</label>
              <input type="number" id="cfg-pts-venda" min="0" max="50" step="1" value="${s.pointsPerSale || 5}"
                style="width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;font-size:15px;box-sizing:border-box;">
            </div>
          </div>
        </div>

        <!-- Loja -->
        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:20px;">
          <h3 style="margin:0 0 16px;font-size:16px;color:#1B4332;">🏪 Loja & Geral</h3>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
            <div>
              <label style="display:block;font-size:13px;font-weight:600;color:#555;margin-bottom:4px;">Frete Grátis a partir de (R$)</label>
              <input type="number" id="cfg-free-shipping" min="0" step="1" value="${s.freeShippingMin || 89}"
                style="width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;font-size:15px;box-sizing:border-box;">
            </div>
            <div>
              <label style="display:block;font-size:13px;font-weight:600;color:#555;margin-bottom:4px;">WhatsApp da Loja</label>
              <input type="tel" id="cfg-whatsapp" value="${s.whatsapp || '5511999990000'}" placeholder="5511999990000"
                style="width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;font-size:15px;box-sizing:border-box;">
            </div>
          </div>
        </div>

        <button onclick="saveConfigPage()" class="btn btn--primary" style="padding:12px 32px;font-size:15px;">
          💾 Salvar Configurações
        </button>
        <span id="cfg-saved-msg" style="display:none;margin-left:12px;color:#10B981;font-weight:600;font-size:14px;">✅ Salvo!</span>
      </div>
    `;
  }

  // Exposed globally for onclick
  window.saveConfigPage = function() {
    const freqs = [];
    if (document.getElementById('cfg-freq-semanal').checked) freqs.push('semanal');
    if (document.getElementById('cfg-freq-quinzenal').checked) freqs.push('quinzenal');
    if (document.getElementById('cfg-freq-mensal').checked) freqs.push('mensal');

    const settings = {
      subscriptionDiscount: parseInt(document.getElementById('cfg-sub-discount').value) || 15,
      frequencies: freqs,
      pointsPerSubscription: parseInt(document.getElementById('cfg-pts-assinatura').value) || 20,
      pointsPerSale: parseInt(document.getElementById('cfg-pts-venda').value) || 5,
      freeShippingMin: parseInt(document.getElementById('cfg-free-shipping').value) || 89,
      whatsapp: document.getElementById('cfg-whatsapp').value.trim(),
      updatedAt: new Date().toISOString(),
    };
    saveSettings(settings);
    const msg = document.getElementById('cfg-saved-msg');
    if (msg) { msg.style.display = 'inline'; setTimeout(() => msg.style.display = 'none', 3000); }
    if (typeof Toast !== 'undefined') Toast.success('Configurações salvas!');
  };

  return {
    init,
    navigateTo,
    updatePedidosBadge,
    updateSyncBanner,
    getSettings,
    getSelectedStore() {
      return els.storeSelector ? els.storeSelector.value : 'todas';
    },
  };
})();

// Boot on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  AdminApp.init();
});
