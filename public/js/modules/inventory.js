/* ─── Inventory Module ─── */
const Inventory = (() => {
  let _data = [];
  let _belowSafety = false;
  let _agingRed = false;
  let _sortValueDesc = false;

  function reset() {
    _belowSafety = false;
    _agingRed = false;
    _sortValueDesc = false;
  }

  async function render(params = {}) {
    _belowSafety = params.filter === 'below_safety';
    _agingRed = params.filter === 'aging_red';
    _sortValueDesc = params.sort === 'value_desc';

    const container = document.getElementById('page-container');
    
    let bannerHTML = '';
    if (_belowSafety || _agingRed || _sortValueDesc) {
      const filterText = _belowSafety ? '안전재고 미달 품목' : _agingRed ? '장기 미회전(180일+) 품목' : '자산 가치 높은 순';
      bannerHTML = `
        <div class="filter-active-banner">
          <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clip-rule="evenodd"/></svg>
          <span>현재 적용된 필터: <strong>${filterText}</strong></span>
          <button class="btn btn-xs btn-ghost" onclick="Inventory.clearFilters()" style="margin-left:auto;color:white;text-decoration:underline">필터 해제</button>
        </div>
      `;
    }

    container.innerHTML = `
      <div class="animate-fade">
        ${bannerHTML}
        <div class="page-header">
          <div>
            <h2 class="page-title">재고 현황</h2>
            <p class="page-subtitle">가용 · 검수 · 보류 재고 현황 및 이동평균 단가 기준 재고금액</p>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary ${_belowSafety?'btn-warning':''}" id="inv-safety-btn">
              ${_belowSafety ? '⚠ 안전재고 미달만 보기' : '안전재고 미달 필터'}
            </button>
            <button class="btn btn-secondary" id="inv-reload">새로고침</button>
          </div>
        </div>
        <div class="filter-bar">
          <div class="search-input" style="max-width:260px">
            <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd"/></svg>
            <input type="text" id="inv-search" placeholder="품목코드 또는 품목명...">
          </div>
          <select id="inv-cat" style="width:140px">
            <option value="">전체 구분</option>
            <option value="원료">원료</option>
            <option value="부자재">부자재</option>
            <option value="장비">장비</option>
            <option value="소모품">소모품</option>
            <option value="상품">상품</option>
            <option value="기타">기타</option>
          </select>
          <button class="btn btn-secondary" id="inv-search-btn">조회</button>
        </div>
        <div id="inv-summary-bar" style="display:flex;gap:16px;margin-bottom:16px;flex-wrap:wrap"></div>
        <div class="table-container" id="inv-table-wrap">${loadingHTML()}</div>
      </div>
    `;

    document.getElementById('inv-safety-btn').onclick = () => {
      _belowSafety = !_belowSafety;
      document.getElementById('inv-safety-btn').textContent = _belowSafety ? '⚠ 안전재고 미달만 보기' : '안전재고 미달 필터';
      loadData();
    };
    document.getElementById('inv-reload').onclick = () => loadData();
    document.getElementById('inv-search-btn').onclick = () => loadData();
    await loadData();
  }

  async function loadData() {
    const wrap = document.getElementById('inv-table-wrap');
    if (!wrap) return;
    wrap.innerHTML = loadingHTML();
    try {
      const params = new URLSearchParams();
      const search = document.getElementById('inv-search')?.value;
      const cat = document.getElementById('inv-cat')?.value;
      if (search) params.set('search', search);
      if (cat) params.set('category', cat);
      if (_belowSafety) params.set('below_safety', '1');
      _data = await API.get('/inventory?' + params.toString());
      
      if (_agingRed) {
        _data = _data.filter(m => {
          const days = m.last_out_date ? (new Date() - new Date(m.last_out_date))/(1000*60*60*24) : (new Date() - new Date(m.created_at))/(1000*60*60*24);
          return days >= 180;
        });
      }

      if (_sortValueDesc) {
        _data.sort((a, b) => b.stock_value - a.stock_value);
      }

      renderSummary();
      renderTable();
    } catch (err) { wrap.innerHTML = `<div class="alert alert-danger">${err.message}</div>`; }
  }

  function renderSummary() {
    const bar = document.getElementById('inv-summary-bar');
    if (!bar) return;
    // 가용재고 기준 stock_value + 전체재고(검수포함) total_inventory_value 분리 표시
    const availValue  = _data.reduce((s, m) => s + (m.stock_value || 0), 0);
    const totalValue  = _data.reduce((s, m) => s + (m.total_inventory_value || 0), 0);
    const inspValue   = totalValue - availValue;
    const belowCount  = _data.filter(m => m.is_digital !== 1 && m.available_qty < m.safety_stock).length;

    bar.innerHTML = `
      <div style="padding:8px 16px;background:var(--bg-glass);border:1px solid var(--border);border-radius:var(--radius-md);font-size:0.8rem">
        전체 재고금액: <strong style="color:var(--secondary)">${formatCurrency(totalValue)}</strong>
        ${inspValue > 0 ? `<span style="font-size:0.72rem;color:var(--warning);margin-left:8px">(검수중 ${formatCurrency(inspValue)} 포함)</span>` : ''}
      </div>
      <div style="padding:8px 16px;background:var(--bg-glass);border:1px solid var(--border);border-radius:var(--radius-md);font-size:0.8rem">
        가용재고 금액: <strong style="color:var(--primary-light)">${formatCurrency(availValue)}</strong>
      </div>
      <div style="padding:8px 16px;background:var(--bg-glass);border:1px solid var(--border);border-radius:var(--radius-md);font-size:0.8rem">
        조회 품목: <strong>${_data.length}</strong>개
      </div>
      ${belowCount > 0 ? `<div style="padding:8px 16px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:var(--radius-md);font-size:0.8rem;color:#FCA5A5">
        ⚠ 안전재고 미달: <strong>${belowCount}</strong>개 품목
      </div>` : ''}
    `;
  }

  function renderTable() {
    const wrap = document.getElementById('inv-table-wrap');
    if (!wrap) return;
    if (!_data.length) { wrap.innerHTML = emptyHTML('재고 데이터가 없습니다'); return; }

    const catColors = { '원료':'badge-primary','부자재':'badge-info','장비':'badge-warning','소모품':'badge-success','상품':'badge-secondary','디지털(자체)':'badge-digital','디지털(외부)':'badge-digital-ext','기타':'badge-ghost' };
    
    // Auto-scroll to top if banner is present
    window.scrollTo({ top: 0, behavior: 'smooth' });

    wrap.innerHTML = `<div style="overflow-x:auto"><table>
      <thead><tr>
        <th>품목코드</th><th>품목명</th><th>구분</th><th>규격</th><th>단위</th>
        <th>실물재고</th><th>주문할당</th><th>가용재고(Net)</th><th>검수재고</th><th>보류재고</th><th>총재고</th>
        <th>안전재고</th><th>이동평균단가</th><th>재고금액(가용)</th><th>총재고금액</th><th>리드타임</th><th>상태</th>
      </tr></thead>
      <tbody>${_data.map(m => {
        const isSelfDigital = m.is_digital === 1;
        const isBelowSafety = !isSelfDigital && m.available_qty < m.safety_stock;
        const safetyRatio = m.safety_stock > 0 ? m.available_qty / m.safety_stock : 1;
        const nameSafe = (m.name || '').replace(/'/g, "\\'");
        return `<tr style="${isBelowSafety ? 'background:rgba(239,68,68,0.04)' : ''}">
          <td><span class="mono inv-ledger-link" data-code="${m.code}" data-name="${nameSafe}" style="color:var(--primary-light);cursor:pointer;text-decoration:underline dotted" title="클릭: 재고 이동 이력 보기">${m.code}</span></td>
          <td><span class="inv-ledger-link" data-code="${m.code}" data-name="${nameSafe}" style="font-weight:600;cursor:pointer;color:var(--text-primary);text-decoration:underline dotted" title="클릭: 재고 이동 이력 보기">${m.name}</span></td>
          <td><span class="badge ${catColors[m.category]||'badge-ghost'}">${m.category}</span></td>
          <td style="color:var(--text-muted)">${m.spec||'-'}</td>
          <td>${m.unit}</td>
          <td class="num">${isSelfDigital ? '<span style="color:var(--text-muted)">-</span>' : formatNumber(m.physical_qty,2)}</td>
          <td class="num" style="color:var(--warning)">${isSelfDigital ? '<span style="color:var(--text-muted)">-</span>' : formatNumber(m.committed_qty,2)}</td>
          <td>
            ${isSelfDigital
              ? `<div class="num" style="font-weight:700;color:var(--text-muted)">무한</div>`
              : `<div class="num ${isBelowSafety?'num-negative':''}" style="font-weight:700;color:var(--secondary)">${formatNumber(m.available_qty,2)}</div>
            <div class="progress-bar" style="margin-top:4px;width:80px">
              <div class="progress-fill" style="width:${Math.min(safetyRatio*100,100)}%;background:${isBelowSafety?'var(--danger)':'linear-gradient(90deg,var(--success),var(--primary))'}"></div>
            </div>`
            }
          </td>
          <td class="num ${m.inspection_qty>0?'num-warn':''}" ${m.inspection_qty>0?`style="cursor:pointer;text-decoration:underline dotted" onclick="Inventory.quickApproveInspection('${m.code}','${(m.name||'').replace(/'/g,"\\'")}',${m.inspection_qty})" title="클릭: 검수재고 즉시 가용화"`:''}>
            ${formatNumber(m.inspection_qty,2)}${m.inspection_qty>0?` <span style="font-size:0.68rem">▶가용화</span>`:''}
          </td>
          <td class="num ${m.hold_qty>0?'num-negative':''}" ${m.hold_qty>0?`style="cursor:pointer;text-decoration:underline dotted" onclick="Inventory.showHoldDispose('${m.code}','${(m.name||'').replace(/'/g,"\\'")}',${m.hold_qty})" title="클릭: 반품보류재고 처리"`:''}>
            ${formatNumber(m.hold_qty,2)}${m.hold_qty>0?` <span style="font-size:0.68rem;color:var(--danger)">⚠반품</span>`:''}
          </td>
          <td class="num">${formatNumber(m.total_qty,2)}</td>
          <td class="num">${isSelfDigital ? '<span style="color:var(--text-muted)">-</span>' : formatNumber(m.safety_stock,0)}</td>
          <td class="num" style="color:var(--secondary)">${formatCurrency(m.avg_price)}</td>
          <td class="num" style="font-weight:600">${isSelfDigital ? '<span style="color:var(--text-muted)">-</span>' : formatCurrency(m.stock_value)}</td>
          <td class="num" style="font-weight:600;color:${m.total_inventory_value>m.stock_value?'var(--warning)':'var(--secondary)'}">
            ${isSelfDigital ? '<span style="color:var(--text-muted)">-</span>' : formatCurrency(m.total_inventory_value||0)}
            ${!isSelfDigital && m.inspection_qty > 0 ? `<span style="font-size:0.65rem;display:block;color:var(--warning)">검수포함</span>` : ''}
          </td>
          <td class="num">${m.lead_time}일</td>
          <td>${isSelfDigital ? '<span class="badge badge-digital" style="font-size:0.7rem">무한재고</span>' : isBelowSafety ? '<span class="badge badge-danger">⚠ 발주필요</span>' : '<span class="badge badge-success">정상</span>'}</td>
        </tr>`;
      }).join('')}
      </tbody>
      <tfoot>
        <tr style="background:rgba(108,99,255,0.08);border-top:2px solid var(--border-active)">
          <td colspan="11" style="text-align:right;font-weight:700;padding:12px 16px">합계</td>
          <td class="num" style="font-weight:700;color:var(--primary-light);font-size:0.9rem">${formatCurrency(_data.reduce((s,m)=>s+(m.stock_value||0),0))}</td>
          <td class="num" style="font-weight:700;color:var(--secondary);font-size:0.95rem">${formatCurrency(_data.reduce((s,m)=>s+(m.total_inventory_value||0),0))}</td>
          <td colspan="2"></td>
        </tr>
      </tfoot>
    </table></div>`;

    // 품목코드/품목명 클릭 → 수불부 모달
    wrap.querySelectorAll('.inv-ledger-link').forEach(el =>
      el.addEventListener('click', () => openMovementLedger(el.dataset.code, el.dataset.name)));
  }

  function clearFilters() {
    _belowSafety = false;
    _agingRed = false;
    _sortValueDesc = false;
    render();
  }

  async function showHoldDispose(materialCode, materialName, holdQty) {
    // Load pending hold items for this material from returns
    let pendingItems = [];
    try {
      pendingItems = await API.get(`/returns/pending-hold`);
      pendingItems = pendingItems.filter(r => r.material_code === materialCode);
    } catch(e) { /* ignore */ }

    const itemsHtml = pendingItems.length
      ? pendingItems.map(r => `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:rgba(239,68,68,0.06);border-radius:5px;margin-bottom:6px;font-size:0.82rem">
            <div>
              <div style="font-weight:600">${r.return_nos || '-'}</div>
              <div style="font-size:0.75rem;color:var(--text-muted)">사유: ${r.reason_codes||'-'} | 수량: ${formatNumber(r.total_hold_qty)}</div>
            </div>
            <a href="#" onclick="closeModal();navigate('returns')" style="font-size:0.75rem;color:var(--primary)">반품 상세 →</a>
          </div>`).join('')
      : `<div style="color:var(--text-muted);font-size:0.8rem;padding:8px">연결된 반품 전표 없음 (직접 보류 입고된 재고)</div>`;

    const html = `
      <div class="modal-header">
        <div class="modal-title">⚠️ 보류재고 처리 — ${materialName}</div>
        <button class="modal-close">×</button>
      </div>
      <div class="modal-body">
        <div style="padding:10px 12px;background:rgba(239,68,68,0.07);border:1px solid rgba(239,68,68,0.2);border-radius:6px;margin-bottom:14px;font-size:0.85rem">
          <strong style="color:var(--danger)">보류재고: ${formatNumber(holdQty)}</strong>
          <span style="color:var(--text-muted);margin-left:8px">(반품 대기 중)</span>
        </div>
        <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:8px">연결 반품 전표</div>
        ${itemsHtml}
        <div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--border)">
          <div style="font-size:0.82rem;font-weight:600;margin-bottom:10px">전체 일괄 처리</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-success" id="hd-available">✓ 가용화</button>
            <button class="btn btn-danger" id="hd-scrap">🗑 폐기</button>
            <button class="btn btn-secondary" id="hd-returns-page">반품 관리 페이지 →</button>
          </div>
          <label style="display:flex;align-items:center;gap:6px;margin-top:10px;font-size:0.8rem">
            <input type="checkbox" id="hd-map-adjust">
            <span>가용화 시 MAP 조정 (단가: <strong>${formatCurrency(pendingItems[0]?.avg_price||0)}</strong>)</span>
          </label>
        </div>
      </div>`;
    openModal(html);

    document.getElementById('hd-available')?.addEventListener('click', async () => {
      const mapAdjust = document.getElementById('hd-map-adjust')?.checked || false;
      try {
        // Get return items in hold for this material and dispose
        const allItems = await API.get(`/returns/pending-hold`);
        const targets = allItems.filter(r => r.material_code === materialCode);
        if (!targets.length) {
          showToast('처리 가능한 반품 품목이 없습니다. 반품 관리 페이지에서 개별 처리하세요.', 'info', 4000);
          return;
        }
        // Dispose via returns detail pages - redirect to returns module
        closeModal();
        showToast('반품 관리 페이지에서 개별 품목을 처리하세요.', 'info', 4000);
        if (typeof navigate === 'function') navigate('returns');
      } catch(err) { showToast(err.message, 'error'); }
    });

    document.getElementById('hd-scrap')?.addEventListener('click', () => {
      closeModal();
      showToast('반품 관리 페이지에서 품목별 폐기 처리하세요.', 'info', 4000);
      if (typeof navigate === 'function') navigate('returns');
    });

    document.getElementById('hd-returns-page')?.addEventListener('click', () => {
      closeModal();
      if (typeof navigate === 'function') navigate('returns');
    });
  }

  function quickApproveInspection(materialCode, materialName, inspQty) {
    confirmDialog(
      `<strong>[${materialName}]</strong><br>검수재고 <strong>${formatNumber(inspQty)}</strong>을(를) 즉시 가용재고로 전환합니다.<br><span style="font-size:0.8rem;color:var(--text-muted)">MAP이 즉시 갱신됩니다.</span>`,
      async () => {
        try {
          const result = await API.put(`/inventory/approve-inspection/${materialCode}`, {});
          showToast(`${materialName} — ${formatNumber(result.total_approved_qty)} 가용화 완료`, 'success', 4000);
          render();
        } catch (err) { showToast(err.message, 'error'); }
      },
      false
    );
  }

  async function openMovementLedger(materialCode, materialName) {
    const html = `
      <div class="modal-header">
        <div class="modal-title">📦 재고 이동 이력 — <span class="mono" style="font-size:0.85em;color:var(--primary-light)">${materialCode}</span> ${materialName}</div>
        <button class="modal-close">×</button>
      </div>
      <div class="modal-body" style="padding:0">
        <div id="inv-ledger-body" style="padding:16px">${loadingHTML()}</div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary modal-close">닫기</button>
      </div>
    `;
    openModal(html, 'modal-wide');

    try {
      const rows = await API.get(`/inventory/movements/${encodeURIComponent(materialCode)}`);
      const body = document.getElementById('inv-ledger-body');
      if (!body) return;

      if (!rows.length) {
        body.innerHTML = '<div style="padding:32px;text-align:center;color:var(--text-muted)">이동 이력이 없습니다.</div>';
        return;
      }

      const TYPE_BADGES = {
        '101': 'badge-success',
        '201': 'badge-danger',
        '202': 'badge-info',
        '211': 'badge-danger',
        '701': 'badge-primary',
        '702': 'badge-warning',
      };

      body.innerHTML = `
        <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:10px">
          총 <strong>${rows.length}</strong>건 · 최신순 정렬 · 품목코드/품목명 클릭 시 이 창이 열립니다
        </div>
        <div style="overflow-x:auto">
          <table class="table table-sm" style="font-size:0.82rem;min-width:760px">
            <thead><tr>
              <th>날짜</th>
              <th>이동구분</th>
              <th>이동번호</th>
              <th>연결전표</th>
              <th>창고</th>
              <th>재고유형</th>
              <th class="num">변동수량</th>
              <th class="num">단가</th>
              <th class="num">잔고(누계)</th>
              <th>담당자</th>
              <th>비고</th>
              <th>상태</th>
            </tr></thead>
            <tbody>
              ${rows.map(r => {
                const isIn  = r.direction > 0;
                const isOut = r.direction < 0;
                const qtyStyle = isIn  ? 'color:#22c55e;font-weight:700'
                               : isOut ? 'color:#ef4444;font-weight:700'
                               :         'color:var(--text-muted)';
                const qtyPrefix = isIn ? '+' : isOut ? '−' : '';
                const badgeCls = TYPE_BADGES[r.type_code] || 'badge-ghost';
                const isCancelled = r.status === 'cancelled';
                return `<tr style="${isCancelled ? 'opacity:0.45;text-decoration:line-through' : ''}">
                  <td>${r.date || '-'}</td>
                  <td><span class="badge ${badgeCls}" style="font-size:0.72rem">${r.type_name || r.type_code}</span></td>
                  <td class="mono" style="font-size:0.75rem;color:var(--text-muted)">${r.movement_no || '-'}</td>
                  <td class="mono" style="font-size:0.75rem;color:var(--primary-light)">${r.ref_doc_no || '-'}</td>
                  <td style="font-size:0.78rem">${r.warehouse_name || r.warehouse_code || '-'}</td>
                  <td style="font-size:0.78rem;color:var(--text-muted)">${r.stock_type || '-'}</td>
                  <td class="num" style="${qtyStyle}">${qtyPrefix}${formatNumber(r.qty, 2)}</td>
                  <td class="num">${r.unit_price ? formatCurrency(r.unit_price) : '-'}</td>
                  <td class="num" style="font-weight:600;color:var(--secondary)">${formatNumber(r.running_balance, 2)}</td>
                  <td style="font-size:0.78rem">${r.created_by || '-'}</td>
                  <td style="font-size:0.75rem;color:var(--text-muted);max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${r.notes || ''}">${r.notes || '-'}</td>
                  <td>${isCancelled ? '<span class="badge badge-ghost" style="font-size:0.7rem">취소</span>' : '<span class="badge badge-success" style="font-size:0.7rem">유효</span>'}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch (e) {
      const body = document.getElementById('inv-ledger-body');
      if (body) body.innerHTML = `<div class="alert alert-danger">${e.message}</div>`;
    }
  }

  return { render, reset, clearFilters, quickApproveInspection, showHoldDispose, openMovementLedger };
})();
window.Inventory = Inventory;
