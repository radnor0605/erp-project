/* ─── SCM Alerts Module ─── */
const ScmAlerts = (() => {
  let _data = [];
  let _statusFilter = 'open';

  function reset() { _statusFilter = 'open'; }

  async function render(params = {}) {
    if (params.status) _statusFilter = params.status;

    const container = document.getElementById('page-container');
    container.innerHTML = `
      <div class="animate-fade">
        <div class="page-header">
          <div>
            <h2 class="page-title">SCM 경보 센터</h2>
            <p class="page-subtitle">안전재고 미달·납기 지연·3-Way 불일치 자동 감지</p>
          </div>
          <div class="page-actions">
            <button class="btn btn-warning" id="scm-generate-btn">⚡ 경보 자동 생성</button>
            <button class="btn btn-secondary" id="scm-reload-btn">새로고침</button>
          </div>
        </div>
        <div class="filter-bar">
          <select id="scm-status-filter" style="width:130px">
            <option value="open" ${_statusFilter==='open'?'selected':''}>미처리</option>
            <option value="acknowledged" ${_statusFilter==='acknowledged'?'selected':''}>확인됨</option>
            <option value="all">전체</option>
          </select>
          <select id="scm-type-filter" style="width:160px">
            <option value="">전체 유형</option>
            <option value="SAFETY_STOCK">안전재고 미달</option>
            <option value="OVERDUE_PO">발주 납기 초과</option>
            <option value="QTY_MISMATCH">수량 불일치</option>
            <option value="PPV_WARNING">단가 변동</option>
            <option value="THREE_WAY_FAIL">3-Way 불일치</option>
          </select>
          <button class="btn btn-secondary" id="scm-search-btn">조회</button>
        </div>
        <div id="scm-summary" style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap"></div>
        <div id="scm-table-wrap">${loadingHTML()}</div>
      </div>
    `;

    document.getElementById('scm-generate-btn').onclick = generateAlerts;
    document.getElementById('scm-reload-btn').onclick = loadData;
    document.getElementById('scm-search-btn').onclick = loadData;

    await loadData();
  }

  async function loadData() {
    const wrap = document.getElementById('scm-table-wrap');
    if (!wrap) return;
    wrap.innerHTML = loadingHTML();
    try {
      const status = document.getElementById('scm-status-filter')?.value;
      const type = document.getElementById('scm-type-filter')?.value;
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      if (type) params.set('type', type);
      _data = await API.get('/scm-alerts?' + params.toString());
      renderSummary();
      renderTable();
    } catch (err) {
      wrap.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
    }
  }

  async function generateAlerts() {
    const btn = document.getElementById('scm-generate-btn');
    if (btn) { btn.disabled = true; btn.textContent = '생성 중...'; }
    try {
      const result = await API.post('/scm-alerts/generate', {});
      showToast(`경보 생성 완료: ${result.created}건 신규`, 'success');
      await loadData();
    } catch (err) {
      showToast('경보 생성 실패: ' + err.message, 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '⚡ 경보 자동 생성'; }
    }
  }

  function renderSummary() {
    const bar = document.getElementById('scm-summary');
    if (!bar) return;
    const byType = {};
    _data.forEach(a => { byType[a.type] = (byType[a.type] || 0) + 1; });
    const typeLabels = {
      SAFETY_STOCK: '안전재고 미달',
      OVERDUE_PO: '납기 초과',
      QTY_MISMATCH: '수량 불일치',
      PPV_WARNING: '단가 변동',
      THREE_WAY_FAIL: '3-Way 불일치',
    };
    const typeColors = {
      SAFETY_STOCK: '#EF4444',
      OVERDUE_PO: '#F97316',
      QTY_MISMATCH: '#EAB308',
      PPV_WARNING: '#8B5CF6',
      THREE_WAY_FAIL: '#EC4899',
    };
    const openCount = _data.filter(a => a.status === 'open').length;
    bar.innerHTML = `
      <div style="padding:8px 16px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:var(--radius-md);font-size:0.8rem;color:#FCA5A5">
        미처리 경보: <strong>${openCount}</strong>건
      </div>
      ${Object.entries(byType).map(([t, c]) => `
        <div style="padding:8px 16px;background:var(--bg-glass);border:1px solid var(--border);border-radius:var(--radius-md);font-size:0.8rem">
          <span style="color:${typeColors[t]||'var(--text-muted)'}">●</span> ${typeLabels[t]||t}: <strong>${c}</strong>건
        </div>
      `).join('')}
    `;
  }

  function renderTable() {
    const wrap = document.getElementById('scm-table-wrap');
    if (!wrap) return;
    if (!_data.length) { wrap.innerHTML = emptyHTML('SCM 경보가 없습니다'); return; }

    const typeColors = {
      SAFETY_STOCK: 'badge-danger',
      OVERDUE_PO: 'badge-warning',
      QTY_MISMATCH: 'badge-warning',
      PPV_WARNING: 'badge-info',
      THREE_WAY_FAIL: 'badge-danger',
    };
    const typeLabels = {
      SAFETY_STOCK: '안전재고',
      OVERDUE_PO: '납기초과',
      QTY_MISMATCH: '수량불일치',
      PPV_WARNING: '단가변동',
      THREE_WAY_FAIL: '3-Way',
    };

    wrap.innerHTML = `<div style="overflow-x:auto"><table>
      <thead><tr>
        <th>유형</th><th>메시지</th><th>품목코드</th><th>참조전표</th><th>상태</th><th>발생시각</th><th>작업</th>
      </tr></thead>
      <tbody>${_data.map(a => `
        <tr style="${a.status==='open' ? 'background:rgba(239,68,68,0.03)' : ''}">
          <td><span class="badge ${typeColors[a.type]||'badge-ghost'}">${typeLabels[a.type]||a.type}</span></td>
          <td style="max-width:360px;font-size:0.82rem">${a.message}</td>
          <td><span class="mono" style="color:var(--primary-light);font-size:0.78rem">${a.material_code||'-'}</span></td>
          <td style="font-size:0.78rem;color:var(--text-muted)">${a.ref_no||'-'}</td>
          <td>${a.status==='open'
            ? '<span class="badge badge-danger">미처리</span>'
            : `<span class="badge badge-success">확인됨</span><div style="font-size:0.7rem;color:var(--text-muted)">${a.acknowledged_by||''}</div>`
          }</td>
          <td style="font-size:0.75rem;color:var(--text-muted)">${(a.created_at||'').slice(0,16)}</td>
          <td>${a.status==='open'
            ? `<button class="btn btn-xs btn-success" onclick="ScmAlerts.acknowledge('${a.id}')">확인</button>`
            : ''
          }</td>
        </tr>
      `).join('')}
      </tbody>
    </table></div>`;
  }

  async function acknowledge(id) {
    try {
      await API.put(`/scm-alerts/${id}/acknowledge`, {});
      showToast('경보 확인 처리됨', 'success');
      await loadData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  return { render, reset, acknowledge };
})();
window.ScmAlerts = ScmAlerts;
