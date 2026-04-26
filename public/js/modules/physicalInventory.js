/* ─── Physical Inventory Module ─── */
const PhysicalInventory = (() => {
  let _data = [];

  async function render() {
    const container = document.getElementById('page-container');
    container.innerHTML = `
      <div class="animate-fade">
        <div class="page-header">
          <div>
            <h2 class="page-title">재고 실사</h2>
            <p class="page-subtitle">실사 수량 입력 → 확정 시 701/702 조정 전표 자동 생성</p>
          </div>
          <button class="btn btn-primary" id="pi-add-btn">+ 새 실사 생성</button>
        </div>
        <div class="table-container" id="pi-table-wrap">${loadingHTML()}</div>
      </div>
    `;
    document.getElementById('pi-add-btn').onclick = () => openCreateForm();
    await loadData();
  }

  async function loadData() {
    const wrap = document.getElementById('pi-table-wrap');
    if (!wrap) return;
    try {
      _data = await API.get('/physical-inventory');
      renderTable();
    } catch (err) { wrap.innerHTML = `<div class="alert alert-danger">${err.message}</div>`; }
  }

  function renderTable() {
    const wrap = document.getElementById('pi-table-wrap');
    if (!wrap) return;
    if (!_data.length) { wrap.innerHTML = emptyHTML('재고 실사 내역이 없습니다'); return; }

    const statusMap = { draft:'badge-ghost', counting:'badge-warning', confirmed:'badge-success', cancelled:'badge-danger' };
    const statusLabel = { draft:'초안', counting:'실사중', confirmed:'확정', cancelled:'취소' };

    wrap.innerHTML = `<div style="overflow-x:auto"><table>
      <thead><tr>
        <th>실사번호</th><th>실사일</th><th>창고</th><th>상태</th><th>품목수</th><th>생성일시</th><th></th>
      </tr></thead>
      <tbody>${_data.map(p => `
        <tr>
          <td class="mono" style="color:var(--primary-light)">${p.inv_no}</td>
          <td>${formatDate(p.date)}</td>
          <td>${p.warehouse_name||'-'}</td>
          <td><span class="badge ${statusMap[p.status]||'badge-ghost'}">${statusLabel[p.status]||p.status}</span></td>
          <td class="num">${p.item_count}개</td>
          <td style="color:var(--text-muted);font-size:0.8rem">${formatDateTime(p.created_at)}</td>
          <td class="table-actions">
            <button class="btn btn-xs btn-secondary" onclick="PhysicalInventory.viewDetail('${p.id}')">상세/입력</button>
            ${p.status === 'counting' ? `<button class="btn btn-xs btn-success" onclick="PhysicalInventory.confirm('${p.id}')">확정</button>` : ''}
          </td>
        </tr>`).join('')}
      </tbody>
    </table></div>`;
  }

  async function openCreateForm() {
    const warehouses = await API.get('/inventory/warehouses').catch(() => []);
    const html = `
      <div class="modal-header">
        <div class="modal-title">새 재고 실사 생성 <small style="font-weight:400;color:var(--text-muted);font-size:0.75rem;margin-left:8px">(실사번호 자동 채번)</small></div>
        <button class="modal-close"><svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg></button>
      </div>
      <div class="modal-body">
        <div class="alert alert-info">
          <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/></svg>
          선택한 창고의 현재 가용재고를 기준으로 실사 목록이 자동 생성됩니다.
        </div>
        <div class="form-grid">
          <div class="form-group"><label>실사일 <span class="required">*</span></label>
            <input type="date" id="pif-date" value="${today()}">
          </div>
          <div class="form-group"><label>대상 창고</label>
            <select id="pif-wh">
              ${warehouses.map(w=>`<option value="${w.code}">${w.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group" style="grid-column:1/-1"><label>비고</label>
            <input id="pif-notes" placeholder="실사 목적 또는 메모">
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal()">취소</button>
        <button class="btn btn-primary" id="pif-save">실사 생성</button>
      </div>
    `;
    openModal(html);

    document.getElementById('pif-save').onclick = async () => {
      try {
        const result = await API.post('/physical-inventory', {
          date: document.getElementById('pif-date').value,
          warehouse_code: document.getElementById('pif-wh').value,
          notes: document.getElementById('pif-notes').value,
        });
        showToast(`실사 ${result.inv_no} 생성 완료 (${result.item_count}개 품목)`, 'success');
        closeModal();
        await loadData();
      } catch (err) { showToast(err.message, 'error'); }
    };
  }

  async function viewDetail(id) {
    try {
      const inv = await API.get(`/physical-inventory/${id}`);
      const isEditable = inv.status === 'counting';

      const html = `
        <div class="modal-header">
          <div class="modal-title">실사 상세 — ${inv.inv_no}</div>
          <button class="modal-close"><svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg></button>
        </div>
        <div class="modal-body">
          <div class="form-grid" style="margin-bottom:16px">
            <div><div class="kpi-label">실사일</div><div style="font-weight:500">${formatDate(inv.date)}</div></div>
            <div><div class="kpi-label">창고</div><div style="font-weight:500">${inv.warehouse_name||'-'}</div></div>
            <div><div class="kpi-label">상태</div><div style="font-weight:500">${inv.status}</div></div>
          </div>
          <div class="table-container">
            <table>
              <thead><tr>
                <th>품목코드</th><th>품목명</th><th>단위</th><th>시스템수량</th><th>실사수량</th><th>차이</th><th>단가</th><th>차이금액</th>
              </tr></thead>
              <tbody>${inv.items.map((item, idx) => `
                <tr>
                  <td class="mono" style="color:var(--primary-light)">${item.material_code}</td>
                  <td>${item.material_name||'-'}</td>
                  <td>${item.unit||''}</td>
                  <td class="num">${formatNumber(item.system_qty,2)}</td>
                  <td>
                    ${isEditable
                      ? `<input type="number" class="pi-counted" data-id="${item.id}" value="${item.counted_qty}" min="0" step="0.01" style="width:90px;padding:5px 8px;font-size:0.83rem">`
                      : `<span class="num">${formatNumber(item.counted_qty,2)}</span>`}
                  </td>
                  <td class="num ${item.diff_qty>0?'num-positive':item.diff_qty<0?'num-negative':''}">${item.diff_qty>=0?'+':''}${formatNumber(item.diff_qty,2)}</td>
                  <td class="num">${formatCurrency(item.unit_price)}</td>
                  <td class="num ${item.diff_amount>0?'num-positive':item.diff_amount<0?'num-negative':''}">${item.diff_amount>=0?'+':''}${formatCurrency(item.diff_amount)}</td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal()">닫기</button>
          ${isEditable ? `
            <button class="btn btn-secondary" id="pi-save-qty-btn">수량 저장</button>
            <button class="btn btn-success" onclick="PhysicalInventory.confirm('${id}')">실사 확정</button>
          ` : ''}
        </div>
      `;
      openModal(html, 'modal-xl');

      if (isEditable) {
        document.getElementById('pi-save-qty-btn').onclick = async () => {
          const inputs = document.querySelectorAll('.pi-counted');
          const items = Array.from(inputs).map(input => ({
            id: input.dataset.id,
            counted_qty: parseFloat(input.value) || 0,
          }));
          try {
            await API.put(`/physical-inventory/${id}/items`, { items });
            showToast('수량이 저장되었습니다.', 'success');
          } catch (err) { showToast(err.message, 'error'); }
        };
      }
    } catch (err) { showToast(err.message, 'error'); }
  }

  async function confirm(id) {
    confirmDialog('실사를 확정하시겠습니까?<br>차이 수량에 대해 <strong>701/702 조정 전표</strong>가 자동 생성됩니다.', async () => {
      try {
        await API.put(`/physical-inventory/${id}/confirm`);
        showToast('재고 실사가 확정되었습니다.', 'success');
        closeModal();
        await loadData();
      } catch (err) { showToast(err.message, 'error'); }
    }, false);
  }

  return { render, viewDetail, confirm };
})();
window.PhysicalInventory = PhysicalInventory;
