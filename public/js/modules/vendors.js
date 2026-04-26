/* ─── Vendors Module ─── */
const Vendors = (() => {
  let _data = [];
  let _search = '';

  async function render() {
    const container = document.getElementById('page-container');
    container.innerHTML = `
      <div class="animate-fade">
        <div class="page-header">
          <div>
            <h2 class="page-title">거래처 마스터</h2>
            <p class="page-subtitle">거래처 코드, 결제조건, 담당자 정보 관리</p>
          </div>
          <button class="btn btn-secondary" id="ven-upload-btn">
            <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 11-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clip-rule="evenodd"/></svg>
            일괄 업로드
          </button>
          <button class="btn btn-primary" id="ven-add-btn">
            <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd"/></svg>
            거래처 등록
          </button>
        </div>
        <div class="filter-bar">
          <div class="search-input" style="max-width:280px">
            <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd"/></svg>
            <input type="text" id="ven-search" placeholder="코드 또는 업체명 검색...">
          </div>
          <button class="btn btn-secondary" id="ven-reload">새로고침</button>
        </div>
        <div class="table-container" id="ven-table-wrap">${loadingHTML()}</div>
      </div>
    `;

    document.getElementById('ven-add-btn').onclick = () => openForm();
    document.getElementById('ven-upload-btn').onclick = () => showUploadModal('vendors', () => Router.navigate('vendors'));
    document.getElementById('ven-reload').onclick = () => loadData();
    document.getElementById('ven-search').oninput = (e) => { _search = e.target.value; loadData(); };
    await loadData();
  }

  async function loadData() {
    const wrap = document.getElementById('ven-table-wrap');
    if (!wrap) return;
    try {
      const params = _search ? `?search=${encodeURIComponent(_search)}` : '';
      _data = await API.get('/vendors' + params);
      renderTable();
    } catch (err) {
      wrap.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
    }
  }

  function renderTable() {
    const wrap = document.getElementById('ven-table-wrap');
    if (!wrap) return;
    if (!_data.length) { wrap.innerHTML = emptyHTML('등록된 거래처가 없습니다'); return; }

    const payTermColor = { '선급': 'badge-warning', '특정일자': 'badge-info', '익월말': 'badge-primary' };

    wrap.innerHTML = `<div style="overflow-x:auto"><table>
      <thead><tr>
        <th>거래처코드</th><th>업체명</th><th>구분</th><th>결제조건</th>
        <th>대표자</th><th>담당자</th><th>연락처</th><th>주소</th><th></th>
      </tr></thead>
      <tbody>${_data.map(v => `
        <tr>
          <td><span class="mono" style="color:var(--primary-light)">${v.code}</span></td>
          <td style="font-weight:600">${v.name}</td>
          <td><span class="badge badge-ghost">${v.type||'-'}</span></td>
          <td><span class="badge ${payTermColor[v.payment_terms]||'badge-ghost'}">${v.payment_terms||'-'}${v.payment_day?` (${v.payment_day}일)`:''}</span></td>
          <td>${v.ceo||'-'}</td>
          <td>${v.manager||'-'}</td>
          <td style="font-family:monospace">${v.phone||'-'}</td>
          <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text-muted)">${v.address||'-'}</td>
          <td class="table-actions">
            <button class="btn btn-xs btn-secondary" onclick="Vendors.openForm('${v.code}')">수정</button>
            <button class="btn btn-xs btn-danger" onclick="Vendors.delete('${v.code}','${v.name}')">삭제</button>
          </td>
        </tr>`).join('')}
      </tbody>
    </table></div>`;
  }

  async function openForm(code = null) {
    let v = {};
    if (code) { try { v = await API.get(`/vendors/${code}`); } catch {} }
    const isEdit = !!code;

    const html = `
      <div class="modal-header">
        <div class="modal-title">${isEdit ? '거래처 수정' : '거래처 등록'}</div>
        <button class="modal-close"><svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg></button>
      </div>
      <div class="modal-body">
        <form id="vendor-form" class="form-grid">
          <div class="form-group"><label>거래처코드 <span class="required">*</span></label>
            <input name="code" id="vf-code" value="${v.code||''}" placeholder="예: V001" ${isEdit?'readonly':''}>
          </div>
          <div class="form-group"><label>구분</label>
            <input name="type" id="vf-type" value="${v.type||''}" placeholder="예: 원자재">
          </div>
          <div class="form-group" style="grid-column:1/-1"><label>업체명 <span class="required">*</span></label>
            <input name="name" id="vf-name" value="${v.name||''}" placeholder="업체명">
          </div>
          <div class="form-group"><label>결제조건</label>
            <select name="payment_terms" id="vf-pay">
              ${['선급','특정일자','익월말'].map(t=>`<option value="${t}" ${v.payment_terms===t?'selected':''}>${t}</option>`).join('')}
            </select>
          </div>
          <div class="form-group"><label>결제일 (특정일자인 경우)</label>
            <input type="number" name="payment_day" id="vf-payday" value="${v.payment_day||''}" placeholder="예: 25" min="1" max="31">
          </div>
          <div class="form-group"><label>대표자</label><input name="ceo" id="vf-ceo" value="${v.ceo||''}" placeholder="대표자명"></div>
          <div class="form-group"><label>담당자</label><input name="manager" id="vf-mgr" value="${v.manager||''}" placeholder="담당자명"></div>
          <div class="form-group"><label>연락처</label><input name="phone" id="vf-phone" value="${v.phone||''}" placeholder="02-0000-0000"></div>
          <div class="form-group"><label>이메일</label><input name="email" id="vf-email" value="${v.email||''}" placeholder="example@company.com"></div>
          <div class="form-group"><label>사업자번호 <span class="required">*</span></label><input name="business_no" id="vf-bizno" value="${v.business_no||''}" placeholder="000-00-00000"></div>
          <div class="form-group" style="grid-column:1/-1"><label>주소</label>
            <input name="address" id="vf-addr" value="${v.address||''}" placeholder="주소">
          </div>
        </form>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal()">취소</button>
        <button class="btn btn-primary" id="ven-save-btn">${isEdit ? '수정 완료' : '등록'}</button>
      </div>
    `;
    openModal(html, 'modal-lg');
    const form = document.getElementById('vendor-form');
    if (!isEdit) FormPersistence.bind('vendor-add', form);

    document.getElementById('ven-save-btn').onclick = async () => {
      const body = {
        code: document.getElementById('vf-code').value.trim(),
        name: document.getElementById('vf-name').value.trim(),
        type: document.getElementById('vf-type').value.trim(),
        payment_terms: document.getElementById('vf-pay').value,
        payment_day: parseInt(document.getElementById('vf-payday').value) || null,
        ceo: document.getElementById('vf-ceo').value.trim(),
        manager: document.getElementById('vf-mgr').value.trim(),
        phone: document.getElementById('vf-phone').value.trim(),
        email: document.getElementById('vf-email').value.trim(),
        business_no: document.getElementById('vf-bizno').value.trim(),
        address: document.getElementById('vf-addr').value.trim(),
      };
      try {
        if (isEdit) await API.put(`/vendors/${code}`, body);
        else {
          await API.post('/vendors', body);
          FormPersistence.clear('vendor-add');
        }
        showToast(`거래처가 ${isEdit?'수정':'등록'}되었습니다.`, 'success');
        closeModal();
        await loadData();
      } catch (err) { showToast(err.message, 'error'); }
    };
  }

  async function del(code, name) {
    confirmDialog(`<strong>${name}</strong> (${code}) 거래처를 삭제하시겠습니까?`, async () => {
      try { await API.delete(`/vendors/${code}`); showToast('삭제되었습니다.', 'success'); await loadData(); }
      catch (err) { showToast(err.message, 'error'); }
    });
  }

  return { render, openForm, delete: del };
})();
window.Vendors = Vendors;
