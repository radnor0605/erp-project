/* ─── Purchasing (PO) Module (V10.1 → V26) ─── */
const Purchasing = (() => {
  let _data = [];
  let _filters = { status: '', from: '', to: '' };
  let _activeTab = 'po'; // 'po' | 'draft'

  function reset() {
    _filters = { status: '', from: '', to: '' };
    _activeTab = 'po';
  }

  async function render() {
    const container = document.getElementById('page-container');
    if (!container) return; // LH-045: 페이지 전환 중 DOM 소멸 방어
    // 발주초안 카운트 (배지용)
    let draftCount = 0;
    try {
      const drafts = await API.get('/purchase-orders/drafts?status=draft');
      draftCount = (drafts || []).length;
    } catch (_) {}

    if (!document.getElementById('page-container')) return; // re-check after await
    container.innerHTML = `
      <div class="animate-fade">
        <div class="page-header">
          <div>
            <h2 class="page-title">발주서 관리 (Purchase Orders)</h2>
            <p class="page-subtitle">매입처별 발주 현황 및 미입고 잔량을 관리합니다.</p>
          </div>
          <div class="header-actions">
            <button class="btn btn-primary" id="po-add-btn">
              <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd"/></svg>
              신규 발주서 작성
            </button>
          </div>
        </div>

        <div style="display:flex;gap:0;margin-bottom:16px;border-bottom:2px solid var(--border)">
          <button class="tab-btn ${_activeTab==='po'?'active':''}" id="tab-po" style="padding:8px 20px;background:none;border:none;cursor:pointer;font-weight:600;border-bottom:${_activeTab==='po'?'2px solid var(--primary)':'2px solid transparent'};color:${_activeTab==='po'?'var(--primary)':'var(--text-muted)'}">
            발주서
          </button>
          <button class="tab-btn ${_activeTab==='draft'?'active':''}" id="tab-draft" style="padding:8px 20px;background:none;border:none;cursor:pointer;font-weight:600;border-bottom:${_activeTab==='draft'?'2px solid var(--warning)':'2px solid transparent'};color:${_activeTab==='draft'?'var(--warning)':'var(--text-muted)'}">
            발주 초안 (Draft PO) ${draftCount>0?`<span style="background:var(--danger);color:#fff;border-radius:9999px;padding:1px 7px;font-size:0.7rem;margin-left:4px">${draftCount}</span>`:''}
          </button>
        </div>

        <div id="po-tab-content"></div>
      </div>
    `;

    document.getElementById('po-add-btn').onclick = () => openForm();
    document.getElementById('tab-po').onclick    = () => { _activeTab = 'po';    renderTabContent(); };
    document.getElementById('tab-draft').onclick = () => { _activeTab = 'draft'; renderTabContent(); };

    renderTabContent();
  }

  async function renderTabContent() {
    // 탭 버튼 스타일 갱신
    const tabPo    = document.getElementById('tab-po');
    const tabDraft = document.getElementById('tab-draft');
    if (tabPo) {
      tabPo.style.borderBottom    = _activeTab==='po'    ? '2px solid var(--primary)' : '2px solid transparent';
      tabPo.style.color           = _activeTab==='po'    ? 'var(--primary)'           : 'var(--text-muted)';
      tabDraft.style.borderBottom = _activeTab==='draft' ? '2px solid var(--warning)' : '2px solid transparent';
      tabDraft.style.color        = _activeTab==='draft' ? 'var(--warning)'           : 'var(--text-muted)';
    }
    const wrap = document.getElementById('po-tab-content');
    if (!wrap) return;
    if (_activeTab === 'draft') { await renderDraftTab(wrap); return; }

    wrap.innerHTML = `
      <div class="filter-bar">
        <select id="po-status-filter" style="width:140px">
          <option value="">전체 상태</option>
          <option value="ordered">발주완료</option>
          <option value="partial">부분입고</option>
          <option value="completed">입고완료</option>
          <option value="cancelled">취소</option>
        </select>
        <input type="date" id="po-from" value="${currentMonth()}-01" style="width:150px">
        <input type="date" id="po-to" value="${today()}" style="width:150px">
        <button class="btn btn-secondary" id="po-search-btn">조회</button>
      </div>
      <div class="table-container" id="po-table-wrap">${loadingHTML()}</div>
    `;
    document.getElementById('po-search-btn').onclick = () => {
      _filters.status = document.getElementById('po-status-filter').value;
      _filters.from   = document.getElementById('po-from').value;
      _filters.to     = document.getElementById('po-to').value;
      loadData();
    };
    await loadData();
  }

  async function renderDraftTab(wrap) {
    wrap.innerHTML = loadingHTML();
    let [drafts, rejected, partners] = [[], [], []];
    try {
      [drafts, rejected, partners] = await Promise.all([
        API.get('/purchase-orders/drafts?status=draft'),
        API.get('/purchase-orders/drafts?status=rejected'),
        API.get('/partners?type=vendor').catch(() => [])
      ]);
    } catch (e) { wrap.innerHTML = `<div class="alert alert-danger">${e.message}</div>`; return; }

    const partnerMap = Object.fromEntries((partners || []).map(p => [p.code, p.name]));

    const pendingRows = (drafts || []).map(d => `
      <tr>
        <td style="width:32px"><input type="checkbox" class="draft-chk" data-id="${d.id}" data-no="${d.draft_no}"
          data-mat="${(d.material_name||d.material_code).replace(/"/g,'&quot;')}"
          data-code="${d.material_code}" data-qty="${d.suggested_qty}"
          data-vendor="${d.preferred_vendor_code||''}" data-price="${d.unit_price||0}"></td>
        <td class="mono" style="color:var(--warning);font-size:0.8rem">${d.draft_no}</td>
        <td><span class="mono" style="font-size:0.75rem">${d.ref_so_no || '-'}</span></td>
        <td class="font-bold">${d.material_name || d.material_code}
          <div class="mono" style="font-size:0.7rem;color:var(--text-muted)">${d.material_code}</div>
        </td>
        <td class="num" style="color:var(--danger)">↓ ${formatNumber(d.shortage_qty)}</td>
        <td class="num" style="color:var(--warning);font-weight:700">↑ ${formatNumber(d.suggested_qty)}</td>
        <td class="num" style="font-size:0.78rem">${formatNumber(d.moq)}</td>
        <td style="font-size:0.78rem">${d.estimated_delivery ? `~${d.estimated_delivery}` : '-'}</td>
        <td style="font-size:0.78rem">${partnerMap[d.preferred_vendor_code] || d.preferred_vendor_code || '<span style="color:var(--text-muted)">미지정</span>'}</td>
        <td>
          <div class="table-actions">
            <button class="btn btn-xs btn-primary draft-approve"
              data-id="${d.id}" data-no="${d.draft_no}"
              data-mat="${(d.material_name||d.material_code).replace(/"/g,'&quot;')}"
              data-code="${d.material_code}" data-qty="${d.suggested_qty}"
              data-vendor="${d.preferred_vendor_code||''}" data-price="${d.unit_price||0}">승인</button>
            <button class="btn btn-xs btn-danger draft-reject" data-id="${d.id}" data-no="${d.draft_no}">반려</button>
          </div>
        </td>
      </tr>`).join('');

    const rejectedRows = (rejected || []).map(d => `
      <tr style="opacity:0.75">
        <td colspan="3" class="mono" style="font-size:0.78rem;color:var(--danger)">${d.draft_no}
          <div style="font-size:0.7rem;color:var(--text-muted)">${d.material_name||d.material_code}</div>
        </td>
        <td colspan="5" style="font-size:0.75rem;color:var(--text-muted)">${d.notes || '-'}</td>
        <td>
          <button class="btn btn-xs btn-warning draft-restore" data-id="${d.id}" data-no="${d.draft_no}" title="승인 대기로 복구">⚡ 복구</button>
        </td>
      </tr>`).join('');

    wrap.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <span style="font-size:0.82rem;color:var(--text-muted)">⚠️ ATP 부족 자동생성 초안 — 수량·거래처 확인 후 승인하세요.</span>
        <div style="display:flex;gap:6px;align-items:center">
          <label style="display:flex;align-items:center;gap:4px;font-size:0.8rem;cursor:pointer">
            <input type="checkbox" id="draft-chk-all"> 전체선택
          </label>
          <button class="btn btn-sm btn-primary" id="draft-bulk-approve" style="display:none">일괄 승인</button>
        </div>
      </div>
      <div class="table-responsive">
        <table class="table" id="draft-pending-table">
          <thead><tr>
            <th style="width:32px"></th>
            <th>초안번호</th><th>참조 수주</th><th>품목</th>
            <th class="num">부족수량 ↓</th>
            <th class="num">권고발주량 ↑</th>
            <th class="num">MOQ</th>
            <th>출고예정일</th>
            <th>선호거래처</th>
            <th>작업</th>
          </tr></thead>
          <tbody>${pendingRows || `<tr><td colspan="10" style="text-align:center;color:var(--text-muted);padding:32px">승인 대기 초안 없음</td></tr>`}</tbody>
        </table>
      </div>
      ${rejected.length ? `
      <details style="margin-top:16px">
        <summary style="cursor:pointer;font-size:0.82rem;color:var(--text-muted);padding:6px 0">반려된 초안 ${rejected.length}건 (클릭하여 확인)</summary>
        <div class="table-responsive" style="margin-top:6px">
          <table class="table table-sm">
            <thead><tr><th colspan="3">초안번호 / 품목</th><th colspan="5">반려 메모</th><th>작업</th></tr></thead>
            <tbody>${rejectedRows}</tbody>
          </table>
        </div>
      </details>` : ''}
    `;

    // 전체선택
    wrap.querySelector('#draft-chk-all')?.addEventListener('change', e => {
      wrap.querySelectorAll('.draft-chk').forEach(cb => { cb.checked = e.target.checked; });
      updateBulkBtn();
    });
    wrap.querySelectorAll('.draft-chk').forEach(cb => cb.addEventListener('change', updateBulkBtn));

    function updateBulkBtn() {
      const cnt = wrap.querySelectorAll('.draft-chk:checked').length;
      const btn = wrap.querySelector('#draft-bulk-approve');
      if (btn) { btn.style.display = cnt > 0 ? '' : 'none'; btn.textContent = `일괄 승인 (${cnt}건)`; }
    }

    // 일괄 승인
    wrap.querySelector('#draft-bulk-approve')?.addEventListener('click', () => {
      const selected = [...wrap.querySelectorAll('.draft-chk:checked')].map(cb => ({ ...cb.dataset }));
      if (!selected.length) return;
      showBulkApprove(selected, partners);
    });

    // 개별 승인
    wrap.querySelectorAll('.draft-approve').forEach(btn => {
      btn.addEventListener('click', () => showDraftApprove(btn.dataset, partners || []));
    });

    // 반려
    wrap.querySelectorAll('.draft-reject').forEach(btn => {
      btn.addEventListener('click', async () => {
        const reason = prompt(`반려 사유 입력 (${btn.dataset.no}):`);
        if (reason === null) return;
        try {
          await API.put(`/purchase-orders/drafts/${btn.dataset.id}/reject`, { reason });
          showToast('반려 처리되었습니다.', 'success');
          renderTabContent();
        } catch (e) { showToast(e.message, 'error'); }
      });
    });

    // 긴급 복구
    wrap.querySelectorAll('.draft-restore').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm(`${btn.dataset.no}을(를) 승인 대기로 복구하시겠습니까?`)) return;
        try {
          await API.put(`/purchase-orders/drafts/${btn.dataset.id}/restore`, {});
          showToast('발주 초안이 복구되었습니다.', 'success');
          renderTabContent();
        } catch (e) { showToast(e.message, 'error'); }
      });
    });
  }

  async function showBulkApprove(items, partners) {
    const vendorOpts = (partners || []).map(p => `<option value="${p.code}">${p.name} (${p.code})</option>`).join('');
    const html = `
      <div class="modal-header">
        <div class="modal-title">일괄 승인 — ${items.length}건</div>
        <button class="modal-close">×</button>
      </div>
      <div class="modal-body">
        <div class="alert alert-warning" style="margin-bottom:14px;font-size:0.82rem">
          ⚠️ 아래 공통 조건으로 선택한 ${items.length}건을 일괄 발주서로 생성합니다.<br>
          거래처·단가는 각 품목의 선호 거래처 및 기준단가로 자동 적용됩니다. 수정이 필요한 건은 개별 승인을 이용하세요.
        </div>
        <div class="form-grid" style="margin-bottom:16px">
          <div class="form-group">
            <label>공통 발주일 <span class="required">*</span></label>
            <input type="date" id="bulk-date" value="${today()}" style="width:100%">
          </div>
          <div class="form-group">
            <label>미지정 거래처 일괄 적용</label>
            <select id="bulk-vendor" style="width:100%">
              <option value="">개별 유지</option>
              ${vendorOpts}
            </select>
          </div>
        </div>
        <table class="table table-sm" style="font-size:0.82rem">
          <thead><tr><th>초안번호</th><th>품목</th><th>발주수량</th><th>거래처</th><th>단가</th></tr></thead>
          <tbody id="bulk-preview">
            ${items.map(d => `
              <tr data-id="${d.id}">
                <td class="mono" style="font-size:0.75rem">${d.no}</td>
                <td>${d.mat}</td>
                <td class="num">${formatNumber(parseFloat(d.qty))}</td>
                <td class="bulk-vendor-cell" style="font-size:0.78rem">${d.vendor || '<span style="color:var(--warning)">미지정</span>'}</td>
                <td class="bulk-price-cell num">${d.price > 0 ? formatCurrency(parseFloat(d.price)) : '<span style="color:var(--warning)">미확인</span>'}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary modal-close">취소</button>
        <button class="btn btn-primary" id="bulk-confirm-btn">일괄 발주서 생성</button>
      </div>
    `;
    openModal(html, 'modal-xl');

    document.getElementById('bulk-confirm-btn')?.addEventListener('click', async () => {
      const orderDate = document.getElementById('bulk-date').value;
      const fallbackVendor = document.getElementById('bulk-vendor').value;
      if (!orderDate) return showToast('발주일을 선택하세요.', 'error');

      const btn = document.getElementById('bulk-confirm-btn');
      btn.disabled = true; btn.textContent = '처리 중...';

      let ok = 0, fail = 0;
      for (const d of items) {
        const vendor_code = d.vendor || fallbackVendor;
        if (!vendor_code) { fail++; continue; }
        try {
          await API.put(`/purchase-orders/drafts/${d.id}/approve`, {
            vendor_code,
            unit_price: parseFloat(d.price) || 0,
            order_date: orderDate
          });
          ok++;
        } catch (e) { fail++; console.error(`Bulk approve ${d.no}:`, e.message); }
      }
      closeModal();
      showToast(`일괄 승인 완료: ${ok}건 성공${fail > 0 ? `, ${fail}건 실패` : ''}`, ok > 0 ? 'success' : 'error');
      renderTabContent();
    });
  }

  async function showDraftApprove(data, partners) {
    // 단가 우선순위: draft.unit_price → last_purchase_price → standard_price → avg_price (LH-022)
    let autoPrice = parseFloat(data.price) || 0;
    let priceSource = '';
    if (data.code) {
      try {
        const [mat, trend] = await Promise.all([
          API.get(`/materials/${data.code}`).catch(() => null),
          API.get(`/receipts/items/${data.code}/price-trend`).catch(() => [])
        ]);
        if (trend?.length) {
          autoPrice = trend[trend.length - 1].unit_price;
          priceSource = `최근매입가 ${formatCurrency(autoPrice)}`;
        } else if (mat) {
          autoPrice = mat.last_purchase_price || mat.standard_price || mat.standard_unit_price || mat.avg_price || 0;
          priceSource = mat.last_purchase_price ? `최근매입가 ${formatCurrency(autoPrice)}`
            : mat.standard_price ? `기준단가 ${formatCurrency(autoPrice)}`
            : autoPrice ? `이동평균가 ${formatCurrency(autoPrice)}` : '';
        }
      } catch(_) {}
    }

    const html = `
      <div class="modal-header">
        <div class="modal-title">발주 초안 승인 — ${data.no}</div>
        <button class="modal-close">×</button>
      </div>
      <div class="modal-body">
        <div class="alert alert-warning" style="margin-bottom:16px;font-size:0.83rem">
          <strong>품목:</strong> ${data.mat} &nbsp;|&nbsp; <strong>권고 수량:</strong> ${formatNumber(parseFloat(data.qty))}
        </div>
        <div class="form-grid">
          <div class="form-group">
            <label>거래처 <span class="required">*</span></label>
            <select id="dpa-vendor" style="width:100%">
              <option value="">거래처 선택</option>
              ${(partners || []).map(p => `<option value="${p.code}" ${p.code===data.vendor?'selected':''}>${p.name} (${p.code})</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>발주수량</label>
            <input type="number" id="dpa-qty" value="${data.qty}" min="1" step="any" style="width:100%">
          </div>
          <div class="form-group">
            <label>단가 <span class="required">*</span>
              ${priceSource ? `<span style="font-size:0.72rem;color:var(--info,#06b6d4);font-weight:400">↑ ${priceSource} 자동기입</span>` : '<span style="font-size:0.72rem;color:var(--danger)">⚠️ 단가 정보 없음 — 직접 입력</span>'}
            </label>
            <input type="number" id="dpa-price" value="${autoPrice}" min="0" step="any" style="width:100%"
              ${!autoPrice ? 'style="border-color:var(--warning)"' : ''}>
          </div>
          <div class="form-group">
            <label>발주일</label>
            <input type="date" id="dpa-date" value="${today()}" style="width:100%">
          </div>
          <div class="form-group" style="grid-column:span 2">
            <label>비고</label>
            <input type="text" id="dpa-notes" placeholder="추가 요구사항">
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary modal-close">취소</button>
        <button class="btn btn-primary" id="dpa-confirm-btn">발주서 생성 (승인)</button>
      </div>
    `;
    openModal(html, 'modal-wide', { persistent: true });

    document.getElementById('dpa-confirm-btn')?.addEventListener('click', async () => {
      const vendor_code = document.getElementById('dpa-vendor').value;
      if (!vendor_code) return showToast('거래처를 선택하세요.', 'error');
      const btn = document.getElementById('dpa-confirm-btn');
      btn.disabled = true; btn.textContent = '처리 중...';
      try {
        const r = await API.put(`/purchase-orders/drafts/${data.id}/approve`, {
          vendor_code,
          unit_price:  parseFloat(document.getElementById('dpa-price').value) || 0,
          order_date:  document.getElementById('dpa-date').value,
          notes:       document.getElementById('dpa-notes').value,
        });
        showToast(`발주서 생성 완료: ${r.po_no}`, 'success', 5000);
        closeModal();
        _activeTab = 'po';
        render();
      } catch (e) {
        btn.disabled = false; btn.textContent = '발주서 생성 (승인)';
        // LH-027: DUPLICATE_DOC_NO — 채번 충돌 시 목록 새로고침 안내
        if (e.code === 'DUPLICATE_DOC_NO' || (e.message && e.message.includes('중복'))) {
          showToast('발주번호 중복이 감지되었습니다. 목록을 새로고침 후 다시 시도해주세요.', 'warning', 6000);
          closeModal();
          render();
        } else {
          showToast(e.message, 'error');
        }
      }
    });
  }

  async function loadData() {
    const wrap = document.getElementById('po-table-wrap');
    if (!wrap) return;
    try {
      const params = new URLSearchParams(_filters);
      _data = await API.get('/purchase-orders?' + params.toString());
      renderTable();
    } catch (err) { wrap.innerHTML = `<div class="alert alert-danger">${err.message}</div>`; }
  }

  function renderTable() {
    const wrap = document.getElementById('po-table-wrap');
    if (!wrap) return;
    if (!_data.length) { wrap.innerHTML = emptyHTML('발주 내역이 없습니다'); return; }

    wrap.innerHTML = `
      <div class="table-responsive">
        <table class="table">
          <thead>
            <tr>
              <th>발주번호</th><th>일자</th><th>납기예정</th><th>거래처</th><th>품목수</th><th>총수량</th><th>상태</th><th>진척률</th><th>작업</th>
            </tr>
          </thead>
          <tbody>
            ${_data.map(po => {
              const progress = po.total_qty > 0 ? Math.round((po.total_received / po.total_qty) * 100) : 0;
              return `
                <tr>
                  <td class="mono font-bold">${po.po_no}</td>
                  <td>${formatDate(po.order_date)}</td>
                  <td>${formatDate(po.delivery_due_date)}</td>
                  <td>${po.vendor_name}</td>
                  <td class="num">${po.item_count}건</td>
                  <td class="num">${formatNumber(po.total_qty)}</td>
                  <td>${poStatusBadge(po.status)}</td>
                  <td>
                    <div style="display:flex; align-items:center; gap:8px">
                      <div class="progress-bar" style="width:60px"><div class="progress-fill" style="width:${progress}%"></div></div>
                      <small>${progress}%</small>
                    </div>
                  </td>
                  <td class="table-actions">
                    <button class="btn btn-xs btn-secondary" onclick="Purchasing.viewDetail('${po.id}')">상세</button>
                    <button class="btn btn-xs btn-secondary" onclick="window.open('/api/purchase-orders/${po.id}/print?token='+localStorage.getItem('ag_token'),'_blank')" title="PDF 출력">
                      <svg viewBox="0 0 20 20" fill="currentColor" style="width:11px;height:11px"><path fill-rule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a1 1 0 001 1h8a1 1 0 001-1v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a1 1 0 00-1-1H6a1 1 0 00-1 1zm2 0h6v3H7V4zm-1 9v-2a1 1 0 011-1h6a1 1 0 011 1v2H6zm7 2H7v-1h6v1z" clip-rule="evenodd"/></svg>출력
                    </button>
                    <button class="btn btn-xs btn-ghost" onclick="Purchasing.sendEmail('${po.id}','${po.po_no}','${po.vendor_email||''}')" title="이메일 발송">
                      <svg viewBox="0 0 20 20" fill="currentColor" style="width:11px;height:11px"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/></svg>발송
                    </button>
                    ${po.status === 'ordered' ? `<button class="btn btn-xs btn-primary" onclick="Purchasing.editPO('${po.id}','${po.po_no}')">수정</button>` : ''}
                    ${po.status === 'partial' ? `<button class="btn btn-xs btn-secondary" title="개정 불가 — 부분입고 진행 중" disabled style="opacity:.45;cursor:not-allowed">수정불가</button>` : ''}
                    <button class="btn btn-xs btn-secondary" onclick="Purchasing.viewRevisions('${po.id}','${po.po_no}')" title="개정 이력">
                      <svg viewBox="0 0 20 20" fill="currentColor" style="width:11px;height:11px;margin-right:2px"><path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clip-rule="evenodd"/></svg>이력
                    </button>
                    ${!['completed','cancelled'].includes(po.status) ? `<button class="btn btn-xs btn-warning" onclick="Purchasing.cancelPO('${po.id}','${po.po_no}')">취소</button>` : ''}
                    ${po.status === 'cancelled' ? `<button class="btn btn-xs btn-danger" onclick="Purchasing.deletePO('${po.id}','${po.po_no}')">삭제</button>` : ''}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function poStatusBadge(status) {
    const map = { ordered: ['badge-info','발주'], partial: ['badge-warning','부분'], completed: ['badge-success','완료'], cancelled: ['badge-danger','취소'] };
    const [cls, label] = map[status] || ['badge-ghost', status];
    return `<span class="badge ${cls}">${label}</span>`;
  }

  async function openForm() {
    const [partners, materials] = await Promise.all([
      API.get('/partners?type=vendor'),
      API.get('/materials')
    ]);
    const matMap = Object.fromEntries(materials.map(m => [m.code, m]));
    const html = `
      <div class="modal-header">
        <div class="modal-title">신규 발주서 작성</div>
        <button class="modal-close">×</button>
      </div>
      <div class="modal-body">
        <form id="po-form">
          <div class="form-grid">
            <div class="form-group">
              <label>거래처 (Vendor) <span class="required">*</span></label>
              <select name="vendor_code" required>
                <option value="">거래처 선택</option>
                ${partners.map(p => `<option value="${p.code}">${p.name} (${p.code})</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>발주일자 <span class="required">*</span></label>
              <input type="date" name="order_date" value="${today()}" required>
            </div>
            <div class="form-group">
              <label>납기요청일</label>
              <input type="date" name="delivery_due_date">
            </div>
            <div class="form-group" style="grid-column:span 2">
              <label>비고</label>
              <input name="notes" placeholder="기타 요구사항">
            </div>
          </div>

          <div style="margin-top:24px">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px">
              <h4 style="font-size:0.9rem">발주 품목 리스트</h4>
              <button type="button" class="btn btn-xs btn-secondary" id="po-add-item">품목 추가</button>
            </div>
            <div class="table-container">
              <table class="table table-sm" id="po-items-table">
                <thead><tr><th>품목</th><th>규격/단위</th><th>발주수량</th><th>단가</th><th style="width:70px">할인(%)</th><th style="width:70px">세율(%)</th><th>금액(VAT)</th><th></th></tr></thead>
                <tbody></tbody>
                <tfoot>
                  <tr><td colspan="6" class="text-right font-bold">합계 (VAT 포함)</td><td id="po-total-amount" class="num font-bold">0원</td><td></td></tr>
                </tfoot>
              </table>
            </div>
          </div>
        </form>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary modal-close">취소</button>
        <button class="btn btn-primary" id="po-save-btn">발주서 저장</button>
      </div>
    `;
    openModal(html, 'max-width:95%');
    
    // Item Add logic — materials & matMap pre-fetched above (LH-019)
    const addItem = async (code = '', qty = 0, price = 0) => {
      const tbody = document.querySelector('#po-items-table tbody');
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <select class="item-mat" name="material_code" required style="width:200px">
            <option value="">품목 선택</option>
            ${materials.map(m => `<option value="${m.code}" ${m.code===code?'selected':''}>${m.name}</option>`).join('')}
          </select>
        </td>
        <td class="item-spec" style="font-size:0.72rem;color:var(--text-muted)">-</td>
        <td><input type="number" class="item-qty" value="${qty}" min="0.01" step="0.01" style="width:80px" required></td>
        <td>
          <input type="number" class="item-price" value="${price}" min="0" style="width:110px" placeholder="필수" required>
          <div class="po-price-hint" style="font-size:0.7rem;margin-top:2px;white-space:nowrap"></div>
        </td>
        <td><input type="number" class="item-discount" value="0" min="0" max="100" step="0.1" style="width:60px" title="할인율(%)"></td>
        <td><input type="number" class="item-tax" value="10" min="0" max="100" step="0.1" style="width:60px" title="부가세율(%)"></td>
        <td class="item-amount num">0원</td>
        <td class="text-center">
          <button type="button" class="btn btn-xs btn-danger remove-row" title="행 삭제">×</button>
        </td>
      `;
      tbody.appendChild(tr);

      const updateRow = () => {
        const matCode = tr.querySelector('.item-mat').value;
        const mat = matMap[matCode];
        if (mat) tr.querySelector('.item-spec').textContent = `${mat.spec || '-'} (${mat.unit})`;
        const q  = parseFloat(tr.querySelector('.item-qty').value)      || 0;
        const p  = parseFloat(tr.querySelector('.item-price').value)    || 0;
        const dr = Math.min(100, parseFloat(tr.querySelector('.item-discount')?.value || 0)) / 100;
        const tr_ = Math.min(100, parseFloat(tr.querySelector('.item-tax')?.value ?? 10)) / 100;
        const lineAmt = Math.round(q * p * (1 - dr) * (1 + tr_));
        tr.querySelector('.item-amount').textContent = formatCurrency(lineAmt);
        // PPV 인디케이터 — vendor-specific last price 우선 (LH-036)
        const lastVendorPrice = parseFloat(tr.dataset.lastVendorPrice) || 0;
        const stdPrice  = mat ? (mat.standard_price || mat.standard_unit_price || 0) : 0;
        const lastPrice = lastVendorPrice || (mat ? (mat.last_purchase_price || mat.avg_price || 0) : 0);
        const hint = tr.querySelector('.po-price-hint');
        // PPV reason input (show when ≥5%)
        let reasonEl = tr.querySelector('.ppv-reason');
        if ((stdPrice > 0 || lastPrice > 0) && p > 0) {
          const ref = lastPrice || stdPrice;
          const ppv = ref > 0 ? (p - ref) / ref * 100 : 0;
          tr.dataset.ppv = ppv.toFixed(2);
          const icon = Math.abs(ppv) >= 10 ? '🔴' : Math.abs(ppv) >= 5 ? '⚠️' : '✓';
          hint.innerHTML = `${icon} ${lastVendorPrice ? '거래처이력' : '최근매입'}: ${formatCurrency(lastPrice||0)} | PPV: ${ppv>=0?'+':''}${ppv.toFixed(1)}%`;
          hint.style.color = Math.abs(ppv) >= 10 ? 'var(--danger)' : Math.abs(ppv) >= 5 ? 'var(--warning)' : 'var(--success)';
          if (Math.abs(ppv) >= 5) {
            if (!reasonEl) {
              reasonEl = document.createElement('input');
              reasonEl.type = 'text'; reasonEl.className = 'ppv-reason';
              reasonEl.placeholder = '단가변동 사유 입력 필수 (PPV≥5%)';
              reasonEl.style.cssText = 'width:100%;font-size:0.72rem;margin-top:3px;border-color:var(--warning);';
              hint.after(reasonEl);
            }
          } else if (reasonEl) { reasonEl.remove(); }
        } else { hint.textContent = ''; if (reasonEl) reasonEl.remove(); tr.dataset.ppv = '0'; }
        calculateTotal();
      };

      tr.querySelector('.item-mat').onchange = async () => {
        const matCode    = tr.querySelector('.item-mat').value;
        const mat        = matMap[matCode];
        if (!mat) return;
        const vendorCode = document.querySelector('[name="vendor_code"]')?.value || '';

        // 단가 우선순위: 공급사별 이력 → last_purchase_price → standard_price → avg_price (LH-036)
        let autoPrice = 0, src = '기준단가', lastVendorPrice = 0;
        if (vendorCode) {
          try {
            const hist = await API.get(`/purchase-orders/last-prices?vendor_code=${vendorCode}&material_code=${matCode}`);
            if (hist?.length) { lastVendorPrice = hist[0].unit_price; autoPrice = lastVendorPrice; src = `거래처 최근매입가 (${hist[0].order_date})`; }
          } catch (_) {}
        }
        if (!autoPrice) {
          try {
            const trend = await API.get(`/receipts/items/${matCode}/price-trend`);
            if (trend?.length) { autoPrice = trend[trend.length-1].unit_price; src = '입고 이력가'; }
          } catch (_) {}
        }
        if (!autoPrice) { autoPrice = mat.last_purchase_price || mat.standard_price || mat.standard_unit_price || mat.avg_price || 0; src = mat.last_purchase_price ? '최근매입가' : mat.standard_price ? '기준단가' : '이동평균가'; }

        tr.dataset.lastVendorPrice = lastVendorPrice;
        tr.querySelector('.item-price').value = autoPrice || '';
        if (autoPrice) {
          const hint = tr.querySelector('.po-price-hint');
          hint.textContent = `↑ ${src} 자동기입`;
          hint.style.color = 'var(--info,#06b6d4)';
        }
        updateRow();
      };
      tr.querySelector('.item-qty').oninput      = updateRow;
      tr.querySelector('.item-price').oninput    = updateRow;
      tr.querySelector('.item-discount').oninput = updateRow;
      tr.querySelector('.item-tax').oninput      = updateRow;
      tr.querySelector('.remove-row').onclick    = () => { tr.remove(); calculateTotal(); };

      if (code) {
        const mat = matMap[code];
        if (mat && !price) {
          tr.querySelector('.item-price').value = mat.last_purchase_price || mat.standard_price || mat.avg_price || 0;
        }
        updateRow();
      }
    };

    function calculateTotal() {
      let total = 0;
      document.querySelectorAll('#po-items-table tbody tr').forEach(row => {
        const q  = parseFloat(row.querySelector('.item-qty')?.value)      || 0;
        const p  = parseFloat(row.querySelector('.item-price')?.value)    || 0;
        const dr = Math.min(100, parseFloat(row.querySelector('.item-discount')?.value || 0)) / 100;
        const tr_ = Math.min(100, parseFloat(row.querySelector('.item-tax')?.value ?? 10)) / 100;
        total += Math.round(q * p * (1 - dr) * (1 + tr_));
      });
      document.getElementById('po-total-amount').textContent = formatCurrency(total);
    }

    document.getElementById('po-add-item').onclick = () => addItem();
    document.getElementById('po-save-btn').onclick = async () => {
      const form = document.getElementById('po-form');
      const data = Object.fromEntries(new FormData(form));
      const items = [];
      let ppvBlocked = false;
      document.querySelectorAll('#po-items-table tbody tr').forEach(tr => {
        const mat = tr.querySelector('.item-mat').value;
        if (!mat) return;
        const ppv    = Math.abs(parseFloat(tr.dataset.ppv) || 0);
        const reason = tr.querySelector('.ppv-reason')?.value?.trim() || '';
        if (ppv >= 5 && !reason) { ppvBlocked = true; tr.querySelector('.ppv-reason')?.focus(); return; }
        items.push({
          material_code: mat,
          qty:           parseFloat(tr.querySelector('.item-qty').value),
          unit_price:    parseFloat(tr.querySelector('.item-price').value),
          discount_rate: parseFloat(tr.querySelector('.item-discount')?.value || 0) / 100,
          tax_rate:      parseFloat(tr.querySelector('.item-tax')?.value ?? 10) / 100,
          ...(reason ? { ppv_reason: reason } : {}),
        });
      });
      if (ppvBlocked) return showToast('⚠️ PPV ≥5% 품목의 단가변동 사유를 입력하세요.', 'error');
      if (!items.length) return showToast('최소 하나 이상의 품목을 추가해주세요.', 'error');
      
      try {
        await API.post('/purchase-orders', { ...data, items });
        FormPersistence.clear('po-add');
        showToast('발주서가 성공적으로 등록 되었습니다.', 'success');
        closeModal();
        await loadData();
      } catch (err) {
        // LH-027: DUPLICATE_DOC_NO — 채번 충돌 시 리스트 새로고침 후 재시도 안내
        if (err.code === 'DUPLICATE_DOC_NO' || (err.message && err.message.includes('중복'))) {
          showToast('이미 생성된 발주번호입니다. 목록을 새로고침 후 다시 시도해주세요.', 'warning', 6000);
          closeModal();
          await loadData();
        } else {
          showToast(err.message, 'error');
        }
      }
    };

    // Auto-add one row
    addItem();
  }

  async function viewDetail(id) {
    const po = await API.get(`/purchase-orders/${id}`);
    const html = `
      <div class="modal-header">
        <div class="modal-title">발주서 상세 : ${po.po_no}</div>
        <button class="modal-close">×</button>
      </div>
      <div class="modal-body">
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px; margin-bottom:20px; padding:16px; background:var(--bg-glass); border-radius:var(--radius-md)">
          <div>
            <label style="display:block; margin-bottom:4px; font-size:0.7rem; color:var(--text-muted)">거래처</label>
            <div style="font-weight:600">${po.vendor_name}</div>
            <div style="font-size:0.8rem">${po.vendor_address || '-'}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:0.75rem">발주일: ${po.order_date}</div>
            <div style="font-size:0.75rem">납기요청일: ${po.delivery_due_date || '-'}</div>
            <div style="margin-top:8px">${poStatusBadge(po.status)}</div>
          </div>
        </div>

        <div class="table-container">
          <table class="table table-sm">
            <thead><tr><th>품목명</th><th>규격</th><th>단위</th><th>발주수량</th><th>단가</th><th>금액</th><th>입고수량</th></tr></thead>
            <tbody>
              ${po.items.map(it => `
                <tr>
                  <td>${it.material_name}</td>
                  <td>${it.spec || '-'}</td>
                  <td>${it.unit}</td>
                  <td class="num">${formatNumber(it.qty)}</td>
                  <td class="num">${formatCurrency(it.unit_price)}</td>
                  <td class="num font-bold">${formatCurrency(it.qty * it.unit_price)}</td>
                  <td class="num" style="color:var(--success)">${formatNumber(it.received_qty)}</td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr><td colspan="5" class="text-right font-bold">총 발주액</td><td class="num font-bold" style="font-size:1.1rem; color:var(--primary)">${formatCurrency(po.total_amount)}</td><td></td></tr>
            </tfoot>
          </table>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="Purchasing.exportExcel('${id}')">Excel 다운로드</button>
        <button class="btn btn-primary modal-close">닫기</button>
      </div>
    `;
    openModal(html, 'max-width:95%');
  }

  async function exportExcel(id) {
    const po = await API.get(`/purchase-orders/${id}`);
    const data = [
      ['발주서 (PURCHASE ORDER)'],
      [],
      ['발주번호', po.po_no, '', '거래처', po.vendor_name],
      ['발주일자', po.order_date, '', '연락처', po.vendor_phone || '-'],
      ['납기기한', po.delivery_due_date || '-', '', '이메일', po.vendor_email || '-'],
      [],
      ['No', '품목명', '규격', '단위', '수량', '단가', '합계'],
      ...po.items.map((it, idx) => [
        idx + 1, it.material_name, it.spec || '-', it.unit, it.qty, it.unit_price, it.qty * it.unit_price
      ]),
      [],
      ['', '', '', '', '총 합계', '', po.total_amount]
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);
    
    // Style merged title
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }];
    
    XLSX.utils.book_append_sheet(wb, ws, "PurchaseOrder");
    XLSX.writeFile(wb, `PO_${po.po_no}.xlsx`);
    showToast('엑셀 다운로드가 완료되었습니다.', 'success');
  }

  async function cancelPO(id, poNo) {
    if (!confirm(`발주서 ${poNo}를 취소하시겠습니까?`)) return;
    try {
      await API.put(`/purchase-orders/${id}/cancel`, {});
      showToast(`${poNo} 취소 완료`, 'success');
      renderTabContent();
    } catch (e) { showToast(e.message, 'error'); }
  }

  async function deletePO(id, poNo) {
    if (!confirm(`발주서 ${poNo}를 영구 삭제하시겠습니까?\n삭제 후 복구 불가합니다.`)) return;
    try {
      await API.delete(`/purchase-orders/${id}`);
      showToast(`${poNo} 삭제 완료`, 'success');
      renderTabContent();
    } catch (e) { showToast(e.message, 'error'); }
  }

  async function editPO(id, poNo) {
    const [po, materials, vendors] = await Promise.all([
      API.get(`/purchase-orders/${id}`),
      API.get('/materials'),
      API.get('/partners?type=vendor'),
    ]);
    if (['partial','completed','cancelled'].includes(po.status)) {
      return showToast('개정 불가 — 부분입고 이상 진행된 발주서입니다.', 'error');
    }
    const matMap     = Object.fromEntries(materials.map(m => [m.code, m]));
    const vendorOpts = vendors.map(v =>
      `<option value="${v.code}" ${v.code===po.vendor_code?'selected':''}>${v.name} (${v.code})</option>`
    ).join('');

    const buildItemRows = (items, vendorCheckMap = {}) => items.map((it, i) => {
      const vc = vendorCheckMap[it.material_code] || {};
      const hasCheck    = Object.keys(vendorCheckMap).length > 0;
      const noHistory   = hasCheck && !vc.has_history;
      const badge       = vc.is_preferred ? '⭐ 선호' : vc.has_history ? '✓ 이력' : hasCheck ? '⚠️ 신규' : '';
      const badgeColor  = vc.is_preferred ? 'var(--success)' : vc.has_history ? 'var(--info,#06b6d4)' : 'var(--warning)';
      return `
        <tr data-idx="${i}" data-code="${it.material_code}" data-excluded="0">
          <td>
            <div style="${noHistory?'color:var(--text-muted)':''}">${it.material_name || it.material_code}</div>
            ${badge ? `<div style="font-size:0.68rem;color:${badgeColor};font-weight:600">${badge}</div>` : ''}
          </td>
          <td class="num">${formatNumber(it.qty)}</td>
          <td><input type="number" class="edit-qty" value="${it.qty}" min="1" style="width:80px" ${noHistory?'style="opacity:.5"':''}></td>
          <td class="num before-price">${formatCurrency(it.unit_price)}</td>
          <td>
            <input type="number" class="edit-price" value="${it.unit_price}" min="0" style="width:110px">
            <div class="map-hint" style="font-size:0.68rem;margin-top:2px;color:var(--text-muted)">
              ${vc.last_price ? `이력단가: ${formatCurrency(vc.last_price)} (${vc.last_date||''})` : ''}
            </div>
          </td>
          <td class="num edit-amount">${formatCurrency(it.qty * it.unit_price)}</td>
          <td style="width:60px;text-align:center">
            ${noHistory ? `<label style="font-size:0.7rem;cursor:pointer;color:var(--danger)"><input type="checkbox" class="exclude-item"> 제외</label>` : ''}
          </td>
        </tr>`;
    }).join('');

    const html = `
      <div class="modal-header">
        <div class="modal-title">발주서 수정 — ${poNo}</div>
        <button class="modal-close">×</button>
      </div>
      <div class="modal-body">
        <div style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.3);border-radius:6px;padding:9px 14px;margin-bottom:12px;font-size:0.78rem">
          ⚠️ 개정 이력이 <strong>po_revisions</strong>에 영구 기록됩니다. 부분입고 후 수정은 차단됩니다.
        </div>
        <div class="grid-form" style="margin-bottom:14px;grid-template-columns:repeat(3,1fr)">
          <div class="form-group">
            <label>거래처 <span class="required">*</span></label>
            <select id="edit-vendor">${vendorOpts}</select>
            <div id="vendor-change-badge" style="font-size:0.7rem;margin-top:3px"></div>
          </div>
          <div class="form-group">
            <label>납기요청일</label>
            <input type="date" id="edit-delivery" value="${po.delivery_due_date||''}">
          </div>
          <div class="form-group">
            <label>비고</label>
            <input type="text" id="edit-notes" value="${po.notes||''}">
          </div>
        </div>
        <div style="font-size:0.78rem;font-weight:600;margin-bottom:6px;color:var(--text-muted)">품목 (수량·단가)</div>
        <div class="table-responsive">
          <table class="table table-sm" id="edit-po-table">
            <thead><tr>
              <th>품목</th>
              <th class="num">기존수량</th><th style="width:90px">수정수량</th>
              <th class="num">기존단가</th><th style="width:130px">수정단가</th>
              <th class="num">금액</th><th style="width:60px"></th>
            </tr></thead>
            <tbody>${buildItemRows(po.items)}</tbody>
            <tfoot><tr>
              <td colspan="5" class="text-right font-bold">합계</td>
              <td class="num font-bold text-primary" id="edit-po-total">${formatCurrency(po.total_amount)}</td>
            </tr></tfoot>
          </table>
        </div>
        <div id="map-report-preview" style="margin-top:10px"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary modal-close">취소</button>
        <button class="btn btn-primary" id="confirm-edit-btn">변경사항 저장</button>
      </div>
    `;
    openModal(html, 'max-width:960px', { persistent: true });

    const recalc = () => {
      let total = 0;
      document.querySelectorAll('#edit-po-table tbody tr').forEach(tr => {
        const excluded = tr.querySelector('.exclude-item')?.checked;
        tr.style.opacity = excluded ? '0.35' : '1';
        if (excluded) { tr.querySelector('.edit-amount').textContent = '제외'; return; }
        const q = parseFloat(tr.querySelector('.edit-qty').value)   || 0;
        const p = parseFloat(tr.querySelector('.edit-price').value) || 0;
        tr.querySelector('.edit-amount').textContent = formatCurrency(q * p);
        total += q * p;
        const mat  = matMap[tr.dataset.code];
        const hint = tr.querySelector('.map-hint');
        if (mat && p > 0) {
          const map = mat.avg_price || 0;
          const ppv = map > 0 ? ((p - map) / map * 100).toFixed(1) : null;
          const existing = hint.textContent.split('|')[0];
          const mapPart  = ppv !== null ? `MAP: ${formatCurrency(map)} | PPV: ${ppv>=0?'+':''}${ppv}%` : '';
          if (mapPart) hint.textContent = [existing.trim(), mapPart].filter(Boolean).join(' | ');
          hint.style.color = ppv > 10 ? 'var(--danger)' : ppv > 5 ? 'var(--warning)' : ppv < -5 ? 'var(--success)' : 'var(--text-muted)';
        }
      });
      document.getElementById('edit-po-total').textContent = formatCurrency(total);
    };

    const wireTableEvents = () => {
      document.querySelectorAll('#edit-po-table .edit-qty, #edit-po-table .edit-price').forEach(el => el.addEventListener('input', recalc));
      document.querySelectorAll('#edit-po-table .exclude-item').forEach(chk => chk.addEventListener('change', recalc));
    };

    // 거래처 변경 핸들러 — vendor-check + last-prices 재매핑 + variance (LH-044/045)
    const onVendorChange = async (newVendorCode) => {
      // pre-await: DOM은 아직 살아있음
      const badge = document.getElementById('vendor-change-badge');
      if (!badge) return; // 모달이 이미 닫힌 경우 조기 종료
      if (newVendorCode === po.vendor_code) { badge.innerHTML = ''; return; }
      badge.textContent = '검증 중...'; badge.style.color = 'var(--text-muted)';
      const matCodes = po.items.map(it => it.material_code).join(',');
      try {
        const check = await API.get(`/purchase-orders/vendor-check?vendor_code=${newVendorCode}&material_codes=${matCodes}`);

        // post-await: 모달이 닫혔을 수 있으므로 전부 null-guard (LH-045)
        const tbody = document.querySelector('#edit-po-table tbody');
        const badgeEl = document.getElementById('vendor-change-badge');
        if (!tbody || !badgeEl) return; // 모달 소멸 → 조용히 종료

        const vcMap   = Object.fromEntries(check.items.map(c => [c.material_code, c]));
        const remapped = po.items.map(it => ({ ...it, unit_price: vcMap[it.material_code]?.last_price || it.unit_price }));

        tbody.innerHTML = buildItemRows(remapped, vcMap);
        wireTableEvents();

        const oldTotal = po.items.reduce((s,it) => s + it.qty * it.unit_price, 0);
        const newTotal = remapped.reduce((s,it) => s + it.qty * it.unit_price, 0);
        const diff     = newTotal - oldTotal;
        const diffPct  = oldTotal > 0 ? ((diff/oldTotal)*100).toFixed(1) : '0';
        const varColor = diff > 0 ? 'var(--danger)' : diff < 0 ? 'var(--success)' : 'var(--text-muted)';
        const noHistory = check.items.filter(c => !c.has_history);

        badgeEl.innerHTML = `
          <span style="color:${noHistory.length?'var(--warning)':'var(--success)'}">
            ${noHistory.length ? `⚠️ 이력없음 ${noHistory.length}건 (제외 선택 가능)` : `✓ ${check.vendor_name} 전 품목 이력 확인`}
          </span>
          <span style="margin-left:10px;color:${varColor};font-weight:600">
            예산변동: ${diff>=0?'+':''}${formatCurrency(diff)} (${diffPct}%)
          </span>`;

        recalc();
      } catch (e) {
        const b = document.getElementById('vendor-change-badge');
        if (b) { b.textContent = `검증 실패: ${e.message}`; b.style.color = 'var(--danger)'; }
      }
    };

    document.getElementById('edit-vendor').addEventListener('change', e => onVendorChange(e.target.value));
    wireTableEvents();
    recalc();

    document.getElementById('confirm-edit-btn').addEventListener('click', () => {
      const newVendor   = document.getElementById('edit-vendor').value;
      const newDelivery = document.getElementById('edit-delivery').value;
      const newNotes    = document.getElementById('edit-notes').value;
      const items = [];
      let changed = newVendor !== po.vendor_code
        || newDelivery !== (po.delivery_due_date||'')
        || newNotes    !== (po.notes||'');

      document.querySelectorAll('#edit-po-table tbody tr').forEach((tr, i) => {
        if (tr.querySelector('.exclude-item')?.checked) { changed = true; return; } // excluded
        const newQty   = parseFloat(tr.querySelector('.edit-qty').value)   || 0;
        const newPrice = parseFloat(tr.querySelector('.edit-price').value) || 0;
        const orig = po.items[i];
        if (newQty !== orig.qty || newPrice !== orig.unit_price) changed = true;
        items.push({ material_code: tr.dataset.code, qty: newQty, unit_price: newPrice });
      });
      if (!changed) return showToast('변경된 내용이 없습니다.', 'warning');

      const vendorLabel = newVendor !== po.vendor_code
        ? `거래처 변경 포함 — 입고전표 거래처도 함께 수정됩니다. ` : '';
      // ⚠️ confirmDialog는 openModal()로 기존 모달을 덮어씀 → callback 내 editPO DOM 전부 null
      // → report는 callback에서 새 openModal()로 표시 (LH-045)
      confirmDialog(`${vendorLabel}발주서 ${poNo}를 수정하시겠습니까?`, async () => {
        try {
          const r = await API.put(`/purchase-orders/${id}`, {
            vendor_code:       newVendor !== po.vendor_code ? newVendor : undefined,
            delivery_due_date: newDelivery || undefined,
            notes:             newNotes,
            items,
          });
          await loadData();

          const bv = r.budget_variance;
          if (r.map_report?.length || bv) {
            const c    = bv ? (bv.diff > 0 ? 'var(--danger)' : bv.diff < 0 ? 'var(--success)' : 'inherit') : '';
            const bvHtml = bv ? `
              <div style="display:flex;flex-wrap:wrap;gap:16px;padding:8px 12px;background:rgba(99,102,241,0.05);border-radius:5px;font-size:0.82rem;margin-bottom:10px">
                <span>기존 총액: <strong>${formatCurrency(bv.before_total)}</strong></span>
                <span>수정 총액: <strong>${formatCurrency(bv.after_total)}</strong></span>
                <span style="color:${c};font-weight:700">차액: ${bv.diff>=0?'+':''}${formatCurrency(bv.diff)} (${bv.diff_pct}%)</span>
                ${bv.vendor_changed ? '<span style="color:var(--warning)">⚠️ 거래처 변경 포함</span>' : ''}
              </div>` : '';
            const mapRows = (r.map_report||[]).map(m => `
              <tr>
                <td>${m.material_name}</td>
                <td class="num">${formatCurrency(m.before_price)}</td>
                <td class="num">${formatCurrency(m.after_price)}</td>
                <td class="num" style="color:${m.ppv_pct>0?'var(--danger)':m.ppv_pct<0?'var(--success)':'inherit'}">${m.ppv_pct>=0?'+':''}${m.ppv_pct}%</td>
                <td class="num">${formatCurrency(m.current_map)}</td>
                <td class="num font-bold" style="color:var(--primary)">${formatCurrency(m.expected_map)}</td>
              </tr>`).join('');
            // editPO 모달은 confirmDialog가 이미 닫았으므로 새 모달로 표시
            openModal(`
              <div class="modal-header">
                <div class="modal-title">📊 원가·예산 영향 리포트 — ${poNo}</div>
                <button class="modal-close">×</button>
              </div>
              <div class="modal-body">
                ${bvHtml}
                ${mapRows ? `<table class="table table-sm" style="font-size:0.82rem">
                  <thead><tr><th>품목</th><th class="num">기존단가</th><th class="num">수정단가</th><th class="num">PPV</th><th class="num">현재MAP</th><th class="num">예상MAP</th></tr></thead>
                  <tbody>${mapRows}</tbody>
                </table>` : '<p style="color:var(--text-muted);font-size:0.85rem">단가 변경 없음 (수량·납기·거래처만 수정)</p>'}
              </div>
              <div class="modal-footer"><button class="btn btn-primary modal-close">확인</button></div>
            `, 'max-width:760px');
            showToast(`${poNo} 수정 완료${r.map_report?.length ? ` — PPV 변동 ${r.map_report.length}건` : ''}`, 'success', 4000);
          } else {
            showToast(`${poNo} 수정 완료`, 'success');
          }
        } catch (err) { showToast(err.message, 'error'); }
      });
    });
  }

  async function viewRevisions(id, poNo) {
    const revs = await API.get(`/purchase-orders/${id}/revisions`);
    const rows = revs.length
      ? revs.map(r => `<tr>
          <td class="num">${r.revision_no}</td>
          <td>${r.changed_at?.slice(0,16) || '-'}</td>
          <td>${r.changed_by || '-'}</td>
          <td>${r.change_summary || '-'}</td>
        </tr>`).join('')
      : `<tr><td colspan="4" style="text-align:center;color:var(--text-muted)">개정 이력 없음</td></tr>`;
    const html = `
      <div class="modal-header">
        <div class="modal-title">개정 이력 — ${poNo}</div>
        <button class="modal-close">×</button>
      </div>
      <div class="modal-body">
        <table class="table table-sm">
          <thead><tr><th>Rev.</th><th>변경일시</th><th>변경자</th><th>내용</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="modal-footer"><button class="btn btn-secondary modal-close">닫기</button></div>
    `;
    openModal(html, 'max-width:640px');
  }

  async function sendEmail(poId, poNo, vendorEmail) {
    const po = await API.get(`/purchase-orders/${poId}`).catch(() => null);
    showEmailModal({
      to: po?.vendor_email || vendorEmail || '',
      subject: `[발주서] ${poNo} 송부드립니다`,
      body: `안녕하세요,\n\n발주번호 ${poNo}에 대한 발주서를 송부드립니다.\n\n발주금액: ${po ? formatCurrency(po.total_amount) : ''}\n납기예정: ${po?.delivery_due_date || '-'}\n\n확인 후 회신 부탁드립니다.\n\n감사합니다.`,
      docType: 'purchase_order',
      docId: poId,
    });
  }

  return { render, openForm, viewDetail, exportExcel, cancelPO, deletePO, viewRevisions, editPO, reset, sendEmail };
})();

window.Purchasing = Purchasing;
