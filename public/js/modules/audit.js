const Audit = {
  render: async () => {
    const data = await API.get('/api/audit').catch(() => []);
    
    return `
      <div class="content-header">
        <h1 class="content-title">감사 로그 (Audit Trail)</h1>
        <div class="header-actions">
          <button id="refresh-audit" class="btn btn-secondary">새로고침</button>
        </div>
      </div>

      <div class="card">
        <div class="table-container">
          <table class="table">
            <thead>
              <tr>
                <th>시간</th>
                <th>작업자</th>
                <th>작업</th>
                <th>대상 테이블</th>
                <th>대상 ID</th>
                <th>이전 값</th>
                <th>이후 값</th>
              </tr>
            </thead>
            <tbody>
              ${data.length ? data.map(item => `
                <tr>
                  <td><small>${new Date(item.created_at).toLocaleString()}</small></td>
                  <td><span class="badge badge-info">${item.user_id}</span></td>
                  <td><strong>${item.action}</strong></td>
                  <td>${item.target_table}</td>
                  <td><code>${item.target_id || '-'}</code></td>
                  <td><button class="btn btn-sm btn-secondary view-diff" data-val='${item.old_value || "{}"}'>보기</button></td>
                  <td><button class="btn btn-sm btn-secondary view-diff" data-val='${item.new_value || "{}"}'>보기</button></td>
                </tr>
              `).join('') : '<tr><td colspan="7" style="text-align:center">로그 기록이 없습니다.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  init: () => {
    document.getElementById('refresh-audit')?.addEventListener('click', () => {
      window.router.navigateTo('/audit');
    });

    document.querySelectorAll('.view-diff').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const raw = e.target.getAttribute('data-val');
        const json = JSON.parse(raw);
        const modal = document.createElement('div');
        modal.className = 'modal-backdrop';
        modal.innerHTML = `
          <div class="modal" style="max-width: 500px">
            <div class="modal-header">
              <div class="modal-title">상세 데이터</div>
              <button class="modal-close">×</button>
            </div>
            <div class="modal-body">
              <pre style="background:#f4f4f4; padding:15px; border-radius:8px; font-size:12px; overflow-x:auto">
                ${JSON.stringify(json, null, 2)}
              </pre>
            </div>
          </div>
        `;
        document.body.appendChild(modal);
        modal.querySelector('.modal-close').onclick = () => modal.remove();
      });
    });
  }
};
window.Audit = Audit;
