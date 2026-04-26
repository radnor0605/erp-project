/* ─── Movements Module ─── */
const Movements = (() => {
  let _data = [];
  let _filterType = '';

  function reset() {
    _filterType = '';
  }

  async function render() {
    const container = document.getElementById('page-container');
    container.innerHTML = `
      <div class="animate-fade">
        <div class="page-header">
          <div>
            <h2 class="page-title">재고 이동</h2>
            <p class="page-subtitle">이동유형: 101(구매입고) · 201(생산출고) · 311(창고이동) · 501(기타입고) · 701/702(실사조정)</p>
          </div>
          <button class="btn btn-primary" id="mv-add-btn">+ 이동 전표 생성</button>
        </div>
        <div class="filter-bar">
          <select id="mv-type" style="width:160px">
            <option value="">전체 유형</option>
            <option value="101">101 구매 입고</option>
            <option value="201">201 생산 출고</option>
            <option value="311">311 창고간 이동</option>
            <option value="501">501 기타 입고</option>
            <option value="701">701 실사조정(+)</option>
            <option value="702">702 실사조정(-)</option>
          </select>
          <input type="date" id="mv-from" value="${currentMonth()}-01" style="width:150px">
          <span style="color:var(--text-muted)">~</span>
          <input type="date" id="mv-to" value="${today()}" style="width:150px">
          <button class="btn btn-secondary" id="mv-search-btn">조회</button>
        </div>
        <div class="table-container" id="mv-table-wrap">${loadingHTML()}</div>
      </div>
    `;

    document.getElementById('mv-add-btn').onclick = () => openCreateForm();
    document.getElementById('mv-search-btn').onclick = () => loadData();
    await loadData();
  }

  async function loadData() {
    const wrap = document.getElementById('mv-table-wrap');
    if (!wrap) return;
    try {
      const params = new URLSearchParams();
      const type = document.getElementById('mv-type')?.value;
      const from = document.getElementById('mv-from')?.value;
      const to = document.getElementById('mv-to')?.value;
      if (type) params.set('type_code', type);
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      _data = await API.get('/movements?' + params.toString());
      renderTable();
    } catch (err) { wrap.innerHTML = `<div class="alert alert-danger">${err.message}</div>`; }
  }

  function renderTable() {
    const wrap = document.getElementById('mv-table-wrap');
    if (!wrap) return;
    if (!_data.length) { wrap.innerHTML = emptyHTML('이동 전표가 없습니다'); return; }

    const totalAmount = _data.reduce((s, m) => s + (m.amount || 0), 0);

    wrap.innerHTML = `
      <div style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;gap:20px">
        <span style="font-size:0.8rem;color:var(--text-muted)">총 <strong style="color:var(--text-primary)">${_data.length}</strong>건</span>
        <span style="font-size:0.8rem;color:var(--text-muted)">총 금액: <strong style="color:var(--secondary)">${formatCurrency(totalAmount)}</strong></span>
      </div>
      <div style="overflow-x:auto"><table>
        <thead><tr>
          <th>이동번호</th><th>유형</th><th>날짜</th><th>품목</th><th>품목명</th>
          <th>창고(출발)</th><th>창고(도착)</th><th>재고유형</th><th>수량</th><th>단가</th><th>금액</th><th>잠금</th><th></th>
        </tr></thead>
        <tbody>${_data.map(m => `
          <tr>
            <td class="mono" style="font-size:0.77rem;color:var(--primary-light)">${m.movement_no}</td>
            <td>${movementTypeBadge(m.type_code)}</td>
            <td>${formatDate(m.date)}</td>
            <td class="mono" style="font-size:0.8rem">${m.material_code}</td>
            <td style="font-weight:500">${m.material_name||'-'}</td>
            <td style="color:var(--text-muted)">${m.warehouse_name||'-'}</td>
            <td style="color:var(--text-muted)">${m.to_warehouse_name||'-'}</td>
            <td>${stockTypeBadge(m.stock_type)}</td>
            <td class="num">${formatNumber(m.qty,2)} ${m.unit||''}</td>
            <td class="num">${formatCurrency(m.unit_price)}</td>
            <td class="num" style="font-weight:600">${formatCurrency(m.amount)}</td>
            <td>${m.is_locked ? '<span class="lock-badge lock-badge-locked">잠금</span>' : ''}</td>
            <td class="table-actions">
              ${!m.is_locked ? `<button class="btn btn-xs btn-danger" onclick="Movements.cancel('${m.id}','${m.movement_no}')">취소</button>` : ''}
            </td>
          </tr>`).join('')}
        </tbody>
      </table></div>
    `;
  }

  async function openCreateForm() {
    const [materials, warehouses] = await Promise.all([
      API.get('/materials').catch(() => []),
      API.get('/inventory/warehouses').catch(() => []),
    ]);

    const whOpts = warehouses.map(w=>`<option value="${w.code}">${w.name}</option>`).join('');

    const html = `
      <div class="modal-header">
        <div class="modal-title">재고 이동 전표 생성 <small style="font-weight:400;color:var(--text-muted);font-size:0.75rem;margin-left:8px">(전표번호 자동 채번)</small></div>
        <button class="modal-close"><svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg></button>
      </div>
      <div class="modal-body">
        <div class="form-grid">
          <div class="form-group"><label>이동 유형 <span class="required">*</span></label>
            <select id="mvf-type">
              <option value="101">101 — 구매 입고</option>
              <option value="201">201 — 생산 출고</option>
              <option value="311">311 — 창고간 이동</option>
              <option value="501">501 — 기타 입고</option>
              <option value="701">701 — 실사 조정(+)</option>
              <option value="702">702 — 실사 조정(-)</option>
            </select>
          </div>
          <div class="form-group"><label>날짜 <span class="required">*</span></label>
            <input type="date" id="mvf-date" value="${today()}">
          </div>
          <div class="form-group"><label>품목 <span class="required">*</span></label>
            <select id="mvf-mat">
              <option value="">품목 선택</option>
              ${materials.map(m=>`<option value="${m.code}">${m.code} — ${m.name} (가용:${formatNumber(m.available_qty,0)}${m.unit})</option>`).join('')}
            </select>
          </div>
          <div class="form-group"><label>수량 <span class="required">*</span></label>
            <input type="number" id="mvf-qty" value="0" min="0" step="0.01">
          </div>
          <div class="form-group"><label>출발 창고</label>
            <select id="mvf-from-wh">${whOpts}</select>
          </div>
          <div class="form-group" id="mvf-to-wh-grp"><label>도착 창고 (311 이동 시)</label>
            <select id="mvf-to-wh">${whOpts}</select>
          </div>
          <div class="form-group"><label>재고 유형</label>
            <select id="mvf-stock">
              <option value="가용">가용</option>
              <option value="검수">검수</option>
              <option value="보류">보류</option>
            </select>
          </div>
          <div class="form-group"><label>비고</label>
            <input id="mvf-notes" placeholder="비고">
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal()">취소</button>
        <button class="btn btn-primary" id="mvf-save">생성</button>
      </div>
    `;
    openModal(html);

    const typeSelect = document.getElementById('mvf-type');
    const toWhGrp = document.getElementById('mvf-to-wh-grp');
    typeSelect.onchange = () => {
      toWhGrp.style.display = typeSelect.value === '311' ? '' : 'none';
    };
    toWhGrp.style.display = 'none';

    document.getElementById('mvf-save').onclick = async () => {
      try {
        const body = {
          type_code: document.getElementById('mvf-type').value,
          date: document.getElementById('mvf-date').value,
          material_code: document.getElementById('mvf-mat').value,
          qty: parseFloat(document.getElementById('mvf-qty').value)||0,
          warehouse_code: document.getElementById('mvf-from-wh').value,
          to_warehouse_code: document.getElementById('mvf-to-wh').value || null,
          stock_type: document.getElementById('mvf-stock').value,
          notes: document.getElementById('mvf-notes').value,
        };
        const result = await API.post('/movements', body);
        showToast(`이동 전표 ${result.movement_no} 생성 완료`, 'success');
        closeModal();
        await loadData();
      } catch (err) { showToast(err.message, 'error'); }
    };
  }

  async function cancel(id, no) {
    confirmDialog(`<strong>${no}</strong> 이동 전표를 연쇄 취소하시겠습니까?<br>재고가 역산됩니다.`, async () => {
      try { await API.delete(`/movements/${id}`); showToast('취소 처리되었습니다.', 'success'); await loadData(); }
      catch (err) { showToast(err.message, 'error'); }
    });
  }

  return { render, cancel, reset };
})();
window.Movements = Movements;
