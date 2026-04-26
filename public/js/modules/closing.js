/* ─── Closing Module ─── */
const Closing = (() => {
  let _data = [];

  async function render() {
    const user = getUser();
    const isAdmin = user?.role === 'admin';
    const container = document.getElementById('page-container');
    container.innerHTML = `
      <div class="animate-fade">
        <div class="page-header">
          <div>
            <h2 class="page-title">매입 마감 관리</h2>
            <p class="page-subtitle">월별 마감 처리 · 잠금 · 해제 (관리자 전용)</p>
          </div>
          ${isAdmin ? `<button class="btn btn-primary" id="cls-add-btn">+ 신규 마감 처리</button>` : ''}
        </div>
        ${!isAdmin ? `<div class="alert alert-warning">
          <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd"/></svg>
          마감 해제는 관리자만 가능합니다.
        </div>` : ''}
        <div class="table-container" id="cls-table-wrap">${loadingHTML()}</div>
      </div>
    `;

    if (isAdmin) document.getElementById('cls-add-btn').onclick = () => openCloseForm();
    await loadData();
  }

  async function loadData() {
    const wrap = document.getElementById('cls-table-wrap');
    if (!wrap) return;
    try {
      _data = await API.get('/closing');
      renderTable();
    } catch (err) { wrap.innerHTML = `<div class="alert alert-danger">${err.message}</div>`; }
  }

  function renderTable() {
    const wrap = document.getElementById('cls-table-wrap');
    if (!wrap) return;
    const user = getUser();
    const isAdmin = user?.role === 'admin';

    if (!_data.length) {
      wrap.innerHTML = emptyHTML('마감 이력이 없습니다', '신규 마감 처리를 실행하세요');
      return;
    }

    wrap.innerHTML = `<div style="overflow-x:auto"><table>
      <thead><tr>
        <th>마감월</th><th>상태</th><th>입고 전표</th><th>이동 전표</th>
        <th>마감 처리일시</th><th>처리자</th><th>비고</th><th></th>
      </tr></thead>
      <tbody>${_data.map(p => `
        <tr>
          <td><span class="mono" style="font-size:0.95rem;font-weight:700;color:var(--primary-light)">${p.month}</span></td>
          <td>
            ${p.status === 'closed'
              ? `<span class="lock-badge lock-badge-locked"><svg viewBox="0 0 20 20" fill="currentColor" style="width:11px;height:11px"><path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd"/></svg>마감완료</span>`
              : `<span class="lock-badge lock-badge-open">개방</span>`}
          </td>
          <td class="num">${p.receipt_count}건</td>
          <td class="num">${p.movement_count}건</td>
          <td style="color:var(--text-muted);font-size:0.8rem">${formatDateTime(p.locked_at)||'-'}</td>
          <td>${p.locked_by||'-'}</td>
          <td style="color:var(--text-muted);font-size:0.8rem">${p.notes||'-'}</td>
          <td class="table-actions">
            ${isAdmin && p.status === 'closed' ? `<button class="btn btn-xs btn-warning" onclick="Closing.unlock('${p.month}')">잠금 해제</button>` : ''}
            ${isAdmin && p.status === 'open' ? `<button class="btn btn-xs btn-danger" onclick="Closing.relock('${p.month}')">재잠금</button>` : ''}
          </td>
        </tr>`).join('')}
      </tbody>
    </table></div>`;
  }

  function openCloseForm() {
    // Suggest next month to close
    const prev = new Date();
    prev.setMonth(prev.getMonth() - 1);
    const suggestedMonth = prev.toISOString().slice(0, 7);

    const html = `
      <div class="modal-header">
        <div class="modal-title">
          <svg viewBox="0 0 20 20" fill="currentColor" style="color:var(--warning)"><path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd"/></svg>
          신규 마감 처리
        </div>
        <button class="modal-close"><svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg></button>
      </div>
      <div class="modal-body">
        <div class="alert alert-warning">
          <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92z" clip-rule="evenodd"/></svg>
          마감 처리 후 해당 월의 전표는 수정/삭제가 제한됩니다. 미확정 전표가 없는지 확인하세요.
        </div>
        <div class="form-grid">
          <div class="form-group"><label>마감월 (YYYY-MM) <span class="required">*</span></label>
            <input type="month" id="clf-month" value="${suggestedMonth}">
          </div>
          <div class="form-group"><label>비고</label>
            <input id="clf-notes" placeholder="마감 사유 또는 메모">
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal()">취소</button>
        <button class="btn btn-danger" id="clf-save">마감 실행</button>
      </div>
    `;
    openModal(html);

    document.getElementById('clf-save').onclick = async () => {
      const month = document.getElementById('clf-month').value;
      const notes = document.getElementById('clf-notes').value;
      if (!month) { showToast('마감월을 선택해주세요.', 'warning'); return; }

      confirmDialog(`<strong>${month}</strong> 마감을 실행하시겠습니까?<br>해당 기간의 모든 전표가 잠금됩니다.`, async () => {
        try {
          await API.post('/closing', { month, notes });
          showToast(`${month} 마감이 완료되었습니다.`, 'success');
          closeModal();
          await loadData();
        } catch (err) { showToast(err.message, 'error'); }
      });
    };
  }

  async function unlock(month) {
    const html = `
      <div class="modal-header">
        <div class="modal-title" style="color:var(--warning)">마감 잠금 해제 — ${month}</div>
        <button class="modal-close"><svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg></button>
      </div>
      <div class="modal-body">
        <div class="alert alert-danger">
          <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92z" clip-rule="evenodd"/></svg>
          관리자 전용 기능입니다. 잠금 해제 사유를 반드시 기록하세요.
        </div>
        <div class="form-group">
          <label>잠금 해제 사유 <span class="required">*</span></label>
          <textarea id="unlock-reason" placeholder="잠금 해제 사유를 입력하세요..." rows="3"></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal()">취소</button>
        <button class="btn btn-danger" id="unlock-btn">잠금 해제 실행</button>
      </div>
    `;
    openModal(html);

    document.getElementById('unlock-btn').onclick = async () => {
      const reason = document.getElementById('unlock-reason').value.trim();
      if (!reason) { showToast('잠금 해제 사유를 입력해주세요.', 'warning'); return; }
      try {
        await API.put(`/closing/${month}/unlock`, { reason });
        showToast(`${month} 잠금이 해제되었습니다.`, 'success');
        closeModal();
        await loadData();
      } catch (err) { showToast(err.message, 'error'); }
    };
  }

  async function relock(month) {
    confirmDialog(`<strong>${month}</strong>을 다시 잠금하시겠습니까?`, async () => {
      try {
        await API.put(`/closing/${month}/relock`);
        showToast(`${month} 재잠금 완료.`, 'success');
        await loadData();
      } catch (err) { showToast(err.message, 'error'); }
    });
  }

  return { render, unlock, relock };
})();
window.Closing = Closing;
