/* ─── Reports Module ─── */
const Reports = (() => {
  let trendChart = null;
  let topChart = null;
  let turnoverChart = null;

  async function render() {
    const container = document.getElementById('page-container');
    container.innerHTML = loadingHTML();

    container.innerHTML = `
      <div class="animate-fade">
        <div class="page-header">
          <div>
            <h2 class="page-title">
              <svg viewBox="0 0 20 20" fill="currentColor"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zm6-4a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zm6-3a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/></svg>
              보고서 및 분석
            </h2>
            <p class="page-subtitle">통계 분석 및 대시보드 시각화</p>
          </div>
          <div class="page-actions">
            <select id="report-period" class="form-control" style="width:auto;display:inline-block">
              <option value="1m">최근 1개월</option>
              <option value="3m" selected>최근 3개월</option>
              <option value="6m">최근 6개월</option>
              <option value="1y">최근 1년</option>
            </select>
            <button class="btn btn-secondary" onclick="Reports.refresh()">
              <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1z" clip-rule="evenodd"/></svg>
              새로고침
            </button>
          </div>
        </div>

        <!-- Tab Navigation -->
        <div class="report-tabs" style="display:flex;gap:4px;margin-bottom:20px;border-bottom:2px solid var(--border);padding-bottom:0">
          <button class="btn report-tab active" data-tab="trend" onclick="Reports.switchTab('trend')">월별 트렌드</button>
          <button class="btn report-tab" data-tab="top" onclick="Reports.switchTab('top')">자재 순위</button>
          <button class="btn report-tab" data-tab="purchase" onclick="Reports.switchTab('purchase')">구매 분석</button>
          <button class="btn report-tab" data-tab="sales" onclick="Reports.switchTab('sales')">매출 분석</button>
          <button class="btn report-tab" data-tab="turnover" onclick="Reports.switchTab('turnover')">재고 회전율</button>
          <button class="btn report-tab" data-tab="pl" onclick="Reports.switchTab('pl')">손익계산서 (P&amp;L)</button>
        </div>

        <div id="report-content"></div>
      </div>
    `;

    document.getElementById('report-period').addEventListener('change', () => Reports.refresh());
    await loadTab('trend');
  }

  function switchTab(tab) {
    document.querySelectorAll('.report-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.report-tab[data-tab="${tab}"]`).classList.add('active');
    loadTab(tab);
  }

  async function loadTab(tab) {
    const content = document.getElementById('report-content');
    content.innerHTML = loadingHTML();
    const period = document.getElementById('report-period')?.value || '3m';

    try {
      switch (tab) {
        case 'trend': await renderTrend(content, period); break;
        case 'top': await renderTop(content, period); break;
        case 'purchase': await renderPurchase(content, period); break;
        case 'sales': await renderSales(content, period); break;
        case 'turnover': await renderTurnover(content); break;
        case 'pl': await renderPL(content); break;
      }
    } catch (err) {
      content.innerHTML = `<div class="alert alert-danger">데이터 로드 오류: ${err.message}</div>`;
    }
  }

  async function renderTrend(el, period) {
    const data = await API.get(`/reports/monthly-trend?period=${period}`);
    const allMonths = [...new Set([
      ...data.receipts.map(r => r.month),
      ...data.sales.map(s => s.month),
      ...data.movements.map(m => m.month)
    ])].sort();

    el.innerHTML = `
      <div class="dashboard-grid">
        <div class="section-card" style="grid-column:span 2">
          <div class="section-header"><div class="section-title">월별 입고/매출 금액 추이</div></div>
          <div style="height:350px;padding:16px"><canvas id="trendChart"></canvas></div>
        </div>
        <div class="section-card">
          <div class="section-header"><div class="section-title">월별 요약</div></div>
          <div class="table-container"><table class="table">
            <thead><tr><th>월</th><th>입고액</th><th>매출액</th><th>건수</th></tr></thead>
            <tbody>${allMonths.map(m => {
              const r = data.receipts.find(x => x.month === m) || {};
              const s = data.sales.find(x => x.month === m) || {};
              return `<tr>
                <td><strong>${m}</strong></td>
                <td class="num">${formatCurrency(r.amount || 0)}</td>
                <td class="num">${formatCurrency(s.amount || 0)}</td>
                <td class="num">${formatNumber((r.count || 0) + (s.count || 0))}</td>
              </tr>`;
            }).join('')}</tbody>
          </table></div>
        </div>
      </div>
    `;

    const ctx = document.getElementById('trendChart');
    if (!ctx) return;
    if (trendChart) trendChart.destroy();

    const receiptMap = Object.fromEntries(data.receipts.map(r => [r.month, r.amount]));
    const salesMap = Object.fromEntries(data.sales.map(s => [s.month, s.amount]));

    trendChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: allMonths,
        datasets: [
          {
            label: '입고 금액',
            data: allMonths.map(m => receiptMap[m] || 0),
            borderColor: '#3B82F6', backgroundColor: 'rgba(59,130,246,0.1)',
            fill: true, tension: 0.3
          },
          {
            label: '매출 금액',
            data: allMonths.map(m => salesMap[m] || 0),
            borderColor: '#10B981', backgroundColor: 'rgba(16,185,129,0.1)',
            fill: true, tension: 0.3
          }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'top' } },
        scales: {
          y: { ticks: { callback: v => formatNumber(v / 10000) + '만' } }
        }
      }
    });
  }

  async function renderTop(el, period) {
    const data = await API.get(`/reports/top-materials?period=${period}&limit=10`);

    el.innerHTML = `
      <div class="dashboard-grid">
        <div class="section-card">
          <div class="section-header"><div class="section-title">매출 상위 자재 (금액)</div></div>
          <div style="height:300px;padding:16px"><canvas id="topSalesChart"></canvas></div>
        </div>
        <div class="section-card">
          <div class="section-header"><div class="section-title">구매 상위 자재 (금액)</div></div>
          <div style="height:300px;padding:16px"><canvas id="topPurchaseChart"></canvas></div>
        </div>
        <div class="section-card" style="grid-column:span 2">
          <div class="section-header"><div class="section-title">자재별 상세</div></div>
          <div class="table-container"><table class="table">
            <thead><tr><th>구분</th><th>품목코드</th><th>품목명</th><th>카테고리</th><th>수량</th><th>금액</th></tr></thead>
            <tbody>
              ${data.topSales.map(s => `<tr>
                <td><span class="badge badge-success">매출</span></td>
                <td class="mono">${s.code}</td><td>${s.name}</td><td>${s.category}</td>
                <td class="num">${formatNumber(s.total_qty)}</td><td class="num">${formatCurrency(s.total_amount)}</td>
              </tr>`).join('')}
              ${data.topPurchases.map(p => `<tr>
                <td><span class="badge badge-info">구매</span></td>
                <td class="mono">${p.code}</td><td>${p.name}</td><td>${p.category}</td>
                <td class="num">${formatNumber(p.total_qty)}</td><td class="num">${formatCurrency(p.total_amount)}</td>
              </tr>`).join('')}
            </tbody>
          </table></div>
        </div>
      </div>
    `;

    createHorizontalBar('topSalesChart', data.topSales, '#6C63FF');
    createHorizontalBar('topPurchaseChart', data.topPurchases, '#3B82F6');
  }

  function createHorizontalBar(canvasId, items, color) {
    const ctx = document.getElementById(canvasId);
    if (!ctx || items.length === 0) return;
    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: items.map(i => i.name.length > 10 ? i.name.slice(0, 10) + '…' : i.name),
        datasets: [{ data: items.map(i => i.total_amount), backgroundColor: color, borderRadius: 6 }]
      },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { ticks: { callback: v => formatNumber(v / 10000) + '만' } } }
      }
    });
  }

  async function renderPurchase(el, period) {
    const data = await API.get(`/reports/purchase-summary?period=${period}`);

    el.innerHTML = `
      <div class="dashboard-grid">
        <div class="section-card">
          <div class="section-header"><div class="section-title">월별 구매 금액 추이</div></div>
          <div style="height:300px;padding:16px"><canvas id="purchaseMonthlyChart"></canvas></div>
        </div>
        <div class="section-card">
          <div class="section-header"><div class="section-title">협력업체별 구매 비중</div></div>
          <div style="height:300px;padding:16px"><canvas id="vendorPieChart"></canvas></div>
        </div>
        <div class="section-card" style="grid-column:span 2">
          <div class="section-header"><div class="section-title">협력업체별 구매 상세</div></div>
          <div class="table-container"><table class="table">
            <thead><tr><th>업체코드</th><th>업체명</th><th>입고건수</th><th>구매총액</th><th>비중</th></tr></thead>
            <tbody>${(() => {
              const total = data.byVendor.reduce((s, v) => s + v.total_amount, 0);
              return data.byVendor.map(v => `<tr>
                <td class="mono">${v.code}</td><td>${v.name}</td>
                <td class="num">${v.receipt_count}</td>
                <td class="num">${formatCurrency(v.total_amount)}</td>
                <td class="num">${total > 0 ? ((v.total_amount / total) * 100).toFixed(1) : 0}%</td>
              </tr>`).join('');
            })()}</tbody>
          </table></div>
        </div>
      </div>
    `;

    // Monthly bar chart
    const mCtx = document.getElementById('purchaseMonthlyChart');
    if (mCtx && data.monthly.length > 0) {
      new Chart(mCtx, {
        type: 'bar',
        data: {
          labels: data.monthly.map(m => m.month),
          datasets: [{ label: '구매 금액', data: data.monthly.map(m => m.amount), backgroundColor: '#3B82F6', borderRadius: 6 }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { y: { ticks: { callback: v => formatNumber(v / 10000) + '만' } } }
        }
      });
    }

    // Vendor pie
    const pCtx = document.getElementById('vendorPieChart');
    if (pCtx && data.byVendor.length > 0) {
      const colors = ['#6C63FF', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6B7280'];
      new Chart(pCtx, {
        type: 'doughnut',
        data: {
          labels: data.byVendor.map(v => v.name),
          datasets: [{ data: data.byVendor.map(v => v.total_amount), backgroundColor: colors, borderWidth: 0 }]
        },
        options: {
          responsive: true, maintainAspectRatio: false, cutout: '60%',
          plugins: {
            legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11 } } },
            tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${formatCurrency(ctx.raw)}` } }
          }
        }
      });
    }
  }

  async function renderSales(el, period) {
    const data = await API.get(`/reports/sales-summary?period=${period}`);

    el.innerHTML = `
      <div class="dashboard-grid">
        <div class="section-card">
          <div class="section-header"><div class="section-title">월별 매출 추이</div></div>
          <div style="height:300px;padding:16px"><canvas id="salesMonthlyChart"></canvas></div>
        </div>
        <div class="section-card">
          <div class="section-header"><div class="section-title">고객별 매출 비중</div></div>
          <div style="height:300px;padding:16px"><canvas id="customerPieChart"></canvas></div>
        </div>
        <div class="section-card" style="grid-column:span 2">
          <div class="section-header"><div class="section-title">품목별 마진 분석</div></div>
          <div class="table-container"><table class="table">
            <thead><tr><th>품목코드</th><th>품목명</th><th>카테고리</th><th>매출액</th><th>원가</th><th>마진</th><th>마진율</th></tr></thead>
            <tbody>${data.marginAnalysis.map(m => `<tr>
              <td class="mono">${m.code}</td><td>${m.name}</td><td>${m.category}</td>
              <td class="num">${formatCurrency(m.sales_amount)}</td>
              <td class="num">${formatCurrency(m.cost_amount)}</td>
              <td class="num ${m.margin >= 0 ? '' : 'num-negative'}">${formatCurrency(m.margin)}</td>
              <td class="num"><span class="badge ${m.margin_rate >= 20 ? 'badge-success' : m.margin_rate >= 0 ? 'badge-warning' : 'badge-danger'}">${m.margin_rate}%</span></td>
            </tr>`).join('')}</tbody>
          </table></div>
        </div>
        <div class="section-card" style="grid-column:span 2">
          <div class="section-header"><div class="section-title">고객별 매출 상세</div></div>
          <div class="table-container"><table class="table">
            <thead><tr><th>고객코드</th><th>고객명</th><th>주문건수</th><th>총매출</th></tr></thead>
            <tbody>${data.byCustomer.map(c => `<tr>
              <td class="mono">${c.code}</td><td>${c.name}</td>
              <td class="num">${c.order_count}</td><td class="num">${formatCurrency(c.total_amount)}</td>
            </tr>`).join('')}</tbody>
          </table></div>
        </div>
      </div>
    `;

    const sCtx = document.getElementById('salesMonthlyChart');
    if (sCtx && data.monthly.length > 0) {
      new Chart(sCtx, {
        type: 'bar',
        data: {
          labels: data.monthly.map(m => m.month),
          datasets: [{ label: '매출 금액', data: data.monthly.map(m => m.amount), backgroundColor: '#10B981', borderRadius: 6 }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { y: { ticks: { callback: v => formatNumber(v / 10000) + '만' } } }
        }
      });
    }

    const cCtx = document.getElementById('customerPieChart');
    if (cCtx && data.byCustomer.length > 0) {
      const colors = ['#6C63FF', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6B7280'];
      new Chart(cCtx, {
        type: 'doughnut',
        data: {
          labels: data.byCustomer.map(c => c.name),
          datasets: [{ data: data.byCustomer.map(c => c.total_amount), backgroundColor: colors, borderWidth: 0 }]
        },
        options: {
          responsive: true, maintainAspectRatio: false, cutout: '60%',
          plugins: {
            legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11 } } },
            tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${formatCurrency(ctx.raw)}` } }
          }
        }
      });
    }
  }

  async function renderTurnover(el) {
    const data = await API.get('/reports/inventory-turnover');

    const gradeCount = { A: 0, B: 0, C: 0, D: 0 };
    data.forEach(r => gradeCount[r.grade]++);

    el.innerHTML = `
      <div class="dashboard-grid">
        <div class="kpi-grid" style="grid-column:span 3">
          <div class="kpi-card" style="--kpi-color:var(--success)">
            <div class="kpi-label">A등급 (회전율 6+)</div><div class="kpi-value">${gradeCount.A}</div>
          </div>
          <div class="kpi-card" style="--kpi-color:var(--info)">
            <div class="kpi-label">B등급 (3~6)</div><div class="kpi-value">${gradeCount.B}</div>
          </div>
          <div class="kpi-card" style="--kpi-color:var(--warning)">
            <div class="kpi-label">C등급 (1~3)</div><div class="kpi-value">${gradeCount.C}</div>
          </div>
          <div class="kpi-card" style="--kpi-color:var(--danger)">
            <div class="kpi-label">D등급 (1 미만)</div><div class="kpi-value">${gradeCount.D}</div>
          </div>
        </div>
        <div class="section-card" style="grid-column:span 3">
          <div class="section-header"><div class="section-title">재고 회전율 분석</div></div>
          <div class="table-container"><table class="table">
            <thead><tr><th>품목코드</th><th>품목명</th><th>카테고리</th><th>현재고</th><th>재고가치</th><th>6개월출고</th><th>회전율</th><th>재고일수</th><th>등급</th></tr></thead>
            <tbody>${data.map(r => `<tr>
              <td class="mono">${r.code}</td><td>${r.name}</td><td>${r.category}</td>
              <td class="num">${formatNumber(r.current_qty)} ${r.unit}</td>
              <td class="num">${formatCurrency(r.current_value)}</td>
              <td class="num">${formatNumber(r.outbound_6m)}</td>
              <td class="num"><strong>${r.turnover}</strong></td>
              <td class="num">${r.days_of_supply === 999 ? '∞' : r.days_of_supply + '일'}</td>
              <td><span class="badge ${r.grade === 'A' ? 'badge-success' : r.grade === 'B' ? 'badge-info' : r.grade === 'C' ? 'badge-warning' : 'badge-danger'}">${r.grade}</span></td>
            </tr>`).join('')}</tbody>
          </table></div>
        </div>
      </div>
    `;
  }

  async function renderPL(el) {
    const year = new Date().getFullYear();
    const [cur, prev] = await Promise.all([
      API.get(`/reports/pl?year=${year}`),
      API.get(`/reports/pl?year=${year - 1}`),
    ]);

    const a = cur.annual;
    const yoyRev  = a.yoy_revenue_pct !== null ? `${a.yoy_revenue_pct >= 0 ? '+' : ''}${a.yoy_revenue_pct}%` : '-';
    const yoyGP   = a.prev_gross_profit > 0 ? `${(((a.gross_profit - a.prev_gross_profit) / a.prev_gross_profit) * 100).toFixed(1)}%` : '-';
    const gmColor = a.gross_margin_rate >= 30 ? 'var(--success)' : a.gross_margin_rate >= 10 ? 'var(--warning)' : 'var(--danger)';

    el.innerHTML = `
      <div style="display:flex;gap:12px;align-items:center;margin-bottom:16px">
        <h3 style="font-size:1rem;font-weight:700;margin:0">${year}년 손익계산서</h3>
        <span style="font-size:0.78rem;color:var(--text-muted)">(출고·마감 주문 기준 / COGS: 이동평균법)</span>
      </div>

      <!-- 연간 KPI -->
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px">
        ${[
          { label: '매출액', val: a.revenue, sub: `전년 ${formatCurrency(a.prev_revenue)} | YoY ${yoyRev}`, color: '' },
          { label: '매출원가 (COGS)', val: a.cogs, sub: `전년 ${formatCurrency(a.prev_cogs)}`, color: 'color:var(--danger)' },
          { label: '매출총이익', val: a.gross_profit, sub: `전년 ${formatCurrency(a.prev_gross_profit)} | YoY ${yoyGP}`, color: `color:${a.gross_profit >= 0 ? 'var(--success)' : 'var(--danger)'}` },
          { label: '매출총이익률', val: `${a.gross_margin_rate}%`, sub: '= 총이익 / 매출액', color: `color:${gmColor}`, isCurrency: false },
        ].map(k => `
          <div class="card" style="padding:16px">
            <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:4px">${k.label}</div>
            <div style="font-size:1.3rem;font-weight:700;${k.color}">${k.isCurrency === false ? k.val : formatCurrency(k.val)}</div>
            <div style="font-size:0.72rem;color:var(--text-muted);margin-top:4px">${k.sub}</div>
          </div>
        `).join('')}
      </div>

      <!-- 월별 테이블 -->
      <div class="card" style="margin-bottom:16px">
        <div style="padding:12px 16px;border-bottom:1px solid var(--border);font-weight:700">월별 손익 현황</div>
        <div style="overflow-x:auto">
          <table class="table">
            <thead><tr>
              <th>월</th><th class="num">매출액</th><th class="num">매출원가</th>
              <th class="num">매출총이익</th><th class="num">이익률</th><th class="num">구매액</th>
            </tr></thead>
            <tbody>
              ${cur.monthly.map(m => {
                const gpColor = m.gross_profit >= 0 ? 'var(--success)' : 'var(--danger)';
                const mrColor = m.margin_rate >= 30 ? 'var(--success)' : m.margin_rate >= 10 ? 'var(--warning)' : 'var(--danger)';
                return `<tr>
                  <td class="font-bold">${m.month}</td>
                  <td class="num">${formatCurrency(m.revenue)}</td>
                  <td class="num" style="color:var(--danger)">${formatCurrency(m.cogs)}</td>
                  <td class="num font-bold" style="color:${gpColor}">${formatCurrency(m.gross_profit)}</td>
                  <td class="num" style="color:${mrColor}">${m.margin_rate}%</td>
                  <td class="num" style="color:var(--text-muted)">${formatCurrency(m.purchases)}</td>
                </tr>`;
              }).join('') || '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:24px">데이터 없음</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>

      <!-- 카테고리별 총이익 -->
      <div class="card">
        <div style="padding:12px 16px;border-bottom:1px solid var(--border);font-weight:700">카테고리별 매출총이익</div>
        <div style="overflow-x:auto">
          <table class="table">
            <thead><tr>
              <th>카테고리</th><th class="num">매출액</th><th class="num">매출원가</th>
              <th class="num">총이익</th><th class="num">이익률</th>
            </tr></thead>
            <tbody>
              ${cur.by_category.map(c => {
                const gpColor = c.gross_profit >= 0 ? 'var(--success)' : 'var(--danger)';
                const mrColor = c.margin_rate >= 30 ? 'var(--success)' : c.margin_rate >= 10 ? 'var(--warning)' : 'var(--danger)';
                return `<tr>
                  <td class="font-bold">${c.category}</td>
                  <td class="num">${formatCurrency(c.revenue)}</td>
                  <td class="num" style="color:var(--danger)">${formatCurrency(c.cogs)}</td>
                  <td class="num font-bold" style="color:${gpColor}">${formatCurrency(c.gross_profit)}</td>
                  <td class="num" style="color:${mrColor}">${c.margin_rate}%</td>
                </tr>`;
              }).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:24px">데이터 없음</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  async function refresh() {
    const activeTab = document.querySelector('.report-tab.active')?.dataset.tab || 'trend';
    await loadTab(activeTab);
  }

  return { render, refresh, switchTab };
})();
window.Reports = Reports;
