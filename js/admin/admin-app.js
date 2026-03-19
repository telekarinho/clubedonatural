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
    nf: 'Notas Fiscais',
    produtos: 'Produtos',
    lojas: 'Lojas',
    funcionarios: 'Funcionários',
    clientes: 'Clientes',
    relatorios: 'Relatórios',
    config: 'Configurações',
    usuarios: 'Usuários',
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
      loginOverlay: document.getElementById('login-overlay'),
      loginForm: document.getElementById('login-form'),
      loginCelular: document.getElementById('login-celular'),
      loginSenha: document.getElementById('login-senha'),
      loginError: document.getElementById('login-error'),
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

    // Apply phone mask to login input
    Utils.maskPhone(els.loginCelular);

    // Check auth state
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
     AUTH
  ------------------------------------------ */
  function checkAuth() {
    const user = AppState.get('user');
    if (user) {
      showAdminShell(user);
    } else {
      showLoginOverlay();
    }
  }

  function showLoginOverlay() {
    els.loginOverlay.hidden = false;
    els.adminShell.hidden = true;
    els.loginError.hidden = true;
    els.loginCelular.value = '';
    els.loginSenha.value = '';
    els.loginCelular.focus();
  }

  function showAdminShell(user) {
    els.loginOverlay.hidden = true;
    els.adminShell.hidden = false;
    renderUserInfo(user);

    // Navigate to default page
    const activePage = AppState.get('activeAdminPage') || 'dashboard';
    navigateTo(activePage);

    // Hide sidebar links user has no permission for
    applyPermissions(user);
  }

  function handleLogin(e) {
    e.preventDefault();
    els.loginError.hidden = true;

    const celular = els.loginCelular.value.trim();
    const senha = els.loginSenha.value.trim();

    if (!celular || !senha) {
      showLoginError('Preencha celular e senha');
      return;
    }

    const result = Auth.login(celular, senha);

    if (result.success) {
      Toast.success(`Bem-vindo(a), ${result.user.nome}!`);
      showAdminShell(result.user);
    } else {
      showLoginError(result.error);
    }
  }

  function showLoginError(msg) {
    els.loginError.textContent = msg;
    els.loginError.hidden = false;
  }

  function handleLogout() {
    Auth.logout();
    showLoginOverlay();
    Toast.info('Você saiu do painel');
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

  function triggerPageRender(page) {
    const selectedStore = els.storeSelector.value;
    switch (page) {
      case 'dashboard':
        if (typeof AdminDashboard !== 'undefined') AdminDashboard.render(selectedStore);
        break;
      case 'pedidos':
        if (typeof AdminPedidos !== 'undefined') AdminPedidos.render(selectedStore);
        break;
      case 'assinaturas':
        if (typeof AdminAssinaturas !== 'undefined') AdminAssinaturas.render(selectedStore);
        break;
      case 'estoque':
        if (typeof AdminEstoque !== 'undefined') AdminEstoque.render(selectedStore);
        break;
      case 'caixa':
        if (typeof AdminCaixa !== 'undefined') AdminCaixa.render(selectedStore);
        break;
      case 'nf':
        if (typeof AdminNF !== 'undefined') AdminNF.render(selectedStore);
        break;
      case 'produtos':
        if (typeof AdminProdutos !== 'undefined') AdminProdutos.render(selectedStore);
        break;
      case 'lojas':
        if (typeof AdminLojas !== 'undefined') AdminLojas.render(selectedStore);
        break;
      case 'funcionarios':
        if (typeof AdminFuncionarios !== 'undefined') AdminFuncionarios.render(selectedStore);
        break;
      case 'clientes':
        if (typeof AdminClientes !== 'undefined') AdminClientes.render(selectedStore);
        break;
      case 'relatorios':
        if (typeof AdminRelatorios !== 'undefined') AdminRelatorios.render(selectedStore);
        break;
      case 'config':
        // Config page — placeholder for now
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
    const pendingCount = orders.filter(o =>
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
    // Login form
    els.loginForm.addEventListener('submit', handleLogin);

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
  return {
    init,
    navigateTo,
    updatePedidosBadge,
    updateSyncBanner,
    getSelectedStore() {
      return els.storeSelector ? els.storeSelector.value : 'todas';
    },
  };
})();

// Boot on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  AdminApp.init();
});
