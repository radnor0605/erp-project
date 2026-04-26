/* ─── Partners Module (V9.0) ─── */
const Partners = (() => {
  let _data = [];
  let _filterType = 'all'; // all, vendor, customer, both
  let _search = '';

  function reset() {
    _filterType = 'all';
    _search = '';
  }

  async function render() {
    const container = document.getElementById('page-container');
    container.innerHTML = `
      <div class="animate-fade">
        <div class="page-header">
          <div>
            <h2 class="page-title">파트너 통합 관리</h2>
            <p class="page-subtitle">매입처(Vendor) 및 매출처(Customer) 통합 관리 시스템</p>
          </div>
          <div class="header-actions">
            <button class="btn btn-secondary" id="part-upload-btn">
              <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 11-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clip-rule="evenodd"/></svg>
              일괄 업로드
            </button>
            <button class="btn btn-primary" id="part-add-btn">
              <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd"/></svg>
              신규 파트너 등록
            </button>
          </div>
        </div>

        <div class="filter-bar partners-filter">
          <div class="search-input" style="max-width:300px">
            <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd"/></svg>
            <input type="text" id="part-search" placeholder="업체명, 코드, 사업자번호 검색..." value="${_search}">
          </div>
          <div class="segmented-control" id="part-type-filter">
            <button class="seg-item ${_filterType==='all'?'active':''}" data-value="all">전체</button>
            <button class="seg-item ${_filterType==='vendor'?'active':''}" data-value="vendor">매입처</button>
            <button class="seg-item ${_filterType==='customer'?'active':''}" data-value="customer">매출처</button>
            <button class="seg-item ${_filterType==='both'?'active':''}" data-value="both">혼합(Both)</button>
          </div>
          <button class="btn btn-secondary" id="part-reload">새로고침</button>
          <button class="btn btn-secondary" id="part-scan-btn" title="폴더 스캔 실행">
            <svg viewBox="0 0 20 20" fill="currentColor" style="width:14px;height:14px;margin-right:4px"><path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"/></svg>
            폴더 스캔
          </button>
        </div>

        <div class="table-container" id="part-table-wrap">${loadingHTML()}</div>
      </div>
    `;

    document.getElementById('part-add-btn').onclick = () => openForm();
    document.getElementById('part-upload-btn').onclick = () => showUploadModal('partners', () => loadData());
    document.getElementById('part-reload').onclick = () => loadData();
    document.getElementById('part-scan-btn').onclick = () => triggerScan('part-scan-btn', loadData, 'suppliers');
    document.getElementById('part-search').oninput = (e) => { _search = e.target.value; loadData(); };
    
    document.querySelectorAll('#part-type-filter .seg-item').forEach(btn => {
      btn.onclick = () => {
        _filterType = btn.dataset.value;
        render(); // Re-render to update UI state
      };
    });

    await loadData();
  }

  async function loadData() {
    const wrap = document.getElementById('part-table-wrap');
    if (!wrap) return;
    try {
      const params = new URLSearchParams();
      if (_filterType !== 'all') params.set('type', _filterType);
      if (_search) params.set('search', _search);
      _data = await API.get('/partners?' + params.toString());
      renderTable();
    } catch (err) {
      wrap.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
    }
  }

  function renderTable() {
    const wrap = document.getElementById('part-table-wrap');
    if (!wrap) return;
    if (!_data.length) { wrap.innerHTML = emptyHTML('등록된 파트너가 없습니다'); return; }

    const typeLabels = { vendor: '매입', customer: '매출', both: '혼합' };
    const typeColors = { vendor: 'badge-info', customer: 'badge-success', both: 'badge-primary' };

    wrap.innerHTML = `
      <div class="table-responsive">
        <table class="table">
          <thead>
            <tr>
              <th>구분</th><th>코드/업체명</th><th>사업자번호</th><th>대표/담당자</th><th>연락처</th><th>결제/여신</th><th>통합원장</th><th>작업</th>
            </tr>
          </thead>
          <tbody>
            ${_data.map(p => {
              const isCollateralWarning = p.collateral_expiry && (new Date(p.collateral_expiry) <= new Date(Date.now() + 7*24*60*60*1000));
              return `
                <tr>
                  <td data-label="구분"><span class="badge ${typeColors[p.partner_type]}">${typeLabels[p.partner_type]}</span></td>
                  <td data-label="코드/업체명">
                    <div style="font-weight:600">${p.name}</div>
                    <div class="mono" style="font-size:0.7rem;color:var(--text-muted)">${p.code}</div>
                  </td>
                  <td data-label="사업자번호" class="mono">${p.business_no}</td>
                  <td data-label="대표/담당자">
                    <div>${p.ceo || '-'}</div>
                    <div style="font-size:0.75rem;color:var(--text-secondary)">${p.manager || '-'}</div>
                  </td>
                  <td data-label="연락처">${p.phone || p.contact || '-'}</td>
                  <td data-label="결제/여신">
                    <div style="font-size:0.75rem">${p.payment_terms || '-'}</div>
                    <div style="font-weight:600;color:var(--primary)">${p.credit_limit > 0 ? formatCurrency(p.credit_limit) : ''}</div>
                    ${isCollateralWarning ? `<div class="status-tag status-danger" style="font-size:0.6rem">담보만료임박</div>` : ''}
                  </td>
                  <td data-label="SCM 지표">
                    <div style="font-size:0.7rem;color:var(--text-muted)">평균 납기</div>
                    <div style="font-weight:700;color:var(--success)">${p.avg_lead_time ? p.avg_lead_time + '일' : '-'}</div>
                  </td>
                  <td data-label="통합원장">
                    <button class="btn btn-xs btn-outline-primary" onclick="Partners.openLedger('${p.code}')">원장보기</button>
                  </td>
                  <td data-label="작업" class="table-actions">
                    <button class="btn btn-xs btn-secondary" onclick="Partners.openForm('${p.code}')">수정</button>
                    <button class="btn btn-xs btn-danger" onclick="Partners.delete('${p.code}','${p.name}')">삭제</button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  async function openForm(code = null) {
    let p = { partner_type: 'vendor', credit_limit: 0 };
    if (code) { p = await API.get(`/partners/${code}`); }

    const isEdit = !!code;
    const html = `
      <div class="modal-header">
        <div class="modal-title">${isEdit ? '파트너 정보 수정' : '신규 파트너 등록'}</div>
        <button class="modal-close">×</button>
      </div>
      <div class="modal-body">
        <form id="partner-form">
          <div class="form-grid">
            <div class="form-group"><label>업체코드 <span class="required">*</span></label>
              <input name="code" id="p-code" value="${p.code||''}" ${isEdit?'readonly':''} required placeholder="예: P001">
            </div>
            <div class="form-group"><label>구분 <span class="required">*</span></label>
              <select name="partner_type">
                <option value="vendor" ${p.partner_type==='vendor'?'selected':''}>매입처 (Vendor)</option>
                <option value="customer" ${p.partner_type==='customer'?'selected':''}>매출처 (Customer)</option>
                <option value="both" ${p.partner_type==='both'?'selected':''}>혼합 (Both)</option>
              </select>
            </div>
            <div class="form-group" style="grid-column: span 2"><label>업체명 <span class="required">*</span></label>
              <input name="name" value="${p.name||''}" required placeholder="(주)상사명">
            </div>
            <div class="form-group"><label>사업자번호 <span class="required">*</span></label>
              <input name="business_no" value="${p.business_no||''}" required placeholder="000-00-00000">
            </div>
            <div class="form-group"><label>대표자</label><input name="ceo" value="${p.ceo||''}"></div>
            <div class="form-group"><label>담당자</label><input name="manager" value="${p.manager||''}"></div>
            <div class="form-group"><label>대표 연락처</label><input name="phone" value="${p.phone||''}"></div>
            <div class="form-group"><label>담당자 직업/연락처</label><input name="contact" value="${p.contact||''}"></div>
            <div class="form-group"><label>이메일</label><input name="email" value="${p.email||''}"></div>
            <div class="form-group" style="grid-column: span 2">
              <label>주소</label>
              <div style="display:flex; gap:8px">
                <input name="address" id="p-address" value="${p.address||''}" placeholder="주소 검색을 이용해주세요" style="flex:1">
                <button type="button" class="btn btn-secondary btn-sm" id="p-search-addr">주소 검색</button>
              </div>
            </div>
            <div class="form-group"><label>여신한도</label><input type="number" name="credit_limit" value="${p.credit_limit || (isEdit ? 0 : 1000000)}"></div>
            <div class="form-group"><label>담보만료일</label><input type="date" name="collateral_expiry" value="${p.collateral_expiry||''}"></div>
            <div class="form-group"><label>결제조건</label>
              <select name="payment_terms" id="p-pay-terms">
                <option value="익월말" ${p.payment_terms==='익월말'?'selected':''}>익월말</option>
                <option value="당월말" ${p.payment_terms==='당월말'?'selected':''}>당월말</option>
                <option value="선급" ${p.payment_terms==='선급'?'selected':''}>선급</option>
                <option value="마감 후 60일" ${p.payment_terms==='마감 후 60일'?'selected':''}>마감 후 60일</option>
                <option value="라이선스 발급 전 입금" ${p.payment_terms==='라이선스 발급 전 입금'?'selected':''}>라이선스 발급 전 입금</option>
                <option value="COD" ${p.payment_terms==='COD'?'selected':''}>현금 결제 (COD)</option>
                <option value="별도" ${p.payment_terms==='별도'?'selected':''}>별도 (직접 입력)</option>
              </select>
            </div>
            <div class="form-group"><label>결제일 (숫자)</label><input type="number" name="payment_day" id="p-pay-day" value="${p.payment_day||''}" placeholder="예: 25"></div>
          </div>
        </form>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal()">취소</button>
        <button class="btn btn-primary" id="part-save-btn">저장하기</button>
      </div>
    `;
    openModal(html, 'max-width:700px');
    const form = document.getElementById('partner-form');
    if (!isEdit) FormPersistence.bind('partner-add', form);

    // Conditional Payment Day
    const termSelect = document.getElementById('p-pay-terms');
    const dayInput = document.getElementById('p-pay-day');
    const updateDayInput = () => {
      const val = termSelect.value;
      const needsDay = val === '별도' || val === '마감 후 60일';
      dayInput.disabled = !needsDay;
      if (!needsDay) dayInput.value = '';
    };
    termSelect.onchange = updateDayInput;
    updateDayInput();

    // Masking
    const bizInput = document.querySelector('input[name="business_no"]');
    const phoneInput = document.querySelector('input[name="phone"]');
    
    bizInput.oninput = (e) => {
      let val = e.target.value.replace(/[^0-9]/g, '');
      if (val.length > 10) val = val.slice(0, 10);
      if (val.length > 5) val = val.slice(0, 3) + '-' + val.slice(3, 5) + '-' + val.slice(5);
      else if (val.length > 3) val = val.slice(0, 3) + '-' + val.slice(3);
      e.target.value = val;
    };

    phoneInput.oninput = (e) => {
      let val = e.target.value.replace(/[^0-9]/g, '');
      if (val.length > 11) val = val.slice(0, 11);
      if (val.startsWith('02')) {
        if (val.length > 9) val = val.slice(0, 2) + '-' + val.slice(2, 6) + '-' + val.slice(6);
        else if (val.length > 5) val = val.slice(0, 2) + '-' + val.slice(2, 5) + '-' + val.slice(5);
        else if (val.length > 2) val = val.slice(0, 2) + '-' + val.slice(2);
      } else {
        if (val.length > 10) val = val.slice(0, 3) + '-' + val.slice(3, 7) + '-' + val.slice(7);
        else if (val.length > 6) val = val.slice(0, 3) + '-' + val.slice(3, 6) + '-' + val.slice(6);
        else if (val.length > 3) val = val.slice(0, 3) + '-' + val.slice(3);
      }
      e.target.value = val;
    };

    // Address Search
    document.getElementById('p-search-addr').onclick = () => {
      new daum.Postcode({
        oncomplete: function(data) {
          let addr = '';
          if (data.userSelectedType === 'R') addr = data.roadAddress;
          else addr = data.jibunAddress;
          document.getElementById('p-address').value = `(${data.zonecode}) ${addr} `;
          document.getElementById('p-address').focus();
        }
      }).open();
    };

    document.getElementById('part-save-btn').onclick = async () => {
      const data = Object.fromEntries(new FormData(document.getElementById('partner-form')));
      
      if (!data.code || !data.name || !data.business_no) {
        alert('업체코드, 업체명, 사업자번호는 필수 입력 항목입니다.');
        return;
      }
      
      try {
        if (isEdit) await API.put(`/partners/${code}`, data);
        else {
          await API.post('/partners', data);
          FormPersistence.clear('partner-add');
        }
        showToast('파트너 정보가 저장되었습니다.', 'success');
        closeModal();
        await loadData();
      } catch (err) { showToast(err.message, 'error'); }
    };
  }

  async function openLedger(code) {
    const res = await API.get(`/partners/${code}/ledger`);
    const { summary, ledger } = res;
    const html = `
      <div class="modal-header">
        <div class="modal-title">통합 원장 조회 (Net Ledger) - ${code}</div>
        <button class="modal-close">×</button>
      </div>
      <div class="modal-body">
        <div class="ledger-summary" style="display:grid; grid-template-columns: repeat(3, 1fr); gap:12px; margin-bottom:20px;">
          <div class="card p-3 text-center" style="background:rgba(239,68,68,0.05)">
            <div style="font-size:0.75rem; color:var(--danger)">미지급금 (AP)</div>
            <div style="font-size:1.2rem; font-weight:700">${formatCurrency(summary.total_ap)}</div>
          </div>
          <div class="card p-3 text-center" style="background:rgba(16,185,129,0.05)">
            <div style="font-size:0.75rem; color:var(--success)">미수금 (AR)</div>
            <div style="font-size:1.2rem; font-weight:700">${formatCurrency(summary.total_ar)}</div>
          </div>
          <div class="card p-3 text-center" style="background:rgba(59,130,246,0.1)">
            <div style="font-size:0.75rem; color:var(--primary)">상계 후 잔액</div>
            <div style="font-size:1.2rem; font-weight:700; color:${summary.net_balance >= 0 ? 'var(--success)' : 'var(--danger)'}">
              ${formatCurrency(summary.net_balance)}
            </div>
          </div>
        </div>
        
        <div class="table-responsive" style="max-height:400px; overflow-y:auto;">
          <table class="table table-sm">
            <thead>
              <tr><th>일자</th><th>구분</th><th>참조번호</th><th>상세</th><th>금액</th></tr>
            </thead>
            <tbody>
              ${ledger.map(row => `
                <tr>
                  <td>${row.date}</td>
                  <td><span class="badge ${row.type==='AR'?'badge-success':'badge-danger'}">${row.type}</span></td>
                  <td class="mono">${row.ref_no}</td>
                  <td>${row.description}</td>
                  <td class="text-right font-bold">${formatCurrency(row.amount)}</td>
                </tr>
              `).join('')}
              ${!ledger.length ? '<tr><td colspan="5" class="text-center p-4">미결제 거래 내역이 없습니다.</td></tr>' : ''}
            </tbody>
          </table>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary modal-close">닫기</button>
        <button class="btn btn-primary" onclick="window.print()">원장 출력</button>
      </div>
    `;
    openModal(html, 'max-width:850px');
  }

  async function del(code, name) {
    confirmDialog(`<strong>${name}</strong> (${code}) 파트너를 삭제하시겠습니까?`, async () => {
      try {
        await API.delete(`/partners/${code}`);
        showToast('삭제되었습니다.', 'success');
        await loadData();
      } catch (err) { showToast(err.message, 'error'); }
    });
  }

  return { render, openForm, openLedger, delete: del, reset };
})();
window.Partners = Partners;
