/* ─── Returns Module (반품 관리) v1.0 ─── */
const Returns = (() => {
  const REASON_LABELS = { '불량':'불량', '단순변심':'단순변심', '오배송':'오배송', '수량초과':'수량초과', '파손':'파손', '기타':'기타' };
  const STATUS_BADGE = {
    draft:    '<span class="badge badge-ghost">초안</span>',
    approved: '<span class="badge badge-warning">승인(보류)</span>',
    closed:   '<span class="badge badge-success">완료</span>',
  };
  const DISPOSITION_BADGE = {
    hold:      '<span style="color:var(--danger);font-size:0.78rem">⚠보류</span>',
    available: '<span style="color:var(--success);font-size:0.78rem">✓가용화</span>',
    scrap:     '<span style="color:var(--text-muted);font-size:0.78rem">🗑폐기</span>',
    resend:    '<span style="color:var(--warning);font-size:0.78rem">↩반송</span>',
  };

  async function render() {
    const container = document.getElementById('page-container');
    container.innerHTML = `
      <div class="animate-fade">
        <div class="page-header">
          <div>
            <h2 class="page-title">반품 관리</h2>
            <p class="page-subtitle">영업/구매 반품 전표 및 보류재고 처리</p>
          </div>
          <div class="header-actions">
            <button class="btn btn-primary" id="ret-new-btn">+ 반품 전표 등록</button>
          </div>
        </div>
        <div class="filter-bar">
          <select id="ret-type" style="width:110px">
            <option value="">전체 유형</option>
            <option value="sales">영업 반품</option>
            <option value="purchase">구매 반품</option>
          </select>
          <select id="ret-status" style="width:110px">
            <option value="">전체 상태</option>
            <option value="draft">초안</option>
            <option value="approved">승인(보류)</option>
            <option value="closed">완료</option>
          </select>
          <button class="btn btn-secondary" id="ret-search-btn">조회</button>
        </div>
        <div class="table-container" id="ret-table-wrap">${loadingHTML()}</div>
      </div>`;

    document.getElementById('ret-search-btn').onclick = loadData;
    document.getElementById('ret-new-btn').onclick = openCreateModal;
    loadData();
  }

  async function loadData() {
    const type   = document.getElementById('ret-type')?.value || '';
    const status = document.getElementById('ret-status')?.value || '';
    const wrap   = document.getElementById('ret-table-wrap');
    if (!wrap) return;
    wrap.innerHTML = loadingHTML();

    try {
      const params = new URLSearchParams();
      if (type)   params.set('return_type', type);
      if (status) params.set('status', status);
      const rows = await API.get(`/returns?${params.toString()}`);
      renderTable(rows);
    } catch(err) { wrap.innerHTML = `<div class="empty-state">${err.message}</div>`; }
  }

  function renderTable(rows) {
    const wrap = document.getElementById('ret-table-wrap');
    if (!rows.length) { wrap.innerHTML = '<div class="empty-state">반품 전표가 없습니다.</div>'; return; }
    wrap.innerHTML = `
      <table class="table">
        <thead><tr>
          <th>전표번호</th><th>유형</th><th>반품일</th><th>거래처</th>
          <th>사유</th><th class="num">금액</th><th>상태</th><th></th>
        </tr></thead>
        <tbody>
          ${rows.map(r => `
            <tr>
              <td class="mono">${r.return_no}</td>
              <td>${r.return_type === 'sales' ? '<span class="badge badge-primary">영업</span>' : '<span class="badge badge-ghost">구매</span>'}</td>
              <td>${r.return_date}</td>
              <td>${r.partner_name || r.partner_code || '-'}</td>
              <td>${r.reason_code}</td>
              <td class="num">${formatCurrency(r.total_amount)}</td>
              <td>${STATUS_BADGE[r.status] || r.status}</td>
              <td class="table-actions">
                <button class="btn btn-xs btn-secondary" onclick="Returns.viewDetail('${r.id}')">상세</button>
                ${r.status === 'draft' ? `<button class="btn btn-xs btn-warning" onclick="Returns.approve('${r.id}','${r.return_no}')">승인</button>` : ''}
                ${r.status === 'draft' ? `<button class="btn btn-xs btn-danger" onclick="Returns.cancel('${r.id}','${r.return_no}')">취소</button>` : ''}
              </td>
            </tr>`).join('')}
        </tbody>
      </table>`;
  }

  async function viewDetail(id) {
    const ret = await API.get(`/returns/${id}`);
    const canDispose = ret.status === 'approved';

    const itemRows = ret.items.map(item => `
      <tr>
        <td>${item.material_name || item.material_code}</td>
        <td class="num">${formatNumber(item.qty)} ${item.unit||''}</td>
        <td class="num">${formatCurrency(item.unit_price)}</td>
        <td><span class="badge badge-ghost">${item.condition_code}</span></td>
        <td>${DISPOSITION_BADGE[item.disposition] || item.disposition}</td>
        <td>
          ${canDispose && item.disposition === 'hold' ? `
            <div style="display:flex;gap:4px;flex-wrap:wrap">
              <button class="btn btn-xs btn-success" onclick="Returns.disposeItem('${item.id}','available','${ret.id}')">가용화</button>
              <button class="btn btn-xs btn-danger" onclick="Returns.disposeItem('${item.id}','scrap','${ret.id}')">폐기</button>
              <button class="btn btn-xs btn-secondary" onclick="Returns.disposeItem('${item.id}','resend','${ret.id}')">반송</button>
            </div>` : (item.disposed_at ? `<span style="font-size:0.75rem;color:var(--text-muted)">${item.disposed_at.slice(0,10)} by ${item.disposed_by}</span>` : '')}
        </td>
      </tr>`).join('');

    const html = `
      <div class="modal-header">
        <div class="modal-title">반품 전표 — ${ret.return_no} ${STATUS_BADGE[ret.status]||''}</div>
        <button class="modal-close">×</button>
      </div>
      <div class="modal-body">
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px;font-size:0.82rem">
          <div><span style="color:var(--text-muted)">유형</span><div>${ret.return_type === 'sales' ? '영업 반품' : '구매 반품'}</div></div>
          <div><span style="color:var(--text-muted)">반품일</span><div>${ret.return_date}</div></div>
          <div><span style="color:var(--text-muted)">사유</span><div>${ret.reason_code}</div></div>
          <div><span style="color:var(--text-muted)">거래처</span><div>${ret.partner_name || ret.partner_code || '-'}</div></div>
          <div><span style="color:var(--text-muted)">원 전표</span><div class="mono">${ret.ref_so_no || ret.ref_receipt_no || '-'}</div></div>
          <div><span style="color:var(--text-muted)">창고</span><div>${ret.warehouse_code}</div></div>
          ${ret.notes ? `<div style="grid-column:1/-1"><span style="color:var(--text-muted)">메모</span><div>${ret.notes}</div></div>` : ''}
        </div>
        <table class="table table-sm" style="font-size:0.82rem">
          <thead><tr><th>품목</th><th class="num">수량</th><th class="num">단가</th><th>상태</th><th>처리</th><th></th></tr></thead>
          <tbody>${itemRows}</tbody>
        </table>
        <div style="margin-top:10px;text-align:right;font-weight:600">합계: ${formatCurrency(ret.total_amount)}</div>
      </div>
      <div class="modal-footer">
        ${ret.status === 'draft' ? `<button class="btn btn-warning" onclick="closeModal();Returns.approve('${ret.id}','${ret.return_no}')">승인 (보류재고 격리)</button>` : ''}
        <button class="btn btn-secondary modal-close">닫기</button>
      </div>`;
    openModal(html, 'modal-xl');
  }

  async function approve(id, returnNo) {
    confirmDialog(
      `<strong>[${returnNo}]</strong> 반품을 승인합니다.<br>해당 수량은 즉시 <strong style="color:var(--danger)">보류재고</strong>로 격리됩니다.`,
      async () => {
        try {
          await API.put(`/returns/${id}/approve`, {});
          showToast(`${returnNo} 승인 완료 — 보류재고 격리됨`, 'success', 4000);
          loadData();
        } catch(err) { showToast(err.message, 'error'); }
      },
      true
    );
  }

  async function disposeItem(itemId, disposition, returnId) {
    const labels = { available: '가용화', scrap: '폐기', resend: '반송' };
    const mapAdjust = disposition === 'available' && confirm('가용화 시 이동평균단가(MAP)를 반품 단가로 재조정하시겠습니까?\n\n[확인]: MAP 조정 포함\n[취소]: MAP 유지 (기존 단가 보존)');

    try {
      await API.put(`/returns/items/${itemId}/dispose`, { disposition, map_adjust: mapAdjust });
      showToast(`${labels[disposition]} 처리 완료${mapAdjust ? ' (MAP 조정됨)' : ''}`, 'success', 4000);
      closeModal();
      loadData();
      viewDetail(returnId);
    } catch(err) { showToast(err.message, 'error'); }
  }

  async function cancel(id, returnNo) {
    confirmDialog(
      `<strong>[${returnNo}]</strong> 반품 전표를 취소하시겠습니까?`,
      async () => {
        try {
          await API.delete(`/returns/${id}`);
          showToast('반품 전표 취소 완료', 'success');
          loadData();
        } catch(err) { showToast(err.message, 'error'); }
      },
      true
    );
  }

  async function openCreateModal() {
    // Fetch SOs (출고 상태) and recent receipts for reference
    const [soList, rcList, matList] = await Promise.all([
      API.get('/sales-orders?status=출고').catch(() => []),
      API.get('/receipts?status=confirmed').catch(() => []),
      API.get('/materials').catch(() => []),
    ]);

    const html = `
      <div class="modal-header">
        <div class="modal-title">반품 전표 등록</div>
        <button class="modal-close">×</button>
      </div>
      <div class="modal-body">
        <div class="form-grid" style="grid-template-columns:repeat(2,1fr);gap:10px">
          <div class="form-group">
            <label>반품 유형 <span class="required">*</span></label>
            <select id="ret-type-sel" onchange="Returns._onTypeChange()">
              <option value="sales">영업 반품 (고객 → 당사)</option>
              <option value="purchase">구매 반품 (당사 → 매입처)</option>
            </select>
          </div>
          <div class="form-group">
            <label>반품일 <span class="required">*</span></label>
            <input type="date" id="ret-date" value="${today()}" max="${today()}">
          </div>
          <div class="form-group" id="ret-so-wrap">
            <label>원 수주 (SO)</label>
            <select id="ret-ref-so">
              <option value="">- 선택 -</option>
              ${soList.map(s => `<option value="${s.id}" data-partner="${s.customer_code}">[${s.so_no}] ${s.customer_name||s.customer_code} — ${formatCurrency(s.total_amount)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group" id="ret-rc-wrap" style="display:none">
            <label>원 입고전표 (Receipt)</label>
            <select id="ret-ref-rc">
              <option value="">- 선택 -</option>
              ${rcList.map(r => `<option value="${r.id}" data-partner="${r.vendor_code}">[${r.receipt_no}] ${r.vendor_name||r.vendor_code||''}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>반품 사유 <span class="required">*</span></label>
            <select id="ret-reason">
              <option value="불량">불량</option>
              <option value="단순변심">단순변심</option>
              <option value="오배송">오배송</option>
              <option value="수량초과">수량초과</option>
              <option value="파손">파손</option>
              <option value="기타">기타</option>
            </select>
          </div>
          <div class="form-group">
            <label>입고 창고</label>
            <input id="ret-warehouse" value="WH-001">
          </div>
          <div class="form-group" style="grid-column:1/-1">
            <label>메모</label>
            <input type="text" id="ret-notes" placeholder="반품 사유 상세">
          </div>
        </div>

        <div style="border-top:1px solid var(--border);padding-top:12px;margin-top:10px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
            <strong style="font-size:0.85rem">반품 품목</strong>
            <button class="btn btn-xs btn-secondary" onclick="Returns._addReturnItem()">+ 품목 추가</button>
          </div>
          <div id="ret-items-wrap">
            <div style="color:var(--text-muted);font-size:0.8rem">품목을 추가하세요.</div>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary modal-close">취소</button>
        <button class="btn btn-primary" id="ret-save-btn">초안 저장</button>
      </div>`;
    openModal(html, 'modal-lg');

    window._returnMatList = matList;
    window._returnItemIdx = 0;
    Returns._addReturnItem();

    document.getElementById('ret-save-btn').onclick = async () => {
      const return_type = document.getElementById('ret-type-sel').value;
      const return_date = document.getElementById('ret-date').value;
      const reason_code = document.getElementById('ret-reason').value;
      const warehouse_code = document.getElementById('ret-warehouse').value;
      const notes = document.getElementById('ret-notes').value;
      const ref_so_id = return_type === 'sales' ? (document.getElementById('ret-ref-so')?.value || null) : null;
      const ref_receipt_id = return_type === 'purchase' ? (document.getElementById('ret-ref-rc')?.value || null) : null;

      const items = [];
      document.querySelectorAll('.ret-item-row').forEach(row => {
        const code = row.querySelector('.ret-item-code')?.value;
        const qty  = parseFloat(row.querySelector('.ret-item-qty')?.value) || 0;
        const price = parseFloat(row.querySelector('.ret-item-price')?.value) || 0;
        const cond = row.querySelector('.ret-item-cond')?.value || '불량';
        if (code && qty > 0) items.push({ material_code: code, qty, unit_price: price, condition_code: cond });
      });

      if (!items.length) return showToast('반품 품목을 추가하세요.', 'error');
      const btn = document.getElementById('ret-save-btn');
      btn.disabled = true; btn.textContent = '저장 중...';
      try {
        const res = await API.post('/returns', { return_type, return_date, ref_so_id, ref_receipt_id,
          warehouse_code, reason_code, notes, items });
        showToast(`${res.return_no} 반품 전표 저장됨`, 'success', 4000);
        closeModal();
        loadData();
      } catch(err) {
        btn.disabled = false; btn.textContent = '초안 저장';
        showToast(err.message, 'error');
      }
    };
  }

  function _onTypeChange() {
    const t = document.getElementById('ret-type-sel')?.value;
    const soWrap = document.getElementById('ret-so-wrap');
    const rcWrap = document.getElementById('ret-rc-wrap');
    if (soWrap) soWrap.style.display = t === 'sales' ? '' : 'none';
    if (rcWrap) rcWrap.style.display = t === 'purchase' ? '' : 'none';
  }

  function _addReturnItem() {
    const wrap = document.getElementById('ret-items-wrap');
    if (!wrap) return;
    const idx = window._returnItemIdx++;
    const mats = window._returnMatList || [];
    if (idx === 0) wrap.innerHTML = '';
    const row = document.createElement('div');
    row.className = 'ret-item-row';
    row.style.cssText = 'display:grid;grid-template-columns:3fr 1fr 1fr 1fr auto;gap:6px;margin-bottom:6px;align-items:center';
    row.innerHTML = `
      <select class="ret-item-code">
        <option value="">- 품목 선택 -</option>
        ${mats.map(m => `<option value="${m.code}">[${m.code}] ${m.name}</option>`).join('')}
      </select>
      <input type="number" class="ret-item-qty" placeholder="수량" min="0.01" step="0.01">
      <input type="number" class="ret-item-price" placeholder="단가" min="0">
      <select class="ret-item-cond">
        <option value="불량">불량</option>
        <option value="재사용가능">재사용가능</option>
        <option value="폐기">폐기</option>
      </select>
      <button class="btn btn-xs btn-danger" onclick="this.parentElement.remove()">✕</button>`;
    wrap.appendChild(row);
  }

  function reset() {}

  return { render, loadData, viewDetail, approve, disposeItem, cancel, openCreateModal, _onTypeChange, _addReturnItem, reset };
})();
window.Returns = Returns;
