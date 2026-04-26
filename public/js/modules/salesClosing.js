/* ─── Sales Closing Module ─── */
const SalesClosing = (() => {
  function reset() {}

  async function render() {
    const [orders, customers] = await Promise.all([
      API.get('/sales-orders?status=출고'),
      API.get('/partners?type=customer'),
    ]);
    const closedOrders = await API.get('/sales-orders?status=마감').catch(()=>[]);

    const html = `
      <div class="page-header">
        <div>
          <h2 class="page-title">매출 마감</h2>
          <p class="page-subtitle">출고 완료된 주문에 대해 거래명세서 발행 및 매출 마감 처리</p>
        </div>
      </div>

      <!-- 마감 대기 -->
      <div class="card" style="margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid var(--border)">
          <div style="font-weight:700">마감 대기 (출고완료)</div>
          <span class="badge badge-warning">${orders.length}건</span>
        </div>
        ${orders.length ? `
        <div style="overflow-x:auto">
          <table class="table hover">
            <thead><tr>
              <th>주문번호</th><th>주문일</th><th>고객사</th>
              <th class="num">주문금액</th><th>명세서</th><th>작업</th>
            </tr></thead>
            <tbody>
              ${orders.map(o => `
                <tr>
                  <td><span class="mono" style="color:var(--primary-light)">${o.so_no}</span></td>
                  <td>${formatDate(o.order_date)}</td>
                  <td class="font-bold">${o.customer_name||o.customer_code}</td>
                  <td class="num font-bold">${formatCurrency(o.total_amount)}</td>
                  <td>
                    ${o.statement_path
                      ? `<a class="btn btn-xs btn-ghost" href="/${o.statement_path}" target="_blank"><svg viewBox="0 0 20 20" fill="currentColor" style="width:10px;height:10px;margin-right:2px"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>PDF</a>`
                      : `<button class="btn btn-xs btn-secondary issue-stmt-btn" data-id="${o.id}" data-cust="${o.customer_name||o.customer_code}">📄 명세서 발행</button>`}
                  </td>
                  <td>
                    <button class="btn btn-xs btn-primary close-btn" data-id="${o.id}" data-no="${o.so_no}" data-cust="${o.customer_name||o.customer_code}" ${!o.statement_path?'title="명세서 발행 후 마감 가능"':''}>
                      마감 처리
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>` : `<div style="padding:40px;text-align:center;color:var(--text-muted)">마감 대기 주문이 없습니다.</div>`}
      </div>

      <!-- 마감 완료 이력 -->
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid var(--border)">
          <div style="font-weight:700">마감 완료 이력</div>
          <span class="badge badge-success">${closedOrders.length}건</span>
        </div>
        ${closedOrders.length ? `
        <div style="overflow-x:auto">
          <table class="table">
            <thead><tr>
              <th>주문번호</th><th>마감일</th><th>고객사</th>
              <th class="num">금액</th><th>명세서</th>
            </tr></thead>
            <tbody>
              ${closedOrders.slice(0,50).map(o => `
                <tr>
                  <td><span class="mono">${o.so_no}</span></td>
                  <td>${formatDate(o.closed_at||o.order_date)}</td>
                  <td>${o.customer_name||o.customer_code}</td>
                  <td class="num">${formatCurrency(o.total_amount)}</td>
                  <td>${o.statement_path?`<a class="btn btn-xs btn-ghost" href="/${o.statement_path}" target="_blank"><svg viewBox="0 0 20 20" fill="currentColor" style="width:10px;height:10px;margin-right:2px"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>PDF</a>`:'-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>` : `<div style="padding:40px;text-align:center;color:var(--text-muted)">마감 이력이 없습니다.</div>`}
      </div>
    `;
    return html;
  }

  function init() {
    // 명세서 발행
    document.querySelectorAll('.issue-stmt-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        btn.disabled = true; btn.textContent = '생성 중...';
        try {
          const r = await API.put(`/sales-orders/${btn.dataset.id}/issue-statement`, {});
          showToast(`명세서 생성: ${r.file_name} (${r.size_kb}KB)`, 'success');
          Router.navigate('sales-closing');
        } catch (err) {
          btn.disabled = false; btn.textContent = '📄 발행';
          showToast(err.message, 'error');
        }
      });
    });

    // 마감 처리
    document.querySelectorAll('.close-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        confirmDialog(
          `<strong>${btn.dataset.cust}</strong> — ${btn.dataset.no} 주문을 마감 처리합니다.<br>` +
          `거래명세서 PDF가 자동 생성되고 매출 전표가 확정됩니다.<br>되돌릴 수 없습니다.`,
          async () => {
            try {
              const r = await API.put(`/sales-orders/${btn.dataset.id}/close`, {
                generate_pdf: true,
              });
              const pdfMsg = r.pdf_path ? ` — PDF: ${r.pdf_name}` : '';
              showToast(`매출 마감 완료${pdfMsg}`, 'success', 5000);
              Router.navigate('sales-closing');
            } catch (err) { showToast(err.message, 'error'); }
          }
        );
      });
    });
  }

  return { render, init, reset };
})();
window.SalesClosing = SalesClosing;
