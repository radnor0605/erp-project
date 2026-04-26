/* ─── Warehouses Module ─── */
const Warehouses = (() => {

  async function render() {
    const container = document.getElementById('page-container');
    container.innerHTML = `
      <div class="animate-fade">
        <div class="page-header">
          <div>
            <h2 class="page-title">창고 관리</h2>
            <p class="page-subtitle">입고 기준 창고 마스터 — 코드·위치·담당자·수용량</p>
          </div>
          <button class="btn btn-primary" id="wh-add-btn">+ 창고 등록</button>
        </div>
        <div class="table-container" id="wh-table-wrap">${loadingHTML()}</div>
      </div>`;

    document.getElementById('wh-add-btn').onclick = () => openForm();
    await loadData();
  }

  async function loadData() {
    const wrap = document.getElementById('wh-table-wrap');
    if (!wrap) return;
    try {
      const data = await API.get('/warehouses?active=0');
      if (!data.length) { wrap.innerHTML = emptyHTML('등록된 창고가 없습니다'); return; }

      wrap.innerHTML = `<div style="overflow-x:auto"><table>
        <thead><tr>
          <th>코드</th><th>창고명</th><th>위치</th><th>담당자</th><th>연락처</th><th>수용량</th><th>상태</th><th>비고</th><th></th>
        </tr></thead>
        <tbody>${data.map(w => `
          <tr style="${!w.is_active?'opacity:0.5':''}">
            <td class="mono">${w.code}</td>
            <td style="font-weight:600">${w.name}</td>
            <td>${w.location||'-'}</td>
            <td>${w.manager||'-'}</td>
            <td class="mono">${w.phone||'-'}</td>
            <td>${w.capacity||'-'}</td>
            <td>${w.is_active
              ? '<span class="badge badge-success">운영중</span>'
              : '<span class="badge badge-secondary">비활성</span>'}</td>
            <td style="color:var(--text-muted);font-size:0.8rem">${w.notes||''}</td>
            <td class="table-actions">
              <button class="btn btn-xs btn-secondary" onclick="Warehouses.openForm('${w.code}')">수정</button>
              ${w.is_active
                ? `<button class="btn btn-xs btn-danger" onclick="Warehouses.deactivate('${w.code}','${w.name}')">비활성화</button>`
                : `<button class="btn btn-xs btn-secondary" onclick="Warehouses.activate('${w.code}')">활성화</button>`}
            </td>
          </tr>`).join('')}
        </tbody></table></div>`;
    } catch (err) { wrap.innerHTML = `<div class="alert alert-danger">${err.message}</div>`; }
  }

  async function openForm(code = null) {
    let wh = {};
    if (code) {
      try { wh = await API.get(`/warehouses/${code}`); } catch { showToast('창고 조회 실패', 'error'); return; }
    }

    const html = `
      <div class="modal-header">
        <div class="modal-title">${code ? '창고 수정' : '창고 등록'}</div>
        <button class="modal-close"><svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg></button>
      </div>
      <div class="modal-body">
        <div class="form-grid">
          <div class="form-group"><label>창고코드 <span class="required">*</span></label>
            <input id="whf-code" value="${wh.code||''}" placeholder="예: WH-004" ${code?'readonly':''}>
          </div>
          <div class="form-group"><label>창고명 <span class="required">*</span></label>
            <input id="whf-name" value="${wh.name||''}" placeholder="예: 3창고">
          </div>
          <div class="form-group" style="grid-column:1/-1"><label>위치</label>
            <input id="whf-loc" value="${wh.location||''}" placeholder="예: 본사 3층 A동">
          </div>
          <div class="form-group"><label>담당자</label>
            <input id="whf-mgr" value="${wh.manager||''}" placeholder="담당자명">
          </div>
          <div class="form-group"><label>담당자 연락처</label>
            <input id="whf-phone" value="${wh.phone||''}" placeholder="010-0000-0000">
          </div>
          <div class="form-group"><label>수용량</label>
            <input id="whf-cap" value="${wh.capacity||''}" placeholder="예: 500 팔레트">
          </div>
          <div class="form-group" style="grid-column:1/-1"><label>비고</label>
            <input id="whf-notes" value="${wh.notes||''}" placeholder="특이사항">
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal()">취소</button>
        <button class="btn btn-primary" id="whf-save">${code ? '수정' : '등록'}</button>
      </div>`;
    openModal(html);

    document.getElementById('whf-save').onclick = async () => {
      const body = {
        code: document.getElementById('whf-code').value.trim(),
        name: document.getElementById('whf-name').value.trim(),
        location: document.getElementById('whf-loc').value.trim(),
        manager: document.getElementById('whf-mgr').value.trim(),
        phone: document.getElementById('whf-phone').value.trim(),
        capacity: document.getElementById('whf-cap').value.trim(),
        notes: document.getElementById('whf-notes').value.trim(),
      };
      if (!body.code || !body.name) { showToast('코드와 창고명은 필수입니다.', 'warning'); return; }
      try {
        if (code) await API.put(`/warehouses/${code}`, body);
        else await API.post('/warehouses', body);
        showToast(`창고가 ${code?'수정':'등록'}되었습니다.`, 'success');
        closeModal();
        await loadData();
      } catch (err) { showToast(err.message, 'error'); }
    };
  }

  async function deactivate(code, name) {
    confirmDialog(`<strong>${name}</strong> 창고를 비활성화하시겠습니까?`, async () => {
      try {
        await API.delete(`/warehouses/${code}`);
        showToast('비활성화되었습니다.', 'success');
        await loadData();
      } catch (err) { showToast(err.message, 'error'); }
    });
  }

  async function activate(code) {
    try {
      await API.put(`/warehouses/${code}`, { is_active: 1 });
      showToast('활성화되었습니다.', 'success');
      await loadData();
    } catch (err) { showToast(err.message, 'error'); }
  }

  return { render, openForm, deactivate, activate };
})();
window.Warehouses = Warehouses;
