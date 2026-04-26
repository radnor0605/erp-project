/* ─── Tax Invoices Module (세금계산서) v56 — 기발행 등록 방식 ─── */
const TaxInvoices = (() => {
  let _data = [];
  let _tab  = 'sales';
  let _filters = { from: '', to: '' };

  function reset() { _filters = { from: '', to: '' }; _tab = 'sales'; }

  async function render() {
    const container = document.getElementById('page-container');
    if (!container) return;

    const summaryData   = await API.get(`/tax-invoices/summary?year=${new Date().getFullYear()}`).catch(() => []);
    const salesTotal    = summaryData.filter(r => r.invoice_type === 'sales').reduce((s, r) => s + r.total_amount, 0);
    const purchaseTotal = summaryData.filter(r => r.invoice_type === 'purchase').reduce((s, r) => s + r.total_amount, 0);
    const salesVat      = summaryData.filter(r => r.invoice_type === 'sales').reduce((s, r) => s + r.tax_amount, 0);
    const purchaseVat   = summaryData.filter(r => r.invoice_type === 'purchase').reduce((s, r) => s + r.tax_amount, 0);
    const vatPayable    = salesVat - purchaseVat;

    container.innerHTML = `
      <div class="animate-fade">
        <div class="page-header">
          <div>
            <h2 class="page-title">세금계산서 관리</h2>
            <p class="page-subtitle">홈택스 등 외부 발행 세금계산서를 등록하고 전표와 연결합니다.</p>
          </div>
          <button class="btn btn-primary" id="ti-new-btn">+ 세금계산서 등록</button>
        </div>

        <div class="kpi-grid" style="margin-bottom:20px">
          <div class="kpi-card">
            <div class="kpi-label">올해 매출 세금계산서</div>
            <div class="kpi-value">${formatCurrency(salesTotal)}</div>
            <div class="kpi-sub">세액 ${formatCurrency(salesVat)}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">올해 매입 세금계산서</div>
            <div class="kpi-value">${formatCurrency(purchaseTotal)}</div>
            <div class="kpi-sub">세액 ${formatCurrency(purchaseVat)}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">납부 예상 부가세</div>
            <div class="kpi-value" style="color:${vatPayable >= 0 ? 'var(--danger)' : 'var(--success)'}">${formatCurrency(vatPayable)}</div>
            <div class="kpi-sub">매출세액 − 매입세액 ${vatPayable >= 0 ? '↑' : '↓'}</div>
          </div>
        </div>

        <div style="display:flex;gap:0;border-bottom:2px solid var(--border);margin-bottom:16px">
          <button class="tab-btn" id="ti-tab-sales"    style="padding:8px 20px;background:none;border:none;cursor:pointer;font-weight:600">매출 세금계산서</button>
          <button class="tab-btn" id="ti-tab-purchase" style="padding:8px 20px;background:none;border:none;cursor:pointer;font-weight:600">매입 세금계산서</button>
        </div>

        <div class="filter-bar" style="margin-bottom:12px">
          <input type="date" id="ti-from" value="${currentMonth()}-01" style="width:150px">
          <input type="date" id="ti-to"   value="${today()}"           style="width:150px">
          <button class="btn btn-secondary" id="ti-search-btn">조회</button>
        </div>

        <div class="card" id="ti-table-wrap">${loadingHTML()}</div>
      </div>
    `;

    const setTabStyle = tab => {
      document.getElementById('ti-tab-sales').style.cssText    = `padding:8px 20px;background:none;border:none;cursor:pointer;font-weight:600;border-bottom:${tab==='sales'?'2px solid var(--primary)':'2px solid transparent'};color:${tab==='sales'?'var(--primary)':'var(--text-muted)'}`;
      document.getElementById('ti-tab-purchase').style.cssText = `padding:8px 20px;background:none;border:none;cursor:pointer;font-weight:600;border-bottom:${tab==='purchase'?'2px solid var(--warning)':'2px solid transparent'};color:${tab==='purchase'?'var(--warning)':'var(--text-muted)'}`;
    };
    setTabStyle(_tab);

    document.getElementById('ti-tab-sales').addEventListener('click', () => { _tab = 'sales'; setTabStyle('sales'); loadData(); });
    document.getElementById('ti-tab-purchase').addEventListener('click', () => { _tab = 'purchase'; setTabStyle('purchase'); loadData(); });
    document.getElementById('ti-search-btn').addEventListener('click', () => {
      _filters.from = document.getElementById('ti-from').value;
      _filters.to   = document.getElementById('ti-to').value;
      loadData();
    });
    document.getElementById('ti-new-btn').addEventListener('click', () => openForm());

    await loadData();
  }

  async function loadData() {
    const wrap = document.getElementById('ti-table-wrap');
    if (!wrap) return;
    try {
      const p = new URLSearchParams({ invoice_type: _tab, ..._filters });
      _data = await API.get('/tax-invoices?' + p);
      renderTable();
    } catch (e) {
      wrap.innerHTML = `<div class="alert alert-danger">${e.message}</div>`;
    }
  }

  function renderTable() {
    const wrap = document.getElementById('ti-table-wrap');
    if (!wrap) return;
    if (!_data.length) {
      wrap.innerHTML = `<div style="padding:40px;text-align:center;color:var(--text-muted)">등록된 세금계산서가 없습니다.</div>`;
      return;
    }
    const issued = _data.filter(r => r.status === 'issued');
    wrap.innerHTML = `
      <div style="overflow-x:auto">
        <table class="table hover">
          <thead><tr>
            <th>계산서 번호</th><th>작성일자</th><th>거래처</th>
            <th>국세청 승인번호</th>
            <th class="num">공급가액</th><th class="num">세액</th><th class="num">합계</th>
            <th>상태</th><th>작업</th>
          </tr></thead>
          <tbody>
            ${_data.map(inv => `
              <tr>
                <td><span class="mono" style="color:var(--primary-light)">${inv.invoice_no}</span></td>
                <td>${formatDate(inv.issue_date)}</td>
                <td class="font-bold">${inv.partner_name || inv.partner_code || '-'}</td>
                <td><span class="mono" style="font-size:0.78rem;color:var(--text-muted)">${inv.nts_approval_no || '-'}</span></td>
                <td class="num">${formatCurrency(inv.supply_amount)}</td>
                <td class="num" style="color:var(--warning)">${formatCurrency(inv.tax_amount)}</td>
                <td class="num font-bold">${formatCurrency(inv.total_amount)}</td>
                <td>${inv.status === 'issued'
                  ? '<span class="badge badge-success">등록완료</span>'
                  : '<span class="badge badge-danger">취소</span>'}</td>
                <td class="table-actions">
                  <button class="btn btn-xs btn-secondary ti-detail-btn" data-id="${inv.id}">상세</button>
                  ${inv.status === 'issued' ? `<button class="btn btn-xs btn-danger ti-cancel-btn" data-id="${inv.id}" data-no="${inv.invoice_no}">취소</button>` : ''}
                </td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr style="font-weight:700;border-top:2px solid var(--border)">
              <td colspan="4">합계 (${issued.length}건)</td>
              <td class="num">${formatCurrency(issued.reduce((s,r)=>s+r.supply_amount,0))}</td>
              <td class="num" style="color:var(--warning)">${formatCurrency(issued.reduce((s,r)=>s+r.tax_amount,0))}</td>
              <td class="num">${formatCurrency(issued.reduce((s,r)=>s+r.total_amount,0))}</td>
              <td colspan="2"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;
    document.querySelectorAll('.ti-detail-btn').forEach(btn =>
      btn.addEventListener('click', () => viewDetail(btn.dataset.id)));
    document.querySelectorAll('.ti-cancel-btn').forEach(btn =>
      btn.addEventListener('click', async () => {
        if (!confirm(`${btn.dataset.no}을 취소하시겠습니까? 연결된 전표의 세금계산서 상태도 초기화됩니다.`)) return;
        try {
          const r = await API.put(`/tax-invoices/${btn.dataset.id}/cancel`, {});
          showToast(r.message, 'success');
          loadData();
        } catch (e) { showToast(e.message, 'error'); }
      }));
  }

  async function viewDetail(id) {
    const [inv, company] = await Promise.all([
      API.get(`/tax-invoices/${id}`),
      API.get('/company-profile').catch(() => ({})),
    ]);
    const typeLabel = inv.invoice_type === 'sales' ? '매출' : '매입';
    const isSales = inv.invoice_type === 'sales';
    const supplierName   = isSales ? (company.name || '-')           : (inv.partner_name || '-');
    const supplierBizno  = isSales ? (company.business_no || '-')    : (inv.partner_bizno || '-');
    const receiverName   = isSales ? (inv.partner_name || '-')       : (company.name || '-');
    const receiverBizno  = isSales ? (inv.partner_bizno || '-')      : (company.business_no || '-');
    const linkedHtml = inv.linked_receipts?.length
      ? `<div style="margin-top:8px;font-size:0.8rem;color:var(--text-muted)">연결 입고전표: ${inv.linked_receipts.map(r => r.receipt_no).join(', ')}</div>`
      : '';
    const ntsHtml = inv.nts_approval_no
      ? `<div style="margin-top:6px;font-size:0.82rem">국세청 승인번호: <span class="mono">${inv.nts_approval_no}</span></div>`
      : '';
    const html = `
      <div class="modal-header">
        <div class="modal-title">${typeLabel} 세금계산서 — ${inv.invoice_no}</div>
        <button class="modal-close">×</button>
      </div>
      <div class="modal-body">
        <div style="border:2px solid var(--border);border-radius:var(--radius-md);padding:20px;margin-bottom:16px">
          <div style="text-align:center;font-size:1.1rem;font-weight:700;margin-bottom:16px;letter-spacing:2px">세금계산서 (${typeLabel})</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;font-size:0.85rem">
            <div>
              <div style="color:var(--text-muted);font-size:0.72rem">공 급 자</div>
              <div style="font-weight:600">${supplierName}</div>
              <div style="font-size:0.75rem;color:var(--text-muted)">사업자번호: ${supplierBizno}</div>
            </div>
            <div>
              <div style="color:var(--text-muted);font-size:0.72rem">공급받는자</div>
              <div style="font-weight:600">${receiverName}</div>
              <div style="font-size:0.75rem;color:var(--text-muted)">사업자번호: ${receiverBizno}</div>
            </div>
            <div><div style="color:var(--text-muted);font-size:0.72rem">작 성 일 자</div><div>${formatDate(inv.issue_date)}</div></div>
            <div><div style="color:var(--text-muted);font-size:0.72rem">계산서 번호</div><div class="mono">${inv.invoice_no}</div></div>
          </div>
          ${inv.items?.length ? `
          <table class="table table-sm" style="margin-bottom:12px">
            <thead><tr><th>품목명</th><th class="num">수량</th><th class="num">단가</th><th class="num">공급가액</th><th class="num">세액</th></tr></thead>
            <tbody>${inv.items.map(i => `
              <tr><td>${i.item_name}</td><td class="num">${formatNumber(i.qty)}</td>
              <td class="num">${formatCurrency(i.unit_price)}</td>
              <td class="num">${formatCurrency(i.supply_amount)}</td>
              <td class="num">${formatCurrency(i.tax_amount)}</td></tr>
            `).join('')}</tbody>
          </table>` : ''}
          <div style="background:var(--bg-glass);border-radius:var(--radius-md);padding:12px;display:flex;justify-content:flex-end;gap:32px">
            <div style="text-align:right"><div style="font-size:0.72rem;color:var(--text-muted)">공급가액</div><div style="font-weight:700">${formatCurrency(inv.supply_amount)}</div></div>
            <div style="text-align:right"><div style="font-size:0.72rem;color:var(--text-muted)">세액</div><div style="font-weight:700;color:var(--warning)">${formatCurrency(inv.tax_amount)}</div></div>
            <div style="text-align:right"><div style="font-size:0.72rem;color:var(--text-muted)">합계금액</div><div style="font-weight:700;font-size:1.1rem;color:var(--primary)">${formatCurrency(inv.total_amount)}</div></div>
          </div>
        </div>
        ${ntsHtml}
        ${linkedHtml}
        ${inv.notes ? `<div style="font-size:0.82rem;color:var(--text-muted);margin-top:6px">비고: ${inv.notes}</div>` : ''}
      </div>
      <div class="modal-footer"><button class="btn btn-secondary modal-close">닫기</button></div>
    `;
    openModal(html, 'modal-wide');
  }

  // ── 기발행 세금계산서 등록 폼 ──────────────────────────────────────────────
  async function openForm(prefill = {}) {
    const partners = await API.get('/partners').catch(() => []);
    const partnerOpts = partners.map(p =>
      `<option value="${p.code}" data-name="${p.name}">${p.name} (${p.code})</option>`).join('');

    const html = `
      <div class="modal-header">
        <div class="modal-title">기발행 세금계산서 등록</div>
        <button class="modal-close">×</button>
      </div>
      <div class="modal-body" style="overflow-y:auto;max-height:75vh">
        <div class="alert alert-info" style="font-size:0.82rem;margin-bottom:12px">
          홈택스(국세청)에서 처리된 세금계산서를 시스템에 등록합니다. 거래처 선택 시 미마감 전표가 자동 필터링됩니다.
        </div>
        <div class="form-grid" style="margin-bottom:16px">
          <div class="form-group">
            <label>구분 <span class="required">*</span></label>
            <select id="ti-type" style="width:100%">
              <option value="sales">매출 세금계산서</option>
              <option value="purchase" selected>매입 세금계산서</option>
            </select>
          </div>
          <div class="form-group">
            <label>작성일자 <span class="required">*</span></label>
            <input type="date" id="ti-issue-date" value="${today()}" style="width:100%">
          </div>
          <div class="form-group">
            <label>거래처 <span class="required">*</span></label>
            <select id="ti-partner" style="width:100%">
              <option value="">선택하세요</option>${partnerOpts}
            </select>
          </div>
          <div class="form-group">
            <label>국세청 승인번호 <span style="color:var(--text-muted);font-size:0.78rem">(전자세금계산서)</span></label>
            <input type="text" id="ti-nts-no" placeholder="24자리 승인번호 (선택)" maxlength="50" style="font-family:monospace">
          </div>
          <div class="form-group">
            <label>공급가액 <span class="required">*</span></label>
            <input type="number" id="ti-supply" placeholder="전표 선택 시 자동 계산" min="0" style="width:100%">
          </div>
          <div class="form-group">
            <label>세액 <span style="color:var(--text-muted);font-size:0.78rem">(자동계산)</span></label>
            <input type="number" id="ti-tax" placeholder="자동" min="0" style="width:100%">
          </div>
          <div class="form-group">
            <label>합계금액</label>
            <input type="number" id="ti-total" placeholder="자동" min="0" style="width:100%;background:var(--bg-glass)" readonly>
          </div>
          <div class="form-group">
            <label>비고</label>
            <input type="text" id="ti-notes" placeholder="적요 (선택)">
          </div>
        </div>

        <div id="ti-link-section">
          <div style="font-weight:600;font-size:0.88rem;margin-bottom:6px;display:flex;align-items:center;gap:8px">
            <span id="ti-link-label">연결 입고전표</span>
            <span style="font-size:0.75rem;color:var(--text-muted);font-weight:400">(거래처 선택 시 자동 필터링 · 더블클릭 또는 🔍로 상세 확인)</span>
            <span id="ti-slip-count" style="margin-left:auto;font-size:0.75rem;color:var(--text-muted)"></span>
          </div>
          <div id="ti-slip-table" style="border:1px solid var(--border);border-radius:var(--radius-sm);overflow:hidden;max-height:200px;overflow-y:auto">
            <div style="padding:24px;text-align:center;color:var(--text-muted);font-size:0.82rem">거래처를 선택하면 미마감 전표가 표시됩니다.</div>
          </div>

          <div style="margin-top:16px">
            <div style="font-weight:600;font-size:0.85rem;margin-bottom:6px;color:var(--primary-light)">
              🧾 포함된 품목 명세 <span style="font-size:0.75rem;color:var(--text-muted);font-weight:400">(선택된 전표의 실제 품목)</span>
            </div>
            <div id="ti-items-grid" style="border:1px solid var(--border);border-radius:var(--radius-sm);overflow:hidden">
              <div style="padding:16px;text-align:center;color:var(--text-muted);font-size:0.82rem">전표를 선택하면 품목 명세가 표시됩니다.</div>
            </div>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary modal-close">취소</button>
        <button class="btn btn-primary" id="ti-save-btn">등록</button>
      </div>
    `;
    openModal(html, 'modal-wide', { persistent: true });

    // 상태
    let _slips     = [];   // 현재 로드된 전표 목록
    let _selected  = new Set();   // 선택된 전표 ID
    let _taxManual = false;

    // 금액 계산
    const calcTotal = () => {
      const supply = parseFloat(document.getElementById('ti-supply').value) || 0;
      const taxEl  = document.getElementById('ti-tax');
      if (!_taxManual) taxEl.value = Math.floor(supply * 0.1) || '';
      const tax = parseFloat(taxEl.value) || 0;
      document.getElementById('ti-total').value = Math.round(supply + tax) || '';
    };
    document.getElementById('ti-supply').addEventListener('input', () => {
      _taxManual = false;
      calcTotal();
    });
    document.getElementById('ti-tax').addEventListener('input', () => {
      _taxManual = true;
      calcTotal();
    });

    // 선택된 전표들 → 공급가액 자동 채우기
    const fillFromSelected = () => {
      const total = _slips.filter(s => _selected.has(s.id)).reduce((a, s) => a + (s.supply_amount || 0), 0);
      if (_selected.size > 0) {
        document.getElementById('ti-supply').value = total;
        _taxManual = false;
        calcTotal();
      }
    };

    // 품목 명세표 렌더
    const renderItemsGrid = () => {
      const grid = document.getElementById('ti-items-grid');
      if (!grid) return;
      const selectedSlips = _slips.filter(s => _selected.has(s.id));
      const allItems = selectedSlips.flatMap(s =>
        (s.items || []).map(it => ({ ...it, slip_no: s.receipt_no }))
      );
      if (!allItems.length) {
        grid.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-muted);font-size:0.82rem">전표를 선택하면 품목 명세가 표시됩니다.</div>';
        return;
      }
      grid.innerHTML = `
        <table class="table table-sm" style="margin:0;font-size:0.8rem">
          <thead><tr>
            <th style="width:100px">전표번호</th>
            <th>품목명</th>
            <th class="num">수량</th>
            <th class="num">단가</th>
            <th class="num">금액</th>
          </tr></thead>
          <tbody>
            ${allItems.map(it => `
              <tr>
                <td class="mono" style="font-size:0.75rem;color:var(--text-muted)">${it.slip_no || ''}</td>
                <td>${it.name || it.material_code || '-'}</td>
                <td class="num">${formatNumber(it.qty)}</td>
                <td class="num">${formatCurrency(it.unit_price)}</td>
                <td class="num font-bold">${formatCurrency(it.amount)}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr style="font-weight:700;background:var(--bg-glass)">
              <td colspan="4" style="text-align:right">합계</td>
              <td class="num">${formatCurrency(allItems.reduce((a, i) => a + (i.amount || 0), 0))}</td>
            </tr>
          </tfoot>
        </table>
      `;
    };

    // 전표 체크박스 변경 → 선택 업데이트
    const onSlipCheck = (id, checked) => {
      checked ? _selected.add(id) : _selected.delete(id);
      // 행 하이라이트
      document.querySelectorAll('[data-slip-id]').forEach(tr => {
        tr.style.background = _selected.has(tr.dataset.slipId) ? 'var(--primary-glass, rgba(99,102,241,0.08))' : '';
      });
      fillFromSelected();
      renderItemsGrid();
    };

    // 전표 테이블 렌더
    const renderSlipTable = () => {
      const wrap = document.getElementById('ti-slip-table');
      const cnt  = document.getElementById('ti-slip-count');
      if (!wrap) return;
      if (!_slips.length) {
        wrap.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:0.82rem">미마감 전표가 없습니다.</div>';
        if (cnt) cnt.textContent = '';
        return;
      }
      if (cnt) cnt.textContent = `${_slips.length}건`;
      wrap.innerHTML = `
        <table class="table table-sm" style="margin:0;font-size:0.82rem">
          <thead><tr>
            <th style="width:32px;text-align:center">선택</th>
            <th>전표번호</th>
            <th>날짜</th>
            <th>거래처</th>
            <th class="num">공급가액</th>
            <th style="width:40px"></th>
          </tr></thead>
          <tbody>
            ${_slips.map(s => `
              <tr data-slip-id="${s.id}" style="cursor:pointer">
                <td style="text-align:center">
                  <input type="checkbox" class="slip-chk" data-id="${s.id}" ${_selected.has(s.id) ? 'checked' : ''}>
                </td>
                <td class="mono" style="color:var(--primary-light)">${s.receipt_no || s.so_no || '-'}</td>
                <td>${s.date || s.order_date || '-'}</td>
                <td>${s.vendor_name || s.partner_name || '-'}</td>
                <td class="num font-bold">${formatCurrency(s.supply_amount || s.total_amount)}</td>
                <td>
                  <button class="btn btn-xs btn-secondary slip-detail-btn" data-id="${s.id}" title="상세 보기">🔍</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;

      // 체크박스 변경
      wrap.querySelectorAll('.slip-chk').forEach(chk =>
        chk.addEventListener('change', e => onSlipCheck(e.target.dataset.id, e.target.checked)));

      // 행 클릭 → 체크박스 토글 (체크박스 자체 클릭 제외)
      wrap.querySelectorAll('tr[data-slip-id]').forEach(tr =>
        tr.addEventListener('click', e => {
          if (e.target.type === 'checkbox' || e.target.classList.contains('slip-detail-btn')) return;
          const chk = tr.querySelector('.slip-chk');
          chk.checked = !chk.checked;
          onSlipCheck(chk.dataset.id, chk.checked);
        }));

      // 더블 클릭 → 상세 모달
      wrap.querySelectorAll('tr[data-slip-id]').forEach(tr =>
        tr.addEventListener('dblclick', e => {
          if (e.target.classList.contains('slip-detail-btn')) return;
          openSlipDetailModal(document.getElementById('ti-type').value, tr.dataset.slipId);
        }));

      // 🔍 버튼
      wrap.querySelectorAll('.slip-detail-btn').forEach(btn =>
        btn.addEventListener('click', e => {
          e.stopPropagation();
          openSlipDetailModal(document.getElementById('ti-type').value, btn.dataset.id);
        }));
    };

    // 거래처 변경 → 해당 거래처 전표만 로드
    const loadSlips = async () => {
      const type        = document.getElementById('ti-type').value;
      const partnerCode = document.getElementById('ti-partner').value;
      const lbl = document.getElementById('ti-link-label');
      if (lbl) lbl.textContent = type === 'purchase' ? '연결 입고전표' : '연결 출고전표';

      _slips    = [];
      _selected = new Set();
      renderItemsGrid();

      if (!partnerCode) {
        const wrap = document.getElementById('ti-slip-table');
        if (wrap) wrap.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-muted);font-size:0.82rem">거래처를 선택하면 미마감 전표가 표시됩니다.</div>';
        return;
      }

      const wrap = document.getElementById('ti-slip-table');
      if (wrap) wrap.innerHTML = `<div style="padding:16px;text-align:center;color:var(--text-muted);font-size:0.82rem">${loadingHTML()}</div>`;

      try {
        if (type === 'purchase') {
          _slips = await API.get(`/tax-invoices/pending-receipts?vendor_code=${partnerCode}`);
        } else {
          _slips = await API.get(`/tax-invoices/pending-sos?partner_code=${partnerCode}`);
        }
      } catch { _slips = []; }

      renderSlipTable();
    };

    document.getElementById('ti-partner').addEventListener('change', loadSlips);
    document.getElementById('ti-type').addEventListener('change', loadSlips);

    // 저장
    document.getElementById('ti-save-btn').addEventListener('click', async () => {
      const invoice_type  = document.getElementById('ti-type').value;
      const issue_date    = document.getElementById('ti-issue-date').value;
      const partnerSel    = document.getElementById('ti-partner');
      const partner_code  = partnerSel.value;
      const partner_name  = partnerSel.selectedOptions[0]?.dataset.name || '';
      const nts_approval_no = document.getElementById('ti-nts-no').value.trim();
      const supply_amount = parseFloat(document.getElementById('ti-supply').value) || 0;
      const tax_amount    = parseFloat(document.getElementById('ti-tax').value)    || 0;
      const total_amount  = parseFloat(document.getElementById('ti-total').value)  || (supply_amount + tax_amount);
      const notes         = document.getElementById('ti-notes').value;

      if (!issue_date)    return showToast('작성일자를 입력하세요.', 'error');
      if (!partner_code)  return showToast('거래처를 선택하세요.', 'error');
      if (!supply_amount) return showToast('공급가액을 입력하세요.', 'error');

      const selected = [..._selected];
      const ref_receipt_ids = invoice_type === 'purchase' ? selected : [];
      const ref_so_ids      = invoice_type === 'sales'    ? selected : [];

      try {
        const r = await API.post('/tax-invoices', {
          invoice_type, issue_date, partner_code, partner_name,
          supply_amount, tax_amount, total_amount,
          nts_approval_no, notes, ref_receipt_ids, ref_so_ids,
        });
        showToast(`등록 완료: ${r.invoice_no}`, 'success', 5000);
        closeModal();
        _tab = invoice_type;
        loadData();
      } catch (e) { showToast(e.message, 'error'); }
    });
  }

  // ── 전표 상세 드릴다운 모달 ───────────────────────────────────────────────
  async function openSlipDetailModal(type, id) {
    try {
      const endpoint = type === 'purchase'
        ? `/tax-invoices/receipt-detail/${id}`
        : `/tax-invoices/so-detail/${id}`;
      const d = await API.get(endpoint);
      const typeLabel = type === 'purchase' ? '입고전표' : '출고전표';
      const docNo   = d.receipt_no || d.so_no || id;
      const date    = d.date || d.order_date || '-';
      const partner = d.vendor_name || d.customer_name || d.vendor_code || d.customer_code || '-';
      const totalAmt = (d.items || []).reduce((a, i) => a + (i.amount || 0), 0);

      const itemRows = (d.items || []).map(i => `
        <tr>
          <td>${i.name || i.material_code || '-'}</td>
          <td style="color:var(--text-muted);font-size:0.78rem">${i.material_code || ''}</td>
          <td class="num">${formatNumber(i.qty)}<span style="color:var(--text-muted);font-size:0.75rem;margin-left:2px">${i.unit || ''}</span></td>
          <td class="num">${formatCurrency(i.unit_price)}</td>
          <td class="num font-bold">${formatCurrency(i.amount)}</td>
        </tr>
      `).join('');

      const html = `
        <div class="modal-header">
          <div class="modal-title">${typeLabel} 상세 — <span class="mono">${docNo}</span></div>
          <button class="modal-close">×</button>
        </div>
        <div class="modal-body">
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:16px;font-size:0.85rem">
            <div><div style="color:var(--text-muted);font-size:0.72rem">전표번호</div><div class="mono font-bold">${docNo}</div></div>
            <div><div style="color:var(--text-muted);font-size:0.72rem">날짜</div><div>${formatDate(date)}</div></div>
            <div><div style="color:var(--text-muted);font-size:0.72rem">거래처</div><div class="font-bold">${partner}</div></div>
            <div><div style="color:var(--text-muted);font-size:0.72rem">상태</div><div>${d.status || '-'}</div></div>
            <div><div style="color:var(--text-muted);font-size:0.72rem">담당자</div><div>${d.created_by || d.manager || '-'}</div></div>
            <div><div style="color:var(--text-muted);font-size:0.72rem">합계금액</div><div class="font-bold" style="color:var(--primary)">${formatCurrency(totalAmt)}</div></div>
          </div>
          <table class="table table-sm" style="font-size:0.82rem">
            <thead><tr>
              <th>품목명</th><th style="color:var(--text-muted);font-size:0.75rem">코드</th>
              <th class="num">수량</th><th class="num">단가</th><th class="num">금액</th>
            </tr></thead>
            <tbody>${itemRows || '<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">품목 없음</td></tr>'}</tbody>
            <tfoot>
              <tr style="font-weight:700;background:var(--bg-glass)">
                <td colspan="4" style="text-align:right">합계</td>
                <td class="num">${formatCurrency(totalAmt)}</td>
              </tr>
            </tfoot>
          </table>
          ${d.notes ? `<div style="margin-top:10px;font-size:0.82rem;color:var(--text-muted)">비고: ${d.notes}</div>` : ''}
        </div>
        <div class="modal-footer"><button class="btn btn-secondary modal-close">닫기</button></div>
      `;
      openModal(html, 'modal-wide');
    } catch (e) { showToast('전표 상세 조회 실패: ' + e.message, 'error'); }
  }

  return { render, reset };
})();
window.TaxInvoices = TaxInvoices;
