/* ─── Receipts Module (V10.2) ─── */
const Receipts = (() => {
  let _data = [];
  let _filters = { status: '', from: '', to: '' };
  let _isFiltered = false;

  // 품목 캐시 — 30s TTL, addItem 호출마다 API 반복 호출 방지 (LH-019)
  let _matCache = null, _matCacheTs = 0;
  async function _getMaterials() {
    const now = Date.now();
    if (_matCache && now - _matCacheTs < 30000) return _matCache;
    _matCache = await API.get('/materials');
    _matCacheTs = now;
    return _matCache;
  }

  function reset() {
    _filters = { status: '', from: '', to: '' };
    _isFiltered = false;
  }

  async function render(params = {}) {
    if (params.filter === 'pending_today') {
      _filters.status = 'inspecting';
      _filters.from = today();
      _filters.to = today();
      _isFiltered = true;
    }

    const container = document.getElementById('page-container');
    const thisMonth = currentMonth();
    if (!_filters.from) _filters.from = thisMonth + '-01';
    if (!_filters.to) _filters.to = today();

    let bannerHTML = '';
    if (_isFiltered) {
      bannerHTML = `
        <div class="filter-active-banner">
          <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clip-rule="evenodd"/></svg>
          <span>현재 적용된 필터: <strong>금일 입고/검수 예정 건</strong></span>
          <button class="btn btn-xs btn-ghost" onclick="Receipts.clearFilters()" style="margin-left:auto;color:white;text-decoration:underline">필터 해제</button>
        </div>
      `;
    }

    container.innerHTML = `
      <div class="animate-fade">
        ${bannerHTML}
        <div class="page-header">
          <div>
            <h2 class="page-title">입고 처리</h2>
            <p class="page-subtitle">발주서 연동 입고 및 실시간 단가 이력 조제</p>
          </div>
          <div class="header-actions">
            <button class="btn btn-secondary" id="rc-scan-btn" title="폴더에서 거래명세서 자동 추출">
              <svg viewBox="0 0 20 20" fill="currentColor" style="width:14px;height:14px;margin-right:4px"><path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"/></svg>
              폴더 스캔
            </button>
            <button class="btn btn-primary" id="rc-add-btn">
              <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd"/></svg>
              신규 입고 등록
            </button>
          </div>
        </div>
        <div class="filter-bar">
          <select id="rc-status" style="width:120px">
            <option value="" ${_filters.status===''?'selected':''}>전체 상태</option>
            <option value="draft" ${_filters.status==='draft'?'selected':''}>초안</option>
            <option value="inspecting" ${_filters.status==='inspecting'?'selected':''}>검수중</option>
            <option value="confirmed" ${_filters.status==='confirmed'?'selected':''}>확정</option>
            <option value="closed" ${_filters.status==='closed'?'selected':''}>마감</option>
            <option value="cancelled" ${_filters.status==='cancelled'?'selected':''}>취소</option>
          </select>
          <input type="date" id="rc-from" value="${_filters.from}" style="width:140px">
          <input type="date" id="rc-to" value="${_filters.to}" style="width:140px">
          <button class="btn btn-secondary" id="rc-search-btn">조회</button>
        </div>
        <div class="table-container" id="rc-table-wrap">${loadingHTML()}</div>
      </div>
    `;

    document.getElementById('rc-add-btn').onclick = () => openForm();
    document.getElementById('rc-scan-btn').onclick = () => triggerScan('rc-scan-btn', loadData, 'inbound');
    document.getElementById('rc-search-btn').onclick = () => {
      _filters.status = document.getElementById('rc-status').value;
      _filters.from = document.getElementById('rc-from').value;
      _filters.to = document.getElementById('rc-to').value;
      loadData();
    };
    await loadData();
  }

  async function loadData() {
    const wrap = document.getElementById('rc-table-wrap');
    if (!wrap) return;
    try {
      const params = new URLSearchParams(_filters);
      _data = await API.get('/receipts?' + params.toString());
      renderTable();
    } catch (err) { wrap.innerHTML = `<div class="alert alert-danger">${err.message}</div>`; }
  }

  function renderTable() {
    const wrap = document.getElementById('rc-table-wrap');
    if (!wrap) return;
    if (!_data.length) { wrap.innerHTML = emptyHTML('입고 전표가 없습니다'); return; }

    const hasCancelled = _data.some(r => r.status === 'cancelled');

    wrap.innerHTML = `
      ${hasCancelled ? `
      <div style="display:flex;align-items:center;gap:8px;padding:8px 4px;margin-bottom:4px">
        <label style="display:flex;align-items:center;gap:6px;font-size:0.82rem;cursor:pointer">
          <input type="checkbox" id="rc-select-all-cancelled"> 취소 전표 전체 선택
        </label>
        <button class="btn btn-xs btn-danger" id="rc-bulk-purge">선택 영구 삭제</button>
      </div>` : ''}
      <div class="table-responsive">
        <table class="table">
          <thead><tr>
            ${hasCancelled ? '<th style="width:32px"></th>' : ''}
            <th>전표번호</th><th>발행번호</th><th>입고일</th><th>등록시간</th><th>거래처</th><th>상태</th><th>품목수</th><th>작업</th>
          </tr></thead>
          <tbody>${_data.map(r => `
            <tr${r.needs_review ? ' style="background:rgba(245,158,11,0.05)"' : ''}>
              ${hasCancelled ? `<td>${r.status==='cancelled' ? `<input type="checkbox" class="rc-cancel-chk" data-id="${r.id}">` : ''}</td>` : ''}
              <td class="mono font-bold">${r.receipt_no}</td>
              <td class="mono" style="font-size:0.8rem;color:var(--text-muted)">${r.doc_number||'-'}</td>
              <td>${formatDate(r.date)}</td>
              <td class="mono" style="font-size:0.8rem;color:var(--text-muted)">${r.created_at ? r.created_at.slice(11,19) : '-'}</td>
              <td>${r.vendor_name||'-'}</td>
              <td>${receiptStatusBadge(r.status)}${r.needs_review ? ' <span class="badge" style="background:rgba(245,158,11,0.15);color:#d97706;font-size:0.7rem">⚠️검토</span>' : ''}</td>
              <td class="num">${r.item_count}개</td>
              <td class="table-actions">
                <button class="btn btn-xs btn-secondary" onclick="Receipts.viewDetail('${r.id}')">상세</button>
                ${!['confirmed','closed','cancelled'].includes(r.status) ? `
                  <button class="btn btn-xs btn-success" onclick="Receipts.confirm('${r.id}')">확정</button>
                ` : ''}
                ${r.status === 'confirmed' && r.has_inspection_stock ? `
                  <button class="btn btn-xs btn-warning" onclick="Receipts.approveInspection('${r.id}','${r.receipt_no}')" title="검수 재고 → 가용 재고 전환">검수승인</button>
                ` : ''}
                ${r.status !== 'cancelled' ? `<button class="btn btn-xs btn-danger" onclick="Receipts.cancel('${r.id}','${r.receipt_no}')">취소</button>` : ''}
                ${r.status === 'cancelled' ? `<button class="btn btn-xs btn-danger" style="background:var(--danger-dark,#b91c1c)" onclick="Receipts.purge('${r.id}','${r.receipt_no}')">영구삭제</button>` : ''}
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    `;

    if (hasCancelled) {
      document.getElementById('rc-select-all-cancelled')?.addEventListener('change', e => {
        document.querySelectorAll('.rc-cancel-chk').forEach(cb => cb.checked = e.target.checked);
      });
      document.getElementById('rc-bulk-purge')?.addEventListener('click', () => {
        const ids = [...document.querySelectorAll('.rc-cancel-chk:checked')].map(cb => cb.dataset.id);
        if (!ids.length) { showToast('삭제할 전표를 선택하세요.', 'warning'); return; }
        Receipts.bulkPurge(ids);
      });
    }
  }

  async function openForm(id = null) {
    let r = { date: today(), inspection_type: '검사', warehouse_code: 'WH-001' };
    const isEdit = !!id;
    if (isEdit) r = await API.get(`/receipts/${id}`);
    const [vendors, whOpts] = await Promise.all([
      API.get('/partners?type=vendor'),
      warehouseOptions(r.warehouse_code)
    ]);

    const html = `
      <div class="modal-header">
        <div class="modal-title">${isEdit ? '입고 전표 수정' : '신규 입고 등록'}</div>
        <button class="modal-close">×</button>
      </div>
      <div class="modal-body">
        <!-- 입고일 — 최우선 필드 (LH-024) -->
        <div style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:8px;padding:12px 16px;margin-bottom:14px">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
            <div>
              <label style="font-size:0.78rem;color:var(--text-muted);display:block;margin-bottom:4px">
                실제 입고일 <span class="required">*</span>
                <span style="font-size:0.7rem;font-weight:400;margin-left:6px">전산 등록 시각은 저장 시점 자동 기입</span>
              </label>
              <input type="date" name="date" id="f-inbound-date" value="${r.date}" max="${today()}" required
                style="font-size:1rem;padding:6px 10px;border:2px solid var(--primary);border-radius:6px;background:var(--bg-input,#1e2030);color:var(--text);width:180px">
            </div>
            <div id="retroactive-warning" style="display:none;padding:7px 12px;background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.4);border-radius:6px;font-size:0.8rem;color:#d97706;max-width:340px">
              ⚠️ <strong>소급 입력 중입니다.</strong> 재고 마감 기간을 확인하세요.
            </div>
          </div>
        </div>

        <div style="display:flex; justify-content:flex-end; margin-bottom:12px">
          ${!isEdit ? '<button class="btn btn-sm btn-outline-primary" id="btn-load-po">발주서(PO) 불러오기</button>' : ''}
        </div>
        <form id="receipt-form">
          <input type="hidden" name="date" id="f-date-hidden" value="${r.date}">
          <div class="form-grid">
            <div class="form-group" style="grid-column:1/-1">
              <label>매입처 (Vendor)</label>
              <select name="vendor_code" id="f-vendor">
                <option value="">거래처 선택 (PO 연동 시 자동)</option>
                ${vendors.map(p => `<option value="${p.code}" ${r.vendor_code===p.code?'selected':''}>${p.name} (${p.code})</option>`).join('')}
              </select>
            </div>
            <input type="hidden" name="po_id" id="f-po-id" value="${r.po_id||''}">
            <div class="form-group"><label>입고창고</label><select name="warehouse_code">${whOpts}</select></div>
            <div class="form-group"><label>검사유형</label>
              <select name="inspection_type">
                ${['검사','무검사','보류'].map(t => `<option value="${t}" ${r.inspection_type===t?'selected':''}>${t}</option>`).join('')}
              </select>
            </div>
          </div>

          <div style="margin-top:20px; border-top:1px solid var(--border); padding-top:20px">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px">
              <h4 style="font-size:0.9rem">입고 품목</h4>
              <button type="button" class="btn btn-xs btn-secondary" id="btn-add-item">품목 추가</button>
            </div>
            <div class="table-container">
              <table class="table table-sm" id="receipt-items-table">
                <thead><tr><th>품목</th><th>발주수량</th><th>입고수량</th><th>단가</th><th>금액</th><th></th></tr></thead>
                <tbody></tbody>
              </table>
            </div>
          </div>
        </form>
        <div id="f-po-ref" style="display:none;font-size:0.75rem;color:var(--text-muted);margin-top:8px;padding:4px 8px;border-left:3px solid var(--info,#06b6d4)"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary modal-close">취소</button>
        <button class="btn btn-primary" id="btn-save-receipt">전표 저장</button>
      </div>
    `;
    openModal(html, 'max-width:860px');
    const form = document.getElementById('receipt-form');
    if (!isEdit) FormPersistence.bind('rc-add', form);

    // 소급 입력 경고 — 실시간 (3일 이상 과거)
    const datePicker = document.getElementById('f-inbound-date');
    const hiddenDate = document.getElementById('f-date-hidden');
    const saveBtn = document.getElementById('btn-save-receipt');
    const warnEl = document.getElementById('retroactive-warning');

    function onDateChange() {
      const v = datePicker.value;
      hiddenDate.value = v;
      saveBtn.disabled = !v;
      if (!v) { warnEl.style.display = 'none'; return; }
      const diffDays = Math.floor((new Date(today()) - new Date(v)) / 86400000);
      warnEl.style.display = diffDays >= 3 ? '' : 'none';
      if (diffDays >= 3) {
        warnEl.innerHTML = `⚠️ <strong>소급 입력 중입니다.</strong> 기준일로부터 <strong>${diffDays}일 전</strong> 날짜입니다. 마감 기간을 확인하세요.`;
      }
    }
    datePicker.addEventListener('change', onDateChange);
    onDateChange(); // 초기화

    if (!isEdit) {
      document.getElementById('btn-load-po').onclick = () => Receipts.lookupPO();
    }
    document.getElementById('btn-add-item').onclick = () => addItem();
    document.getElementById('btn-save-receipt').onclick = async () => {
      const dateVal = document.getElementById('f-inbound-date').value;
      if (!dateVal) return showToast('입고일자를 선택하세요.', 'error');
      const formData = Object.fromEntries(new FormData(form));
      formData.date = dateVal; // date hidden 동기화 보장
      const items = [];
      document.querySelectorAll('#receipt-items-table tbody tr').forEach(tr => {
        const mat = tr.querySelector('.item-mat').value;
        if (mat) items.push({
          material_code: mat,
          ordered_qty: parseFloat(tr.querySelector('.item-oqty').value) || 0,
          received_qty: parseFloat(tr.querySelector('.item-rqty').value) || 0,
          unit_price: parseFloat(tr.querySelector('.item-price').value) || 0
        });
      });
      try {
        await API.post('/receipts', { ...formData, items });
        FormPersistence.clear('rc-add');
        showToast('전표가 저장되었습니다.', 'success');
        closeModal();
        await loadData();
      } catch (err) { showToast(err.message, 'error'); }
    };

    if (isEdit) {
      r.items.forEach(it => addItem(it.material_code, it.ordered_qty, it.received_qty, it.unit_price));
    }
  }

  // PO 로드 후 참조 날짜 힌트 표시
  function _showPODateHint(poOrderDate) {
    const ref = document.getElementById('f-po-ref');
    if (!ref) return;
    ref.style.display = '';
    ref.textContent = `📌 PO 발주일 기준: ${poOrderDate} — 실제 입고일이 다르면 위 날짜 필드를 수정하세요.`;
  }

  async function addItem(code = '', ordered_qty = 0, received_qty = 0, unit_price = 0) {
    const materials = await _getMaterials();
    const matMap = {};
    materials.forEach(m => matMap[m.code] = m);
    const tbody = document.querySelector('#receipt-items-table tbody');
    const tr = document.createElement('tr');

    tr.innerHTML = `
      <td>
        <select name="material_code" class="item-mat" required style="width:220px">
          <option value="">품목 선택</option>
          ${materials.map(m => `<option value="${m.code}" ${m.code===code?'selected':''}>${m.name} (${m.code})</option>`).join('')}
        </select>
      </td>
      <td><input type="number" class="item-oqty" value="${ordered_qty}" step="0.01" style="width:80px"></td>
      <td><input type="number" class="item-rqty" value="${received_qty || ordered_qty}" step="0.01" style="width:80px"></td>
      <td>
        <input type="number" class="item-price" value="${unit_price || 0}" min="0" placeholder="0" style="width:110px">
        <div class="item-price-hint" style="font-size:0.7rem;color:var(--text-muted);margin-top:2px;white-space:nowrap"></div>
      </td>
      <td class="item-total num">0원</td>
      <td><button type="button" class="btn-icon text-danger remove-row">×</button></td>
    `;
    tbody.appendChild(tr);

    const updateRow = () => {
      const q = parseFloat(tr.querySelector('.item-rqty').value) || 0;
      const p = parseFloat(tr.querySelector('.item-price').value) || 0;
      tr.querySelector('.item-total').textContent = formatCurrency(q * p);

      // PPV 인디케이터
      const mCode = tr.querySelector('.item-mat').value;
      const mat = matMap[mCode];
      const stdPrice = mat ? (mat.standard_price || mat.standard_unit_price || 0) : 0;
      const hint = tr.querySelector('.item-price-hint');
      if (stdPrice > 0 && p > 0) {
        const ppv = (p - stdPrice) / stdPrice * 100;
        const icon = Math.abs(ppv) >= 10 ? '🔴' : Math.abs(ppv) >= 5 ? '⚠️' : '✓';
        hint.innerHTML = `${icon} 기준: ${formatCurrency(stdPrice)} (${ppv > 0 ? '+' : ''}${ppv.toFixed(1)}%)`;
        hint.style.color = Math.abs(ppv) >= 10 ? 'var(--danger)' : Math.abs(ppv) >= 5 ? 'var(--warning)' : 'var(--success)';
      } else {
        hint.textContent = '';
      }
    };

    tr.querySelector('.item-rqty').oninput  = updateRow;
    tr.querySelector('.item-price').oninput = updateRow;
    tr.querySelector('.remove-row').onclick = () => tr.remove();

    tr.querySelector('.item-mat').onchange = async () => {
      const mCode = tr.querySelector('.item-mat').value;
      if (!mCode) return;
      const mat = matMap[mCode];
      // 단가 우선순위: last_purchase_price → standard_price → avg_price
      let bestPrice = 0;
      let priceSource = '';
      try {
        const trend = await API.get(`/receipts/items/${mCode}/price-trend`);
        if (trend?.length) {
          bestPrice = trend[trend.length - 1].unit_price;
          priceSource = `최근매입 (${formatCurrency(bestPrice)})`;
        }
      } catch (_) {}
      if (!bestPrice && mat) {
        bestPrice = mat.last_purchase_price || mat.standard_price || mat.standard_unit_price || mat.avg_price || 0;
        priceSource = mat.last_purchase_price ? `최근매입 (${formatCurrency(mat.last_purchase_price)})` : `기준가 (${formatCurrency(bestPrice)})`;
      }
      if (bestPrice) {
        tr.querySelector('.item-price').value = bestPrice;
        if (priceSource) showToast(`단가 자동기입: ${priceSource}`, 'info', 2500);
      }
      updateRow();
    };

    if (code) {
      const mat = matMap[code];
      if (mat && !unit_price) {
        tr.querySelector('.item-price').value = mat.last_purchase_price || mat.standard_price || mat.avg_price || 0;
      }
    }
    updateRow();
  }

  async function lookupPO() {
    try {
      const openPOs = await API.get('/purchase-orders/open');
      if (!openPOs.length) return showToast('조회 가능한 미입고 발주서가 없습니다.', 'warning');

      const html = `
        <div class="modal-header">
          <div class="modal-title">발주서 선택 <span style="font-size:0.78rem;color:var(--text-muted);font-weight:400">(복수 선택 가능)</span></div>
          <button class="modal-close" id="po-lookup-x">×</button>
        </div>
        <div class="modal-body">
          <div class="table-container" style="max-height:380px;overflow-y:auto">
            <table class="table table-sm">
              <thead><tr>
                <th style="width:32px"><input type="checkbox" id="po-chk-all" title="전체선택"></th>
                <th>발주번호</th><th>거래처</th><th>발주일</th><th>납기일</th>
              </tr></thead>
              <tbody>${openPOs.map(po => `
                <tr>
                  <td><input type="checkbox" class="po-chk" data-id="${po.id}" data-no="${po.po_no}"></td>
                  <td class="mono font-bold">${po.po_no}</td>
                  <td>${po.vendor_name}</td>
                  <td>${po.order_date}</td>
                  <td>${po.delivery_due_date || '-'}</td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="po-lookup-cancel">취소</button>
          <button class="btn btn-primary" id="po-lookup-confirm">선택한 발주서 불러오기</button>
        </div>
      `;
      const overlay = document.createElement('div');
      overlay.id = 'po-lookup-overlay';
      overlay.className = 'modal-overlay';
      overlay.style.zIndex = '2100';
      overlay.innerHTML = `<div class="modal-container" style="max-width:640px">${html}</div>`;
      document.body.appendChild(overlay);
      overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
      overlay.querySelector('#po-lookup-x').onclick = () => overlay.remove();
      overlay.querySelector('#po-lookup-cancel').onclick = () => overlay.remove();

      // 전체선택 토글
      overlay.querySelector('#po-chk-all').onchange = (e) => {
        overlay.querySelectorAll('.po-chk').forEach(cb => { cb.checked = e.target.checked; });
      };

      overlay.querySelector('#po-lookup-confirm').onclick = async () => {
        const selected = [...overlay.querySelectorAll('.po-chk:checked')].map(cb => cb.dataset.id);
        if (!selected.length) return showToast('발주서를 하나 이상 선택하세요.', 'warning');
        overlay.remove();
        await loadMultiplePOs(selected);
      };
    } catch (err) { showToast(err.message, 'error'); }
  }

  async function loadMultiplePOs(ids) {
    const tbody = document.querySelector('#receipt-items-table tbody');
    const existingCodes = new Set(
      [...tbody.querySelectorAll('.item-mat')].map(s => s.value).filter(Boolean)
    );
    const loadedNos = [];
    let firstVendor = null;
    let firstPoId = null;

    for (const id of ids) {
      try {
        const po = await API.get(`/purchase-orders/${id}`);
        if (!firstVendor) {
          firstVendor = po.vendor_code;
          firstPoId = po.id;
        }
        loadedNos.push(po.po_no);
        po.items.forEach(it => {
          const rem = (it.qty || 0) - (it.received_qty || 0);
          if (rem <= 0) return;
          if (existingCodes.has(it.material_code)) {
            // 중복 품목: 수량 누적
            const existingRow = [...tbody.querySelectorAll('tr')].find(tr =>
              tr.querySelector('.item-mat')?.value === it.material_code
            );
            if (existingRow) {
              const rqtyInput = existingRow.querySelector('.item-rqty');
              rqtyInput.value = parseFloat(rqtyInput.value || 0) + rem;
              rqtyInput.dispatchEvent(new Event('input'));
            }
          } else {
            existingCodes.add(it.material_code);
            addItem(it.material_code, it.qty, rem, it.unit_price);
          }
        });
      } catch (e) { showToast(`PO 불러오기 실패: ${e.message}`, 'error'); }
    }

    if (firstVendor) {
      const vendorSel = document.getElementById('f-vendor');
      if (vendorSel && !vendorSel.value) vendorSel.value = firstVendor;
    }
    if (firstPoId) {
      const poIdField = document.getElementById('f-po-id');
      if (poIdField && !poIdField.value) poIdField.value = firstPoId;
    }
    if (loadedNos.length) {
      showToast(`발주서 ${loadedNos.join(', ')} 불러왔습니다.`, 'success');
      // PO 발주일 힌트 표시 (첫 번째 PO 기준)
      try {
        const firstPO = await API.get(`/purchase-orders/${ids[0]}`);
        if (firstPO?.order_date) _showPODateHint(firstPO.order_date);
      } catch (_) {}
    }
  }

  async function loadPOData(id) {
    try {
      const po = await API.get(`/purchase-orders/${id}`);
      document.getElementById('po-lookup-overlay')?.remove();
      document.getElementById('f-vendor').value = po.vendor_code;
      document.getElementById('f-po-id').value = po.id;
      const tbody = document.querySelector('#receipt-items-table tbody');
      tbody.innerHTML = '';
      po.items.forEach(it => {
        const rem = it.qty - (it.received_qty || 0);
        if (rem > 0) addItem(it.material_code, it.qty, rem, it.unit_price);
      });
      showToast(`발주서 ${po.po_no} 내용을 불러왔습니다.`, 'success');
      if (po.order_date) _showPODateHint(po.order_date);
    } catch (err) { showToast(err.message, 'error'); }
  }

  async function viewDetail(id) {
    const r = await API.get(`/receipts/${id}`);
    const lc = r.status === 'confirmed' ? await API.get(`/landing-cost/${r.id}`).catch(() => null) : null;

    // 10% 이상 괴리 시 적색, 5% 이상 황색 (v21)
    function priceVarianceStyle(unitPrice, refPrice) {
      if (!refPrice || refPrice === 0) return '';
      const diff = Math.abs(unitPrice - refPrice) / refPrice;
      if (diff >= 0.10) return 'color:#ef4444;font-weight:700';
      if (diff >= 0.05) return 'color:#d97706;font-weight:700';
      return '';
    }
    function priceVarianceTip(unitPrice, refPrice) {
      if (!refPrice || refPrice === 0) return '';
      const pct = ((unitPrice - refPrice) / refPrice * 100).toFixed(1);
      if (Math.abs(pct) < 5) return '';
      const icon = Math.abs(pct) >= 10 ? '🔴' : '⚠️';
      return ` title="기준단가 ${formatCurrency(refPrice)} 대비 ${pct}% 변동 ${icon}"`;
    }

    const itemRows = r.items.map(i => {
      const isDraft = i.is_draft === 1 || !!i.pending_name;
      // 기준단가: standard_price > standard_unit_price > avg_price 우선순위
      const refPrice = i.standard_price || i.standard_unit_price || i.avg_price_at_receipt || i.avg_price || 0;
      const varStyle = priceVarianceStyle(i.unit_price, refPrice);
      const varTip   = priceVarianceTip(i.unit_price, refPrice);
      const vendorName   = i.vendor_product_name || i.pending_name || i.material_name || '';
      const internalName = i.internal_product_name || i.material_name || '';
      const escapedV = vendorName.replace(/'/g, "\\'");
      const escapedI = internalName.replace(/'/g, "\\'");

      // 기준단가/최근매입단가 표시 (v20/v21)
      const stdPrice  = i.standard_price || i.standard_unit_price || 0;
      const lastPrice = i.last_purchase_price || 0;
      const priceTip = stdPrice > 0
        ? ` title="기준단가: ${formatCurrency(stdPrice)} | 최근매입: ${formatCurrency(lastPrice || i.unit_price)}"` : '';

      return `
        <tr${isDraft ? ' style="background:rgba(99,102,241,0.06)"' : ''}>
          <td>
            ${isDraft
              ? `<div style="color:#6366f1;font-weight:600;font-size:0.82rem">[신규제안]</div>
                 <div style="font-size:0.8rem;color:var(--text-muted)">업체명: ${vendorName}</div>
                 <div style="font-size:0.75rem;color:var(--text-muted)">${i.material_code}</div>`
              : `<div>${i.material_name || '-'}</div>
                 ${vendorName && vendorName !== i.material_name
                   ? `<div style="font-size:0.73rem;color:var(--text-muted)">업체: ${vendorName}</div>` : ''}`}
          </td>
          <td>
            ${internalName && !isDraft
              ? `<div style="font-size:0.78rem">${internalName}</div>` : ''}
            ${!isDraft && internalName !== vendorName && vendorName
              ? `<div style="font-size:0.72rem;color:var(--text-muted)">업체: ${vendorName}</div>` : ''}
          </td>
          <td class="num">${formatNumber(i.received_qty)} ${i.unit||''}</td>
          <td class="num" style="${varStyle}"${varTip}${priceTip}>
            ${formatCurrency(i.unit_price)}${varStyle ? ' ⚠️' : ''}
            ${stdPrice > 0 ? `<div style="font-size:0.7rem;color:var(--text-muted)">기준: ${formatCurrency(stdPrice)}</div>` : ''}
          </td>
          <td class="num font-bold">${formatCurrency(i.received_qty * i.unit_price)}</td>
          <td style="white-space:nowrap">
            ${isDraft
              ? `<button class="btn btn-xs btn-primary" onclick="Receipts.promoteDraft('${i.id}','${escapedV}',${i.unit_price},'${escapedI}')">마스터 등록</button>`
              : `<button class="btn btn-xs btn-secondary" onclick="Receipts.setInternalName('${i.id}','${escapedI}')" title="사내 품목명 설정">명칭</button>`}
            <button class="btn btn-xs btn-ghost" onclick="Receipts.showPriceTrend('${i.material_code}','${(i.material_name||'').replace(/'/g,"\\'")}'" title="단가 추이 차트">📈</button>
          </td>
        </tr>`;
    }).join('');

    const attachmentUrl = r.attachment_path ? `/${r.attachment_path}` : null;
    const isPDF = attachmentUrl && attachmentUrl.toLowerCase().endsWith('.pdf');

    const html = `
      <div class="modal-header">
        <div class="modal-title">입고 검수 — ${r.receipt_no} ${r.needs_review ? '<span style="color:#d97706;font-size:0.8rem">⚠️ 검토 필요</span>' : ''}</div>
        <button class="modal-close">×</button>
      </div>
      <div class="modal-body" style="padding:0">
        <div style="display:grid;grid-template-columns:${attachmentUrl ? '1fr 1fr' : '1fr'};height:70vh;overflow:hidden">

          ${attachmentUrl ? `
          <!-- 왼쪽: 원본 명세서 -->
          <div style="border-right:1px solid var(--border);overflow:auto;background:var(--bg-elevated)">
            <div style="padding:8px 12px;font-size:0.75rem;color:var(--text-muted);background:var(--bg-base);border-bottom:1px solid var(--border)">
              원본 명세서
            </div>
            ${isPDF
              ? `<iframe src="${attachmentUrl}" style="width:100%;height:calc(70vh - 33px);border:none"></iframe>`
              : `<img src="${attachmentUrl}" style="width:100%;object-fit:contain;padding:8px" onerror="this.style.display='none';this.nextElementSibling.style.display='block'">
                 <div style="display:none;padding:20px;text-align:center;color:var(--text-muted);font-size:0.85rem">이미지를 불러올 수 없습니다</div>`
            }
          </div>` : ''}

          <!-- 오른쪽: AI 판독 데이터 -->
          <div style="overflow-y:auto;padding:16px">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;font-size:0.82rem">
              <div>
                <span style="color:var(--text-muted)">입고일</span>
                ${['draft','inspecting','pending'].includes(r.status) ? `
                <div style="display:flex;align-items:center;gap:6px;margin-top:2px">
                  <input type="date" id="rc-date-edit" value="${r.date}" style="font-size:0.82rem;padding:2px 6px;border:1px solid var(--border);border-radius:4px;background:var(--bg-input,#1e2030);color:var(--text);width:140px">
                  <button class="btn btn-xs btn-primary" id="rc-date-save" title="입고일 저장">저장</button>
                </div>` : `<div style="font-weight:600">${r.date}</div>`}
              </div>
              <div>
                <span style="color:var(--text-muted)">전산 등록 시각</span>
                <div class="mono" style="font-size:0.78rem" title="조작 불가 시스템 기록 시각">
                  ${r.registered_at ? r.registered_at.slice(0,16).replace('T',' ') : (r.created_at ? r.created_at.slice(0,16) : '-')}
                  ${r.registered_at && r.date && r.registered_at.slice(0,10) !== r.date
                    ? `<span style="color:var(--warning);font-size:0.7rem;display:block">⚠️ 입고일 ≠ 등록일</span>` : ''}
                </div>
              </div>
              <div><span style="color:var(--text-muted)">발행번호</span><div class="mono" style="font-size:0.8rem">${r.doc_number||'-'}</div></div>
              <div><span style="color:var(--text-muted)">거래처</span><div>${r.vendor_name||'-'}</div></div>
              <div><span style="color:var(--text-muted)">상태</span><div>${receiptStatusBadge(r.status)}</div></div>
              <div>
                <span style="color:var(--text-muted)">3-Way</span>
                <div>${r.three_way_match === 1
                  ? '<span style="color:var(--success);font-size:0.8rem">✓ 일치</span>'
                  : r.three_way_match === 0
                    ? '<span style="color:var(--danger);font-size:0.8rem" title="PO단가·수량·기준단가 불일치 감지">⚠️ 불일치</span>'
                    : '<span style="color:var(--text-muted);font-size:0.78rem">-</span>'}</div>
              </div>
            </div>
            ${r.items.some(i => i.is_draft || i.pending_name) ? `
              <div style="padding:7px 10px;background:rgba(99,102,241,0.08);border-radius:5px;margin-bottom:10px;font-size:0.78rem;color:#6366f1">
                ℹ️ <strong>마스터에 없는 품목</strong>이 포함됩니다. [마스터 등록] 버튼으로 전환하세요.
              </div>` : ''}
            ${r.needs_review ? `
              <div style="padding:7px 10px;background:rgba(245,158,11,0.08);border-radius:5px;margin-bottom:10px;font-size:0.78rem;color:#d97706">
                ⚠️ 검산 불일치 또는 OCR 오류가 감지되었습니다. 수량·단가·금액을 직접 확인하세요.
              </div>` : ''}
            <table class="table table-sm" style="font-size:0.82rem">
              <thead><tr><th>업체 품목명</th><th>사내 품목명</th><th>수량</th><th>단가</th><th>금액</th><th></th></tr></thead>
              <tbody>${itemRows}</tbody>
            </table>
            <div style="font-size:0.78rem;color:var(--text-muted);margin-top:8px;border-top:1px solid var(--border);padding-top:8px">${r.notes||''}</div>

            ${lc ? `
            <div style="margin-top:12px;padding:10px 12px;background:rgba(16,185,129,0.07);border:1px solid rgba(16,185,129,0.25);border-radius:6px;font-size:0.8rem">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
                <strong style="color:#10b981">랜딩 코스트 ${lc.status === 'applied' ? '✓ 적용됨' : '(초안)'}</strong>
                ${lc.status !== 'applied' ? `<button class="btn btn-xs btn-primary" onclick="Receipts.openLandingCostModal('${r.id}')">수정/적용</button>` : ''}
              </div>
              <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px;font-size:0.75rem">
                <div><span style="color:var(--text-muted)">운임</span><div>${formatCurrency(lc.freight)}</div></div>
                <div><span style="color:var(--text-muted)">관세</span><div>${formatCurrency(lc.customs)}</div></div>
                <div><span style="color:var(--text-muted)">통관</span><div>${formatCurrency(lc.handling)}</div></div>
                <div><span style="color:var(--text-muted)">기타</span><div>${formatCurrency(lc.other_cost)}</div></div>
              </div>
              <div style="margin-top:6px;font-size:0.75rem">
                <strong>총 부대비용: ${formatCurrency(lc.total_surcharge)}</strong>
                <span style="margin-left:8px;color:var(--text-muted)">배부기준: ${lc.allocation_method === 'qty' ? '수량비중' : '금액비중'}</span>
                ${lc.applied_at ? `<span style="margin-left:8px;color:var(--text-muted)">적용: ${lc.applied_at.slice(0,16)} by ${lc.applied_by}</span>` : ''}
              </div>
              ${lc.items?.length ? `
              <table class="table table-sm" style="font-size:0.75rem;margin-top:8px">
                <thead><tr><th>품목</th><th class="num">기준단가</th><th class="num">배부액</th><th class="num">랜딩단가</th></tr></thead>
                <tbody>
                  ${lc.items.map(li => `<tr>
                    <td>${li.material_name||li.material_code}</td>
                    <td class="num">${formatCurrency(li.base_unit_price)}</td>
                    <td class="num" style="color:#10b981">+${formatCurrency(li.allocated_surcharge)}</td>
                    <td class="num font-bold">${formatCurrency(li.landed_unit_price)}</td>
                  </tr>`).join('')}
                </tbody>
              </table>` : ''}
            </div>` : ''}
          </div>
        </div>
      </div>
      <div class="modal-footer">
        ${r.status === 'confirmed' && !lc ? `<button class="btn btn-success" onclick="closeModal();Receipts.openLandingCostModal('${r.id}')">랜딩 코스트 입력</button>` : ''}
        <button class="btn btn-secondary modal-close">닫기</button>
      </div>
    `;
    openModal(html, 'modal-xl');

    document.getElementById('rc-date-save')?.addEventListener('click', async () => {
      const newDate = document.getElementById('rc-date-edit').value;
      if (!newDate) return showToast('날짜를 선택하세요.', 'error');
      try {
        await API.patch(`/receipts/${id}/date`, { date: newDate });
        showToast(`입고일 변경: ${newDate}`, 'success');
        closeModal();
        loadData();
      } catch (e) { showToast(e.message, 'error'); }
    });
  }

  async function promoteDraft(itemId, vendorName, unitPrice, currentInternal = '') {
    const html = `
      <div class="modal-header"><div class="modal-title">신규 품목 마스터 등록</div><button class="modal-close">×</button></div>
      <div class="modal-body">
        <div style="padding:8px 12px;background:rgba(99,102,241,0.07);border-radius:6px;margin-bottom:14px;font-size:0.82rem">
          <span style="color:var(--text-muted)">업체 품목명 (OCR 원본)</span>
          <div style="font-weight:700;color:#6366f1;margin-top:2px">${vendorName}</div>
        </div>
        <div class="form-grid">
          <div class="form-group" style="grid-column:1/-1">
            <label>사내 품목명 <span class="required">*</span> <span style="font-size:0.75rem;color:var(--text-muted)">(마스터에 저장될 표준 명칭)</span></label>
            <input id="pm-internal" value="${currentInternal || vendorName}" placeholder="예: 마이크로소프트 윈도우 11 프로 한글">
          </div>
          <div class="form-group"><label>분류</label><input id="pm-cat" value="미분류"></div>
          <div class="form-group"><label>규격</label><input id="pm-spec" placeholder="예: 64bit OEM"></div>
          <div class="form-group"><label>단위</label><input id="pm-unit" value="EA"></div>
          <div class="form-group">
            <label>기준 단가 (Standard Price)</label>
            <input id="pm-std-price" type="number" value="${unitPrice}" placeholder="마스터 기준단가">
          </div>
          <div class="form-group">
            <label>통화</label>
            <select id="pm-currency">
              <option value="KRW">KRW (원화)</option>
              <option value="USD">USD (달러)</option>
            </select>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary modal-close">취소</button>
        <button class="btn btn-primary" id="pm-save">정식 등록</button>
      </div>`;
    openModal(html);
    document.getElementById('pm-save').onclick = async () => {
      const internalName = document.getElementById('pm-internal').value.trim();
      if (!internalName) return showToast('사내 품목명을 입력하세요.', 'error');
      try {
        const res = await API.post(`/receipts/items/${itemId}/promote`, {
          name:                vendorName,
          internal_name:       internalName,
          category:            document.getElementById('pm-cat').value,
          spec:                document.getElementById('pm-spec').value,
          unit:                document.getElementById('pm-unit').value,
          avg_price:           parseFloat(document.getElementById('pm-std-price').value) || 0,
          standard_unit_price: parseFloat(document.getElementById('pm-std-price').value) || 0,
          currency:            document.getElementById('pm-currency').value,
        });
        showToast(res.message, 'success');
        closeModal();
      } catch (err) { showToast(err.message, 'error'); }
    };
  }

  async function setInternalName(itemId, currentName) {
    const html = `
      <div class="modal-header"><div class="modal-title">사내 품목명 설정</div><button class="modal-close">×</button></div>
      <div class="modal-body">
        <div class="form-group">
          <label>사내 품목명 <span style="font-size:0.75rem;color:var(--text-muted)">(업체 품목명과 다른 경우 입력)</span></label>
          <input id="sin-name" value="${currentName}" placeholder="예: 마이크로소프트 윈도우 11 프로 한글">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary modal-close">취소</button>
        <button class="btn btn-primary" id="sin-save">저장</button>
      </div>`;
    openModal(html, 'max-width:420px');
    document.getElementById('sin-save').onclick = async () => {
      const val = document.getElementById('sin-name').value.trim();
      if (!val) return showToast('사내 품목명을 입력하세요.', 'error');
      try {
        await API.patch(`/receipts/items/${itemId}/internal-name`, { internal_name: val });
        showToast('사내 품목명이 저장되었습니다.', 'success');
        closeModal();
      } catch (err) { showToast(err.message, 'error'); }
    };
  }

  async function showPriceTrend(materialCode, materialName) {
    const html = `
      <div class="modal-header">
        <div class="modal-title">단가 추이 — ${materialName || materialCode}</div>
        <button class="modal-close">×</button>
      </div>
      <div class="modal-body" style="padding:16px">
        <div id="price-trend-wrap" style="height:220px;display:flex;align-items:center;justify-content:center">
          <span style="color:var(--text-muted);font-size:0.85rem">로딩 중…</span>
        </div>
        <div id="price-trend-table" style="margin-top:12px;font-size:0.8rem"></div>
      </div>
      <div class="modal-footer"><button class="btn btn-secondary modal-close">닫기</button></div>`;
    openModal(html, 'max-width:480px');

    try {
      const data = await API.get(`/receipts/items/${materialCode}/price-trend`);
      const wrap = document.getElementById('price-trend-wrap');
      const tbl  = document.getElementById('price-trend-table');
      if (!data || data.length === 0) {
        wrap.innerHTML = '<span style="color:var(--text-muted)">단가 이력 없음</span>';
        return;
      }
      const labels = data.map(d => d.date);
      const prices = data.map(d => d.unit_price);
      wrap.innerHTML = '<canvas id="price-trend-chart"></canvas>';
      const ctx = document.getElementById('price-trend-chart');
      if (window.Chart && ctx) {
        new Chart(ctx, {
          type: 'line',
          data: {
            labels,
            datasets: [{ label: '매입단가', data: prices,
              borderColor: '#6C63FF', backgroundColor: 'rgba(108,99,255,0.1)',
              tension: 0.3, pointRadius: 5, fill: true }]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              y: { ticks: { callback: v => '₩' + v.toLocaleString('ko-KR') } }
            }
          }
        });
      }
      tbl.innerHTML = `<table class="table table-sm"><thead><tr><th>날짜</th><th>거래처</th><th class="num">단가</th></tr></thead><tbody>
        ${data.map(d => `<tr><td>${d.date}</td><td>${d.vendor_name||'-'}</td><td class="num">${formatCurrency(d.unit_price)}</td></tr>`).join('')}
      </tbody></table>`;
    } catch (err) {
      const wrap = document.getElementById('price-trend-wrap');
      if (wrap) wrap.innerHTML = `<span style="color:var(--danger);font-size:0.8rem">${err.message}</span>`;
    }
  }

  async function confirm(id) {
    // 확정 전 입고일 + 품목별 수량/단가 확인 모달 (LH-024, LH-028)
    let receipt;
    try { receipt = await API.get(`/receipts/${id}`); } catch (e) { showToast(e.message, 'error'); return; }

    const storedDate = receipt.date || today();
    const diffDays = Math.floor((new Date(today()) - new Date(storedDate)) / 86400000);
    const retroWarn = diffDays >= 3
      ? `<div style="padding:7px 12px;background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.4);border-radius:6px;font-size:0.8rem;color:#d97706;margin-top:8px">
           ⚠️ 소급 입력 중입니다. 기준일로부터 <strong>${diffDays}일 전</strong> 날짜입니다.
         </div>` : '';

    const items = receipt.items || [];
    const itemRows = items.map(item => `
      <tr>
        <td style="font-size:0.78rem;color:var(--text-muted)">${item.material_code}</td>
        <td style="font-size:0.82rem">${item.material_name || item.pending_name || item.material_code}</td>
        <td style="text-align:right;font-size:0.8rem;color:var(--text-muted)">${item.ordered_qty ?? '-'}</td>
        <td><input type="number" class="confirm-item-qty" data-id="${item.id}"
              value="${item.received_qty > 0 ? item.received_qty : (item.ordered_qty || 0)}"
              min="0" step="1"
              style="width:70px;text-align:right;padding:3px 6px;border:1px solid var(--border);border-radius:4px;background:var(--bg-input,#1e2030);color:var(--text)"></td>
        <td><input type="number" class="confirm-item-price" data-id="${item.id}"
              value="${item.unit_price > 0 ? item.unit_price : (item.last_purchase_price || 0)}"
              min="0" step="1"
              title="${item.unit_price <= 0 && item.last_purchase_price > 0 ? '최근 매입단가 자동 적용' : ''}"
              style="width:100px;text-align:right;padding:3px 6px;border:1px solid ${item.unit_price <= 0 && item.last_purchase_price > 0 ? 'var(--warning)' : 'var(--border)'};border-radius:4px;background:var(--bg-input,#1e2030);color:var(--text)"></td>
      </tr>
    `).join('');

    const html = `
      <div class="modal-header">
        <div class="modal-title">입고 확정 — ${receipt.receipt_no}</div>
        <button class="modal-close">×</button>
      </div>
      <div class="modal-body" style="max-height:70vh;overflow-y:auto">
        <div style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:8px;padding:12px 16px;margin-bottom:12px">
          <label style="font-size:0.8rem;color:var(--text-muted);display:block;margin-bottom:6px">
            실제 입고일 <span class="required">*</span>
          </label>
          <input type="date" id="confirm-inbound-date" value="${storedDate}" max="${today()}"
            style="font-size:1rem;padding:6px 10px;border:2px solid var(--primary);border-radius:6px;background:var(--bg-input,#1e2030);color:var(--text);width:180px">
          ${retroWarn}
        </div>
        ${items.length ? `
        <div style="font-size:0.8rem;font-weight:600;margin-bottom:6px">품목별 실수령 수량 / 단가 확인</div>
        <div style="overflow-x:auto">
          <table style="font-size:0.8rem;width:100%">
            <thead><tr style="color:var(--text-muted)">
              <th style="text-align:left;padding:4px">품목코드</th>
              <th style="text-align:left;padding:4px">품목명</th>
              <th style="text-align:right;padding:4px">발주수량</th>
              <th style="text-align:right;padding:4px">실수령수량 <span class="required">*</span></th>
              <th style="text-align:right;padding:4px">매입단가 <span class="required">*</span></th>
            </tr></thead>
            <tbody>${itemRows}</tbody>
          </table>
        </div>` : ''}
        <div style="font-size:0.72rem;color:var(--text-muted);margin-top:10px">
          전산 등록 시각: 확정 버튼 클릭 시점 자동 저장
        </div>
        <label id="immediate-stock-wrap" style="display:flex;align-items:center;gap:8px;margin-top:12px;padding:10px 12px;background:rgba(16,185,129,0.07);border:1px solid rgba(16,185,129,0.2);border-radius:6px;cursor:pointer;font-size:0.82rem">
          <input type="checkbox" id="confirm-immediate-stock" style="width:16px;height:16px;cursor:pointer">
          <div>
            <strong style="color:#10b981">즉시 가용재고 산입 (무검사)</strong>
            <div style="font-size:0.75rem;color:var(--text-muted)">검수 단계를 건너뛰고 확정 즉시 가용 재고로 반영합니다. MAP이 즉시 갱신됩니다.</div>
          </div>
        </label>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary modal-close">취소</button>
        <button class="btn btn-primary" id="btn-do-confirm">입고 확정</button>
      </div>
    `;
    openModal(html, 'modal-wide');

    document.getElementById('confirm-inbound-date')?.addEventListener('change', function() {
      const diff = Math.floor((new Date(today()) - new Date(this.value)) / 86400000);
      const existing = this.parentElement.querySelector('.retro-warn');
      if (diff >= 3 && !existing) {
        const note = document.createElement('div');
        note.className = 'retro-warn';
        note.style.cssText = 'padding:7px 12px;background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.4);border-radius:6px;font-size:0.8rem;color:#d97706;margin-top:8px';
        note.innerHTML = `⚠️ 소급 입력: 기준일로부터 <strong>${diff}일 전</strong>`;
        this.parentElement.appendChild(note);
      } else if (diff < 3 && existing) { existing.remove(); }
    });

    document.getElementById('btn-do-confirm')?.addEventListener('click', async () => {
      const inbound_date = document.getElementById('confirm-inbound-date').value;
      if (!inbound_date) return showToast('입고일을 선택하세요.', 'error');

      // 품목별 수량/단가 수집
      const item_qtys = [];
      document.querySelectorAll('.confirm-item-qty').forEach(qEl => {
        const iid = qEl.dataset.id;
        const priceEl = document.querySelector(`.confirm-item-price[data-id="${iid}"]`);
        item_qtys.push({
          id: iid,
          received_qty: parseFloat(qEl.value) || 0,
          unit_price:   parseFloat(priceEl?.value) || 0
        });
      });

      const immediate_stock = document.getElementById('confirm-immediate-stock')?.checked || false;
      const btn = document.getElementById('btn-do-confirm');
      btn.disabled = true; btn.textContent = '처리 중...';
      try {
        await API.put(`/receipts/${id}/confirm`, { inbound_date, item_qtys, immediate_stock });
        showToast(immediate_stock ? '입고 확정 완료 — 가용재고에 즉시 반영되었습니다.' : '입고 확정 완료 — 재고가 반영되었습니다.', 'success', 4000);
        closeModal();
        await loadData();
      } catch (err) {
        btn.disabled = false; btn.textContent = '입고 확정';
        showToast(err.message, 'error');
      }
    });
  }

  async function cancel(id, no) {
    confirmDialog(`<strong>${no}</strong> 전표를 취소하시겠습니까?`, async () => {
      try {
        await API.delete(`/receipts/${id}`);
        showToast('전표 취소 완료', 'success');
        await loadData();
      } catch (err) { showToast(err.message, 'error'); }
    });
  }

  async function purge(id, no) {
    confirmDialog(
      `<strong style="color:var(--danger)">[영구 삭제]</strong><br><strong>${no}</strong> 전표를 완전히 삭제합니다.<br><span style="font-size:0.85rem;color:var(--text-muted)">삭제된 데이터는 복구할 수 없습니다.</span>`,
      async () => {
        try {
          await API.delete(`/receipts/${id}/purge`);
          showToast(`${no} 영구 삭제 완료`, 'success');
          await loadData();
        } catch (err) { showToast(err.message, 'error'); }
      }
    );
  }

  async function bulkPurge(ids) {
    confirmDialog(
      `<strong style="color:var(--danger)">[일괄 영구 삭제]</strong><br>취소 전표 <strong>${ids.length}건</strong>을 완전히 삭제합니다.<br><span style="font-size:0.85rem;color:var(--text-muted)">삭제된 데이터는 복구할 수 없습니다.</span>`,
      async () => {
        try {
          const res = await API.delete('/receipts/purge/bulk', { ids });
          showToast(`${res.deleted}건 영구 삭제 완료${res.errors?.length ? ` (오류 ${res.errors.length}건)` : ''}`, 'success');
          await loadData();
        } catch (err) { showToast(err.message, 'error'); }
      }
    );
  }

  async function approveInspection(id, no) {
    // 검수 재고 → 가용 재고 전환 + MAP 자동 업데이트
    if (!confirm(`[${no}] 검수 재고를 가용 재고로 전환하시겠습니까?\n\n이동평균단가(MAP)가 즉시 갱신됩니다.`)) return;
    try {
      await API.put(`/receipts/${id}/approve-inspection`, {});
      showToast('검수 승인 완료 — 가용재고에 반영되었습니다.', 'success', 4000);
      await loadData();
    } catch (err) { showToast(err.message, 'error'); }
  }

  async function openLandingCostModal(receiptId) {
    const existing = await API.get(`/landing-cost/${receiptId}`).catch(() => null);
    const isEdit = existing && existing.status === 'draft';
    const lcId   = existing?.id || null;

    const fVal = v => existing ? (existing[v] || 0) : 0;

    const html = `
      <div class="modal-header">
        <div class="modal-title">랜딩 코스트 ${isEdit ? '수정' : '입력'}</div>
        <button class="modal-close">×</button>
      </div>
      <div class="modal-body">
        <div class="form-grid" style="grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:14px">
          <div class="form-group">
            <label>운임 (Freight)</label>
            <input type="number" id="lc-freight" value="${fVal('freight')}" min="0" step="1">
          </div>
          <div class="form-group">
            <label>관세 (Customs/Duty)</label>
            <input type="number" id="lc-customs" value="${fVal('customs')}" min="0" step="1">
          </div>
          <div class="form-group">
            <label>통관비 (Handling)</label>
            <input type="number" id="lc-handling" value="${fVal('handling')}" min="0" step="1">
          </div>
          <div class="form-group">
            <label>기타 부대비용</label>
            <input type="number" id="lc-other" value="${fVal('other_cost')}" min="0" step="1">
          </div>
          <div class="form-group" style="grid-column:1/-1">
            <label>배부 기준</label>
            <div style="display:flex;gap:20px;margin-top:4px">
              <label style="font-weight:normal;display:flex;align-items:center;gap:6px">
                <input type="radio" name="lc-method" value="amount" ${(!existing || existing.allocation_method==='amount') ? 'checked' : ''}>
                금액 비중 (권장)
              </label>
              <label style="font-weight:normal;display:flex;align-items:center;gap:6px">
                <input type="radio" name="lc-method" value="qty" ${existing?.allocation_method==='qty' ? 'checked' : ''}>
                수량 비중
              </label>
            </div>
          </div>
          <div class="form-group" style="grid-column:1/-1">
            <label>메모</label>
            <input type="text" id="lc-notes" value="${existing?.notes||''}" placeholder="운임 인보이스 번호 등">
          </div>
        </div>

        <div style="border-top:1px solid var(--border);padding-top:12px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
            <strong style="font-size:0.85rem">배부 미리보기</strong>
            <button class="btn btn-xs btn-secondary" id="lc-preview-btn">계산 미리보기</button>
          </div>
          <div id="lc-preview-area" style="font-size:0.82rem">
            ${existing?.items?.length ? _renderLcPreviewTable(existing.items, existing.total_surcharge) : '<div style="color:var(--text-muted);font-size:0.8rem">비용을 입력 후 미리보기를 클릭하세요.</div>'}
          </div>
        </div>
      </div>
      <div class="modal-footer" style="justify-content:space-between">
        <div>
          ${isEdit ? `<button class="btn btn-danger btn-sm" id="lc-delete-btn">초안 삭제</button>` : ''}
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-secondary modal-close">취소</button>
          ${isEdit
            ? `<button class="btn btn-warning" id="lc-recalc-btn">재계산 저장</button>
               <button class="btn btn-success" id="lc-apply-btn">MAP에 적용 확정</button>`
            : `<button class="btn btn-primary" id="lc-save-btn">초안 저장</button>`}
        </div>
      </div>
    `;

    openModal(html, 'modal-lg');

    function _collectForm() {
      return {
        receipt_id:        receiptId,
        freight:           parseFloat(document.getElementById('lc-freight').value) || 0,
        customs:           parseFloat(document.getElementById('lc-customs').value) || 0,
        handling:          parseFloat(document.getElementById('lc-handling').value) || 0,
        other_cost:        parseFloat(document.getElementById('lc-other').value) || 0,
        allocation_method: document.querySelector('input[name="lc-method"]:checked')?.value || 'amount',
        notes:             document.getElementById('lc-notes').value.trim() || undefined,
      };
    }

    document.getElementById('lc-preview-btn')?.addEventListener('click', async () => {
      const btn = document.getElementById('lc-preview-btn');
      btn.disabled = true; btn.textContent = '계산 중...';
      try {
        const body = _collectForm();
        let res;
        if (isEdit) {
          res = await API.put(`/landing-cost/${lcId}/recalculate`, body);
        } else {
          res = await API.post('/landing-cost', body);
        }
        document.getElementById('lc-preview-area').innerHTML = _renderLcPreviewTable(res.items, res.total_surcharge);
        if (!isEdit) {
          showToast('초안이 저장되었습니다. [MAP에 적용 확정]으로 반영하세요.', 'success', 5000);
          closeModal();
          viewDetail(receiptId);
        }
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        btn.disabled = false; btn.textContent = '계산 미리보기';
      }
    });

    document.getElementById('lc-save-btn')?.addEventListener('click', async () => {
      const btn = document.getElementById('lc-save-btn');
      btn.disabled = true; btn.textContent = '저장 중...';
      try {
        const body = _collectForm();
        const res = await API.post('/landing-cost', body);
        document.getElementById('lc-preview-area').innerHTML = _renderLcPreviewTable(res.items, res.total_surcharge);
        showToast('랜딩 코스트 초안 저장 완료. [MAP에 적용 확정]으로 반영하세요.', 'success', 5000);
        closeModal();
        viewDetail(receiptId);
      } catch (err) {
        btn.disabled = false; btn.textContent = '초안 저장';
        showToast(err.message, 'error');
      }
    });

    document.getElementById('lc-recalc-btn')?.addEventListener('click', async () => {
      const btn = document.getElementById('lc-recalc-btn');
      btn.disabled = true; btn.textContent = '처리 중...';
      try {
        const body = _collectForm();
        const res = await API.put(`/landing-cost/${lcId}/recalculate`, body);
        document.getElementById('lc-preview-area').innerHTML = _renderLcPreviewTable(res.items, res.total_surcharge);
        showToast('재계산 완료 — [MAP에 적용 확정]으로 반영하세요.', 'success', 4000);
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        btn.disabled = false; btn.textContent = '재계산 저장';
      }
    });

    document.getElementById('lc-apply-btn')?.addEventListener('click', async () => {
      if (!confirm('이동평균단가(MAP)에 랜딩 코스트를 반영합니다.\n적용 후에는 수정이 불가합니다. 계속하시겠습니까?')) return;
      const btn = document.getElementById('lc-apply-btn');
      btn.disabled = true; btn.textContent = '적용 중...';
      try {
        const res = await API.put(`/landing-cost/${lcId}/apply`, {});
        const skip = res.skipped?.length || 0;
        showToast(
          `MAP 반영 완료 — ${res.applied?.length}개 품목 적용${skip ? ` (재고 없음 스킵 ${skip}건)` : ''}`,
          'success', 5000
        );
        closeModal();
        viewDetail(receiptId);
      } catch (err) {
        btn.disabled = false; btn.textContent = 'MAP에 적용 확정';
        showToast(err.message, 'error');
      }
    });

    document.getElementById('lc-delete-btn')?.addEventListener('click', async () => {
      if (!confirm('랜딩 코스트 초안을 삭제하시겠습니까?')) return;
      try {
        await API.delete(`/landing-cost/${lcId}`);
        showToast('초안 삭제 완료', 'success');
        closeModal();
        viewDetail(receiptId);
      } catch (err) { showToast(err.message, 'error'); }
    });
  }

  function _renderLcPreviewTable(items, totalSurcharge) {
    if (!items?.length) return '<div style="color:var(--text-muted)">품목 없음</div>';
    const rows = items.map(i => `
      <tr>
        <td>${i.material_name || i.material_code || '-'}</td>
        <td class="num">${formatNumber(i.received_qty || i.base_qty)}</td>
        <td class="num">${formatCurrency(i.unit_price || i.base_unit_price)}</td>
        <td class="num" style="color:#10b981">+${formatCurrency(i.allocated_surcharge)}</td>
        <td class="num" style="font-size:0.78rem;color:var(--text-muted)">${((i.allocation_pct||0)*100).toFixed(2)}%</td>
        <td class="num font-bold">${formatCurrency(i.landed_unit_price)}</td>
      </tr>`).join('');
    return `
      <table class="table table-sm" style="font-size:0.8rem">
        <thead><tr><th>품목</th><th class="num">수량</th><th class="num">기준단가</th><th class="num">배부액</th><th class="num">비중</th><th class="num">랜딩단가</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr><td colspan="3" style="text-align:right;color:var(--text-muted)">총 부대비용</td><td class="num font-bold" style="color:#10b981">${formatCurrency(totalSurcharge)}</td><td colspan="2"></td></tr></tfoot>
      </table>`;
  }

  return { render, viewDetail, confirm, cancel, purge, bulkPurge, clearFilters: reset, reset, lookupPO, loadPOData, addItem, promoteDraft, setInternalName, showPriceTrend, approveInspection, openLandingCostModal };
})();
window.Receipts = Receipts;
