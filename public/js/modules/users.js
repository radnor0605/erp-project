const Users = {
  render: async () => {
    const data = await API.get('/users').catch(() => []);
    
    return `
      <div class="content-header">
        <div>
          <h1 class="content-title">계정 및 사용자 관리</h1>
          <p class="content-subtitle">시스템 사용자 정보를 조회하하거나 새로운 계정을 등록할 수 있습니다.</p>
        </div>
        <div class="header-actions">
          <button id="add-user-btn" class="btn btn-primary">신규 계정 등록</button>
        </div>
      </div>

      <div class="card">
        <div class="table-container">
          <table class="table">
            <thead>
              <tr>
                <th>ID</th><th>이름</th><th>권한</th><th>사원번호</th><th>등록일</th><th>액션</th>
              </tr>
            </thead>
            <tbody>
              ${data.length ? data.map(u => `
                <tr>
                  <td><span class="mono">${u.username}</span></td>
                  <td>${u.name || '-'}</td>
                  <td><span class="badge ${u.role === 'admin' ? 'badge-primary' : 'badge-ghost'}">${u.role === 'admin' ? '관리자' : '사용자'}</span></td>
                  <td><strong>${u.employee_id || '-'}</strong></td>
                  <td><small>${new Date(u.created_at).toLocaleDateString()}</small></td>
                  <td>
                    <div class="table-actions">
                      <button class="btn btn-xs btn-secondary" onclick="Users.showEditModal('${u.id}')">수정</button>
                      ${u.username !== 'admin' ? `
                        <button class="btn btn-xs btn-danger" onclick="Users.delete(${u.id}, '${u.username}')">삭제</button>
                      ` : ''}
                    </div>
                  </td>
                </tr>
              `).join('') : '<tr><td colspan="6" style="text-align:center">등록된 사용자가 없습니다.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  init: () => {
    document.getElementById('add-user-btn')?.addEventListener('click', () => {
      Users.showAddUserModal();
    });
  },

  delete: (id, name) => {
    confirmDialog(`<strong>${name}</strong> 계정을 삭제하시겠습니까?`, async () => {
      try {
        await API.delete(`/users/${id}`);
        showToast('계정이 삭제되었습니다.', 'success');
        Router.navigate('users');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  },

  showAddUserModal: async () => {
    // Fetch next suggested Employee ID
    let nextEmployeeId = '';
    try {
      const res = await API.get('/users/next-employee-id');
      nextEmployeeId = res.nextId;
    } catch (err) { console.error('Failed to fetch next ID', err); }

    const html = `
      <div class="modal-header">
        <div class="modal-title">신규 계정 등록</div>
        <button class="modal-close">×</button>
      </div>
      <div class="modal-body">
        <div class="alert alert-info" style="font-size:0.75rem; margin-bottom:16px;">
          <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/></svg>
          입력 중인 정보는 세션에 임시 저장됩니다.
        </div>
        <form id="add-user-form" style="display:flex; flex-direction:column; gap:16px;">
          <div class="form-group">
            <label>아이디 <span class="required">*</span></label>
            <input type="text" id="reg-username" name="username" required placeholder="예: test1">
          </div>
          <div class="form-group">
            <label>비밀번호 <span class="required">*</span></label>
            <input type="password" id="reg-password" name="password" required>
          </div>
          <div class="form-group">
            <label>이름</label>
            <input type="text" id="reg-name" name="name" placeholder="홍길동">
          </div>
          <div class="form-group">
            <label>사원번호 <span class="required">*</span></label>
            <div style="display:flex; gap:8px;">
              <input type="text" id="reg-employee-id" name="employee_id" required value="${nextEmployeeId}" style="flex:1">
              <button type="button" class="btn btn-secondary btn-sm" id="btn-gen-id">자동생성</button>
            </div>
          </div>
          <div class="form-group">
            <label>권한</label>
            <select id="reg-role" name="role">
              <option value="user">일반 사용자</option>
              <option value="admin">관리자</option>
            </select>
          </div>
          <button type="submit" class="btn btn-primary btn-full" style="margin-top:10px;">등록 완료</button>
        </form>
      </div>
    `;
    openModal(html, 'max-width:450px');
    const form = document.getElementById('add-user-form');
    
    // Bind with 'session' storage as requested
    FormPersistence.bind('users-add', form, 'session');

    document.getElementById('btn-gen-id').onclick = async () => {
      try {
        const res = await API.get('/users/next-employee-id');
        document.getElementById('reg-employee-id').value = res.nextId;
        // Trigger input event to update persistence
        document.getElementById('reg-employee-id').dispatchEvent(new Event('input'));
      } catch (err) { showToast('ID 생성 실패', 'error'); }
    };

    form.onsubmit = async (e) => {
      e.preventDefault();
      const payload = Object.fromEntries(new FormData(form));

      try {
        await API.post('/users', payload);
        FormPersistence.clear('users-add', 'session');
        showToast('신규 계정이 등록되었습니다.', 'success');
        closeModal();
        Router.navigate('users');
      } catch (err) {
        showToast(err.message, 'error');
      }
    };
  },

  showEditModal: async (id) => {
    try {
      const u = await API.get(`/users/${id}`);
      const html = `
        <div class="modal-header">
          <div class="modal-title">사용자 정보 수정</div>
          <button class="modal-close">×</button>
        </div>
        <div class="modal-body">
          <form id="edit-user-form" style="display:flex; flex-direction:column; gap:16px;">
            <input type="hidden" name="id" value="${u.id}">
            <div class="form-group">
              <label>아이디</label>
              <input type="text" value="${u.username}" readonly style="background:var(--bg-glass)">
            </div>
            <div class="form-group">
              <label>이름</label>
              <input type="text" name="name" value="${u.name || ''}" placeholder="홍길동">
            </div>
            <div class="form-group">
              <label>사원번호 <span class="required">*</span></label>
              <input type="text" name="employee_id" required value="${u.employee_id || ''}">
            </div>
            <div class="form-group">
              <label>새 비밀번호 (변경 시에만 입력)</label>
              <input type="password" name="password" placeholder="********">
            </div>
            <div class="form-group">
              <label>권한</label>
              <select name="role" ${u.username === 'admin' ? 'disabled' : ''}>
                <option value="user" ${u.role === 'user' ? 'selected' : ''}>일반 사용자</option>
                <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>관리자</option>
              </select>
            </div>
            <button type="submit" class="btn btn-primary btn-full" style="margin-top:10px;">수정 완료</button>
          </form>
        </div>
      `;
      openModal(html, 'max-width:450px');
      const form = document.getElementById('edit-user-form');
      form.onsubmit = async (e) => {
        e.preventDefault();
        const payload = Object.fromEntries(new FormData(form));
        try {
          await API.put(`/users/${id}`, payload);
          showToast('사용자 정보가 수정되었습니다.', 'success');
          closeModal();
          Router.navigate('users');
        } catch (err) { showToast(err.message, 'error'); }
      };
    } catch (err) { showToast(err.message, 'error'); }
  }
};
window.Users = Users;
