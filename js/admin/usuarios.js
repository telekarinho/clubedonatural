// =============================================
// Users Admin — Clube do Natural
// =============================================
// Manages user approval, roles, and access control via Firebase.

(function () {
  'use strict';

  const ROLES = {
    dono: { label: 'Dono', color: '#C4972A', icon: '👑' },
    gerente: { label: 'Gerente', color: '#2D6A4F', icon: '🏪' },
    atendente: { label: 'Atendente', color: '#52B788', icon: '🛒' },
    caixa: { label: 'Caixa', color: '#40916C', icon: '💰' },
    estoquista: { label: 'Estoquista', color: '#6B705C', icon: '📦' },
    motoboy: { label: 'Motoboy', color: '#3A86FF', icon: '🏍️' },
    pendente: { label: 'Pendente', color: '#E63946', icon: '⏳' }
  };

  window.UsersAdmin = {
    users: [],
    loaded: false,

    async init() {
      if (!CdnFirebase.ready) return;
      // Only dono can see users page
      if (CdnAuth.userData?.role !== 'dono') {
        document.getElementById('usuarios-content').innerHTML =
          '<p style="color:#E63946;padding:20px">Apenas o Dono pode gerenciar usuários.</p>';
        return;
      }
      await this.refresh();
    },

    async refresh() {
      if (!CdnFirebase.ready) return;

      try {
        const snapshot = await CdnFirebase.db.collection('users')
          .orderBy('createdAt', 'desc')
          .get();

        this.users = [];
        snapshot.forEach(doc => {
          this.users.push({ id: doc.id, ...doc.data() });
        });

        this.render();
        this.updateBadge();
        this.loaded = true;
      } catch (err) {
        console.error('[UsersAdmin] Error loading users:', err);
        document.getElementById('approved-users-list').innerHTML =
          '<p style="color:#E63946">Erro ao carregar usuários: ' + err.message + '</p>';
      }
    },

    render() {
      const pending = this.users.filter(u => !u.approved);
      const approved = this.users.filter(u => u.approved);

      // Pending users section
      const pendingSection = document.getElementById('pending-users-section');
      const pendingList = document.getElementById('pending-users-list');

      if (pending.length > 0) {
        pendingSection.style.display = 'block';
        pendingList.innerHTML = pending.map(u => this.renderUserCard(u, true)).join('');
      } else {
        pendingSection.style.display = 'none';
      }

      // Approved users
      const approvedList = document.getElementById('approved-users-list');
      if (approved.length > 0) {
        approvedList.innerHTML = approved.map(u => this.renderUserCard(u, false)).join('');
      } else {
        approvedList.innerHTML = '<p style="color:#888;padding:20px">Nenhum usuário aprovado ainda.</p>';
      }
    },

    renderUserCard(user, isPending) {
      const role = ROLES[user.role] || ROLES.pendente;
      const createdAt = user.createdAt?.toDate ? user.createdAt.toDate().toLocaleDateString('pt-BR') : 'N/A';
      const lastLogin = user.lastLogin?.toDate ? user.lastLogin.toDate().toLocaleString('pt-BR') : 'N/A';
      const isCurrentUser = user.uid === CdnAuth.currentUser?.uid;

      return `
        <div class="user-card ${isPending ? 'user-card--pending' : ''}" data-uid="${user.uid}">
          <div class="user-card__header">
            ${user.photoURL
              ? `<img src="${user.photoURL}" alt="" class="user-card__avatar">`
              : `<div class="user-card__avatar user-card__avatar--placeholder">${(user.displayName || user.email || '?')[0].toUpperCase()}</div>`
            }
            <div class="user-card__info">
              <strong class="user-card__name">${user.displayName || 'Sem nome'} ${isCurrentUser ? '<span style="font-size:11px;color:#888">(você)</span>' : ''}</strong>
              <span class="user-card__email">${user.email}</span>
            </div>
          </div>
          <div class="user-card__meta">
            <span class="user-card__role" style="background:${role.color}15;color:${role.color};border:1px solid ${role.color}30">
              ${role.icon} ${role.label}
            </span>
            <span class="user-card__date">Criado: ${createdAt}</span>
            <span class="user-card__date">Último acesso: ${lastLogin}</span>
          </div>
          <div class="user-card__actions">
            ${isPending ? `
              <button class="btn btn--sm btn--primary" onclick="UsersAdmin.approveUser('${user.uid}')">✅ Aprovar</button>
              <button class="btn btn--sm btn--danger" onclick="UsersAdmin.rejectUser('${user.uid}')">❌ Rejeitar</button>
            ` : `
              <select class="user-card__role-select" onchange="UsersAdmin.changeRole('${user.uid}', this.value)" ${isCurrentUser ? 'disabled' : ''}>
                ${Object.entries(ROLES).filter(([k]) => k !== 'pendente').map(([k, v]) =>
                  `<option value="${k}" ${user.role === k ? 'selected' : ''}>${v.icon} ${v.label}</option>`
                ).join('')}
              </select>
              ${!isCurrentUser ? `<button class="btn btn--sm btn--danger-ghost" onclick="UsersAdmin.revokeUser('${user.uid}')">Revogar</button>` : ''}
            `}
          </div>
        </div>
      `;
    },

    async approveUser(uid) {
      if (!confirm('Aprovar este usuário?')) return;
      try {
        await CdnFirebase.db.collection('users').doc(uid).update({
          approved: true,
          role: 'atendente', // default role for new approved users
          approvedAt: firebase.firestore.FieldValue.serverTimestamp(),
          approvedBy: CdnAuth.currentUser.uid
        });
        this.toast('Usuário aprovado!');
        await this.refresh();
      } catch (err) {
        this.toast('Erro: ' + err.message, 'error');
      }
    },

    async rejectUser(uid) {
      if (!confirm('Rejeitar e remover este usuário? Ele poderá solicitar acesso novamente.')) return;
      try {
        await CdnFirebase.db.collection('users').doc(uid).delete();
        this.toast('Usuário rejeitado.');
        await this.refresh();
      } catch (err) {
        this.toast('Erro: ' + err.message, 'error');
      }
    },

    async changeRole(uid, newRole) {
      try {
        await CdnFirebase.db.collection('users').doc(uid).update({ role: newRole });
        const user = this.users.find(u => u.uid === uid);
        if (user) user.role = newRole;
        this.toast(`Cargo alterado para ${ROLES[newRole]?.label || newRole}`);
      } catch (err) {
        this.toast('Erro: ' + err.message, 'error');
        this.render(); // revert UI
      }
    },

    async revokeUser(uid) {
      if (!confirm('Revogar acesso deste usuário? Ele voltará a status pendente.')) return;
      try {
        await CdnFirebase.db.collection('users').doc(uid).update({
          approved: false,
          role: 'pendente'
        });
        this.toast('Acesso revogado.');
        await this.refresh();
      } catch (err) {
        this.toast('Erro: ' + err.message, 'error');
      }
    },

    updateBadge() {
      const pending = this.users.filter(u => !u.approved).length;
      const badge = document.getElementById('badge-pending-users');
      if (badge) {
        badge.textContent = pending;
        badge.style.display = pending > 0 ? 'inline' : 'none';
      }
    },

    toast(msg, type = 'success') {
      if (typeof Toast !== 'undefined' && Toast.show) {
        Toast.show(msg, type);
      } else {
        alert(msg);
      }
    }
  };
})();
