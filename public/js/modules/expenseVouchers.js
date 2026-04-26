/* ─── Expense Vouchers Module (수동 비용 전표) v56 ─── */
const ExpenseVouchers = (() => {
  let _data    = [];
  let _filters = { from: '', to: '' };

  const CATEGORIES = ['교통비', '식대', '소모품', '비품', '접대비', '통신비', '임차료', '수수료', '기타'];

  function reset() { _filters = { from: '', to: '' }; }

  async function render() {
    const container = document.getElementById('page-container');
    if (!container) return;

    const year    = new Date().getFullYear();
    const summary = await API.get(`/expense-vouchers/summary?year=${year}`).catch(() => []);
    const totalAmt  = summary.reduce((s, r) => s + r.amount, 0);
    const thisMonth = new Date().toISOString().slice(0, 7);
    const monthAmt  = summary.filter(r => r.month === thisMonth).reduce((s, r) => s + r.amount, 0);

    // 카테고리별 집계
    const byCat = {};
    summary.forEach(r => { byCat[r.category] = (byCat[r.category] || 0) + r.amount; });
    const topCats = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 3);

    container.innerHTML = `
      <div class="animate-fade">
        <div class="page-header">
          <div>
            <h2 class="page-title">수동 비용 전표</h2>
            <p class="page-subtitle">법인카드 · 현금 · 계좌이체로 처리된 PO 외 비용을 직접 등록합니다.</p>
          </div>
          <button class="btn btn-primary" id="ev-new-btn">+ 비용 전표 등록</button>
        </div>

        <div class="kpi-grid" style="margin-bottom:20px">
          <div class="kpi-card">
            <div class="kpi-label">올해 총 비용</div>
            <div class="kpi-value">${formatCurrency(totalAmt)}</div>
            <div class="kpi-sub">${summary.reduce((s,r)=>s+r.count,0)}건</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">이번 달 비용</div>
            <div class="kpi-value">${formatCurrency(monthAmt)}</div>
            <div class="kpi-sub">${thisMonth}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">주요 비목 Top 3</div>
            <div style="font-size:0.85rem;margin-top:4px">
              ${topCats.map(([cat, amt]) => `<div style="display:flex;justify-content:space-between"><span>${cat}</span><strong>${formatCurrency(amt)}</strong></div>`).join('') || '-'}
            </div>
          </div>
        </div>

        <div class="filter-bar" style="margin-bottom:12px">
          <input type="date" id="ev-from" value="${currentMonth()}-01" style="width:150px">
          <input type="date" id="ev-to"   value="${today()}"           style="width:150px">
          <select id="ev-cat-filter" style="width:120px">
            <option value="">전체 비목</option>
            ${CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('')}
          </select>
          <button class="btn btn-secondary" id="ev-search-btn">조회</button>
        </div>

        <div class="card" id="ev-table-wrap">${loadingHTML()}</div>
      </div>
    `;

    document.getElementById('ev-new-btn').addEventListener('click', () => openForm());
    document.getElementById('ev-search-btn').addEventListener('click', () => {
      _filters.from     = document.getElementById('ev-from').value;
      _filters.to       = document.getElementById('ev-to').value;
      _filters.category = document.getElementById('ev-cat-filter').value;
      loadData();
    });

    await loadData();
  }

  async function loadData() {
    const wrap = document.getElementById('ev-table-wrap');
    if (!wrap) return;
    try {
      const p = new URLSearchParams({ ..._filters });
      _data = await API.get('/expense-vouchers?' + p);
      renderTable();
    } catch (e) {
      wrap.innerHTML = `<div class="alert alert-danger">${e.message}</div>`;
    }
  }

  function renderTable() {
    const wrap = document.getElementById('ev-table-wrap');
    if (!wrap) return;
    if (!_data.length) {
      wrap.innerHTML = `<div style="padding:40px;text-align:center;color:var(--text-muted)">등록된 비용 전표가 없습니다.</div>`;
      return;
    }
    const confirmed = _data.filter(r => r.status === 'confirmed');
    wrap.innerHTML = `
      <div style="overflow-x:auto">
        <table class="table hover">
          <thead><tr>
            <th>전표번호</th><th>일자</th><th>적요</th><th>비목</th>
            <th>거래처</th><th>결제수단</th><th>계좌</th>
            <th class="num">금액</th><th>상태</th><th>작업</th>
          </tr></thead>
          <tbody>
            ${_data.map(v => `
              <tr style="${v.status==='cancelled'?'opacity:0.5':''}">
                <td><span class="mono" style="color:var(--primary-light)">${v.voucher_no}</span></td>
                <td>${formatDate(v.voucher_date)}</td>
                <td class="font-bold">${v.description}</td>
                <td><span class="badge badge-ghost">${v.category || '기타'}</span></td>
                <td>${v.partner_name || '-'}</td>
                <td>${v.payment_method}</td>
                <td style="font-size:0.8rem;color:var(--text-muted)">${v.account_name || '-'}</td>
                <td class="num font-bold" style="color:var(--danger)">${formatCurrency(v.amount)}</td>
                <td>${v.status==='confirmed'
                  ? '<span class="badge badge-success">확정</span>'
                  : '<span class="badge badge-danger">취소</span>'}</td>
                <td class="table-actions">
                  ${v.status==='confirmed'
                    ? `<button class="btn btn-xs btn-danger ev-cancel-btn" data-id="${v.id}" data-no="${v.voucher_no}" data-amt="${v.amount}">취소</button>`
                    : ''}
                </td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr style="font-weight:700;border-top:2px solid var(--border)">
              <td colspan="7">합계 (${confirmed.length}건)</td>
              <td class="num" style="color:var(--danger)">${formatCurrency(confirmed.reduce((s,r)=>s+r.amount,0))}</td>
              <td colspan="2"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;

    document.querySelectorAll('.ev-cancel-btn').forEach(btn =>
      btn.addEventListener('click', async () => {
        const amt = Number(btn.dataset.amt);
        if (!confirm(`${btn.dataset.no}을 취소하시겠습니까?\n계좌에 ${formatCurrency(amt)}이 복원됩니다.`)) return;
        try {
          const r = await API.put(`/expense-vouchers/${btn.dataset.id}/cancel`, {});
          showToast(r.message, 'success');
          loadData();
        } catch (e) { showToast(e.message, 'error'); }
      }));
  }

  // ── 비용 전표 등록 폼 ──────────────────────────────────────────────────────
  async function openForm() {
    const [partners, accounts] = await Promise.all([
      API.get('/partners').catch(() => []),
      API.get('/bank-accounts').catch(() => []),
    ]);
    const partnerOpts = partners.map(p =>
      `<option value="${p.code}" data-name="${p.name}">${p.name} (${p.code})</option>`).join('');
    const accountOpts = accounts.map(a =>
      `<option value="${a.id}" data-balance="${a.current_balance}">${a.name} — ${a.bank_name} (잔액 ${formatCurrency(a.current_balance)})</option>`).join('');

    if (!accounts.length) return showToast('등록된 계좌가 없습니다. 자금 및 계좌 관리에서 먼저 계좌를 등록하세요.', 'error');

    const html = `
      <div class="modal-header">
        <div class="modal-title">수동 비용 전표 등록</div>
        <button class="modal-close">×</button>
      </div>
      <div class="modal-body">
        <div class="alert alert-warning" style="font-size:0.82rem;margin-bottom:12px">
          ⚠️ 등록 즉시 선택한 계좌에서 금액이 차감됩니다. 취소 시 복원됩니다.
        </div>
        <div class="form-grid" style="margin-bottom:16px">
          <div class="form-group">
            <label>일자 <span class="required">*</span></label>
            <input type="date" id="ev-date" value="${today()}" style="width:100%" max="${today()}">
          </div>
          <div class="form-group">
            <label>비목 <span class="required">*</span></label>
            <select id="ev-category" style="width:100%">
              ${CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('')}
            </select>
          </div>
          <div class="form-group" style="grid-column:span 2">
            <label>적요 (사용내역) <span class="required">*</span></label>
            <input type="text" id="ev-desc" placeholder="예: 현장 교통비, 소모품 구매" style="width:100%">
          </div>
          <div class="form-group">
            <label>금액 <span class="required">*</span></label>
            <input type="number" id="ev-amount" placeholder="0" min="1" style="width:100%">
          </div>
          <div class="form-group">
            <label>공급가액 <span style="color:var(--text-muted);font-size:0.78rem">(선택)</span></label>
            <input type="number" id="ev-supply" placeholder="자동" min="0" style="width:100%">
          </div>
          <div class="form-group">
            <label>세액 <span style="color:var(--text-muted);font-size:0.78rem">(선택)</span></label>
            <input type="number" id="ev-tax" placeholder="자동" min="0" style="width:100%">
          </div>
          <div class="form-group">
            <label>결제수단 <span class="required">*</span></label>
            <select id="ev-method" style="width:100%">
              <option value="법인카드">법인카드</option>
              <option value="계좌이체" selected>계좌이체</option>
              <option value="현금">현금</option>
            </select>
          </div>
          <div class="form-group" style="grid-column:span 2">
            <label>결제 계좌/카드 <span class="required">*</span></label>
            <select id="ev-account" style="width:100%">
              ${accountOpts}
            </select>
            <div id="ev-balance-hint" style="font-size:0.78rem;color:var(--text-muted);margin-top:3px"></div>
          </div>
          <div class="form-group" style="grid-column:span 2">
            <label>거래처 <span style="color:var(--text-muted);font-size:0.78rem">(선택)</span></label>
            <select id="ev-partner" style="width:100%">
              <option value="">선택 안 함</option>${partnerOpts}
            </select>
          </div>
          <div class="form-group" style="grid-column:span 2">
            <label>비고</label>
            <input type="text" id="ev-notes" placeholder="기타 메모">
          </div>
        </div>
        <div id="ev-balance-warn" style="display:none" class="alert alert-danger"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary modal-close">취소</button>
        <button class="btn btn-primary" id="ev-save-btn">등록 (즉시 출금)</button>
      </div>
    `;
    openModal(html, 'modal-wide', { persistent: true });

    // 잔액 힌트
    const updateBalanceHint = () => {
      const sel = document.getElementById('ev-account');
      const bal = Number(sel.selectedOptions[0]?.dataset.balance || 0);
      const amt = parseFloat(document.getElementById('ev-amount').value) || 0;
      const hint = document.getElementById('ev-balance-hint');
      const warn = document.getElementById('ev-balance-warn');
      hint.textContent = `현재 잔액: ${formatCurrency(bal)}`;
      if (amt > 0 && amt > bal) {
        warn.style.display = '';
        warn.textContent = `⚠️ 잔액 부족: ${formatCurrency(bal)} < ${formatCurrency(amt)}`;
      } else {
        warn.style.display = 'none';
      }
    };
    document.getElementById('ev-account').addEventListener('change', updateBalanceHint);
    document.getElementById('ev-amount').addEventListener('input', () => {
      updateBalanceHint();
      // 공급가액 자동: floor(amt/1.1)
      const amt = parseFloat(document.getElementById('ev-amount').value) || 0;
      const supplyEl = document.getElementById('ev-supply');
      const taxEl    = document.getElementById('ev-tax');
      if (!supplyEl.dataset.manual) supplyEl.value = Math.floor(amt / 1.1) || '';
      if (!taxEl.dataset.manual)    taxEl.value    = (amt - Math.floor(amt / 1.1)) || '';
    });
    document.getElementById('ev-supply').addEventListener('input', () => { document.getElementById('ev-supply').dataset.manual = '1'; });
    document.getElementById('ev-tax').addEventListener('input',    () => { document.getElementById('ev-tax').dataset.manual    = '1'; });
    updateBalanceHint();

    document.getElementById('ev-save-btn').addEventListener('click', async () => {
      const voucher_date   = document.getElementById('ev-date').value;
      const description    = document.getElementById('ev-desc').value.trim();
      const category       = document.getElementById('ev-category').value;
      const amount         = parseFloat(document.getElementById('ev-amount').value);
      const supply_amount  = parseFloat(document.getElementById('ev-supply').value) || undefined;
      const tax_amount     = parseFloat(document.getElementById('ev-tax').value)    || undefined;
      const payment_method = document.getElementById('ev-method').value;
      const bank_account_id = document.getElementById('ev-account').value;
      const partnerSel     = document.getElementById('ev-partner');
      const partner_code   = partnerSel.value || undefined;
      const partner_name   = partnerSel.selectedOptions[0]?.dataset.name || undefined;
      const notes          = document.getElementById('ev-notes').value;

      if (!voucher_date)    return showToast('일자를 입력하세요.', 'error');
      if (!description)     return showToast('적요를 입력하세요.', 'error');
      if (!amount || amount <= 0) return showToast('금액을 입력하세요.', 'error');
      if (!bank_account_id) return showToast('결제 계좌를 선택하세요.', 'error');

      try {
        const r = await API.post('/expense-vouchers', {
          voucher_date, description, category, amount, supply_amount, tax_amount,
          payment_method, bank_account_id, partner_code, partner_name, notes,
        });
        showToast(`등록 완료: ${r.voucher_no} (잔액 ${formatCurrency(r.balance_after)})`, 'success', 5000);
        closeModal();
        loadData();
      } catch (e) { showToast(e.message, 'error'); }
    });
  }

  return { render, reset };
})();
window.ExpenseVouchers = ExpenseVouchers;
