'use strict';

const ArInvoices = (() => {
  /* ── 상태 ── */
  let _list = [];
  let _filterStatus = '';
  let _filterPartner = '';

  /* ── 렌더 ── */
  async function render() {
    return `
      <div class="page-header">
        <div class="page-header-left">
          <h2 class="page-title">청구 및 수금 관리 (AR)</h2>
          <span class="page-subtitle">매출 채권 인보이스 관리 및 수금 처리</span>
        </div>
        <div class="page-header-right">
          <button class="btn btn-primary" onclick="ArInvoices.openCreateModal()">
            <svg class="btn-icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd"/></svg>
            AR 인보이스 발행
          </button>
        </div>
      </div>

      <div class="card" style="margin-bottom:16px">
        <div class="card-body" style="padding:16px">
          <div class="filter-row" style="display:flex;gap:12px;flex-wrap:wrap;align-items:center">
            <select id="ar-status-filter" class="form-control" style="width:140px" onchange="ArInvoices.applyFilter()">
              <option value="">전체 상태</option>
              <option value="open">미수금 (Open)</option>
              <option value="partial">부분수금</option>
              <option value="paid">완납</option>
            </select>
            <input type="text" id="ar-partner-filter" class="form-control" placeholder="거래처명 검색" style="width:200px" oninput="ArInvoices.applyFilter()">
            <button class="btn btn-secondary" onclick="ArInvoices.load()">새로고침</button>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-body" style="padding:0">
          <div id="ar-table-wrap"></div>
        </div>
      </div>
    `;
  }

  async function init() {
    await load();
  }

  async function load() {
    try {
      _list = await API.get('/invoices?type=AR');
      renderTable();
    } catch (e) {
      showToast(e.message, 'error');
    }
  }

  function applyFilter() {
    _filterStatus = document.getElementById('ar-status-filter')?.value || '';
    _filterPartner = document.getElementById('ar-partner-filter')?.value.toLowerCase() || '';
    renderTable();
  }

  function renderTable() {
    const wrap = document.getElementById('ar-table-wrap');
    if (!wrap) return;

    let rows = _list;
    if (_filterStatus) rows = rows.filter(r => r.status === _filterStatus);
    if (_filterPartner) rows = rows.filter(r => (r.partner_name || '').toLowerCase().includes(_filterPartner));

    if (!rows.length) {
      wrap.innerHTML = emptyHTML('AR 인보이스가 없습니다');
      return;
    }

    const statusBadge = (s) => {
      const map = { open: ['미수금', 'badge-danger'], partial: ['부분수금', 'badge-warning'], paid: ['완납', 'badge-success'] };
      const [label, cls] = map[s] || [s, 'badge-secondary'];
      return `<span class="badge ${cls}">${label}</span>`;
    };

    wrap.innerHTML = `
      <table class="data-table">
        <thead><tr>
          <th>인보이스번호</th>
          <th>청구일</th>
          <th>만기일</th>
          <th>거래처</th>
          <th style="text-align:right">청구금액</th>
          <th style="text-align:right">수금액</th>
          <th style="text-align:right">잔액</th>
          <th>상태</th>
          <th>작업</th>
        </tr></thead>
        <tbody>
          ${rows.map(r => `
            <tr>
              <td><code>${r.invoice_no}</code></td>
              <td>${r.invoice_date}</td>
              <td>${r.due_date || '-'}</td>
              <td>${r.partner_name || r.partner_code}</td>
              <td style="text-align:right">${fmtNum(r.total_amount)}</td>
              <td style="text-align:right">${fmtNum(r.paid_amount)}</td>
              <td style="text-align:right"><strong>${fmtNum(r.balance)}</strong></td>
              <td>${statusBadge(r.status)}</td>
              <td>
                <button class="btn btn-sm btn-secondary" onclick="ArInvoices.openDetail('${r.id}')">상세</button>
                ${r.status !== 'paid' ? `<button class="btn btn-sm btn-primary" onclick="ArInvoices.openPayment('${r.id}','${r.invoice_no}',${r.balance})">수금</button>` : ''}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  /* ── AR 인보이스 발행 모달 ── */
  async function openCreateModal() {
    let soList = [];
    try {
      soList = await API.get('/sales-orders?status=출고');
    } catch { soList = []; }

    const opts = soList.map(s => `<option value="${s.id}">[${s.so_no}] ${s.customer_name || s.customer_code} — ₩${fmtNum(s.total_amount)}</option>`).join('');
    const today = new Date().toISOString().slice(0, 10);

    openModal(`
      <div class="modal-header"><div class="modal-title">AR 인보이스 발행</div></div>
      <div class="modal-body">
        <div class="form-group">
          <label>출고완료 수주건 <span class="required">*</span></label>
          <select id="ar-so-select" class="form-control">
            <option value="">-- 수주 선택 --</option>
            ${opts}
          </select>
        </div>
        <div class="form-group">
          <label>청구일 <span class="required">*</span></label>
          <input type="date" id="ar-invoice-date" class="form-control" value="${today}">
        </div>
        <div class="form-group">
          <label>만기일</label>
          <input type="date" id="ar-due-date" class="form-control">
        </div>
        <div class="form-group">
          <label>비고</label>
          <input type="text" id="ar-notes" class="form-control" placeholder="메모">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal()">취소</button>
        <button class="btn btn-primary" onclick="ArInvoices.submitCreate()">발행</button>
      </div>
    `);
  }

  async function submitCreate() {
    const so_id = document.getElementById('ar-so-select').value;
    const invoice_date = document.getElementById('ar-invoice-date').value;
    const due_date = document.getElementById('ar-due-date').value;
    const notes = document.getElementById('ar-notes').value;
    if (!so_id || !invoice_date) return showToast('수주건과 청구일을 선택하세요.', 'error');
    try {
      await API.post('/invoices/ar', { so_id, invoice_date, due_date: due_date || null, notes });
      showToast('AR 인보이스가 발행되었습니다.', 'success');
      closeModal();
      load();
    } catch (e) {
      showToast(e.message, 'error');
    }
  }

  /* ── 상세 보기 ── */
  async function openDetail(id) {
    let inv;
    try { inv = await API.get(`/invoices/${id}`); } catch (e) { showToast(e.message, 'error'); return; }

    const statusBadge = (s) => {
      const map = { open: ['미수금', 'badge-danger'], partial: ['부분수금', 'badge-warning'], paid: ['완납', 'badge-success'] };
      const [label, cls] = map[s] || [s, 'badge-secondary'];
      return `<span class="badge ${cls}">${label}</span>`;
    };

    openModal(`
      <div class="modal-header">
        <div class="modal-title">AR 인보이스 상세 — ${inv.invoice_no}</div>
      </div>
      <div class="modal-body">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
          <div><label class="form-label" style="color:var(--text-muted)">거래처</label><div>${inv.partner_name || inv.partner_code}</div></div>
          <div><label class="form-label" style="color:var(--text-muted)">상태</label><div>${statusBadge(inv.status)}</div></div>
          <div><label class="form-label" style="color:var(--text-muted)">청구일</label><div>${inv.invoice_date}</div></div>
          <div><label class="form-label" style="color:var(--text-muted)">만기일</label><div>${inv.due_date || '-'}</div></div>
          <div><label class="form-label" style="color:var(--text-muted)">청구금액</label><div>₩${fmtNum(inv.total_amount)}</div></div>
          <div><label class="form-label" style="color:var(--text-muted)">수금잔액</label><div><strong>₩${fmtNum(inv.balance)}</strong></div></div>
        </div>
        <table class="data-table" style="margin-bottom:16px">
          <thead><tr><th>품목</th><th style="text-align:right">수량</th><th style="text-align:right">단가</th><th style="text-align:right">할인</th><th style="text-align:right">세율</th><th style="text-align:right">금액</th></tr></thead>
          <tbody>
            ${inv.items.map(it => `<tr>
              <td>${it.material_name || it.material_code}</td>
              <td style="text-align:right">${it.qty}</td>
              <td style="text-align:right">₩${fmtNum(it.unit_price)}</td>
              <td style="text-align:right">${((it.discount_rate||0)*100).toFixed(1)}%</td>
              <td style="text-align:right">${((it.tax_rate||0.1)*100).toFixed(0)}%</td>
              <td style="text-align:right">₩${fmtNum(it.line_amount)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
        ${inv.payments.length ? `
          <div><strong>수금 이력</strong></div>
          <table class="data-table" style="margin-top:8px">
            <thead><tr><th>일자</th><th>방법</th><th style="text-align:right">금액</th><th>비고</th></tr></thead>
            <tbody>
              ${inv.payments.map(p => `<tr>
                <td>${p.payment_date}</td>
                <td>${p.payment_method || '-'}</td>
                <td style="text-align:right">₩${fmtNum(p.amount)}</td>
                <td>${p.notes || ''}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        ` : ''}
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal()">닫기</button>
        ${inv.status !== 'paid' ? `<button class="btn btn-primary" onclick="closeModal();ArInvoices.openPayment('${inv.id}','${inv.invoice_no}',${inv.balance})">수금 처리</button>` : ''}
      </div>
    `, 'max-width:760px');
  }

  /* ── 수금 처리 모달 ── */
  async function openPayment(id, invNo, balance) {
    let accounts = [];
    try { accounts = await API.get('/bank-accounts'); } catch { accounts = []; }

    const today = new Date().toISOString().slice(0, 10);
    const acctOpts = accounts.map(a => `<option value="${a.id}">[${a.account_no}] ${a.bank_name} ${a.account_name} — ₩${fmtNum(a.current_balance)}</option>`).join('');

    openModal(`
      <div class="modal-header"><div class="modal-title">수금 처리 — ${invNo}</div></div>
      <div class="modal-body">
        <div class="form-group">
          <label>수금 잔액</label>
          <input type="text" class="form-control" value="₩${fmtNum(balance)}" readonly style="background:var(--bg-secondary)">
        </div>
        <div class="form-group">
          <label>입금 계좌 <span class="required">*</span></label>
          <select id="pay-account" class="form-control">
            <option value="">-- 계좌 선택 --</option>
            ${acctOpts}
          </select>
        </div>
        <div class="form-group">
          <label>수금액 <span class="required">*</span></label>
          <input type="number" id="pay-amount" class="form-control" value="${balance}" min="1" step="1">
        </div>
        <div class="form-group">
          <label>수금일 <span class="required">*</span></label>
          <input type="date" id="pay-date" class="form-control" value="${today}">
        </div>
        <div class="form-group">
          <label>수금 방법</label>
          <select id="pay-method" class="form-control">
            <option value="계좌이체">계좌이체</option>
            <option value="현금">현금</option>
            <option value="어음">어음</option>
            <option value="카드">카드</option>
          </select>
        </div>
        <div class="form-group">
          <label>비고</label>
          <input type="text" id="pay-notes" class="form-control" placeholder="메모">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal()">취소</button>
        <button class="btn btn-primary" onclick="ArInvoices.submitPayment('${id}')">수금 확정</button>
      </div>
    `);
  }

  async function submitPayment(id) {
    const bank_account_id = document.getElementById('pay-account').value;
    const amount = parseFloat(document.getElementById('pay-amount').value);
    const payment_date = document.getElementById('pay-date').value;
    const payment_method = document.getElementById('pay-method').value;
    const notes = document.getElementById('pay-notes').value;
    if (!bank_account_id || !amount || !payment_date) return showToast('계좌, 수금액, 수금일을 입력하세요.', 'error');
    try {
      await API.post(`/invoices/${id}/payments`, { amount, payment_date, method: payment_method, notes, bank_account_id });
      showToast('수금이 처리되었습니다.', 'success');
      closeModal();
      load();
    } catch (e) {
      showToast(e.message, 'error');
    }
  }

  function fmtNum(n) {
    if (n == null || n === '') return '0';
    return Number(n).toLocaleString('ko-KR');
  }

  return { render, init, load, applyFilter, openCreateModal, submitCreate, openDetail, openPayment, submitPayment };
})();

window.ArInvoices = ArInvoices;
