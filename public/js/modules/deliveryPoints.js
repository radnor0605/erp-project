/* ─── Delivery Points Module ─── */
const DeliveryPoints = (() => {
  let _partners = [];
  let _warehouses = [];
  let _selectedVendor = '';

  async function render() {
    const container = document.getElementById('page-container');
    [_partners, _warehouses] = await Promise.all([
      API.get('/partners?type=vendor').catch(() => []),
      API.get('/warehouses').catch(() => []),
    ]);

    container.innerHTML = `
      <div class="animate-fade">
        <div class="page-header">
          <div>
            <h2 class="page-title">입고지 관리</h2>
            <p class="page-subtitle">업체별 다수 입고지 1:N — 예상 리드타임(L/T) 포함</p>
          </div>
          <button class="btn btn-primary" id="dp-add-btn">+ 입고지 등록</button>
        </div>
        <div class="filter-bar">
          <select id="dp-vendor-sel" style="width:260px">
            <option value="">전체 업체</option>
            ${_partners.map(p=>`<option value="${p.code}" ${_selectedVendor===p.code?'selected':''}>${p.name} (${p.code})</option>`).join('')}
          </select>
          <button class="btn btn-secondary" id="dp-search-btn">조회</button>
        </div>
        <div class="table-container" id="dp-table-wrap">${loadingHTML()}</div>
      </div>`;

    document.getElementById('dp-add-btn').onclick = () => openForm();
    document.getElementById('dp-search-btn').onclick = () => {
      _selectedVendor = document.getElementById('dp-vendor-sel').value;
      loadData();
    };
    await loadData();
  }

  async function loadData() {
    const wrap = document.getElementById('dp-table-wrap');
    if (!wrap) return;
    try {
      const params = _selectedVendor ? `?vendorCode=${_selectedVendor}` : '';
      const data = await API.get('/delivery-points' + params);

      if (!data.length) { wrap.innerHTML = emptyHTML('입고지가 없습니다'); return; }

      wrap.innerHTML = `<div style="overflow-x:auto"><table>
        <thead><tr>
          <th>업체</th><th>입고지명</th><th>수령 창고</th><th>주소</th><th>담당자</th>
          <th style="text-align:center">L/T(일)</th><th style="text-align:center">기본</th><th></th>
        </tr></thead>
        <tbody>${data.map(dp => `
          <tr>
            <td style="color:var(--text-muted);font-size:0.85rem">${dp.vendor_name||dp.vendor_code}</td>
            <td style="font-weight:600">${dp.name}</td>
            <td><span class="badge badge-secondary">${dp.warehouse_name||dp.warehouse_code||'WH-001'}</span></td>
            <td>${dp.address||'-'}</td>
            <td class="mono">${dp.contact||'-'}</td>
            <td style="text-align:center">${dp.lead_time_days > 0
              ? `<span class="badge badge-primary">${dp.lead_time_days}일</span>`
              : '<span style="color:var(--text-muted)">-</span>'}</td>
            <td style="text-align:center">${dp.is_default
              ? '<span class="badge badge-success">기본</span>'
              : '-'}</td>
            <td class="table-actions">
              <button class="btn btn-xs btn-secondary" onclick="DeliveryPoints.openForm('${dp.id}','${dp.vendor_code}')">수정</button>
              <button class="btn btn-xs btn-danger" onclick="DeliveryPoints.delete('${dp.id}','${dp.name}')">삭제</button>
            </td>
          </tr>`).join('')}
        </tbody></table></div>`;
    } catch (err) { wrap.innerHTML = `<div class="alert alert-danger">${err.message}</div>`; }
  }

  async function openForm(id = null, vendorCode = '') {
    let dp = {};
    if (id) {
      try { dp = await API.get(`/delivery-points/${id}`); } catch { showToast('입고지 조회 실패', 'error'); return; }
    }

    const whOptions = _warehouses.map(w =>
      `<option value="${w.code}" ${(dp.warehouse_code||'WH-001')===w.code?'selected':''}>${w.name} (${w.code})</option>`
    ).join('');

    const html = `
      <div class="modal-header">
        <div class="modal-title">${id ? '입고지 수정' : '입고지 등록'}</div>
        <button class="modal-close"><svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg></button>
      </div>
      <div class="modal-body">
        <div class="form-grid">
          <div class="form-group"><label>업체 <span class="required">*</span></label>
            <select id="dpf-vendor">
              <option value="">선택</option>
              ${_partners.map(p=>`<option value="${p.code}" ${(dp.vendor_code||vendorCode)===p.code?'selected':''}>${p.name} (${p.code})</option>`).join('')}
            </select>
          </div>
          <div class="form-group"><label>입고지명 <span class="required">*</span></label>
            <input id="dpf-name" value="${dp.name||''}" placeholder="예: 서울 본사 로딩베이">
          </div>
          <div class="form-group"><label>수령 창고</label>
            <select id="dpf-wh">${whOptions}</select>
          </div>
          <div class="form-group"><label>예상 L/T (일)</label>
            <input id="dpf-lt" type="number" min="0" value="${dp.lead_time_days||0}" placeholder="0">
          </div>
          <div class="form-group" style="grid-column:1/-1"><label>주소</label>
            <input id="dpf-addr" value="${dp.address||''}" placeholder="납품처 주소">
          </div>
          <div class="form-group"><label>담당자 연락처</label>
            <input id="dpf-contact" value="${dp.contact||''}" placeholder="010-0000-0000">
          </div>
          <div class="form-group"><label>비고</label>
            <input id="dpf-notes" value="${dp.notes||''}" placeholder="배송 특이사항">
          </div>
          <div class="form-group" style="display:flex;align-items:center;gap:8px;padding-top:20px">
            <input type="checkbox" id="dpf-default" style="width:auto;margin:0" ${dp.is_default?'checked':''}>
            <label for="dpf-default" style="margin:0">기본 입고지로 설정</label>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal()">취소</button>
        <button class="btn btn-primary" id="dpf-save">${id ? '수정' : '등록'}</button>
      </div>`;
    openModal(html);

    document.getElementById('dpf-save').onclick = async () => {
      const vendor_code = document.getElementById('dpf-vendor').value;
      const name = document.getElementById('dpf-name').value.trim();
      if (!vendor_code || !name) { showToast('업체와 입고지명은 필수입니다.', 'warning'); return; }

      const body = {
        vendor_code,
        name,
        warehouse_code: document.getElementById('dpf-wh').value,
        lead_time_days: parseInt(document.getElementById('dpf-lt').value) || 0,
        address: document.getElementById('dpf-addr').value,
        contact: document.getElementById('dpf-contact').value,
        notes: document.getElementById('dpf-notes').value,
        is_default: document.getElementById('dpf-default').checked,
      };

      try {
        if (id) await API.put(`/delivery-points/${id}`, body);
        else await API.post('/delivery-points', body);
        showToast(`입고지가 ${id?'수정':'등록'}되었습니다.`, 'success');
        closeModal();
        await loadData();
      } catch (err) { showToast(err.message, 'error'); }
    };
  }

  async function del(id, name) {
    confirmDialog(`<strong>${name}</strong> 입고지를 삭제하시겠습니까?`, async () => {
      try { await API.delete(`/delivery-points/${id}`); showToast('삭제되었습니다.', 'success'); await loadData(); }
      catch (err) { showToast(err.message, 'error'); }
    });
  }

  return { render, openForm, delete: del };
})();
window.DeliveryPoints = DeliveryPoints;
