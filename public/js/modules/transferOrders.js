/* ─── Transfer Orders Module (창고간 이전 전표) ─── */
const TransferOrders = (() => {
  let _data = [];
  let _filters = { status: '', from: '', to: '' };

  function reset() { _filters = { status: '', from: '', to: '' }; }

  async function render() {
    const container = document.getElementById('page-container');
    if (!container) return;

    const warehouses = await API.get('/inventory/warehouses').catch(() => []);

    container.innerHTML = `
      <div class="animate-fade">
        <div class="page-header">
          <div>
            <h2 class="page-title">창고간 이전 전표</h2>
            <p class="page-subtitle">재고를 한 창고에서 다른 창고로 이전하고 이동 전표를 생성합니다 (유형 301/302).</p>
          </div>
          <div class="header-actions">
            <button class="btn btn-primary" id="tr-new-btn">
              <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd"/></svg>
              신규 이전 전표
            </button>
          </div>
        </div>

        <div class="filter-bar" style="margin-bottom:16px">
          <select id="tr-status-filter" style="width:130px">
            <option value="">전체 상태</option>
            <option value="draft">초안</option>
            <option value="confirmed">확정</option>
            <option value="cancelled">취소</option>
          </select>
          <input type="date" id="tr-from" value="${currentMonth()}-01" style="width:150px">
          <input type="date" id="tr-to" value="${today()}" style="width:150px">
          <button class="btn btn-secondary" id="tr-search-btn">조회</button>
        </div>

        <div class="card" id="tr-table-wrap">${loadingHTML()}</div>
      </div>
    `;

    document.getElementById('tr-new-btn').onclick = () => openForm(warehouses);
    document.getElementById('tr-search-btn').onclick = () => {
      _filters.status = document.getElementById('tr-status-filter').value;
      _filters.from   = document.getElementById('tr-from').value;
      _filters.to     = document.getElementById('tr-to').value;
      loadData();
    };

    await loadData();
  }

  async function loadData() {
    const wrap = document.getElementById('tr-table-wrap');
    if (!wrap) return;
    try {
      const p = new URLSearchParams(_filters);
      _data = await API.get('/transfer-orders?' + p.toString());
      renderTable();
    } catch (err) {
      wrap.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
    }
  }

  function statusBadge(s) {
    const m = { draft: ['badge-warning','초안'], confirmed: ['badge-success','확정'], cancelled: ['badge-danger','취소'] };
    const [cls, label] = m[s] || ['badge-ghost', s];
    return `<span class="badge ${cls}">${label}</span>`;
  }

  function renderTable() {
    const wrap = document.getElementById('tr-table-wrap');
    if (!wrap) return;
    if (!_data.length) { wrap.innerHTML = `<div style="padding:40px;text-align:center;color:var(--text-muted)">이전 전표가 없습니다.</div>`; return; }
    wrap.innerHTML = `
      <div style="overflow-x:auto">
        <table class="table hover">
          <thead><tr>
            <th>전표번호</th><th>일자</th><th>출발 창고</th><th>도착 창고</th>
            <th class="num">품목 수</th><th>상태</th><th>작업</th>
          </tr></thead>
          <tbody>
            ${_data.map(t => `
              <tr>
                <td><span class="mono" style="color:var(--primary-light)">${t.transfer_no}</span></td>
                <td>${formatDate(t.date)}</td>
                <td><span class="badge badge-info" style="font-size:0.75rem">${t.from_wh_name || t.from_warehouse_code}</span></td>
                <td><span class="badge badge-success" style="font-size:0.75rem">${t.to_wh_name || t.to_warehouse_code}</span></td>
                <td class="num">${t.item_count}건</td>
                <td>${statusBadge(t.status)}</td>
                <td class="table-actions">
                  <button class="btn btn-xs btn-secondary tr-detail-btn" data-id="${t.id}">상세</button>
                  ${t.status === 'draft' ? `<button class="btn btn-xs btn-primary tr-confirm-btn" data-id="${t.id}" data-no="${t.transfer_no}">확정</button>` : ''}
                  ${t.status === 'draft' ? `<button class="btn btn-xs btn-danger tr-cancel-btn" data-id="${t.id}" data-no="${t.transfer_no}">취소</button>` : ''}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    document.querySelectorAll('.tr-detail-btn').forEach(btn =>
      btn.addEventListener('click', () => viewDetail(btn.dataset.id)));

    document.querySelectorAll('.tr-confirm-btn').forEach(btn =>
      btn.addEventListener('click', () => confirmTransfer(btn.dataset.id, btn.dataset.no)));

    document.querySelectorAll('.tr-cancel-btn').forEach(btn =>
      btn.addEventListener('click', async () => {
        if (!confirm(`${btn.dataset.no} 전표를 취소하시겠습니까?`)) return;
        try {
          await API.put(`/transfer-orders/${btn.dataset.id}/cancel`, {});
          showToast('취소되었습니다.', 'success');
          loadData();
        } catch (e) { showToast(e.message, 'error'); }
      }));
  }

  async function viewDetail(id) {
    const t = await API.get(`/transfer-orders/${id}`);
    const html = `
      <div class="modal-header">
        <div class="modal-title">이전 전표 상세 — ${t.transfer_no}</div>
        <button class="modal-close">×</button>
      </div>
      <div class="modal-body">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;padding:14px;background:var(--bg-glass);border-radius:var(--radius-md);margin-bottom:16px">
          <div>
            <div style="font-size:0.7rem;color:var(--text-muted)">출발 창고</div>
            <div style="font-weight:700">${t.from_wh_name || t.from_warehouse_code}</div>
          </div>
          <div>
            <div style="font-size:0.7rem;color:var(--text-muted)">도착 창고</div>
            <div style="font-weight:700;color:var(--success)">${t.to_wh_name || t.to_warehouse_code}</div>
          </div>
          <div>
            <div style="font-size:0.7rem;color:var(--text-muted)">이전일자</div>
            <div>${formatDate(t.date)}</div>
          </div>
          <div>
            <div style="font-size:0.7rem;color:var(--text-muted)">상태</div>
            <div>${statusBadge(t.status)}</div>
          </div>
        </div>
        <table class="table table-sm">
          <thead><tr><th>품목</th><th>규격/단위</th><th class="num">이전수량</th><th class="num">단가(MAP)</th><th class="num">이전금액</th>${t.status === 'draft' ? '<th class="num">가용재고</th>' : ''}</tr></thead>
          <tbody>
            ${t.items.map(i => `
              <tr>
                <td class="font-bold">${i.material_name || i.material_code}</td>
                <td style="font-size:0.78rem;color:var(--text-muted)">${i.unit || '-'}</td>
                <td class="num">${formatNumber(i.qty)}</td>
                <td class="num">${formatCurrency(i.unit_price || i.avg_price || 0)}</td>
                <td class="num font-bold">${formatCurrency(i.qty * (i.unit_price || i.avg_price || 0))}</td>
                ${t.status === 'draft' ? `<td class="num" style="color:${(i.available_qty||0) >= i.qty ? 'var(--success)' : 'var(--danger)'}">${formatNumber(i.available_qty || 0)}</td>` : ''}
              </tr>
            `).join('')}
          </tbody>
        </table>
        ${t.notes ? `<div style="margin-top:10px;font-size:0.83rem;color:var(--text-muted)">비고: ${t.notes}</div>` : ''}
      </div>
      <div class="modal-footer">
        ${t.status === 'draft' ? `<button class="btn btn-primary" id="modal-confirm-btn" data-id="${t.id}" data-no="${t.transfer_no}">확정 처리</button>` : ''}
        <button class="btn btn-secondary modal-close">닫기</button>
      </div>
    `;
    openModal(html, 'modal-wide');
    document.getElementById('modal-confirm-btn')?.addEventListener('click', async (e) => {
      closeModal();
      await confirmTransfer(e.currentTarget.dataset.id, e.currentTarget.dataset.no);
    });
  }

  async function confirmTransfer(id, no) {
    confirmDialog(
      `<strong>${no}</strong> 이전 전표를 확정합니다.<br>재고가 즉시 이전되며 이동 전표(301/302)가 생성됩니다.`,
      async () => {
        try {
          const r = await API.put(`/transfer-orders/${id}/confirm`, {});
          showToast(r.message, 'success', 4000);
          loadData();
        } catch (e) { showToast(e.message, 'error'); }
      }
    );
  }

  async function openForm(warehouses) {
    const materials = await API.get('/materials').catch(() => []);
    const whOpts = warehouses.map(w => `<option value="${w.code}">${w.name} (${w.code})</option>`).join('');
    const matOpts = materials.filter(m => m.is_active && !m.is_deleted)
      .map(m => `<option value="${m.code}" data-unit="${m.unit}" data-avg="${m.avg_price || 0}">${m.name} (${m.code})</option>`).join('');

    const html = `
      <div class="modal-header">
        <div class="modal-title">신규 창고 이전 전표</div>
        <button class="modal-close">×</button>
      </div>
      <div class="modal-body">
        <div class="form-grid" style="margin-bottom:16px">
          <div class="form-group">
            <label>이전 일자 <span class="required">*</span></label>
            <input type="date" id="tr-date" value="${today()}" style="width:100%">
          </div>
          <div class="form-group">
            <label>출발 창고 <span class="required">*</span></label>
            <select id="tr-from-wh" style="width:100%"><option value="">선택</option>${whOpts}</select>
          </div>
          <div class="form-group">
            <label>도착 창고 <span class="required">*</span></label>
            <select id="tr-to-wh" style="width:100%"><option value="">선택</option>${whOpts}</select>
          </div>
          <div class="form-group">
            <label>비고</label>
            <input type="text" id="tr-notes" placeholder="메모 (선택)">
          </div>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <div style="font-weight:600;font-size:0.9rem">이전 품목</div>
          <button class="btn btn-xs btn-secondary" id="tr-add-item">+ 품목 추가</button>
        </div>
        <table class="table table-sm" id="tr-items-table">
          <thead><tr><th>품목</th><th>단위</th><th>이전수량</th><th>단가 (MAP)</th><th></th></tr></thead>
          <tbody></tbody>
        </table>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary modal-close">취소</button>
        <button class="btn btn-primary" id="tr-save-btn">전표 저장 (초안)</button>
      </div>
    `;
    openModal(html, 'modal-wide', { persistent: true });

    const addRow = () => {
      const tbody = document.querySelector('#tr-items-table tbody');
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <select class="tr-mat" style="width:200px">
            <option value="">품목 선택</option>${matOpts}
          </select>
        </td>
        <td class="tr-unit" style="font-size:0.78rem;color:var(--text-muted)">-</td>
        <td><input type="number" class="tr-qty" min="0.01" step="0.01" value="1" style="width:80px"></td>
        <td class="tr-price" style="font-size:0.78rem;color:var(--text-muted)">-</td>
        <td><button type="button" class="btn btn-xs btn-danger tr-del">×</button></td>
      `;
      tr.querySelector('.tr-mat').addEventListener('change', e => {
        const opt = e.target.selectedOptions[0];
        tr.querySelector('.tr-unit').textContent = opt?.dataset.unit || '-';
        tr.querySelector('.tr-price').textContent = formatCurrency(parseFloat(opt?.dataset.avg || 0));
      });
      tr.querySelector('.tr-del').addEventListener('click', () => tr.remove());
      tbody.appendChild(tr);
    };

    document.getElementById('tr-add-item').addEventListener('click', addRow);
    addRow();

    document.getElementById('tr-save-btn').addEventListener('click', async () => {
      const date = document.getElementById('tr-date').value;
      const from_warehouse_code = document.getElementById('tr-from-wh').value;
      const to_warehouse_code   = document.getElementById('tr-to-wh').value;
      const notes = document.getElementById('tr-notes').value;

      if (!from_warehouse_code || !to_warehouse_code) return showToast('출발/도착 창고를 선택하세요.', 'error');
      if (from_warehouse_code === to_warehouse_code) return showToast('출발과 도착 창고가 같습니다.', 'error');

      const items = [];
      document.querySelectorAll('#tr-items-table tbody tr').forEach(row => {
        const mat = row.querySelector('.tr-mat').value;
        const qty = parseFloat(row.querySelector('.tr-qty').value) || 0;
        const avg = parseFloat(row.querySelector('.tr-mat').selectedOptions[0]?.dataset.avg || 0);
        if (mat && qty > 0) items.push({ material_code: mat, qty, unit_price: avg });
      });
      if (!items.length) return showToast('이전 품목을 추가하세요.', 'error');

      try {
        const r = await API.post('/transfer-orders', { date, from_warehouse_code, to_warehouse_code, notes, items });
        showToast(`이전 전표 생성: ${r.transfer_no}`, 'success');
        closeModal();
        loadData();
      } catch (e) { showToast(e.message, 'error'); }
    });
  }

  return { render, reset };
})();
window.TransferOrders = TransferOrders;
