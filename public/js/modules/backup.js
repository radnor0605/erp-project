/* ─── Backup Module ─── */
const Backup = (() => {
  async function render() {
    const user = getUser();
    if (user?.role !== 'admin') {
      document.getElementById('page-container').innerHTML = `
        <div class="alert alert-danger">
          <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd"/></svg>
          관리자만 접근 가능합니다.
        </div>
      `;
      return;
    }

    const container = document.getElementById('page-container');
    container.innerHTML = `
      <div class="animate-fade">
        <div class="page-header">
          <div>
            <h2 class="page-title">DB 백업 관리</h2>
            <p class="page-subtitle">수동/자동 백업 · 다운로드 (매일 새벽 2시 자동 실행)</p>
          </div>
          <button class="btn btn-primary" id="bk-create-btn">+ 지금 백업 생성</button>
        </div>
        <div class="alert alert-info">
          <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/></svg>
          백업 파일은 <code style="font-family:monospace;background:rgba(255,255,255,0.05);padding:2px 6px;border-radius:4px">database/backups/</code> 폴더에 저장됩니다. 최대 30개 보관 후 자동 삭제됩니다.
        </div>
        <div class="table-container" id="bk-table-wrap">${loadingHTML()}</div>
      </div>
    `;

    document.getElementById('bk-create-btn').onclick = async () => {
      try {
        await API.post('/backup/create');
        showToast('백업 생성이 시작되었습니다. 잠시 후 목록을 확인하세요.', 'info');
        setTimeout(() => loadData(), 2000);
      } catch (err) { showToast(err.message, 'error'); }
    };

    await loadData();
  }

  async function loadData() {
    const wrap = document.getElementById('bk-table-wrap');
    if (!wrap) return;
    try {
      const data = await API.get('/backup/list');

      if (!data.length) { wrap.innerHTML = emptyHTML('백업 이력이 없습니다', '지금 백업을 생성해보세요'); return; }

      wrap.innerHTML = `<div style="overflow-x:auto"><table>
        <thead><tr><th>파일명</th><th>유형</th><th>크기</th><th>생성일시</th><th>파일 존재</th><th></th></tr></thead>
        <tbody>${data.map(b => `
          <tr>
            <td class="mono" style="font-size:0.78rem">${b.filename}</td>
            <td><span class="badge ${b.type==='auto'?'badge-info':'badge-primary'}">${b.type==='auto'?'자동':'수동'}</span></td>
            <td class="num">${b.size_kb} KB</td>
            <td style="color:var(--text-muted)">${formatDateTime(b.created_at)}</td>
            <td>${b.exists ? '<span class="badge badge-success">있음</span>' : '<span class="badge badge-danger">없음</span>'}</td>
            <td class="table-actions">
              ${b.exists ? `<a class="btn btn-xs btn-secondary" href="/api/backup/download/${b.filename}" target="_blank">다운로드</a>` : ''}
              <button class="btn btn-xs btn-danger" onclick="Backup.delete('${b.filename}')">삭제</button>
            </td>
          </tr>`).join('')}
        </tbody>
      </table></div>`;
    } catch (err) { wrap.innerHTML = `<div class="alert alert-danger">${err.message}</div>`; }
  }

  async function del(filename) {
    confirmDialog(`백업 파일 <code style="font-family:monospace">${filename}</code>을 삭제하시겠습니까?`, async () => {
      try {
        await API.delete(`/backup/${filename}`);
        showToast('삭제되었습니다.', 'success');
        await loadData();
      } catch (err) { showToast(err.message, 'error'); }
    });
  }

  return { render, delete: del };
})();
window.Backup = Backup;
