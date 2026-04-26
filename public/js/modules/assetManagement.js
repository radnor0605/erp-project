/* ─── 자산관리 (Asset Management) 모듈 v74 ─── */

const AssetManagement = (() => {
  let _tab = 'list';
  let _filters = { search: '', status: '', category_id: '', department: '', asset_type: '' };
  let _categories = [];
  let _locations = [];

  // ─── Status Badge ─────────────────────────────────
  function statusBadge(s) {
    const m = {
      'in_stock':    ['badge-success', '보관'],
      'assigned':    ['badge-info',    '할당'],
      'maintenance': ['badge-warning', '정비중'],
      'disposed':    ['badge-danger',  '폐기'],
      'lost':        ['badge-ghost',   '분실'],
    };
    const [cls, label] = m[s] || ['badge-ghost', s];
    return `<span class="badge ${cls}">${label}</span>`;
  }

  function conditionBadge(c) {
    const m = { 'good': ['badge-success','양호'], 'damaged': ['badge-warning','손상'], 'needs_repair': ['badge-danger','수리필요'] };
    const [cls, label] = m[c] || ['badge-ghost', c || '-'];
    return `<span class="badge ${cls}">${label}</span>`;
  }

  function fmt(n) { return n != null ? Number(n).toLocaleString() : '-'; }
  function fmtDate(d) { return d || '-'; }

  // ─── Main Render ──────────────────────────────────
  async function render() {
    const container = document.getElementById('page-container');
    container.innerHTML = `
      <div class="animate-fade">
        <div class="page-header">
          <div>
            <h2 class="page-title">자산 관리</h2>
            <p class="page-subtitle">IT/일반 자산 등록, 대여/반납, 감가상각, 수리 이력 통합 관리</p>
          </div>
          <button class="btn btn-primary" id="am-add-btn">+ 자산 등록</button>
        </div>
        <div class="tabs" id="am-tabs">
          <button class="tab active" data-tab="list">자산 목록</button>
          <button class="tab" data-tab="dashboard">대시보드</button>
          <button class="tab" data-tab="depreciation">감가상각</button>
          <button class="tab" data-tab="categories">카테고리 관리</button>
          <button class="tab" data-tab="locations">위치 관리</button>
        </div>
        <div id="am-content"></div>
      </div>
    `;

    // 탭 이벤트
    document.querySelectorAll('#am-tabs .tab').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('#am-tabs .tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        _tab = btn.dataset.tab;
        renderTab();
      };
    });
    document.getElementById('am-add-btn').onclick = () => openAssetForm();

    await loadCategories();
    await loadLocations();
    renderTab();
  }

  async function loadCategories() {
    try { _categories = await API.get('/asset-mgmt/categories'); } catch { _categories = []; }
  }

  async function loadLocations() {
    try { _locations = await API.get('/asset-mgmt/locations'); } catch { _locations = []; }
  }

  function renderTab() {
    const fn = { list: renderList, dashboard: renderDashboard, depreciation: renderDepreciation, categories: renderCategories, locations: renderLocations };
    (fn[_tab] || renderList)();
  }

  // ═══════════════════════════════════════════════════════
  // 자산 목록 탭
  // ═══════════════════════════════════════════════════════

  async function renderList() {
    const el = document.getElementById('am-content');
    const params = new URLSearchParams();
    if (_filters.search) params.set('search', _filters.search);
    if (_filters.status) params.set('status', _filters.status);
    if (_filters.category_id) params.set('category_id', _filters.category_id);
    if (_filters.department) params.set('department', _filters.department);
    if (_filters.asset_type) params.set('asset_type', _filters.asset_type);

    let assets = [];
    try { assets = await API.get('/asset-mgmt/assets?' + params.toString()); } catch { }

    el.innerHTML = `
      <div class="filter-bar" style="margin-bottom:16px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <input type="text" class="form-input" placeholder="태그/명칭/시리얼/제조사 검색" id="am-search" value="${_filters.search}" style="width:220px">
        <select class="form-input" id="am-filter-status" style="width:130px">
          <option value="">전체 상태</option>
          <option value="in_stock" ${_filters.status==='in_stock'?'selected':''}>보관</option>
          <option value="assigned" ${_filters.status==='assigned'?'selected':''}>할당</option>
          <option value="maintenance" ${_filters.status==='maintenance'?'selected':''}>정비중</option>
          <option value="disposed" ${_filters.status==='disposed'?'selected':''}>폐기</option>
          <option value="lost" ${_filters.status==='lost'?'selected':''}>분실</option>
        </select>
        <select class="form-input" id="am-filter-cat" style="width:150px">
          <option value="">전체 카테고리</option>
          ${(_categories||[]).map(c => `<option value="${c.id}" ${_filters.category_id==c.id?'selected':''}>${c.parent_name ? c.parent_name+' > ':''}${c.name}</option>`).join('')}
        </select>
        <select class="form-input" id="am-filter-type" style="width:120px">
          <option value="">전체 유형</option>
          <option value="it" ${_filters.asset_type==='it'?'selected':''}>IT 자산</option>
          <option value="general" ${_filters.asset_type==='general'?'selected':''}>일반 자산</option>
        </select>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>자산태그</th><th>명칭</th><th>카테고리</th><th>상태</th>
              <th>부서</th><th>할당자</th><th>위치</th>
              <th>취득원가</th><th>장부금액</th><th>보증만료</th>
            </tr>
          </thead>
          <tbody id="am-tbody">
            ${(assets||[]).map(a => `
              <tr class="clickable" data-id="${a.id}" style="cursor:pointer">
                <td class="mono">${a.asset_tag}</td>
                <td><strong>${a.name}</strong></td>
                <td><span class="badge ${a.asset_type==='it'?'badge-info':'badge-accent'}">${a.category_name||'-'}</span></td>
                <td>${statusBadge(a.status)}</td>
                <td>${a.department||'-'}</td>
                <td>${a.assigned_to||'-'}</td>
                <td>${a.location_name||a.location||'-'}</td>
                <td class="mono">${fmt(a.purchase_price)}</td>
                <td class="mono">${fmt(a.current_value)}</td>
                <td>${a.warranty_end ? (new Date(a.warranty_end) < new Date(Date.now()+30*86400000) ? `<span class="text-warning">${a.warranty_end}</span>` : a.warranty_end) : '-'}</td>
              </tr>
            `).join('') || '<tr><td colspan="10" style="text-align:center;color:var(--text-muted)">등록된 자산이 없습니다.</td></tr>'}
          </tbody>
        </table>
      </div>
    `;

    // 이벤트 바인딩
    const searchInput = document.getElementById('am-search');
    let timer;
    searchInput.oninput = () => { clearTimeout(timer); timer = setTimeout(() => { _filters.search = searchInput.value; renderList(); }, 300); };
    document.getElementById('am-filter-status').onchange = e => { _filters.status = e.target.value; renderList(); };
    document.getElementById('am-filter-cat').onchange = e => { _filters.category_id = e.target.value; renderList(); };
    document.getElementById('am-filter-type').onchange = e => { _filters.asset_type = e.target.value; renderList(); };
    document.querySelectorAll('#am-tbody tr.clickable').forEach(tr => {
      tr.onclick = () => openDetail(parseInt(tr.dataset.id));
    });
  }

  // ═══════════════════════════════════════════════════════
  // 자산 등록/수정 폼
  // ═══════════════════════════════════════════════════════

  async function openAssetForm(asset = null) {
    const isEdit = !!asset;
    const today = new Date().toISOString().slice(0, 10);

    openModal(`
      <div class="modal-header">
        <h3>${isEdit ? '자산 수정' : '자산 등록'}</h3>
        <button class="modal-close">&times;</button>
      </div>
      <div class="modal-body" style="max-height:70vh;overflow-y:auto">
        <form id="am-asset-form">
          <div class="form-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="form-group" style="grid-column:span 2">
              <label>명칭 *</label>
              <input type="text" class="form-input" name="name" value="${asset?.name||''}" required>
            </div>
            <div class="form-group">
              <label>카테고리 *</label>
              <select class="form-input" name="category_id" required>
                <option value="">선택</option>
                ${(_categories||[]).filter(c=>c.parent_id).map(c => `<option value="${c.id}" ${asset?.category_id==c.id?'selected':''}>${c.parent_name} > ${c.name}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>취득일 *</label>
              <input type="date" class="form-input" name="acquisition_date" value="${asset?.acquisition_date||today}" required>
            </div>
            <div class="form-group">
              <label>취득원가 (원)</label>
              <input type="number" class="form-input" name="purchase_price" value="${asset?.purchase_price||0}" min="0">
            </div>
            <div class="form-group">
              <label>잔존가치 (원)</label>
              <input type="number" class="form-input" name="residual_value" value="${asset?.residual_value||0}" min="0">
            </div>
            <div class="form-group">
              <label>감가상각 방법</label>
              <select class="form-input" name="dept_method">
                <option value="straight" ${asset?.dept_method==='straight'?'selected':''}>정액법</option>
                <option value="declining" ${asset?.dept_method==='declining'?'selected':''}>정률법</option>
              </select>
            </div>
            <div class="form-group">
              <label>내용연수 (년)</label>
              <input type="number" class="form-input" name="useful_life" value="${asset?.useful_life||5}" min="1">
            </div>
            <div class="form-group">
              <label>상각 시작일</label>
              <input type="date" class="form-input" name="dept_start_date" value="${asset?.dept_start_date||asset?.acquisition_date||today}">
            </div>
            <div class="form-group">
              <label>공급사</label>
              <input type="text" class="form-input" name="vendor_code" value="${asset?.vendor_code||''}" placeholder="거래처 코드">
            </div>
            <div class="form-group">
              <label>시리얼 번호</label>
              <input type="text" class="form-input" name="serial_number" value="${asset?.serial_number||''}">
            </div>
            <div class="form-group">
              <label>바코드</label>
              <input type="text" class="form-input" name="barcode" value="${asset?.barcode||''}">
            </div>
            <div class="form-group">
              <label>제조사</label>
              <input type="text" class="form-input" name="manufacturer" value="${asset?.manufacturer||''}">
            </div>
            <div class="form-group">
              <label>모델</label>
              <input type="text" class="form-input" name="model" value="${asset?.model||''}">
            </div>
            <div class="form-group" style="grid-column:span 2">
              <label>사양</label>
              <input type="text" class="form-input" name="spec" value="${asset?.spec||''}" placeholder="CPU/RAM/Storage 등">
            </div>
            <div class="form-group">
              <label>부서</label>
              <input type="text" class="form-input" name="department" value="${asset?.department||''}">
            </div>
            <div class="form-group">
              <label>위치</label>
              <select class="form-input" name="location_id">
                <option value="">선택</option>
                ${(_locations||[]).map(l => `<option value="${l.id}" ${asset?.location_id==l.id?'selected':''}>${l.name}${l.building?' ('+l.building+')':''}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>보증시작일</label>
              <input type="date" class="form-input" name="warranty_start" value="${asset?.warranty_start||''}">
            </div>
            <div class="form-group">
              <label>보증만료일</label>
              <input type="date" class="form-input" name="warranty_end" value="${asset?.warranty_end||''}">
            </div>
            <div class="form-group" style="grid-column:span 2">
              <label>비고</label>
              <textarea class="form-input" name="notes" rows="2">${asset?.notes||''}</textarea>
            </div>
          </div>
        </form>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost modal-close">취소</button>
        <button class="btn btn-primary" id="am-save-btn">${isEdit ? '수정' : '등록'}</button>
      </div>
    `, 'modal-lg');

    document.querySelectorAll('.modal-close').forEach(b => b.onclick = closeModal);
    document.getElementById('am-save-btn').onclick = async () => {
      const form = document.getElementById('am-asset-form');
      const fd = new FormData(form);
      const body = Object.fromEntries(fd.entries());
      body.purchase_price = parseFloat(body.purchase_price) || 0;
      body.residual_value = parseFloat(body.residual_value) || 0;
      body.useful_life = parseInt(body.useful_life) || 5;
      if (body.location_id) body.location = _locations.find(l => l.id == body.location_id)?.name || '';

      try {
        if (isEdit) {
          await API.put(`/asset-mgmt/assets/${asset.id}`, body);
        } else {
          await API.post('/asset-mgmt/assets', body);
        }
        closeModal();
        renderList();
      } catch (err) {
        alert(err.message);
      }
    };
  }

  // ═══════════════════════════════════════════════════════
  // 자산 상세 모달
  // ═══════════════════════════════════════════════════════

  async function openDetail(id) {
    let data;
    try { data = await API.get(`/asset-mgmt/assets/${id}`); } catch { return alert('자산 조회 실패'); }

    const deptPct = data.purchase_price > 0 ? Math.round(data.total_depreciated / data.purchase_price * 100) : 0;

    openModal(`
      <div class="modal-header">
        <h3>${data.asset_tag} — ${data.name}</h3>
        <button class="modal-close">&times;</button>
      </div>
      <div class="modal-body" style="max-height:70vh;overflow-y:auto">
        <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
          ${statusBadge(data.status)}
          <span class="badge ${data.asset_type==='it'?'badge-info':'badge-accent'}">${data.category_name}</span>
          ${data.department ? `<span class="badge badge-ghost">${data.department}</span>` : ''}
        </div>

        <div class="tabs" id="am-detail-tabs" style="margin-bottom:12px">
          <button class="tab active" data-dtab="info">기본 정보</button>
          <button class="tab" data-dtab="assignments">할당 이력</button>
          <button class="tab" data-dtab="maintenance">수리 이력</button>
          <button class="tab" data-dtab="depreciation">감가상각</button>
          <button class="tab" data-dtab="qrcode">QR 코드</button>
        </div>
        <div id="am-detail-content"></div>
      </div>
      <div class="modal-footer">
        ${data.status === 'in_stock' || data.status === 'maintenance' ? `<button class="btn btn-primary" id="am-checkout-btn">대여</button>` : ''}
        ${data.status === 'assigned' ? `<button class="btn btn-info" id="am-checkin-btn">반납</button>` : ''}
        ${data.status !== 'disposed' && data.status !== 'assigned' ? `<button class="btn btn-warning" id="am-maint-btn">수리 등록</button>` : ''}
        ${data.status !== 'disposed' && data.status !== 'assigned' ? `<button class="btn btn-danger" id="am-dispose-btn">폐기</button>` : ''}
        <button class="btn btn-ghost" id="am-edit-btn">수정</button>
        <button class="btn btn-ghost modal-close">닫기</button>
      </div>
    `, 'modal-xl');

    document.querySelectorAll('.modal-close').forEach(b => b.onclick = closeModal);

    let activeDTab = 'info';
    function renderDTab() {
      const el = document.getElementById('am-detail-content');
      const fns = { info: detailInfo, assignments: detailAssignments, maintenance: detailMaintenance, depreciation: detailDept, qrcode: detailQR };
      el.innerHTML = (fns[activeDTab] || detailInfo)(data);
    }

    document.querySelectorAll('#am-detail-tabs .tab').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('#am-detail-tabs .tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeDTab = btn.dataset.dtab;
        renderDTab();
      };
    });
    renderDTab();

    // 액션 버튼
    const editBtn = document.getElementById('am-edit-btn');
    if (editBtn) editBtn.onclick = () => { closeModal(); openAssetForm(data); };
    const checkoutBtn = document.getElementById('am-checkout-btn');
    if (checkoutBtn) checkoutBtn.onclick = () => openCheckoutModal(data);
    const checkinBtn = document.getElementById('am-checkin-btn');
    if (checkinBtn) checkinBtn.onclick = () => openCheckinModal(data);
    const maintBtn = document.getElementById('am-maint-btn');
    if (maintBtn) maintBtn.onclick = () => openMaintenanceForm(data);
    const disposeBtn = document.getElementById('am-dispose-btn');
    if (disposeBtn) disposeBtn.onclick = () => openDisposeModal(data);
  }

  function detailInfo(d) {
    return `<table class="data-table" style="font-size:0.9rem">
      <tbody>
        <tr><td style="width:150px;color:var(--text-muted)">자산태그</td><td class="mono">${d.asset_tag}</td><td style="width:150px;color:var(--text-muted)">시리얼</td><td>${d.serial_number||'-'}</td></tr>
        <tr><td style="color:var(--text-muted)">명칭</td><td>${d.name}</td><td style="color:var(--text-muted)">바코드</td><td>${d.barcode||'-'}</td></tr>
        <tr><td style="color:var(--text-muted)">카테고리</td><td>${d.category_name}</td><td style="color:var(--text-muted)">제조사</td><td>${d.manufacturer||'-'}</td></tr>
        <tr><td style="color:var(--text-muted)">상태</td><td>${statusBadge(d.status)}</td><td style="color:var(--text-muted)">모델</td><td>${d.model||'-'}</td></tr>
        <tr><td style="color:var(--text-muted)">부서</td><td>${d.department||'-'}</td><td style="color:var(--text-muted)">사양</td><td>${d.spec||'-'}</td></tr>
        <tr><td style="color:var(--text-muted)">할당자</td><td>${d.assigned_to||'-'}</td><td style="color:var(--text-muted)">위치</td><td>${d.location_name||d.location||'-'}</td></tr>
        <tr><td style="color:var(--text-muted)">취득일</td><td>${fmtDate(d.acquisition_date)}</td><td style="color:var(--text-muted)">공급사</td><td>${d.vendor_name||d.vendor_code||'-'}</td></tr>
        <tr><td style="color:var(--text-muted)">취득원가</td><td class="mono">${fmt(d.purchase_price)} 원</td><td style="color:var(--text-muted)">보증기간</td><td>${d.warranty_start||'?'} ~ ${d.warranty_end||'?'}</td></tr>
        <tr><td style="color:var(--text-muted)">잔존가치</td><td class="mono">${fmt(d.residual_value)} 원</td><td style="color:var(--text-muted)">감가상각</td><td>${d.dept_method==='straight'?'정액법':'정률법'} / ${d.useful_life}년</td></tr>
        <tr><td style="color:var(--text-muted)">장부금액</td><td class="mono"><strong>${fmt(d.current_value)} 원</strong></td><td style="color:var(--text-muted)">누적상각</td><td class="mono">${fmt(d.total_depreciated)} 원 (${deptPct}%)</td></tr>
        ${d.notes ? `<tr><td style="color:var(--text-muted)">비고</td><td colspan="3">${d.notes}</td></tr>` : ''}
      </tbody>
    </table>`;
  }

  function deptPct(d) { return d.purchase_price > 0 ? Math.round(d.total_depreciated / d.purchase_price * 100) : 0; }

  function detailAssignments(d) {
    const rows = (d.assignments || []);
    if (!rows.length) return '<p style="color:var(--text-muted);text-align:center;padding:20px">할당 이력이 없습니다.</p>';
    return `<table class="data-table"><thead><tr><th>대여일</th><th>대상자</th><th>유형</th><th>예상반납</th><th>실제반납</th><th>반납상태</th><th>비고</th></tr></thead>
    <tbody>${rows.map(a => `<tr>
      <td>${fmtDate(a.checkout_date)}</td><td>${a.assignee_name}</td><td>${a.assignee_type}</td>
      <td>${fmtDate(a.expected_return)}</td><td>${fmtDate(a.actual_return)}</td>
      <td>${conditionBadge(a.return_condition)}</td><td>${a.checkout_note||a.return_note||'-'}</td>
    </tr>`).join('')}</tbody></table>`;
  }

  function detailMaintenance(d) {
    const rows = (d.maintenance || []);
    if (!rows.length) return '<p style="color:var(--text-muted);text-align:center;padding:20px">수리 이력이 없습니다.</p>';
    const typeLabel = t => ({'repair':'수리','preventive':'예방정비','inspection':'점검','upgrade':'업그레이드'}[t]||t);
    const statusLabel = s => ({'scheduled':'예정','in_progress':'진행중','completed':'완료','cancelled':'취소'}[s]||s);
    return `<table class="data-table"><thead><tr><th>유형</th><th>제목</th><th>시작</th><th>종료</th><th>비용</th><th>상태</th><th>작업자</th></tr></thead>
    <tbody>${rows.map(m => `<tr>
      <td>${typeLabel(m.type)}</td><td>${m.title}</td><td>${fmtDate(m.start_date)}</td><td>${fmtDate(m.end_date)}</td>
      <td class="mono">${fmt(m.cost)}</td><td><span class="badge badge-${m.status==='completed'?'success':m.status==='in_progress'?'warning':'ghost'}">${statusLabel(m.status)}</span></td>
      <td>${m.performed_by||'-'}</td>
    </tr>`).join('')}</tbody></table>`;
  }

  function detailDept(d) {
    const rows = (d.depreciation || []);
    if (!rows.length) return '<p style="color:var(--text-muted);text-align:center;padding:20px">감가상각 내역이 없습니다.</p>';
    return `<table class="data-table"><thead><tr><th>기간</th><th>상각법</th><th>기초금액</th><th>당기상각</th><th>기말금액</th><th>누적상각</th></tr></thead>
    <tbody>${rows.map(r => `<tr>
      <td class="mono">${r.period}</td><td>${r.dept_method==='straight'?'정액법':'정률법'}</td>
      <td class="mono">${fmt(r.beginning_value)}</td><td class="mono">${fmt(r.depreciation_amt)}</td>
      <td class="mono">${fmt(r.ending_value)}</td><td class="mono">${fmt(r.accumulated_dept)}</td>
    </tr>`).join('')}</tbody></table>`;
  }

  function detailQR(d) {
    let qrSvg = '';
    try {
      if (typeof qrcode !== 'undefined') {
        const qr = qrcode(0, 'M');
        qr.addData(JSON.stringify({ tag: d.asset_tag, name: d.name }));
        qr.make();
        qrSvg = qr.createSvgTag({ cellSize: 6, margin: 2 });
      } else {
        qrSvg = '<p style="color:var(--text-muted)">QR 라이브러리 로딩 대기 중...</p>';
      }
    } catch { qrSvg = '<p style="color:var(--text-muted)">QR 코드 생성 실패</p>'; }
    return `<div style="text-align:center;padding:20px">
      ${qrSvg}
      <p style="margin-top:12px"><strong>${d.asset_tag}</strong></p>
      <p>${d.name}</p>
      <p style="color:var(--text-muted);font-size:0.8rem">인쇄하여 자산에 부착하세요</p>
    </div>`;
  }

  // ═══════════════════════════════════════════════════════
  // 대여 모달
  // ═══════════════════════════════════════════════════════

  function openCheckoutModal(asset) {
    const today = new Date().toISOString().slice(0, 10);
    openModal(`
      <div class="modal-header"><h3>자산 대여 — ${asset.asset_tag}</h3><button class="modal-close">&times;</button></div>
      <div class="modal-body">
        <form id="am-checkout-form">
          <div class="form-group"><label>대상자 유형</label>
            <select class="form-input" name="assignee_type">
              <option value="employee">직원</option><option value="department">부서</option><option value="location">위치</option>
            </select>
          </div>
          <div class="form-group"><label>대상자 명 *</label>
            <input type="text" class="form-input" name="assignee_name" required>
          </div>
          <div class="form-group"><label>예상 반납일</label>
            <input type="date" class="form-input" name="expected_return" min="${today}">
          </div>
          <div class="form-group"><label>대여 사유</label>
            <input type="text" class="form-input" name="checkout_note">
          </div>
        </form>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost modal-close">취소</button>
        <button class="btn btn-primary" id="am-do-checkout">대여 실행</button>
      </div>
    `);
    document.querySelectorAll('.modal-close').forEach(b => b.onclick = closeModal);
    document.getElementById('am-do-checkout').onclick = async () => {
      const fd = new FormData(document.getElementById('am-checkout-form'));
      const body = Object.fromEntries(fd.entries());
      if (!body.assignee_name) return alert('대상자를 입력하세요.');
      try {
        await API.post(`/asset-mgmt/assets/${asset.id}/checkout`, body);
        closeModal(); openDetail(asset.id);
      } catch (err) { alert(err.message); }
    };
  }

  // ═══════════════════════════════════════════════════════
  // 반납 모달
  // ═══════════════════════════════════════════════════════

  function openCheckinModal(asset) {
    openModal(`
      <div class="modal-header"><h3>자산 반납 — ${asset.asset_tag}</h3><button class="modal-close">&times;</button></div>
      <div class="modal-body">
        <form id="am-checkin-form">
          <div class="form-group"><label>반납 상태</label>
            <select class="form-input" name="return_condition">
              <option value="good">양호</option><option value="damaged">손상</option><option value="needs_repair">수리 필요</option>
            </select>
          </div>
          <div class="form-group"><label>반납 비고</label>
            <textarea class="form-input" name="return_note" rows="2"></textarea>
          </div>
        </form>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost modal-close">취소</button>
        <button class="btn btn-primary" id="am-do-checkin">반납 실행</button>
      </div>
    `);
    document.querySelectorAll('.modal-close').forEach(b => b.onclick = closeModal);
    document.getElementById('am-do-checkin').onclick = async () => {
      const fd = new FormData(document.getElementById('am-checkin-form'));
      const body = Object.fromEntries(fd.entries());
      try {
        await API.post(`/asset-mgmt/assets/${asset.id}/checkin`, body);
        closeModal(); openDetail(asset.id);
      } catch (err) { alert(err.message); }
    };
  }

  // ═══════════════════════════════════════════════════════
  // 수리 등록 모달
  // ═══════════════════════════════════════════════════════

  function openMaintenanceForm(asset) {
    const today = new Date().toISOString().slice(0, 10);
    openModal(`
      <div class="modal-header"><h3>수리 등록 — ${asset.asset_tag}</h3><button class="modal-close">&times;</button></div>
      <div class="modal-body">
        <form id="am-maint-form">
          <div class="form-group"><label>유형</label>
            <select class="form-input" name="type">
              <option value="repair">수리</option><option value="preventive">예방정비</option>
              <option value="inspection">점검</option><option value="upgrade">업그레이드</option>
            </select>
          </div>
          <div class="form-group"><label>제목 *</label><input type="text" class="form-input" name="title" required></div>
          <div class="form-group"><label>시작일 *</label><input type="date" class="form-input" name="start_date" value="${today}" required></div>
          <div class="form-group"><label>종료일</label><input type="date" class="form-input" name="end_date"></div>
          <div class="form-group"><label>비용</label><input type="number" class="form-input" name="cost" value="0" min="0"></div>
          <div class="form-group"><label>상태</label>
            <select class="form-input" name="status">
              <option value="scheduled">예정</option><option value="in_progress">진행중</option>
            </select>
          </div>
          <div class="form-group"><label>작업자</label><input type="text" class="form-input" name="performed_by"></div>
          <div class="form-group"><label>비고</label><textarea class="form-input" name="notes" rows="2"></textarea></div>
        </form>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost modal-close">취소</button>
        <button class="btn btn-primary" id="am-do-maint">등록</button>
      </div>
    `);
    document.querySelectorAll('.modal-close').forEach(b => b.onclick = closeModal);
    document.getElementById('am-do-maint').onclick = async () => {
      const fd = new FormData(document.getElementById('am-maint-form'));
      const body = Object.fromEntries(fd.entries());
      body.cost = parseFloat(body.cost) || 0;
      try {
        await API.post(`/asset-mgmt/assets/${asset.id}/maintenance`, body);
        closeModal(); openDetail(asset.id);
      } catch (err) { alert(err.message); }
    };
  }

  // ═══════════════════════════════════════════════════════
  // 폐기 모달
  // ═══════════════════════════════════════════════════════

  function openDisposeModal(asset) {
    openModal(`
      <div class="modal-header"><h3>자산 폐기 — ${asset.asset_tag}</h3><button class="modal-close">&times;</button></div>
      <div class="modal-body">
        <p style="margin-bottom:12px;color:var(--text-muted)">폐기 시 자산 상태가 복구 불가합니다. 계속하시겠습니까?</p>
        <form id="am-dispose-form">
          <div class="form-group"><label>처분 유형 *</label>
            <select class="form-input" name="disposal_type" required>
              <option value="sale">매각</option><option value="scrap">폐기</option>
              <option value="donate">기증</option><option value="transfer">양도</option>
            </select>
          </div>
          <div class="form-group"><label>처분 금액</label><input type="number" class="form-input" name="disposal_value" value="0"></div>
          <div class="form-group"><label>사유</label><textarea class="form-input" name="reason" rows="2"></textarea></div>
        </form>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost modal-close">취소</button>
        <button class="btn btn-danger" id="am-do-dispose">폐기 실행</button>
      </div>
    `);
    document.querySelectorAll('.modal-close').forEach(b => b.onclick = closeModal);
    document.getElementById('am-do-dispose').onclick = async () => {
      const fd = new FormData(document.getElementById('am-dispose-form'));
      const body = Object.fromEntries(fd.entries());
      body.disposal_value = parseFloat(body.disposal_value) || 0;
      try {
        await API.post(`/asset-mgmt/assets/${asset.id}/dispose`, body);
        closeModal(); renderList();
      } catch (err) { alert(err.message); }
    };
  }

  // ═══════════════════════════════════════════════════════
  // 대시보드 탭
  // ═══════════════════════════════════════════════════════

  async function renderDashboard() {
    const el = document.getElementById('am-content');
    let d = {};
    try { d = await API.get('/asset-mgmt/dashboard'); } catch { }

    el.innerHTML = `
      <div class="kpi-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:24px">
        <div class="kpi-card"><div class="kpi-value">${d.total||0}</div><div class="kpi-label">총 자산</div></div>
        <div class="kpi-card"><div class="kpi-value">${d.assigned||0}</div><div class="kpi-label">할당</div></div>
        <div class="kpi-card"><div class="kpi-value">${d.maintenance||0}</div><div class="kpi-label">정비중</div></div>
        <div class="kpi-card"><div class="kpi-value">${d.deptDone||0}</div><div class="kpi-label">상각 완료</div></div>
        <div class="kpi-card"><div class="kpi-value">${fmt(d.totalCost)}</div><div class="kpi-label">총 취득원가 (원)</div></div>
        <div class="kpi-card"><div class="kpi-value">${fmt(d.totalBook)}</div><div class="kpi-label">총 장부금액 (원)</div></div>
      </div>
      ${(d.expiring||[]).length > 0 ? `
        <h4 style="margin-bottom:8px">보증 만료 임박 (30일 이내)</h4>
        <table class="data-table"><thead><tr><th>자산태그</th><th>명칭</th><th>만료일</th></tr></thead>
        <tbody>${(d.expiring||[]).map(e => `<tr><td class="mono">${e.asset_tag}</td><td>${e.name}</td><td class="text-warning">${e.warranty_end}</td></tr>`).join('')}</tbody></table>
      ` : ''}
    `;
  }

  // ═══════════════════════════════════════════════════════
  // 감가상각 탭
  // ═══════════════════════════════════════════════════════

  async function renderDepreciation() {
    const el = document.getElementById('am-content');
    let summary = [];
    try { summary = await API.get('/asset-mgmt/depreciation/summary'); } catch { }

    const now = new Date();
    const currentPeriod = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;

    el.innerHTML = `
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:16px">
        <input type="month" class="form-input" id="am-dept-period" value="${currentPeriod}" style="width:180px">
        <button class="btn btn-primary" id="am-run-dept">상각 실행</button>
      </div>
      <table class="data-table">
        <thead><tr><th>카테고리</th><th>유형</th><th>자산수</th><th>총 취득원가</th><th>총 장부금액</th><th>총 상각액</th></tr></thead>
        <tbody>${(summary||[]).map(s => `<tr>
          <td>${s.category_name}</td>
          <td><span class="badge ${s.asset_type==='it'?'badge-info':'badge-accent'}">${s.asset_type==='it'?'IT':'일반'}</span></td>
          <td>${s.asset_count}</td>
          <td class="mono">${fmt(s.total_cost)}</td>
          <td class="mono">${fmt(s.total_book)}</td>
          <td class="mono">${fmt(s.total_dept)}</td>
        </tr>`).join('') || '<tr><td colspan="6" style="text-align:center;color:var(--text-muted)">데이터가 없습니다.</td></tr>'}</tbody>
      </table>
    `;

    document.getElementById('am-run-dept').onclick = async () => {
      const period = document.getElementById('am-dept-period').value;
      if (!period) return alert('기간을 선택하세요.');
      if (!confirm(`${period} 감가상각을 실행하시겠습니까?`)) return;
      try {
        const r = await API.post('/asset-mgmt/depreciation/run', { period });
        alert(`${r.processed}건 처리 완료, ${r.skipped}건 스킵`);
        renderDepreciation();
      } catch (err) { alert(err.message); }
    };
  }

  // ═══════════════════════════════════════════════════════
  // 카테고리 관리 탭
  // ═══════════════════════════════════════════════════════

  async function renderCategories() {
    const el = document.getElementById('am-content');
    el.innerHTML = `
      <div style="margin-bottom:12px"><button class="btn btn-primary" id="am-add-cat">+ 카테고리 추가</button></div>
      <table class="data-table">
        <thead><tr><th>ID</th><th>명칭</th><th>상위</th><th>유형</th><th>상각법</th><th>내용연수</th><th>잔존가치율</th></tr></thead>
        <tbody>${(_categories||[]).map(c => `<tr>
          <td>${c.id}</td><td>${c.name}</td><td>${c.parent_name||'-'}</td>
          <td><span class="badge ${c.asset_type==='it'?'badge-info':'badge-accent'}">${c.asset_type==='it'?'IT':'일반'}</span></td>
          <td>${c.dept_method==='straight'?'정액법':'정률법'}</td>
          <td>${c.useful_life}년</td><td>${Math.round(c.residual_rate*100)}%</td>
        </tr>`).join('')}</tbody>
      </table>
    `;

    document.getElementById('am-add-cat').onclick = () => openCategoryForm();
  }

  async function openCategoryForm(cat = null) {
    const isEdit = !!cat;
    const topLevel = (_categories||[]).filter(c => !c.parent_id);
    openModal(`
      <div class="modal-header"><h3>${isEdit?'카테고리 수정':'카테고리 추가'}</h3><button class="modal-close">&times;</button></div>
      <div class="modal-body">
        <form id="am-cat-form">
          <div class="form-group"><label>명칭 *</label><input type="text" class="form-input" name="name" value="${cat?.name||''}" required></div>
          <div class="form-group"><label>상위 카테고리</label>
            <select class="form-input" name="parent_id"><option value="">없음 (최상위)</option>
              ${topLevel.filter(c => c.id !== cat?.id).map(c => `<option value="${c.id}" ${cat?.parent_id==c.id?'selected':''}>${c.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group"><label>자산 유형</label>
            <select class="form-input" name="asset_type">
              <option value="it" ${cat?.asset_type==='it'?'selected':''}>IT</option>
              <option value="general" ${(!cat||cat.asset_type==='general')?'selected':''}>일반</option>
            </select>
          </div>
          <div class="form-group"><label>감가상각 방법</label>
            <select class="form-input" name="dept_method">
              <option value="straight" ${(!cat||cat.dept_method==='straight')?'selected':''}>정액법</option>
              <option value="declining" ${cat?.dept_method==='declining'?'selected':''}>정률법</option>
            </select>
          </div>
          <div class="form-group"><label>내용연수 (년)</label><input type="number" class="form-input" name="useful_life" value="${cat?.useful_life||5}" min="1"></div>
          <div class="form-group"><label>잔존가치율 (%)</label><input type="number" class="form-input" name="residual_rate_pct" value="${Math.round((cat?.residual_rate||0.1)*100)}" min="0" max="100"></div>
        </form>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost modal-close">취소</button>
        <button class="btn btn-primary" id="am-save-cat">${isEdit?'수정':'추가'}</button>
      </div>
    `);
    document.querySelectorAll('.modal-close').forEach(b => b.onclick = closeModal);
    document.getElementById('am-save-cat').onclick = async () => {
      const fd = new FormData(document.getElementById('am-cat-form'));
      const body = Object.fromEntries(fd.entries());
      body.residual_rate = (parseFloat(body.residual_rate_pct) || 10) / 100;
      delete body.residual_rate_pct;
      if (!body.parent_id) body.parent_id = null;
      body.useful_life = parseInt(body.useful_life) || 5;
      try {
        if (isEdit) await API.put(`/asset-mgmt/categories/${cat.id}`, body);
        else await API.post('/asset-mgmt/categories', body);
        closeModal();
        await loadCategories();
        renderCategories();
      } catch (err) { alert(err.message); }
    };
  }

  // ═══════════════════════════════════════════════════════
  // 위치 관리 탭
  // ═══════════════════════════════════════════════════════

  function renderLocations() {
    const el = document.getElementById('am-content');
    el.innerHTML = `
      <div style="margin-bottom:12px"><button class="btn btn-primary" id="am-add-loc">+ 위치 추가</button></div>
      <table class="data-table">
        <thead><tr><th>ID</th><th>명칭</th><th>건물</th><th>층</th><th>호수</th></tr></thead>
        <tbody>${(_locations||[]).map(l => `<tr>
          <td>${l.id}</td><td>${l.name}</td><td>${l.building||'-'}</td><td>${l.floor||'-'}</td><td>${l.room||'-'}</td>
        </tr>`).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">등록된 위치가 없습니다.</td></tr>'}</tbody>
      </table>
    `;

    document.getElementById('am-add-loc').onclick = () => openLocationForm();
  }

  function openLocationForm(loc = null) {
    const isEdit = !!loc;
    openModal(`
      <div class="modal-header"><h3>${isEdit?'위치 수정':'위치 추가'}</h3><button class="modal-close">&times;</button></div>
      <div class="modal-body">
        <form id="am-loc-form">
          <div class="form-group"><label>명칭 *</label><input type="text" class="form-input" name="name" value="${loc?.name||''}" required></div>
          <div class="form-group"><label>건물</label><input type="text" class="form-input" name="building" value="${loc?.building||''}"></div>
          <div class="form-group"><label>층</label><input type="text" class="form-input" name="floor" value="${loc?.floor||''}"></div>
          <div class="form-group"><label>호수</label><input type="text" class="form-input" name="room" value="${loc?.room||''}"></div>
        </form>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost modal-close">취소</button>
        <button class="btn btn-primary" id="am-save-loc">${isEdit?'수정':'추가'}</button>
      </div>
    `);
    document.querySelectorAll('.modal-close').forEach(b => b.onclick = closeModal);
    document.getElementById('am-save-loc').onclick = async () => {
      const fd = new FormData(document.getElementById('am-loc-form'));
      const body = Object.fromEntries(fd.entries());
      if (!body.name) return alert('명칭을 입력하세요.');
      try {
        if (isEdit) await API.put(`/asset-mgmt/locations/${loc.id}`, body);
        else await API.post('/asset-mgmt/locations', body);
        closeModal();
        await loadLocations();
        renderLocations();
      } catch (err) { alert(err.message); }
    };
  }

  function init() { }
  function reset() { _filters = { search: '', status: '', category_id: '', department: '', asset_type: '' }; _tab = 'list'; }

  return { render, init, reset };
})();

window.AssetManagement = AssetManagement;
