/* ─── Price History Module ─── */
const PriceHistory = (() => {
  async function render() {
    const container = document.getElementById('page-container');
    container.innerHTML = `
      <div class="animate-fade">
        <div class="page-header">
          <div>
            <h2 class="page-title">입고 단가 이력</h2>
            <p class="page-subtitle">품목별 시계열 단가 분석 — 거래처별 비교</p>
          </div>
        </div>
        <div class="filter-bar">
          <input type="text" id="ph-mat" placeholder="품목코드 입력" style="width:160px">
          <input type="text" id="ph-ven" placeholder="거래처코드" style="width:140px">
          <input type="date" id="ph-from" value="${currentMonth()}-01" style="width:150px">
          <span style="color:var(--text-muted)">~</span>
          <input type="date" id="ph-to" value="${today()}" style="width:150px">
          <button class="btn btn-primary" id="ph-search">조회</button>
        </div>
        <div class="table-container" id="ph-table-wrap">${loadingHTML()}</div>
      </div>
    `;

    document.getElementById('ph-search').onclick = () => loadData();
    await loadData();
  }

  async function loadData() {
    const wrap = document.getElementById('ph-table-wrap');
    if (!wrap) return;
    wrap.innerHTML = loadingHTML();
    try {
      const params = new URLSearchParams();
      const mat = document.getElementById('ph-mat')?.value;
      const ven = document.getElementById('ph-ven')?.value;
      const from = document.getElementById('ph-from')?.value;
      const to = document.getElementById('ph-to')?.value;
      if (mat) params.set('material_code', mat);
      if (ven) params.set('vendor_code', ven);
      if (from) params.set('from', from);
      if (to) params.set('to', to);

      const data = await API.get('/price-history?' + params.toString());

      if (!data.length) { wrap.innerHTML = emptyHTML('단가 이력이 없습니다', '조회 조건을 변경해보세요'); return; }

      wrap.innerHTML = `<div style="overflow-x:auto"><table>
        <thead><tr>
          <th>입고일</th><th>품목코드</th><th>품목명</th><th>단위</th><th>거래처</th>
          <th>입고수량</th><th>입고단가</th><th>입고금액</th><th>관련전표</th>
        </tr></thead>
        <tbody>${data.map(h => `
          <tr>
            <td>${formatDate(h.date)}</td>
            <td class="mono" style="color:var(--primary-light);font-size:0.8rem">${h.material_code}</td>
            <td style="font-weight:500">${h.material_name||'-'}</td>
            <td>${h.unit||''}</td>
            <td>${h.vendor_name||h.vendor_code||'-'}</td>
            <td class="num">${formatNumber(h.qty,2)}</td>
            <td class="num" style="color:var(--secondary);font-weight:600">${formatCurrency(h.unit_price)}</td>
            <td class="num">${formatCurrency(h.qty*h.unit_price)}</td>
            <td class="mono" style="font-size:0.75rem;color:var(--text-muted)">${h.receipt_id?h.receipt_id.slice(0,8)+'...':'-'}</td>
          </tr>`).join('')}
        </tbody>
      </table></div>`;
    } catch (err) { wrap.innerHTML = `<div class="alert alert-danger">${err.message}</div>`; }
  }

  return { render };
})();
window.PriceHistory = PriceHistory;
