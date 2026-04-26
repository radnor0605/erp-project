'use strict';

const BankAccounts = (() => {
  let _list = [];

  async function render() {
    return `
      <div class="page-header">
        <div class="page-header-left">
          <h2 class="page-title">자금 및 계좌 관리</h2>
          <span class="page-subtitle">자사 은행 계좌 잔액 및 입출금 원장 관리</span>
        </div>
        <div class="page-header-right">
          <button class="btn btn-primary" onclick="BankAccounts.openCreateModal()">
            <svg class="btn-icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd"/></svg>
            계좌 등록
          </button>
        </div>
      </div>

      <div id="bank-accounts-summary" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin-bottom:16px"></div>

      <div class="card">
        <div class="card-body" style="padding:0">
          <div id="bank-accounts-table-wrap"></div>
        </div>
      </div>
    `;
  }

  async function init() {
    await load();
  }

  async function load() {
    try {
      _list = await API.get('/bank-accounts');
      renderSummary();
      renderTable();
    } catch (e) {
      showToast(e.message, 'error');
    }
  }

  function renderSummary() {
    const el = document.getElementById('bank-accounts-summary');
    if (!el) return;
    const total = _list.reduce((s, a) => s + (a.current_balance || 0), 0);
    el.innerHTML = `
      <div class="kpi-card" style="background:var(--card-bg);border:1px solid var(--border-color);border-radius:12px;padding:20px">
        <div class="kpi-label" style="color:var(--text-muted);font-size:12px;margin-bottom:6px">총 자금 잔액</div>
        <div class="kpi-value" style="font-size:24px;font-weight:700">₩${fmtNum(total)}</div>
        <div style="color:var(--text-muted);font-size:12px;margin-top:4px">등록 계좌 ${_list.length}개</div>
      </div>
      ${_list.map(a => `
        <div class="kpi-card" style="background:var(--card-bg);border:1px solid var(--border-color);border-radius:12px;padding:20px;cursor:pointer" onclick="BankAccounts.openLedger('${a.id}','${a.name}')">
          <div class="kpi-label" style="color:var(--text-muted);font-size:12px;margin-bottom:4px">${a.bank_name} · ${a.account_no}</div>
          <div class="kpi-sub" style="font-size:13px;font-weight:600;margin-bottom:6px">${a.name}</div>
          <div class="kpi-value" style="font-size:20px;font-weight:700">₩${fmtNum(a.current_balance)}</div>
          <div style="color:var(--text-muted);font-size:11px;margin-top:4px">${a.currency || 'KRW'} · ${a.account_type || 'checking'}</div>
        </div>
      `).join('')}
    `;
  }

  function renderTable() {
    const wrap = document.getElementById('bank-accounts-table-wrap');
    if (!wrap) return;
    if (!_list.length) { wrap.innerHTML = emptyHTML('등록된 계좌가 없습니다'); return; }

    wrap.innerHTML = `
      <table class="data-table">
        <thead><tr>
          <th>코드</th>
          <th>계좌명</th>
          <th>은행</th>
          <th>계좌번호</th>
          <th>예금주</th>
          <th>종류</th>
          <th style="text-align:right">잔액</th>
          <th>작업</th>
        </tr></thead>
        <tbody>
          ${_list.map(a => `
            <tr>
              <td><code>${a.account_code}</code></td>
              <td>${a.name}</td>
              <td>${a.bank_name}</td>
              <td>${a.account_no}</td>
              <td>${a.account_holder || '-'}</td>
              <td>${a.account_type || 'checking'}</td>
              <td style="text-align:right"><strong>₩${fmtNum(a.current_balance)}</strong></td>
              <td>
                <button class="btn btn-sm btn-secondary" onclick="BankAccounts.openLedger('${a.id}','${a.name}')">원장</button>
                <button class="btn btn-sm btn-secondary" onclick="BankAccounts.openEditModal('${a.id}')">수정</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  /* ── 계좌 등록 모달 ── */
  function openCreateModal() {
    openModal(`
      <div class="modal-header"><div class="modal-title">계좌 등록</div></div>
      <div class="modal-body">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="form-group">
            <label>계좌 코드 <span class="required">*</span></label>
            <input type="text" id="ba-code" class="form-control" placeholder="예: BANK-001">
          </div>
          <div class="form-group">
            <label>계좌명 <span class="required">*</span></label>
            <input type="text" id="ba-name" class="form-control" placeholder="예: 주거래 계좌">
          </div>
          <div class="form-group">
            <label>은행명 <span class="required">*</span></label>
            <input type="text" id="ba-bank" class="form-control" placeholder="예: 국민은행">
          </div>
          <div class="form-group">
            <label>계좌번호 <span class="required">*</span></label>
            <input type="text" id="ba-no" class="form-control" placeholder="예: 123-456-789012">
          </div>
          <div class="form-group">
            <label>예금주</label>
            <input type="text" id="ba-holder" class="form-control">
          </div>
          <div class="form-group">
            <label>계좌 종류</label>
            <select id="ba-type" class="form-control">
              <option value="checking">보통예금</option>
              <option value="savings">정기예금</option>
              <option value="corporate">법인계좌</option>
            </select>
          </div>
          <div class="form-group">
            <label>통화</label>
            <select id="ba-currency" class="form-control">
              <option value="KRW">KRW</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </div>
          <div class="form-group">
            <label>초기 잔액</label>
            <input type="number" id="ba-init" class="form-control" value="0" min="0" step="1">
          </div>
        </div>
        <div class="form-group">
          <label>비고</label>
          <input type="text" id="ba-notes" class="form-control" placeholder="메모">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal()">취소</button>
        <button class="btn btn-primary" onclick="BankAccounts.submitCreate()">등록</button>
      </div>
    `, 'max-width:640px');
  }

  async function submitCreate() {
    const account_code = document.getElementById('ba-code').value.trim();
    const name = document.getElementById('ba-name').value.trim();
    const bank_name = document.getElementById('ba-bank').value.trim();
    const account_no = document.getElementById('ba-no').value.trim();
    const account_holder = document.getElementById('ba-holder').value.trim();
    const account_type = document.getElementById('ba-type').value;
    const currency = document.getElementById('ba-currency').value;
    const initial_balance = parseFloat(document.getElementById('ba-init').value) || 0;
    const notes = document.getElementById('ba-notes').value.trim();
    if (!account_code || !name || !bank_name || !account_no) return showToast('코드, 계좌명, 은행명, 계좌번호는 필수입니다.', 'error');
    try {
      await API.post('/bank-accounts', { account_code, name, bank_name, account_no, account_holder, account_type, currency, initial_balance, notes });
      showToast('계좌가 등록되었습니다.', 'success');
      closeModal();
      load();
    } catch (e) {
      showToast(e.message, 'error');
    }
  }

  /* ── 계좌 수정 모달 ── */
  async function openEditModal(id) {
    const a = _list.find(x => x.id === id);
    if (!a) return;
    openModal(`
      <div class="modal-header"><div class="modal-title">계좌 수정 — ${a.name}</div></div>
      <div class="modal-body">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="form-group">
            <label>계좌명</label>
            <input type="text" id="be-name" class="form-control" value="${a.name}">
          </div>
          <div class="form-group">
            <label>은행명</label>
            <input type="text" id="be-bank" class="form-control" value="${a.bank_name}">
          </div>
          <div class="form-group">
            <label>계좌번호</label>
            <input type="text" id="be-no" class="form-control" value="${a.account_no}">
          </div>
          <div class="form-group">
            <label>예금주</label>
            <input type="text" id="be-holder" class="form-control" value="${a.account_holder || ''}">
          </div>
        </div>
        <div class="form-group">
          <label>비고</label>
          <input type="text" id="be-notes" class="form-control" value="${a.notes || ''}">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal()">취소</button>
        <button class="btn btn-primary" onclick="BankAccounts.submitEdit('${id}')">저장</button>
      </div>
    `, 'max-width:500px');
  }

  async function submitEdit(id) {
    const name = document.getElementById('be-name').value.trim();
    const bank_name = document.getElementById('be-bank').value.trim();
    const account_no = document.getElementById('be-no').value.trim();
    const account_holder = document.getElementById('be-holder').value.trim();
    const notes = document.getElementById('be-notes').value.trim();
    try {
      await API.put(`/bank-accounts/${id}`, { name, bank_name, account_no, account_holder, notes });
      showToast('계좌 정보가 수정되었습니다.', 'success');
      closeModal();
      load();
    } catch (e) {
      showToast(e.message, 'error');
    }
  }

  /* ── 계좌 원장 모달 ── */
  async function openLedger(id, name) {
    let data;
    try { data = await API.get(`/bank-accounts/${id}/ledger`); } catch (e) { showToast(e.message, 'error'); return; }

    const { account, ledger } = data;
    let running = account.initial_balance || 0;
    const rows = ledger.map(p => {
      const isIn = p.invoice_type === 'AR';
      if (isIn) running += p.amount;
      else running -= p.amount;
      return `<tr>
        <td>${p.payment_date}</td>
        <td>${p.invoice_no || '-'}</td>
        <td>${p.partner_name || p.partner_code || '-'}</td>
        <td style="text-align:right;color:${isIn ? 'var(--success)' : 'var(--danger)'}">${isIn ? '+' : '-'}₩${fmtNum(p.amount)}</td>
        <td style="text-align:right">₩${fmtNum(running)}</td>
        <td>${p.payment_method || '-'}</td>
        <td>${p.notes || ''}</td>
      </tr>`;
    });

    openModal(`
      <div class="modal-header">
        <div class="modal-title">계좌 원장 — ${name}</div>
      </div>
      <div class="modal-body">
        <div style="display:flex;gap:24px;margin-bottom:16px;padding:12px;background:var(--bg-secondary);border-radius:8px">
          <div><span style="color:var(--text-muted);font-size:12px">계좌번호</span><br><strong>${account.account_no}</strong></div>
          <div><span style="color:var(--text-muted);font-size:12px">은행</span><br><strong>${account.bank_name}</strong></div>
          <div><span style="color:var(--text-muted);font-size:12px">현재 잔액</span><br><strong style="font-size:18px">₩${fmtNum(account.current_balance)}</strong></div>
        </div>
        ${ledger.length ? `
          <div style="max-height:400px;overflow-y:auto">
            <table class="data-table">
              <thead><tr><th>일자</th><th>인보이스</th><th>거래처</th><th style="text-align:right">금액</th><th style="text-align:right">잔액</th><th>방법</th><th>비고</th></tr></thead>
              <tbody>${rows.join('')}</tbody>
            </table>
          </div>
        ` : emptyHTML('거래 내역이 없습니다')}
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal()">닫기</button>
      </div>
    `, 'max-width:900px');
  }

  function fmtNum(n) {
    if (n == null || n === '') return '0';
    return Number(n).toLocaleString('ko-KR');
  }

  return { render, init, load, openCreateModal, submitCreate, openEditModal, submitEdit, openLedger };
})();

window.BankAccounts = BankAccounts;
