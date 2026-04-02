/* ============================================
   CLUBE DO NATURAL — Firestore Service Layer
   Central data access for multi-store system.
   Replaces localStorage/mock data with Firestore.
   ============================================ */

const FirestoreService = (() => {
  'use strict';

  let db = null;
  let _ready = false;
  const _listeners = []; // active snapshot listeners for cleanup

  /* ------------------------------------------
     INIT
  ------------------------------------------ */
  function init() {
    if (_ready) return true;
    if (!CdnFirebase || !CdnFirebase.ready) {
      if (CdnFirebase && CdnFirebase.init) CdnFirebase.init();
      if (!CdnFirebase || !CdnFirebase.ready) {
        console.warn('[FirestoreService] Firebase not ready');
        return false;
      }
    }
    db = CdnFirebase.db;
    _ready = true;
    console.log('[FirestoreService] Initialized');
    return true;
  }

  function ensureDb() {
    if (!_ready) init();
    if (!db) throw new Error('Firestore not initialized');
    return db;
  }

  /* ------------------------------------------
     HELPERS
  ------------------------------------------ */
  function docToObj(doc) {
    return { ...doc.data(), _id: doc.id };
  }

  function cleanUndefined(obj) {
    const clean = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v !== undefined) clean[k] = v;
    }
    return clean;
  }

  function timestamp() {
    return firebase.firestore.FieldValue.serverTimestamp();
  }

  function currentUserId() {
    return CdnFirebase.auth && CdnFirebase.auth.currentUser
      ? CdnFirebase.auth.currentUser.uid : null;
  }

  function currentUserName() {
    const user = typeof AppState !== 'undefined' ? AppState.get('user') : null;
    return user ? user.nome : 'Admin';
  }

  function currentUserRole() {
    const user = typeof AppState !== 'undefined' ? AppState.get('user') : null;
    return user ? user.cargo : null;
  }

  function currentUserStoreId() {
    if (typeof AppState !== 'undefined' && AppState.getUserStoreId) {
      return AppState.getUserStoreId();
    }
    const user = typeof AppState !== 'undefined' ? AppState.get('user') : null;
    return user ? user.storeId || null : null;
  }

  function isNetworkAdmin() {
    return currentUserRole() === 'dono';
  }

  function getScopedStoreIds() {
    if (isNetworkAdmin()) return null;
    const storeId = currentUserStoreId();
    return storeId ? [storeId] : [];
  }

  function ensureStoreAccess(storeId) {
    const scoped = getScopedStoreIds();
    if (scoped && storeId && !scoped.includes(storeId)) {
      throw new Error('Acesso negado para esta loja');
    }
  }

  async function getAllowedStores() {
    const allStores = await ensureDb().collection('lojas').get();
    const mapped = allStores.docs.map(docToObj);
    const scoped = getScopedStoreIds();
    if (!scoped) return mapped;
    return mapped.filter(store => scoped.includes(store.id));
  }

  /* ------------------------------------------
     PRODUCTS — /produtos/{id}
     Global catalog. Each product has global data.
  ------------------------------------------ */
  const Products = {
    async getAll() {
      const snap = await ensureDb().collection('produtos').get();
      return snap.docs.map(docToObj);
    },

    async getById(id) {
      const doc = await ensureDb().collection('produtos').doc(id).get();
      return doc.exists ? docToObj(doc) : null;
    },

    async save(product) {
      const d = ensureDb();
      const id = product.id || product._id || d.collection('produtos').doc().id;
      const data = cleanUndefined({
        ...product,
        id,
        updatedAt: timestamp(),
        updatedBy: currentUserId(),
      });
      delete data._id;
      await d.collection('produtos').doc(id).set(data, { merge: true });
      return id;
    },

    async delete(id) {
      await ensureDb().collection('produtos').doc(id).delete();
    },

    onSnapshot(callback) {
      const unsub = ensureDb().collection('produtos')
        .onSnapshot(snap => {
          callback(snap.docs.map(docToObj));
        });
      _listeners.push(unsub);
      return unsub;
    },
  };

  /* ------------------------------------------
     STORES — /lojas/{id}
     Store config (address, hours, delivery, etc.)
  ------------------------------------------ */
  const Stores = {
    async getAll() {
      return getAllowedStores();
    },

    async getById(id) {
      ensureStoreAccess(id);
      const doc = await ensureDb().collection('lojas').doc(id).get();
      return doc.exists ? docToObj(doc) : null;
    },

    async save(store) {
      const d = ensureDb();
      const id = store.id || store._id || d.collection('lojas').doc().id;
      const data = cleanUndefined({
        ...store,
        id,
        updatedAt: timestamp(),
      });
      delete data._id;
      await d.collection('lojas').doc(id).set(data, { merge: true });
      return id;
    },

    async delete(id) {
      await ensureDb().collection('lojas').doc(id).delete();
    },

    onSnapshot(callback) {
      const unsub = ensureDb().collection('lojas')
        .onSnapshot(snap => {
          const scoped = getScopedStoreIds();
          const stores = snap.docs.map(docToObj);
          callback(scoped ? stores.filter(store => scoped.includes(store.id)) : stores);
        });
      _listeners.push(unsub);
      return unsub;
    },
  };

  /* ------------------------------------------
     STORE PRODUCTS — /lojas/{storeId}/produtos_ativos/{productId}
     Per-store product activation/deactivation.
     Doc exists = product active for that store.
     Doc fields: { ativo: true, precoLocal: optional }
  ------------------------------------------ */
  const StoreProducts = {
    async getForStore(storeId) {
      const snap = await ensureDb()
        .collection('lojas').doc(storeId)
        .collection('produtos_ativos').get();
      return snap.docs.map(docToObj);
    },

    async setActive(storeId, productId, active, extraData = {}) {
      const ref = ensureDb()
        .collection('lojas').doc(storeId)
        .collection('produtos_ativos').doc(productId);
      if (active) {
        await ref.set(cleanUndefined({
          ativo: true,
          productId,
          updatedAt: timestamp(),
          ...extraData,
        }), { merge: true });
      } else {
        await ref.delete();
      }
    },

    async bulkActivate(storeId, productIds) {
      const batch = ensureDb().batch();
      productIds.forEach(pid => {
        const ref = ensureDb()
          .collection('lojas').doc(storeId)
          .collection('produtos_ativos').doc(pid);
        batch.set(ref, { ativo: true, productId: pid, updatedAt: timestamp() }, { merge: true });
      });
      await batch.commit();
    },

    onSnapshot(storeId, callback) {
      const unsub = ensureDb()
        .collection('lojas').doc(storeId)
        .collection('produtos_ativos')
        .onSnapshot(snap => {
          callback(snap.docs.map(docToObj));
        });
      _listeners.push(unsub);
      return unsub;
    },
  };

  /* ------------------------------------------
     STOCK — /lojas/{storeId}/estoque/{productId}
     Per-store stock levels.
     { quantidade, estoqueMinimo, updatedAt }
  ------------------------------------------ */
  const Stock = {
    async getForStore(storeId) {
      const snap = await ensureDb()
        .collection('lojas').doc(storeId)
        .collection('estoque').get();
      return snap.docs.map(docToObj);
    },

    async getForProduct(storeId, productId) {
      const doc = await ensureDb()
        .collection('lojas').doc(storeId)
        .collection('estoque').doc(productId).get();
      return doc.exists ? docToObj(doc) : null;
    },

    async setQty(storeId, productId, quantidade, estoqueMinimo) {
      const data = cleanUndefined({
        productId,
        quantidade,
        estoqueMinimo,
        updatedAt: timestamp(),
        updatedBy: currentUserId(),
      });
      await ensureDb()
        .collection('lojas').doc(storeId)
        .collection('estoque').doc(productId)
        .set(data, { merge: true });
    },

    async getAllStores(productId) {
      // Get stock for a product across all stores
      const stores = await Stores.getAll();
      const result = {};
      await Promise.all(stores.map(async (store) => {
        const doc = await ensureDb()
          .collection('lojas').doc(store.id)
          .collection('estoque').doc(productId).get();
        result[store.id] = doc.exists ? doc.data().quantidade || 0 : 0;
      }));
      return result;
    },

    onSnapshot(storeId, callback) {
      const unsub = ensureDb()
        .collection('lojas').doc(storeId)
        .collection('estoque')
        .onSnapshot(snap => {
          callback(snap.docs.map(docToObj));
        });
      _listeners.push(unsub);
      return unsub;
    },
  };

  /* ------------------------------------------
     MOVEMENTS — /lojas/{storeId}/movimentacoes/{id}
     Stock movement history per store.
  ------------------------------------------ */
  const Movements = {
    async add(storeId, movement) {
      const d = ensureDb();
      const ref = d.collection('lojas').doc(storeId).collection('movimentacoes').doc();
      const data = cleanUndefined({
        ...movement,
        id: ref.id,
        storeId,
        createdAt: timestamp(),
        usuario: currentUserName(),
        usuarioId: currentUserId(),
      });
      await ref.set(data);
      return ref.id;
    },

    async getForStore(storeId, limit = 100) {
      const snap = await ensureDb()
        .collection('lojas').doc(storeId)
        .collection('movimentacoes')
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();
      return snap.docs.map(docToObj);
    },

    async getForProduct(storeId, productId, limit = 50) {
      const snap = await ensureDb()
        .collection('lojas').doc(storeId)
        .collection('movimentacoes')
        .where('productId', '==', productId)
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();
      return snap.docs.map(docToObj);
    },
  };

  /* ------------------------------------------
     EMPLOYEES — /lojas/{storeId}/funcionarios/{id}
     Store-scoped employees.
     Global employees (dono) stored under /funcionarios/{id}
  ------------------------------------------ */
  const Employees = {
    async getForStore(storeId) {
      ensureStoreAccess(storeId);
      const snap = await ensureDb()
        .collection('lojas').doc(storeId)
        .collection('funcionarios').get();
      return snap.docs.map(docToObj);
    },

    async getAll() {
      const stores = await Stores.getAll();
      const allEmployees = [];

      if (isNetworkAdmin()) {
        const globalSnap = await ensureDb().collection('funcionarios').get();
        globalSnap.docs.forEach(doc => {
          allEmployees.push({ ...docToObj(doc), loja: null });
        });
      }

      // Per-store employees
      await Promise.all(stores.map(async (store) => {
        const snap = await ensureDb()
          .collection('lojas').doc(store.id)
          .collection('funcionarios').get();
        snap.docs.forEach(doc => {
          allEmployees.push({ ...docToObj(doc), loja: store.id });
        });
      }));

      return allEmployees;
    },

    async save(employee) {
      const d = ensureDb();
      const id = employee.id || employee._id || d.collection('funcionarios').doc().id;
      const data = cleanUndefined({
        ...employee,
        id,
        updatedAt: timestamp(),
      });
      delete data._id;

      if (employee.loja) {
        ensureStoreAccess(employee.loja);
        await d.collection('lojas').doc(employee.loja)
          .collection('funcionarios').doc(id).set(data, { merge: true });
      } else {
        if (!isNetworkAdmin()) throw new Error('Acesso negado para funcionario global');
        await d.collection('funcionarios').doc(id).set(data, { merge: true });
      }
      return id;
    },

    async delete(employeeId, storeId) {
      if (storeId) {
        ensureStoreAccess(storeId);
        await ensureDb()
          .collection('lojas').doc(storeId)
          .collection('funcionarios').doc(employeeId).delete();
      } else {
        if (!isNetworkAdmin()) throw new Error('Acesso negado para funcionario global');
        await ensureDb().collection('funcionarios').doc(employeeId).delete();
      }
    },
  };

  /* ------------------------------------------
     ORDERS — /lojas/{storeId}/pedidos/{id}
     Per-store orders.
  ------------------------------------------ */
  const Orders = {
    async getForStore(storeId, limit = 200) {
      ensureStoreAccess(storeId);
      const snap = await ensureDb()
        .collection('lojas').doc(storeId)
        .collection('pedidos')
        .orderBy('data', 'desc')
        .limit(limit)
        .get();
      return snap.docs.map(docToObj);
    },

    async getAll(limit = 500) {
      const stores = await Stores.getAll();
      const allOrders = [];
      await Promise.all(stores.map(async (store) => {
        const snap = await ensureDb()
          .collection('lojas').doc(store.id)
          .collection('pedidos')
          .orderBy('data', 'desc')
          .limit(limit)
          .get();
        snap.docs.forEach(doc => {
          allOrders.push({ ...docToObj(doc), loja: store.id });
        });
      }));
      return allOrders.sort((a, b) => {
        const da = a.data ? new Date(a.data) : 0;
        const db2 = b.data ? new Date(b.data) : 0;
        return db2 - da;
      });
    },

    async save(storeId, order) {
      ensureStoreAccess(storeId);
      const d = ensureDb();
      const id = order.id || order._id || order.numero || d.collection('pedidos').doc().id;
      const data = cleanUndefined({
        ...order,
        id,
        loja: storeId,
        updatedAt: timestamp(),
      });
      delete data._id;
      await d.collection('lojas').doc(storeId)
        .collection('pedidos').doc(id).set(data, { merge: true });
      return id;
    },

    async updateStatus(storeId, orderId, status) {
      ensureStoreAccess(storeId);
      await ensureDb()
        .collection('lojas').doc(storeId)
        .collection('pedidos').doc(orderId)
        .update({ status, updatedAt: timestamp() });
    },

    onSnapshot(storeId, callback) {
      ensureStoreAccess(storeId);
      const unsub = ensureDb()
        .collection('lojas').doc(storeId)
        .collection('pedidos')
        .orderBy('data', 'desc')
        .limit(200)
        .onSnapshot(snap => {
          callback(snap.docs.map(docToObj));
        });
      _listeners.push(unsub);
      return unsub;
    },
  };

  /* ------------------------------------------
     NOTAS FISCAIS — /lojas/{storeId}/notas_fiscais/{id}
  ------------------------------------------ */
  const NotasFiscais = {
    async getForStore(storeId) {
      ensureStoreAccess(storeId);
      const snap = await ensureDb()
        .collection('lojas').doc(storeId)
        .collection('notas_fiscais')
        .orderBy('data', 'desc')
        .get();
      return snap.docs.map(docToObj);
    },

    async save(storeId, nf) {
      ensureStoreAccess(storeId);
      const d = ensureDb();
      const id = nf.id || nf._id || d.collection('notas_fiscais').doc().id;
      const data = cleanUndefined({
        ...nf,
        id,
        loja: storeId,
        createdAt: timestamp(),
      });
      delete data._id;
      await d.collection('lojas').doc(storeId)
        .collection('notas_fiscais').doc(id).set(data, { merge: true });
      return id;
    },
  };

  /* ------------------------------------------
     CUSTOMERS — /clientes/{id}
     Global customers (shared across stores).
  ------------------------------------------ */
  const Customers = {
    async getAll() {
      const snap = await ensureDb().collection('clientes').get();
      return snap.docs.map(docToObj);
    },

    async save(customer) {
      const d = ensureDb();
      const id = customer.id || customer._id || d.collection('clientes').doc().id;
      const data = cleanUndefined({
        ...customer,
        id,
        updatedAt: timestamp(),
      });
      delete data._id;
      await d.collection('clientes').doc(id).set(data, { merge: true });
      return id;
    },
  };

  /* ------------------------------------------
     SUBSCRIPTIONS — /assinaturas/{id}
  ------------------------------------------ */
  const Subscriptions = {
    async getAll() {
      let ref = ensureDb().collection('assinaturas').orderBy('createdAt', 'desc');
      if (!isNetworkAdmin() && currentUserStoreId()) {
        ref = ensureDb().collection('assinaturas')
          .where('loja', '==', currentUserStoreId())
          .orderBy('createdAt', 'desc');
      }
      const snap = await ref.get();
      return snap.docs.map(docToObj);
    },

    async getForStore(storeId) {
      ensureStoreAccess(storeId);
      const snap = await ensureDb().collection('assinaturas')
        .where('loja', '==', storeId).get();
      return snap.docs.map(docToObj);
    },

    async save(sub) {
      const d = ensureDb();
      if (sub.loja) ensureStoreAccess(sub.loja);
      const id = sub.id || sub._id || d.collection('assinaturas').doc().id;
      const data = cleanUndefined({ ...sub, id, updatedAt: timestamp() });
      delete data._id;
      await d.collection('assinaturas').doc(id).set(data, { merge: true });
      return id;
    },
  };

  /* ------------------------------------------
     CAIXA — /lojas/{storeId}/caixa/{sessionId}
     Cash register sessions per store.
  ------------------------------------------ */
  const Caixa = {
    async getForStore(storeId) {
      ensureStoreAccess(storeId);
      const snap = await ensureDb()
        .collection('lojas').doc(storeId)
        .collection('caixa')
        .orderBy('abertura', 'desc')
        .limit(50)
        .get();
      return snap.docs.map(docToObj);
    },

    async getAll(limit = 50) {
      const stores = await Stores.getAll();
      const allSessions = [];
      await Promise.all(stores.map(async (store) => {
        const snap = await ensureDb()
          .collection('lojas').doc(store.id)
          .collection('caixa')
          .orderBy('abertura', 'desc')
          .limit(limit)
          .get();
        snap.docs.forEach(doc => {
          allSessions.push({ ...docToObj(doc), loja: store.id });
        });
      }));
      return allSessions;
    },

    async save(storeId, session) {
      ensureStoreAccess(storeId);
      const d = ensureDb();
      const id = session.id || session._id || d.collection('caixa').doc().id;
      const data = cleanUndefined({ ...session, id, updatedAt: timestamp() });
      delete data._id;
      await d.collection('lojas').doc(storeId)
        .collection('caixa').doc(id).set(data, { merge: true });
      return id;
    },
  };

  function createFinanceCollection(collectionName) {
    return {
      async getByFilter(storeId, periodKey) {
        if (storeId) {
          ensureStoreAccess(storeId);
          let ref = ensureDb()
            .collection('lojas').doc(storeId)
            .collection(collectionName);
          if (periodKey) ref = ref.where('periodKey', '==', periodKey);
          const snap = await ref.get();
          return snap.docs.map(doc => ({ ...docToObj(doc), storeId }));
        }

        const stores = await Stores.getAll();
        const allDocs = [];
        await Promise.all(stores.map(async (store) => {
          let ref = ensureDb()
            .collection('lojas').doc(store.id)
            .collection(collectionName);
          if (periodKey) ref = ref.where('periodKey', '==', periodKey);
          const snap = await ref.get();
          snap.docs.forEach(doc => {
            allDocs.push({ ...docToObj(doc), storeId: store.id });
          });
        }));
        return allDocs;
      },

      async save(storeId, docData) {
        ensureStoreAccess(storeId);
        const d = ensureDb();
        const id = docData.id || docData._id || d.collection(collectionName).doc().id;
        const data = cleanUndefined({
          ...docData,
          id,
          storeId,
          updatedAt: timestamp(),
          updatedBy: currentUserId(),
        });
        delete data._id;
        await d.collection('lojas').doc(storeId)
          .collection(collectionName).doc(id).set(data, { merge: true });
        return id;
      },

      async delete(storeId, docId) {
        ensureStoreAccess(storeId);
        await ensureDb()
          .collection('lojas').doc(storeId)
          .collection(collectionName).doc(docId).delete();
      },
    };
  }

  const FinancialPeriods = createFinanceCollection('financial_periods');
  const FixedCosts = createFinanceCollection('fixed_cost_entries');
  const VariableCosts = createFinanceCollection('variable_cost_entries');
  const FinancialSnapshots = createFinanceCollection('financial_snapshots');
  const HealthScores = createFinanceCollection('health_scores');

  /* ------------------------------------------
     NF-e XML PARSER
     Parse Brazilian fiscal note XML to extract
     product items for stock entry.
  ------------------------------------------ */
  function parseNFeXML(xmlString) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

    const parseError = xmlDoc.querySelector('parsererror');
    if (parseError) throw new Error('XML inválido');

    // NF-e namespace
    const ns = 'http://www.portalfiscal.inf.br/nfe';

    // Helper to get text with or without namespace
    function getText(parent, tag) {
      let el = parent.getElementsByTagNameNS(ns, tag)[0];
      if (!el) el = parent.getElementsByTagName(tag)[0];
      return el ? el.textContent.trim() : '';
    }

    // NF-e header info
    const ide = xmlDoc.getElementsByTagNameNS(ns, 'ide')[0] || xmlDoc.getElementsByTagName('ide')[0];
    const emit = xmlDoc.getElementsByTagNameNS(ns, 'emit')[0] || xmlDoc.getElementsByTagName('emit')[0];

    const nfInfo = {
      numero: ide ? getText(ide, 'nNF') : '',
      serie: ide ? getText(ide, 'serie') : '',
      dataEmissao: ide ? getText(ide, 'dhEmi') : '',
      fornecedor: emit ? getText(emit, 'xNome') : '',
      cnpjFornecedor: emit ? getText(emit, 'CNPJ') : '',
    };

    // Products from <det><prod>
    const detElements = xmlDoc.getElementsByTagNameNS(ns, 'det');
    const detFallback = detElements.length ? detElements : xmlDoc.getElementsByTagName('det');

    const items = [];
    for (let i = 0; i < detFallback.length; i++) {
      const det = detFallback[i];
      const prod = det.getElementsByTagNameNS(ns, 'prod')[0] || det.getElementsByTagName('prod')[0];
      if (!prod) continue;

      items.push({
        nItem: det.getAttribute('nItem') || (i + 1),
        codigo: getText(prod, 'cProd'),
        ean: getText(prod, 'cEAN') || getText(prod, 'cEANTrib'),
        nome: getText(prod, 'xProd'),
        ncm: getText(prod, 'NCM'),
        cfop: getText(prod, 'CFOP'),
        unidade: getText(prod, 'uCom') || getText(prod, 'uTrib'),
        quantidade: parseFloat(getText(prod, 'qCom') || getText(prod, 'qTrib')) || 0,
        valorUnitario: parseFloat(getText(prod, 'vUnCom') || getText(prod, 'vUnTrib')) || 0,
        valorTotal: parseFloat(getText(prod, 'vProd')) || 0,
      });
    }

    return { nfInfo, items };
  }

  /* ------------------------------------------
     STOCK OPERATIONS (high-level)
     Handles stock entry, exit, transfer, adjust
     with movement tracking.
  ------------------------------------------ */
  const StockOps = {
    async entrada(storeId, productId, productName, qty, motivo, nota) {
      ensureStoreAccess(storeId);
      const stockDoc = await Stock.getForProduct(storeId, productId);
      const currentQty = stockDoc ? stockDoc.quantidade : 0;
      const newQty = currentQty + qty;

      await Stock.setQty(storeId, productId, newQty, stockDoc ? stockDoc.estoqueMinimo : 10);
      await Movements.add(storeId, {
        tipo: 'entrada',
        productId,
        productName,
        quantidade: qty,
        motivo,
        nota,
        estoqueAnterior: currentQty,
        estoqueNovo: newQty,
      });
      return newQty;
    },

    async saida(storeId, productId, productName, qty, motivo, nota) {
      ensureStoreAccess(storeId);
      const stockDoc = await Stock.getForProduct(storeId, productId);
      const currentQty = stockDoc ? stockDoc.quantidade : 0;
      if (qty > currentQty) throw new Error('Quantidade excede estoque atual');
      const newQty = currentQty - qty;

      await Stock.setQty(storeId, productId, newQty, stockDoc ? stockDoc.estoqueMinimo : 10);
      await Movements.add(storeId, {
        tipo: 'saida',
        productId,
        productName,
        quantidade: qty,
        motivo,
        nota,
        estoqueAnterior: currentQty,
        estoqueNovo: newQty,
      });
      return newQty;
    },

    async transferir(fromStoreId, toStoreId, productId, productName, qty) {
      ensureStoreAccess(fromStoreId);
      ensureStoreAccess(toStoreId);
      const fromStock = await Stock.getForProduct(fromStoreId, productId);
      const toStock = await Stock.getForProduct(toStoreId, productId);
      const fromQty = fromStock ? fromStock.quantidade : 0;
      const toQty = toStock ? toStock.quantidade : 0;

      if (qty > fromQty) throw new Error('Quantidade excede estoque de origem');

      await Stock.setQty(fromStoreId, productId, fromQty - qty, fromStock ? fromStock.estoqueMinimo : 10);
      await Stock.setQty(toStoreId, productId, toQty + qty, toStock ? toStock.estoqueMinimo : 10);

      await Movements.add(fromStoreId, {
        tipo: 'transferencia',
        productId,
        productName,
        quantidade: qty,
        lojaDestino: toStoreId,
        motivo: 'Transferência entre lojas',
        estoqueAnterior: fromQty,
        estoqueNovo: fromQty - qty,
      });
      await Movements.add(toStoreId, {
        tipo: 'transferencia_entrada',
        productId,
        productName,
        quantidade: qty,
        lojaOrigem: fromStoreId,
        motivo: 'Transferência entre lojas',
        estoqueAnterior: toQty,
        estoqueNovo: toQty + qty,
      });
    },

    async ajustar(storeId, productId, productName, newQty, nota) {
      ensureStoreAccess(storeId);
      const stockDoc = await Stock.getForProduct(storeId, productId);
      const currentQty = stockDoc ? stockDoc.quantidade : 0;

      await Stock.setQty(storeId, productId, newQty, stockDoc ? stockDoc.estoqueMinimo : 10);
      await Movements.add(storeId, {
        tipo: 'ajuste',
        productId,
        productName,
        quantidade: newQty - currentQty,
        motivo: 'Ajuste de inventário',
        nota: nota || 'Contagem física',
        estoqueAnterior: currentQty,
        estoqueNovo: newQty,
      });
      return newQty;
    },

    async autoDeduct(storeId, order) {
      ensureStoreAccess(storeId);
      if (!order || !order.items) return;
      for (const item of order.items) {
        const stockDoc = await Stock.getForProduct(storeId, item.productId);
        const currentQty = stockDoc ? stockDoc.quantidade : 0;
        const deductQty = item.quantidade || 1;
        const newQty = Math.max(0, currentQty - deductQty);

        await Stock.setQty(storeId, item.productId, newQty, stockDoc ? stockDoc.estoqueMinimo : 10);
        await Movements.add(storeId, {
          tipo: 'auto_deducao',
          productId: item.productId,
          productName: item.nome,
          quantidade: deductQty,
          motivo: 'Dedução automática - Pedido ' + (order.numero || ''),
          nota: 'Pedido confirmado',
          estoqueAnterior: currentQty,
          estoqueNovo: newQty,
        });
      }
    },

    async entradaFromNFe(storeId, xmlString) {
      ensureStoreAccess(storeId);
      const { nfInfo, items } = parseNFeXML(xmlString);
      const results = [];

      for (const item of items) {
        // Try to match product by EAN (barcode) or name
        const allProducts = await Products.getAll();
        let matched = allProducts.find(p => p.codigoBarras && p.codigoBarras === item.ean);
        if (!matched) {
          matched = allProducts.find(p =>
            p.nome.toLowerCase().includes(item.nome.toLowerCase().slice(0, 10))
          );
        }

        results.push({
          ...item,
          matchedProduct: matched ? { id: matched.id, nome: matched.nome } : null,
          nfNumero: nfInfo.numero,
          fornecedor: nfInfo.fornecedor,
        });

        // If matched, auto-add stock
        if (matched) {
          await this.entrada(
            storeId,
            matched.id,
            matched.nome,
            Math.round(item.quantidade),
            `NF-e ${nfInfo.numero} - ${nfInfo.fornecedor}`,
            `Item: ${item.nome} | Cód: ${item.codigo}`
          );
        }
      }

      // Save NF record
      await NotasFiscais.save(storeId, {
        numero: nfInfo.numero,
        serie: nfInfo.serie,
        dataEmissao: nfInfo.dataEmissao,
        fornecedor: nfInfo.fornecedor,
        cnpjFornecedor: nfInfo.cnpjFornecedor,
        items: results,
        tipo: 'entrada',
        data: new Date().toISOString(),
      });

      return { nfInfo, results };
    },
  };

  /* ------------------------------------------
     SEED MIGRATION
     Write DataProducts + DataStores to Firestore
     (one-time operation).
  ------------------------------------------ */
  async function seedFromMockData() {
    const d = ensureDb();

    // Check if already seeded
    const meta = await d.collection('meta').doc('seed').get();
    if (meta.exists) {
      console.log('[FirestoreService] Already seeded');
      return { products: 0, stores: 0 };
    }

    let prodCount = 0;
    let storeCount = 0;

    // Seed stores
    if (typeof DataStores !== 'undefined') {
      const batch1 = d.batch();
      DataStores.forEach(store => {
        batch1.set(d.collection('lojas').doc(store.id), cleanUndefined({
          ...store,
          createdAt: timestamp(),
        }));
        storeCount++;
      });
      await batch1.commit();
    }

    // Seed products (in batches of 500 max)
    if (typeof DataProducts !== 'undefined') {
      const chunks = [];
      for (let i = 0; i < DataProducts.length; i += 400) {
        chunks.push(DataProducts.slice(i, i + 400));
      }

      for (const chunk of chunks) {
        const batch = d.batch();
        chunk.forEach(product => {
          const { estoque, ...productData } = product;
          batch.set(d.collection('produtos').doc(product.id), cleanUndefined({
            ...productData,
            createdAt: timestamp(),
          }));
          prodCount++;
        });
        await batch.commit();
      }

      // Seed stock per store from DataProducts.estoque
      for (const product of DataProducts) {
        if (!product.estoque) continue;
        const stockBatch = d.batch();
        for (const [storeId, qty] of Object.entries(product.estoque)) {
          stockBatch.set(
            d.collection('lojas').doc(storeId).collection('estoque').doc(product.id),
            {
              productId: product.id,
              quantidade: qty,
              estoqueMinimo: product.estoqueMinimo || 10,
              updatedAt: timestamp(),
            }
          );
        }
        await stockBatch.commit();
      }

      // Activate all products in all stores by default
      for (const store of DataStores) {
        const activeBatch = d.batch();
        DataProducts.forEach(product => {
          activeBatch.set(
            d.collection('lojas').doc(store.id).collection('produtos_ativos').doc(product.id),
            { ativo: true, productId: product.id, updatedAt: timestamp() }
          );
        });
        await activeBatch.commit();
      }
    }

    // Seed employees
    if (typeof DataEmployees !== 'undefined') {
      for (const emp of DataEmployees) {
        if (emp.loja) {
          await d.collection('lojas').doc(emp.loja)
            .collection('funcionarios').doc(emp.id)
            .set(cleanUndefined({ ...emp, createdAt: timestamp() }));
        } else {
          await d.collection('funcionarios').doc(emp.id)
            .set(cleanUndefined({ ...emp, createdAt: timestamp() }));
        }
      }
    }

    // Mark as seeded
    await d.collection('meta').doc('seed').set({
      seededAt: timestamp(),
      seededBy: currentUserId(),
      products: prodCount,
      stores: storeCount,
    });

    console.log(`[FirestoreService] Seeded ${prodCount} products, ${storeCount} stores`);
    return { products: prodCount, stores: storeCount };
  }

  /* ------------------------------------------
     METAS — Gamification data
  ------------------------------------------ */
  const Metas = {
    async getConfig() {
      const doc = await ensureDb().collection('metas_config').doc('default').get();
      return doc.exists ? docToObj(doc) : null;
    },
    async saveConfig(config) {
      await ensureDb().collection('metas_config').doc('default').set(cleanUndefined(config), { merge: true });
    },
    async getPoints(empId) {
      const doc = await ensureDb().collection('metas_pontos').doc(empId).get();
      return doc.exists ? docToObj(doc) : null;
    },
    async savePoints(empId, data) {
      await ensureDb().collection('metas_pontos').doc(empId).set(cleanUndefined({ ...data, updatedAt: timestamp() }), { merge: true });
    },
    async getAllPoints() {
      const snap = await ensureDb().collection('metas_pontos').get();
      return snap.docs.map(docToObj);
    },
    async addProof(proof) {
      const id = proof.id || ('PROOF-' + Date.now());
      await ensureDb().collection('metas_provas').doc(id).set(cleanUndefined({ ...proof, id, createdAt: timestamp() }));
      return id;
    },
    async getProofs(status) {
      let q = ensureDb().collection('metas_provas').orderBy('createdAt', 'desc').limit(200);
      if (status) q = q.where('status', '==', status);
      const snap = await q.get();
      return snap.docs.map(docToObj);
    },
    async updateProof(proofId, data) {
      await ensureDb().collection('metas_provas').doc(proofId).update(cleanUndefined({ ...data, updatedAt: timestamp() }));
    },
    async saveAttendance(empId, record) {
      const dateKey = record.date || new Date().toISOString().slice(0, 10);
      await ensureDb().collection('metas_attendance').doc(empId + '_' + dateKey).set(cleanUndefined({ ...record, empId, date: dateKey, updatedAt: timestamp() }), { merge: true });
    },
    async getAttendance(empId, month) {
      let q = ensureDb().collection('metas_attendance').where('empId', '==', empId);
      if (month) {
        q = q.where('date', '>=', month + '-01').where('date', '<=', month + '-31');
      }
      const snap = await q.get();
      return snap.docs.map(docToObj);
    },
    async saveDailyTasks(empId, date, tasks) {
      await ensureDb().collection('metas_tasks').doc(empId + '_' + date).set(cleanUndefined({ empId, date, tasks, updatedAt: timestamp() }), { merge: true });
    },
    async getDailyTasks(empId, date) {
      const doc = await ensureDb().collection('metas_tasks').doc(empId + '_' + date).get();
      return doc.exists ? docToObj(doc) : null;
    },
  };

  /* ------------------------------------------
     AFILIADOS — Affiliate/referral data
  ------------------------------------------ */
  const Afiliados = {
    async getAll() {
      const snap = await ensureDb().collection('afiliados').get();
      return snap.docs.map(docToObj);
    },
    async getById(id) {
      const doc = await ensureDb().collection('afiliados').doc(id).get();
      return doc.exists ? docToObj(doc) : null;
    },
    async save(affiliate) {
      const id = affiliate.id || ('AF-' + Date.now());
      await ensureDb().collection('afiliados').doc(id).set(cleanUndefined({ ...affiliate, id, updatedAt: timestamp() }), { merge: true });
      return id;
    },
    async delete(id) {
      await ensureDb().collection('afiliados').doc(id).delete();
    },
    async getConfig() {
      const doc = await ensureDb().collection('afiliado_config').doc('default').get();
      return doc.exists ? docToObj(doc) : null;
    },
    async saveConfig(config) {
      await ensureDb().collection('afiliado_config').doc('default').set(cleanUndefined(config), { merge: true });
    },
    async getSales(limit = 200) {
      const snap = await ensureDb().collection('afiliado_sales').orderBy('data', 'desc').limit(limit).get();
      return snap.docs.map(docToObj);
    },
    async addSale(sale) {
      const id = sale.id || ('ASALE-' + Date.now());
      await ensureDb().collection('afiliado_sales').doc(id).set(cleanUndefined({ ...sale, id }));
      return id;
    },
    async updateSale(saleId, data) {
      await ensureDb().collection('afiliado_sales').doc(saleId).update(cleanUndefined({ ...data, updatedAt: timestamp() }));
    },
  };

  /* ------------------------------------------
     CLEANUP
  ------------------------------------------ */
  function cleanup() {
    _listeners.forEach(unsub => {
      try { unsub(); } catch (e) { /* ignore */ }
    });
    _listeners.length = 0;
  }

  /* ------------------------------------------
     PUBLIC API
  ------------------------------------------ */
  return {
    init,
    get ready() { return _ready; },
    get _db() { return db; },

    Products,
    Stores,
    StoreProducts,
    Stock,
    Movements,
    Employees,
    Orders,
    NotasFiscais,
    Customers,
    Subscriptions,
    Caixa,
    FinancialPeriods,
    FixedCosts,
    VariableCosts,
    FinancialSnapshots,
    HealthScores,
    StockOps,
    Metas,
    Afiliados,

    parseNFeXML,
    seedFromMockData,
    cleanup,
    timestamp,
  };
})();
