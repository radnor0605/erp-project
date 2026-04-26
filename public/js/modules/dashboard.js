/* ─── Dashboard Module (v26) ─── */
const Dashboard = (() => {
  let chart = null;
  let _forecastPeriod = 'week';

  async function render() {
    const container = document.getElementById('page-container');
    container.innerHTML = loadingHTML();

    try {
      const [summary, reorders, recentReceipts, aging, draftPartners, draftReceipts, turnover, forecast] = await Promise.all([
        API.get('/dashboard/summary/dashboard').catch(() => ({})),
        API.get('/dashboard/scm/recommendations').catch(() => []),
        API.get('/receipts?status=confirmed').catch(() => []),
        API.get('/dashboard/scm/aging').catch(() => []),
        API.get('/partners?needs_review=1').catch(() => []),
        API.get('/receipts?needs_review=1').catch(() => []),
        API.get('/materials/analytics/turnover?days=90').catch(() => ({ items: [], slow_moving_count: 0 })),
        API.get(`/dashboard/summary/forecast?period=${_forecastPeriod}`).catch(() => ({})),
      ]);

      container.innerHTML = `
        <div class="animate-fade">
          <div class="page-header">
            <div>
              <h2 class="page-title">
                <svg viewBox="0 0 20 20" fill="currentColor"><path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z"/><path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z"/></svg>
                대시보드
              </h2>
              <p class="page-subtitle">${new Date().toLocaleDateString('ko-KR', {year:'numeric',month:'long',day:'numeric',weekday:'long'})}</p>
            </div>
            <div class="page-actions">
              <button class="btn btn-accent" onclick="Dashboard.runAIAnalysis()" id="dashboard-ai-btn">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v8l6 3m-6-3l-6 3m6-3v8"/><circle cx="12" cy="12" r="10"/></svg>
                AI 지능형 재고 분석
              </button>
              <button class="btn btn-secondary" onclick="Dashboard.refresh()">
                <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"/></svg>
                새로고침
              </button>
            </div>
          </div>

          <!-- KPI Cards -->
          <div class="kpi-grid">
            <div class="kpi-card kpi-card-clickable" style="--kpi-color:var(--success)" onclick="Router.navigate('inventory', { sort: 'value_desc' })">
              <div class="kpi-icon"><svg viewBox="0 0 20 20" fill="currentColor"><path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z"/><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clip-rule="evenodd"/></svg></div>
              <div class="kpi-label">총 재고 금액</div>
              <div class="kpi-value" style="font-size:1.4rem">${formatCurrency(summary.total_stock_value)}</div>
              <div class="kpi-sub">가용 재고 기준</div>
            </div>
            <div class="kpi-card kpi-card-clickable" style="--kpi-color:${summary.below_safety_count > 0 ? 'var(--danger)' : 'var(--success)'}" onclick="Router.navigate('inventory', { filter: 'below_safety' })">
              <div class="kpi-icon"><svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg></div>
              <div class="kpi-label">안전재고 부족</div>
              <div class="kpi-value">${formatNumber(summary.below_safety_count)}</div>
              <div class="kpi-sub">즉시 보충 필요</div>
            </div>
            <div class="kpi-card kpi-card-clickable" style="--kpi-color:var(--warning)" onclick="Router.navigate('inventory', { filter: 'aging_red' })">
              <div class="kpi-icon"><svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clip-rule="evenodd"/></svg></div>
              <div class="kpi-label">미회전 재고 가치</div>
              <div class="kpi-value" style="font-size:1.4rem">${formatCurrency(summary.total_aging_value)}</div>
              <div class="kpi-sub">30일 이상 미출고 품목</div>
            </div>
            <div class="kpi-card kpi-card-clickable" style="--kpi-color:var(--info)" onclick="Router.navigate('purchasing', { status: 'ordered' })">
              <div class="kpi-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg></div>
              <div class="kpi-label">미입고 발주 (Open PO)</div>
              <div class="kpi-value">${formatNumber(summary.open_po_count)}</div>
              <div class="kpi-sub">총 발주 잔량 건수</div>
            </div>
            <div class="kpi-card kpi-card-clickable" style="--kpi-color:var(--primary)" onclick="Router.navigate('sales-orders', { status: '출고' })">
              <div class="kpi-icon"><svg viewBox="0 0 20 20" fill="currentColor"><path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z"/><path fill-rule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clip-rule="evenodd"/></svg></div>
              <div class="kpi-label">미수금(AR) 총액</div>
              <div class="kpi-value" style="font-size:1.4rem">${formatCurrency(summary.total_ar_value)}</div>
              <div class="kpi-sub">출고 완료 건 기준</div>
            </div>
            <div class="kpi-card kpi-card-clickable" style="--kpi-color:${summary.renewal_alerts_count > 0 ? 'var(--danger)' : 'var(--success)'}" onclick="Router.navigate('assets', { expiry_within_30: 1 })">
              <div class="kpi-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21 8-9-5-9 5v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8z"/><path d="M12 22V8"/><path d="m12 8 9 5"/><path d="m12 8-9 5"/></svg></div>
              <div class="kpi-label">SW 갱신 알림</div>
              <div class="kpi-value">${formatNumber(summary.renewal_alerts_count)}</div>
              <div class="kpi-sub">만료 30일 이내</div>
            </div>
          </div>

          <!-- 안전재고 부족 경고 배너 (v20) -->
          ${(summary.below_safety_count > 0) ? `
          <div class="safety-alert-banner" onclick="Router.navigate('inventory', { filter: 'below_safety' })" style="cursor:pointer">
            <svg viewBox="0 0 20 20" fill="currentColor" style="width:20px;height:20px;flex-shrink:0"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>
            <strong>안전재고 부족 경고</strong>
            <span>${summary.below_safety_count}개 품목이 안전재고 이하입니다. 즉시 발주가 필요합니다.</span>
            <span style="margin-left:auto;font-size:0.78rem;opacity:0.8">재고 현황 보기 →</span>
          </div>` : ''}

          <!-- 재고 회전율 분석 (v20) -->
          ${(turnover.slow_moving_count > 0) ? `
          <div class="safety-alert-banner" style="background:linear-gradient(135deg,rgba(245,158,11,0.15),rgba(245,158,11,0.05));border-color:var(--warning);color:var(--warning);cursor:pointer" onclick="Router.navigate('inventory')">
            <svg viewBox="0 0 20 20" fill="currentColor" style="width:20px;height:20px;flex-shrink:0"><path d="M10 2a8 8 0 100 16 8 8 0 000-16zm1 11H9V7h2v6z"/></svg>
            <strong>장기 미회전 재고</strong>
            <span>${turnover.slow_moving_count}개 품목이 90일간 출고 이력 없음 (Slow-moving)</span>
            <span style="margin-left:auto;font-size:0.78rem;opacity:0.8">재고 분석 보기 →</span>
          </div>` : ''}

          <div class="dashboard-grid">
            <!-- Asset Chart Card -->
            <div class="section-card">
              <div class="section-header">
                <div class="section-title">
                  <svg viewBox="0 0 20 20" fill="currentColor"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zm6-4a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zm6-3a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/></svg>
                  금주 매출 가액 (카테고리별)
                </div>
              </div>
              <div style="height:300px; padding:16px;">
                <canvas id="salesChart"></canvas>
              </div>
            </div>

            <!-- Reorder Recommendations -->
            <div class="section-card" style="grid-column: span 1;">
              <div class="section-header">
                <div class="section-title">
                  <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92z" clip-rule="evenodd"/></svg>
                  발주 권고 목록
                </div>
                <span class="badge badge-danger">${(reorders||[]).length}건</span>
              </div>
              ${(reorders||[]).length === 0
                ? `<div style="padding:32px;text-align:center;color:var(--text-muted)">
                    <svg viewBox="0 0 20 20" fill="currentColor" style="width:36px;height:36px;color:var(--success);margin:0 auto 8px;display:block;opacity:0.6"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
                    모든 품목의 재고가 안전재고 이상입니다
                  </div>`
                : `<div style="overflow-x:auto"><table>
                    <thead><tr>
                      <th>품목코드</th><th>D-Day</th><th>부족수량</th><th>예상금액</th>
                    </tr></thead>
                    <tbody>${(reorders||[]).slice(0, 8).map(r => `
                      <tr>
                        <td><span class="mono" style="color:var(--primary-light)">${r.code}</span></td>
                        <td>
                          ${r.d_day <= 3 ? `<span class="badge badge-danger">D${r.d_day >= 0 ? '-' : '+'}${Math.abs(r.d_day)}</span>` : 
                            r.d_day <= 7 ? `<span class="badge badge-warning">D-${r.d_day}</span>` : 
                            `<span class="badge badge-ghost">D-${r.d_day}</span>`}
                        </td>
                        <td class="num num-negative">-${formatNumber(r.safety_stock - r.available_qty)}</td>
                        <td class="num" style="font-size:0.8rem">${formatNumber(r.estimated_amount)}원</td>
                      </tr>`).join('')}
                    </tbody>
                  </table></div>`
              }
            </div>

            <!-- Recent Receipts -->
            <div class="section-card">
              <div class="section-header">
                <div class="section-title">
                  <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm1 8a1 1 0 000 2h.01a1 1 0 000-2H7zm3 0a1 1 0 000 2h3a1 1 0 000-2h-3zm-3 4a1 1 0 000 2h.01a1 1 0 000-2H7zm3 0a1 1 0 000 2h3a1 1 0 000-2h-3z" clip-rule="evenodd"/></svg>
                  최근 입고 현황
                </div>
                <a href="#receipts" class="btn btn-xs btn-secondary">전체보기</a>
              </div>
              <div>
                ${(recentReceipts||[]).slice(0, 5).map(r => `
                  <div style="padding:10px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:8px">
                    <div style="flex:1;min-width:0">
                      <div style="font-size:0.82rem;font-weight:500;color:var(--text-primary)">${r.receipt_no}</div>
                      <div style="font-size:0.74rem;color:var(--text-muted)">${r.vendor_name||'-'} · ${formatDate(r.date)}</div>
                    </div>
                    <div style="text-align:right">
                      ${receiptStatusBadge(r.status)}
                      <div style="font-size:0.72rem;color:var(--text-muted);margin-top:2px">${r.item_count}개 품목</div>
                    </div>
                  </div>`).join('') || `<div style="padding:32px;text-align:center;color:var(--text-muted)">입고 내역이 없습니다</div>`}
              </div>
            </div>

            <!-- Inventory Aging Report -->
            <div class="section-card" style="grid-column: span 3">
              <div class="section-header">
                <div class="section-title">
                  <svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 2a8 8 0 100 16 8 8 0 000-16zm1 11H9V7h2v6z"/></svg>
                  장기 미회전 재고 (Aging Report)
                </div>
                <span class="badge ${(aging||[]).length > 0 ? 'badge-warning' : 'badge-success'}">${(aging||[]).length}건</span>
              </div>
              <div class="table-container">
                <table class="table">
                  <thead>
                    <tr>
                      <th>품목</th><th>최종 출고일</th><th>미회전 일수</th><th>현재고</th><th>자산 가치</th><th>위험도</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${(aging||[]).map(a => {
                      let color = 'var(--text-muted)';
                      let badge = 'badge-secondary';
                      let clickable = false;
                      if (a.days_stagnant >= 180) { color = 'var(--danger)'; badge = 'badge-danger'; clickable = true; }
                      else if (a.days_stagnant >= 90) { color = 'var(--warning)'; badge = 'badge-warning'; }
                      else if (a.days_stagnant >= 30) { color = '#F59E0B'; badge = 'badge-info'; }
                      
                      return `
                        <tr ${clickable ? 'class="row-clickable" onclick="Router.navigate(\'inventory\', { filter: \'aging_red\' })"' : ''}>
                          <td><strong>${a.name}</strong> <small class="mono">${a.code}</small></td>
                          <td>${a.last_out_date || '입고 후 무변동'}</td>
                          <td style="color:${color}; font-weight:bold">${a.days_stagnant}일</td>
                          <td>${formatNumber(a.total_qty)} ${a.unit}</td>
                          <td>${formatCurrency(a.stock_value)}</td>
                          <td><span class="badge ${badge}">${a.days_stagnant >= 180 ? '치명' : a.days_stagnant >= 90 ? '주의' : '관심'}</span></td>
                        </tr>
                      `;
                    }).join('') || '<tr><td colspan="6" style="text-align:center">30일 이상 미회전된 품목이 없습니다.</td></tr>'}
                  </tbody>
                </table>
              </div>
            </div>
          <!-- ⚠️ 수동 확인 필요 섹션 -->
          ${((draftPartners||[]).length + (draftReceipts||[]).length) > 0 ? `
          <div class="section-card" style="margin-top:16px;border:1.5px solid var(--warning)">
            <div class="section-header">
              <div class="section-title" style="color:var(--warning)">
                <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>
                ⚠️ 수동 확인 필요 (OCR 판독 불완전)
              </div>
              <span class="badge badge-warning">${(draftPartners||[]).length + (draftReceipts||[]).length}건</span>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0">
              ${(draftPartners||[]).length > 0 ? `
              <div style="padding:12px 16px;border-right:1px solid var(--border)">
                <div style="font-size:0.78rem;font-weight:600;color:var(--warning);margin-bottom:8px">거래처 (${draftPartners.length}건)</div>
                ${draftPartners.slice(0,5).map(p=>`
                  <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border);font-size:0.8rem">
                    <span style="color:var(--text-primary)">${p.name}</span>
                    <a href="#partners" onclick="Router.navigate('partners')" style="font-size:0.72rem;color:var(--primary-light);cursor:pointer">수정 →</a>
                  </div>`).join('')}
                ${draftPartners.length > 5 ? `<div style="font-size:0.72rem;color:var(--text-muted);padding-top:6px">외 ${draftPartners.length-5}건...</div>` : ''}
              </div>` : '<div></div>'}
              ${(draftReceipts||[]).length > 0 ? `
              <div style="padding:12px 16px">
                <div style="font-size:0.78rem;font-weight:600;color:var(--warning);margin-bottom:8px">입고전표 (${draftReceipts.length}건)</div>
                ${draftReceipts.slice(0,5).map(r=>`
                  <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border);font-size:0.8rem">
                    <span style="color:var(--text-primary)">${r.receipt_no} <small style="color:var(--text-muted)">${r.date||''}</small></span>
                    <a href="#receipts" onclick="Router.navigate('receipts')" style="font-size:0.72rem;color:var(--primary-light);cursor:pointer">수정 →</a>
                  </div>`).join('')}
                ${draftReceipts.length > 5 ? `<div style="font-size:0.72rem;color:var(--text-muted);padding-top:6px">외 ${draftReceipts.length-5}건...</div>` : ''}
              </div>` : '<div></div>'}
            </div>
          </div>` : ''}
          </div>
        </div>

        <!-- ── 자금 예측 섹션 ─────────────────────────────────────── -->
        <div class="card" style="margin-top:24px">
          <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid var(--border)">
            <div>
              <span style="font-weight:700;font-size:0.95rem">자금 흐름 예측</span>
              <span style="font-size:0.78rem;color:var(--text-muted);margin-left:8px">발주 지출 / 수금 예정 / 납기 지연</span>
            </div>
            <div style="display:flex;gap:4px">
              ${['week','month','year'].map(p => `
                <button class="btn btn-xs ${_forecastPeriod===p?'btn-primary':'btn-ghost'}" id="fp-${p}" onclick="Dashboard.setForecastPeriod('${p}')">
                  ${p==='week'?'금주':p==='month'?'이번달':'올해'}
                </button>`).join('')}
            </div>
          </div>

          ${(forecast.budget_overrun) ? `
          <div style="background:rgba(239,68,68,0.08);border-left:3px solid var(--danger);padding:10px 18px;font-size:0.82rem;display:flex;align-items:center;gap:10px">
            <span style="font-size:1.1rem">🔴</span>
            <span><strong>예산 초과 경고</strong> — 이번 달 발주 ${formatCurrency(forecast.this_month_po)} (6개월 평균 ${formatCurrency(forecast.avg_monthly_po)} 대비 ↑${((forecast.this_month_po / (forecast.avg_monthly_po||1) - 1)*100).toFixed(0)}%)</span>
          </div>` : ''}

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:0">
            <!-- 발주 지출 예정 -->
            <div style="padding:14px 18px;border-right:1px solid var(--border)">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
                <span style="font-size:0.82rem;font-weight:600;color:var(--warning)">발주 지출 예정 ↑</span>
                <span style="font-size:0.9rem;font-weight:700;color:var(--warning)">${formatCurrency(forecast.po_forecast_total||0)}</span>
              </div>
              ${(forecast.po_forecast||[]).length ? `
              <table style="width:100%;font-size:0.78rem;border-collapse:collapse">
                <thead><tr style="color:var(--text-muted)">
                  <th style="text-align:left;padding-bottom:4px">발주번호</th>
                  <th style="text-align:left">거래처</th>
                  <th style="text-align:right">납기예정</th>
                  <th style="text-align:right">금액</th>
                </tr></thead>
                <tbody>
                  ${(forecast.po_forecast||[]).slice(0,6).map(p => `
                  <tr style="border-top:1px solid var(--border)">
                    <td style="padding:5px 0" class="mono">${p.po_no}</td>
                    <td style="color:var(--text-muted);padding:5px 0">${p.vendor_name||p.vendor_code}</td>
                    <td style="text-align:right;padding:5px 0">${formatDate(p.delivery_due_date)}</td>
                    <td style="text-align:right;font-weight:600;padding:5px 0">${formatCurrency(p.open_amount||p.total_amount||0)}</td>
                  </tr>`).join('')}
                </tbody>
              </table>
              ${(forecast.po_forecast||[]).length>6?`<div style="font-size:0.72rem;color:var(--text-muted);margin-top:6px">외 ${(forecast.po_forecast.length-6)}건...</div>`:''}
              ` : `<div style="color:var(--text-muted);font-size:0.8rem;padding:8px 0">해당 기간 예정 발주 없음</div>`}
            </div>

            <!-- 수금 예정 -->
            <div style="padding:14px 18px">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
                <span style="font-size:0.82rem;font-weight:600;color:var(--success)">수금 예정 ↑</span>
                <span style="font-size:0.9rem;font-weight:700;color:var(--success)">${formatCurrency(forecast.ar_forecast_total||0)}</span>
              </div>
              ${(forecast.ar_forecast||[]).length ? `
              <table style="width:100%;font-size:0.78rem;border-collapse:collapse">
                <thead><tr style="color:var(--text-muted)">
                  <th style="text-align:left;padding-bottom:4px">수주번호</th>
                  <th style="text-align:left">고객사</th>
                  <th style="text-align:right">수금예정일</th>
                  <th style="text-align:right">금액</th>
                </tr></thead>
                <tbody>
                  ${(forecast.ar_forecast||[]).slice(0,6).map(s => `
                  <tr style="border-top:1px solid var(--border)">
                    <td style="padding:5px 0" class="mono">${s.so_no}</td>
                    <td style="color:var(--text-muted);padding:5px 0">${s.customer_name||s.customer_code}</td>
                    <td style="text-align:right;padding:5px 0">${s.expected_collection}</td>
                    <td style="text-align:right;font-weight:600;padding:5px 0">${formatCurrency(s.total_amount||0)}</td>
                  </tr>`).join('')}
                </tbody>
              </table>
              ${(forecast.ar_forecast||[]).length>6?`<div style="font-size:0.72rem;color:var(--text-muted);margin-top:6px">외 ${(forecast.ar_forecast.length-6)}건...</div>`:''}
              ` : `<div style="color:var(--text-muted);font-size:0.8rem;padding:8px 0">해당 기간 수금 예정 없음</div>`}
            </div>
          </div>
        </div>

        <!-- ── 납기 지연 미입고 잔량 ────────────────────────────────── -->
        ${(forecast.overdue_pos||[]).length ? `
        <div class="card" style="margin-top:16px">
          <div style="padding:12px 18px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px">
            <span style="font-size:1rem">⚠️</span>
            <span style="font-weight:700;font-size:0.9rem;color:var(--danger)">납기 지연 미입고 잔량 — ${forecast.overdue_pos_count}건 / ${formatCurrency(forecast.overdue_amount)}</span>
          </div>
          <div style="overflow-x:auto">
            <table class="table" style="font-size:0.8rem">
              <thead><tr>
                <th>발주번호</th><th>거래처</th><th>발주일</th>
                <th>납기예정일</th><th style="color:var(--danger)">지연일수 ↓</th>
                <th class="num">미입고수량</th><th class="num">미입고금액</th><th>작업</th>
              </tr></thead>
              <tbody>
                ${(forecast.overdue_pos||[]).map(p => `
                <tr>
                  <td class="mono" style="color:var(--warning)">${p.po_no}</td>
                  <td>${p.vendor_name||p.vendor_code}</td>
                  <td>${formatDate(p.order_date)}</td>
                  <td style="color:var(--danger)">${formatDate(p.delivery_due_date)}</td>
                  <td style="color:var(--danger);font-weight:700;text-align:center">↓ ${p.overdue_days}일</td>
                  <td class="num">${formatNumber(p.remaining_qty||0)}</td>
                  <td class="num font-bold">${formatCurrency(p.remaining_amount||0)}</td>
                  <td><button class="btn btn-xs btn-secondary" onclick="Router.navigate('purchasing')">조회</button></td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>` : ''}

      `;

      initAssetChart(summary.category_values);
      initSalesChart(summary.weekly_sales_by_category);

    } catch (err) {
      container.innerHTML = `<div style="padding:64px;text-align:center;color:var(--text-muted)">조회된 데이터가 없습니다</div>`;
    }
  }

  async function setForecastPeriod(period) {
    _forecastPeriod = period;
    render();
  }

  function initAssetChart(data) {
    const ctx = document.getElementById('assetChart');
    if (!ctx) return;

    if (chart) chart.destroy();

    const labels = (data||[]).map(d => d.category);
    const values = (data||[]).map(d => d.value);
    const colors = [
      '#6C63FF', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', 
      '#8B5CF6', '#EC4899', '#6B7280'
    ];

    chart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: values,
          backgroundColor: colors,
          borderWidth: 0,
          hoverOffset: 12
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              boxWidth: 12,
              padding: 20,
              font: { size: 12, family: 'Inter' },
              color: '#6B7280'
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const val = context.raw;
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const perc = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
                return ` ${context.label}: ${formatCurrency(val)} (${perc}%)`;
              }
            }
          }
        },
        cutout: '70%'
      }
    });
  }

  let salesChart = null;
  function initSalesChart(data) {
    const ctx = document.getElementById('salesChart');
    if (!ctx) return;
    if (salesChart) salesChart.destroy();

    const labels = (data||[]).map(d => d.category);
    const values = (data||[]).map(d => d.value);

    salesChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: '매출 가액',
          data: values,
          backgroundColor: '#6C63FF',
          borderRadius: 8
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { callback: value => formatNumber(value / 10000) + '만' }
          },
          y: {
            grid: { display: false }
          }
        }
      }
    });
  }

  async function runAIAnalysis() {
    const btn = document.getElementById('dashboard-ai-btn');
    const originalHTML = btn.innerHTML;
    
    // Count items for progress status (V14.0)
    let itemCount = 0;
    try {
      // We can use the 'aging' or 'summary' data if already loaded
      // Or just a quick check on the visible table rows if needed.
      // Here we use the length of 'aging' or a default if not yet known.
      const agingData = await API.get('/dashboard/scm/aging').catch(() => []);
      itemCount = agingData.length || 0;
    } catch(e) {}

    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-small"></span> 재고 ${itemCount}건 분석 중...`;

    try {
      const res = await API.post('/ai/analyze-inventory', {});
      const html = `
        <div class="modal-header">
          <div class="modal-title">AI 지능형 재고 분석 리포트</div>
          <button class="modal-close">×</button>
        </div>
        <div class="modal-body">
          <div class="alert alert-accent" style="margin-bottom:20px">
            <svg viewBox="0 0 20 20" fill="currentColor"><path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1a1 1 0 112 0v1a1 1 0 11-2 0zM13.536 15.657a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM6.464 18.95a1 1 0 101.414-1.414l-.707-.707a1 1 0 00-1.414 1.414l.707.707z" /></svg>
            <strong>분석 엔진: ${res.engine.toUpperCase()}</strong> (Claude 지능 이식 모드)
          </div>
          <div class="ai-report-content" style="white-space:pre-wrap; line-height:1.6; font-size:0.95rem; color:var(--text-primary)">
            ${res.report}
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-primary modal-close">확인</button>
        </div>
      `;
      openModal(html, 'max-width:800px');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalHTML;
    }
  }

  return { render, refresh: render, runAIAnalysis, setForecastPeriod };
})();
window.Dashboard = Dashboard;
