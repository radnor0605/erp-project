/* ─── Materials Module ─── */
const Materials = (() => {
  let _data = [];
  let _search = '', _category = '', _quickFilter = '';

  async function reset() {
    _search = ''; _category = ''; _quickFilter = '';
  }

  async function render() {
    const container = document.getElementById('page-container');
    container.innerHTML = `
      <div class="animate-fade">
        <div class="page-header">
          <div>
            <h2 class="page-title">품목 마스터</h2>
            <p class="page-subtitle">품목 코드, 안전재고, MOQ, 이동평균단가 관리</p>
          </div>
          <button class="btn btn-secondary" id="mat-po-btn">
            <svg viewBox="0 0 20 20" fill="currentColor"><path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"/></svg>
            발주 권고 관리
          </button>
          <button class="btn btn-secondary" id="mat-upload-btn">
            <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 11-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clip-rule="evenodd"/></svg>
            일괄 업로드
          </button>
          <button class="btn btn-primary" id="mat-add-btn">
            <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd"/></svg>
            품목 등록
          </button>
        </div>
        <div class="filter-bar">
          <div class="search-input" style="max-width:280px">
            <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd"/></svg>
            <input type="text" id="mat-search" placeholder="코드 또는 품목명 검색..." value="${_search}">
          </div>
          <select id="mat-cat" style="width:140px">
            <option value="">전체 구분</option>
            ${['원료','부자재','장비','소모품','상품','디지털(자체)','디지털(외부)','기타'].map(c=>`<option value="${c}" ${_category===c?'selected':''}>${c}</option>`).join('')}
          </select>
          <button class="btn btn-secondary" id="mat-reload">새로고침</button>
        </div>
        <div class="quick-filters" id="mat-quick-filters">
          <span class="filter-chip ${_quickFilter===''?'active':''}" data-qf="">전체</span>
          <span class="filter-chip ${_quickFilter==='no_price'?'active':''}" data-qf="no_price">💰 단가 미설정</span>
          <span class="filter-chip ${_quickFilter==='low_stock'?'active':''}" data-qf="low_stock">⚠️ 재고 부족</span>
          <span class="filter-chip ${_quickFilter==='no_image'?'active':''}" data-qf="no_image">🖼 이미지 없음</span>
        </div>
        <div class="table-container" id="mat-table-wrap">${loadingHTML()}</div>
      </div>
    `;

    document.getElementById('mat-add-btn').onclick = () => openForm();
    document.getElementById('mat-upload-btn').onclick = () => showUploadModal('materials', () => Router.navigate('materials'));
    document.getElementById('mat-po-btn').onclick = () => SCM.showReorderPoints();
    document.getElementById('mat-reload').onclick = () => loadData();
    document.getElementById('mat-search').oninput = (e) => { _search = e.target.value; loadData(); };
    document.getElementById('mat-cat').onchange = (e) => { _category = e.target.value; loadData(); };
    document.getElementById('mat-quick-filters').onclick = (e) => {
      const chip = e.target.closest('.filter-chip');
      if (!chip) return;
      _quickFilter = chip.dataset.qf;
      document.querySelectorAll('#mat-quick-filters .filter-chip').forEach(c => c.classList.toggle('active', c.dataset.qf === _quickFilter));
      renderTable();
    };
    await loadData();
  }

  async function loadData() {
    const wrap = document.getElementById('mat-table-wrap');
    if (!wrap) return;
    try {
      const params = new URLSearchParams();
      if (_search) params.set('search', _search);
      if (_category) params.set('category', _category);
      _data = await API.get('/materials?' + params.toString());
      renderTable();
    } catch (err) {
      wrap.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
    }
  }

  function applyQuickFilter(data) {
    if (_quickFilter === 'no_price') return data.filter(m => !m.avg_price || m.avg_price === 0);
    if (_quickFilter === 'low_stock') return data.filter(m => m.is_digital !== 1 && m.available_qty < m.safety_stock);
    if (_quickFilter === 'no_image') return data.filter(m => !m.thumbnail);
    return data;
  }

  function renderTable() {
    const wrap = document.getElementById('mat-table-wrap');
    if (!wrap) return;
    const filtered = applyQuickFilter(_data);
    if (!filtered.length) { wrap.innerHTML = emptyHTML('해당 조건의 품목이 없습니다'); return; }

    const catColors = { '원료':'badge-primary','부자재':'badge-info','장비':'badge-warning','소모품':'badge-success','상품':'badge-accent','디지털(자체)':'badge-digital','디지털(외부)':'badge-digital-ext','기타':'badge-ghost' };

    wrap.innerHTML = `<div style="overflow-x:auto"><table>
      <thead><tr>
        <th style="width:48px">이미지</th>
        <th>품목코드</th>
        <th>품목명</th>
        <th>구분</th>
        <th class="num">가용재고</th>
        <th class="num">이동평균단가</th>
        <th>상태</th>
        <th style="width:80px"></th>
      </tr></thead>
      <tbody>${filtered.map(m => {
        const isSelfDigital = m.is_digital === 1;
        const isBelowSafety = !isSelfDigital && m.available_qty < m.safety_stock;
        const noPrice = !m.avg_price || m.avg_price === 0;
        const qtyDisplay = isSelfDigital
          ? `<span style="color:var(--text-muted)">N/A</span>`
          : `${formatNumber(m.available_qty,2)} ${m.unit}`;
        const statusBadge = isSelfDigital
          ? '<span class="badge badge-digital" style="font-size:0.7rem">무한재고</span>'
          : isBelowSafety ? '<span class="badge badge-danger">⚠ 발주필요</span>' : '<span class="badge badge-success">정상</span>';
        return `<tr style="cursor:pointer" onclick="Materials.openDrawer('${m.code}')">
          <td onclick="event.stopPropagation()">
            ${m.thumbnail ? `<img src="${m.thumbnail}" style="width:36px;height:36px;object-fit:cover;border-radius:6px;border:1px solid var(--border)">` : `<div style="width:36px;height:36px;background:var(--bg-glass);border-radius:6px;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:0.55rem;text-align:center">No<br>Img</div>`}
          </td>
          <td><span class="mono" style="color:var(--primary-light);font-size:0.8rem">${m.code}</span></td>
          <td><div style="font-weight:600">${m.name}</div>${m.vendor_product_name?`<div style="font-size:0.7rem;color:var(--text-muted)">업체: ${m.vendor_product_name}</div>`:''}</td>
          <td><span class="badge ${catColors[m.category]||'badge-ghost'}">${m.category}</span></td>
          <td class="num ${isBelowSafety?'num-negative':''}">${qtyDisplay}</td>
          <td class="num" style="color:${noPrice?'var(--text-muted)':'var(--secondary)'}">${noPrice?'<span style="color:var(--warning)">미설정</span>':formatCurrency(m.avg_price)}</td>
          <td>${statusBadge}</td>
          <td class="table-actions" onclick="event.stopPropagation()">
            <button class="btn btn-xs btn-secondary" onclick="Materials.openForm('${m.code}')">수정</button>
            <button class="btn btn-xs btn-danger" onclick="Materials.delete('${m.code}','${m.name}')">삭제</button>
          </td>
        </tr>`;
      }).join('')}
      </tbody>
    </table></div>`;
  }

  function openDrawer(code) {
    const m = _data.find(x => x.code === code);
    if (!m) return;
    const isSelfDigital = m.is_digital === 1;
    const isBelowSafety = !isSelfDigital && m.available_qty < m.safety_stock;
    const catColors = { '원료':'badge-primary','부자재':'badge-info','장비':'badge-warning','소모품':'badge-success','상품':'badge-accent','디지털(자체)':'badge-digital','디지털(외부)':'badge-digital-ext','기타':'badge-ghost' };

    // Remove existing drawer
    document.getElementById('mat-drawer-overlay')?.remove();

    const el = document.createElement('div');
    el.id = 'mat-drawer-overlay';
    el.className = 'drawer-overlay';
    el.innerHTML = `
      <div class="drawer-panel">
        <div class="drawer-header">
          <div>
            <div style="font-weight:700;font-size:1rem">${m.name}</div>
            <div class="mono" style="font-size:0.75rem;color:var(--text-muted)">${m.code}</div>
          </div>
          <div style="display:flex;gap:8px;align-items:center">
            <button class="btn btn-sm btn-secondary" onclick="Materials.openForm('${m.code}')">수정</button>
            <button class="btn btn-sm" id="drawer-close-btn" style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:1.2rem">✕</button>
          </div>
        </div>
        <div class="drawer-body">
          ${m.thumbnail ? `<img src="${m.thumbnail}" style="width:100%;height:160px;object-fit:contain;border-radius:var(--radius-md);border:1px solid var(--border);margin-bottom:20px;background:var(--bg-glass)">` : ''}
          <div class="drawer-section">
            <div class="drawer-section-title">기본 정보</div>
            <div class="drawer-kv">
              <div class="drawer-kv-item"><div class="drawer-kv-label">구분</div><div class="drawer-kv-value"><span class="badge ${catColors[m.category]||'badge-ghost'}">${m.category}</span></div></div>
              <div class="drawer-kv-item"><div class="drawer-kv-label">단위</div><div class="drawer-kv-value">${m.unit}</div></div>
              <div class="drawer-kv-item"><div class="drawer-kv-label">규격</div><div class="drawer-kv-value">${m.spec||'-'}</div></div>
              <div class="drawer-kv-item"><div class="drawer-kv-label">MPN</div><div class="drawer-kv-value mono" style="font-size:0.8rem">${m.mpn||'-'}</div></div>
              ${m.vendor_product_name?`<div class="drawer-kv-item" style="grid-column:1/-1"><div class="drawer-kv-label">업체 품명</div><div class="drawer-kv-value">${m.vendor_product_name}</div></div>`:''}
            </div>
          </div>
          <div class="drawer-section">
            <div class="drawer-section-title">재고 현황</div>
            <div class="drawer-kv">
              <div class="drawer-kv-item"><div class="drawer-kv-label">가용재고</div><div class="drawer-kv-value" style="color:${isSelfDigital?'var(--text-muted)':isBelowSafety?'var(--danger)':'var(--success)'}">${isSelfDigital?'N/A':formatNumber(m.available_qty,2)+' '+m.unit}</div></div>
              <div class="drawer-kv-item"><div class="drawer-kv-label">검수재고</div><div class="drawer-kv-value">${isSelfDigital?'N/A':formatNumber(m.inspection_qty,2)+' '+m.unit}</div></div>
              <div class="drawer-kv-item"><div class="drawer-kv-label">안전재고</div><div class="drawer-kv-value">${isSelfDigital?'N/A':formatNumber(m.safety_stock,0)+' '+m.unit}</div></div>
              <div class="drawer-kv-item"><div class="drawer-kv-label">상태</div><div class="drawer-kv-value">${isSelfDigital?'<span class="badge badge-digital" style="font-size:0.7rem">무한재고</span>':isBelowSafety?'<span class="badge badge-danger">⚠ 발주필요</span>':'<span class="badge badge-success">정상</span>'}</div></div>
            </div>
          </div>
          <div class="drawer-section">
            <div class="drawer-section-title">단가 / 구매 정보</div>
            <div class="drawer-kv">
              <div class="drawer-kv-item"><div class="drawer-kv-label">이동평균단가</div><div class="drawer-kv-value" style="color:var(--secondary)">${formatCurrency(m.avg_price)}</div></div>
              <div class="drawer-kv-item"><div class="drawer-kv-label">기준단가</div><div class="drawer-kv-value">${(m.standard_unit_price||m.standard_price)?formatCurrency(m.standard_unit_price||m.standard_price):'-'}</div></div>
              <div class="drawer-kv-item"><div class="drawer-kv-label">최근매입단가</div><div class="drawer-kv-value">${m.last_purchase_price?formatCurrency(m.last_purchase_price):'-'}</div></div>
              <div class="drawer-kv-item"><div class="drawer-kv-label">통화</div><div class="drawer-kv-value">${m.currency||'KRW'}</div></div>
              <div class="drawer-kv-item"><div class="drawer-kv-label">MOQ</div><div class="drawer-kv-value">${formatNumber(m.moq,0)}</div></div>
              <div class="drawer-kv-item"><div class="drawer-kv-label">구매단위</div><div class="drawer-kv-value">${formatNumber(m.purchase_unit,0)}</div></div>
              <div class="drawer-kv-item"><div class="drawer-kv-label">리드타임</div><div class="drawer-kv-value">${m.lead_time}일</div></div>
              <div class="drawer-kv-item"><div class="drawer-kv-label">재고금액</div><div class="drawer-kv-value">${formatCurrency(m.available_qty * m.avg_price)}</div></div>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(el);
    el.addEventListener('click', (e) => { if (e.target === el) el.remove(); });
    el.querySelector('#drawer-close-btn').onclick = () => el.remove();
  }

  async function openForm(code = null) {
    let mat = {};
    const partners = await API.get('/partners?type=vendor');
    if (code) { try { mat = await API.get(`/materials/${code}`); } catch {} }

    const isEdit = !!code;
    const html = `
      <div class="modal-header">
        <div class="modal-title">${isEdit ? '품목 수정' : '품목 등록'}</div>
        <button class="modal-close"><svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg></button>
      </div>
      <div class="modal-body">
        <form id="material-form" class="form-grid">
          <div class="form-group"><label>품목코드 <span class="required">*</span></label>
            <input name="code" id="f-code" value="${mat.code||''}" placeholder="예: RM-ST-001" ${isEdit?'readonly':''}>
          </div>
          <div class="form-group"><label>구분 <span class="required">*</span></label>
            <select name="category" id="f-cat">
              ${['원료','부자재','장비','소모품','상품','디지털(자체)','디지털(외부)','기타'].map(c=>`<option value="${c}" ${mat.category===c?'selected':''}>${c}</option>`).join('')}
            </select>
          </div>
          <div class="form-group" style="grid-column:1/-1"><label>품목명 <span class="required">*</span></label>
            <input name="name" id="f-name" value="${mat.name||''}" placeholder="품목명">
          </div>
          <div class="form-group"><label>제조사형번(MPN)</label><input name="mpn" id="f-mpn" value="${mat.mpn||''}" placeholder="예: MPN-123"></div>
          <div class="form-group"><label>규격</label><input name="spec" id="f-spec" value="${mat.spec||''}" placeholder="예: SUS304 2T"></div>
          <div class="form-group"><label>단위 <span class="required">*</span></label>
            <select name="unit" id="f-unit">
              ${['EA','KG','L','M','BOX','SET'].map(u=>`<option value="${u}" ${mat.unit===u?'selected':''}>${u}</option>`).join('')}
            </select>
          </div>
          <div class="form-group"><label>안전재고</label><input type="number" name="safety_stock" id="f-safety" value="${mat.safety_stock||0}" min="0"></div>
          <div class="form-group"><label>리드타임 (일)</label><input type="number" name="lead_time" id="f-lead" value="${mat.lead_time||0}" min="0"></div>
          <div class="form-group"><label>기준단가 <span class="required">*</span></label><input type="number" name="standard_unit_price" id="f-std-price" value="${mat.standard_unit_price||mat.standard_price||''}" min="0" placeholder="0" required></div>
          <div class="form-group"><label>MOQ (최소발주수량)</label><input type="number" name="moq" id="f-moq" value="${mat.moq||1}" min="0" step="0.01"></div>
          <div class="form-group"><label>구매단위</label><input type="number" name="purchase_unit" id="f-punit" value="${mat.purchase_unit||1}" min="0" step="0.01"></div>
          <div class="form-group" style="grid-column:1/-1"><label>주매입처 (Preferred Vendor)</label>
            <select name="preferred_partner_code" id="f-partner">
              <option value="">- 선택 안함 -</option>
              ${partners.map(p => `<option value="${p.code}" ${mat.preferred_partner_code===p.code?'selected':''}>${p.name} (${p.code})</option>`).join('')}
            </select>
          </div>
          <div class="form-group" style="grid-column:1/-1"><label>이미지 URL (Thumbnail)</label>
            <input name="thumbnail" id="f-thumb" value="${mat.thumbnail||''}" placeholder="https://example.com/image.jpg">
          </div>
          <div class="form-group" style="grid-column:1/-1">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
              <input type="checkbox" name="skip_qa" id="f-skip-qa" value="1" ${mat.skip_qa?'checked':''}>
              <span><strong>무검사 품목 (Skip QA)</strong> <span style="font-size:0.75rem;color:var(--text-muted)">— 입고 확정 시 검수 단계 없이 즉시 가용재고 산입</span></span>
            </label>
          </div>
        </div>
        ${isEdit ? `<div class="alert alert-info" style="margin-top:16px">
          <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/></svg>
          이동평균단가: <strong>${formatCurrency(mat.avg_price)}</strong> (입고 시 자동 갱신됩니다)
        </div>` : ''}
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal()">취소</button>
        <button class="btn btn-primary" id="mat-save-btn">${isEdit ? '수정 완료' : '등록'}</button>
      </div>
    `;
    openModal(html, 'modal-wide', { persistent: true });
    const form = document.getElementById('material-form');
    if (!isEdit) FormPersistence.bind('mat-add', form);

    document.getElementById('mat-save-btn').onclick = async () => {
      const code = document.getElementById('f-code').value.trim();
      const stdPrice = parseFloat(document.getElementById('f-std-price').value);
      if (!code) return showToast('품목코드를 입력하세요.', 'error');
      if (isNaN(stdPrice) || document.getElementById('f-std-price').value === '') return showToast('기준단가를 입력하세요.', 'error');
      if (stdPrice < 0) return showToast('기준단가는 0 이상이어야 합니다.', 'error');

      const body = {
        code,
        name: document.getElementById('f-name').value.trim(),
        category: document.getElementById('f-cat').value,
        spec: document.getElementById('f-spec').value.trim(),
        unit: document.getElementById('f-unit').value,
        safety_stock: parseFloat(document.getElementById('f-safety').value) || 0,
        lead_time: parseInt(document.getElementById('f-lead').value) || 0,
        standard_unit_price: parseFloat(document.getElementById('f-std-price').value) || 0,
        moq: parseFloat(document.getElementById('f-moq').value) || 1,
        purchase_unit: parseFloat(document.getElementById('f-punit').value) || 1,
        mpn: document.getElementById('f-mpn').value.trim(),
        preferred_partner_code: document.getElementById('f-partner').value || null,
        thumbnail: document.getElementById('f-thumb').value.trim() || null,
        skip_qa: document.getElementById('f-skip-qa')?.checked ? 1 : 0,
      };
      try {
        if (isEdit) { await API.put(`/materials/${code}`, body); showToast('품목이 수정되었습니다.', 'success'); }
        else { 
          await API.post('/materials', body); 
          FormPersistence.clear('mat-add');
          showToast('품목이 등록되었습니다.', 'success'); 
        }
        closeModal();
        await loadData();
      } catch (err) { showToast(err.message, 'error'); }
    };
  }

  // PO Manager Logic
  async function openPOManager() {
    const reorders = await API.get('/materials/dashboard/reorder-all');
    const html = `
      <div class="modal-header">
        <div class="modal-title">발주 권고 관리</div>
        <button class="modal-close"><svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg></button>
      </div>
      <div class="modal-body po-manager">
        <div class="alert alert-info" style="margin-bottom:16px">
          안전재고 미달 품목에 대해 <strong>MOQ 및 구매단위</strong>를 반영한 발주 권고 리스트입니다.
        </div>
        <div class="table-container">
          <table id="po-table">
            <thead><tr>
              <th style="width:40px"><input type="checkbox" id="po-all" checked></th>
              <th>품목</th><th>구분</th><th>현재고</th><th>안전재고</th><th>권고발주량</th><th>단가(예상)</th>
            </tr></thead>
            <tbody>${reorders.map((r, i) => `
              <tr data-idx="${i}">
                <td><input type="checkbox" class="po-check" checked data-code="${r.code}"></td>
                <td><div style="font-weight:600">${r.name}</div><div class="mono" style="font-size:0.7rem;color:var(--text-muted)">${r.code}</div></td>
                <td><span class="badge badge-ghost">${r.category}</span></td>
                <td class="num num-negative">${formatNumber(r.available_qty)}</td>
                <td class="num">${formatNumber(r.safety_stock)}</td>
                <td>
                  <input type="number" class="po-qty-input" value="${r.recommended_qty}" step="${r.purchase_unit}" min="0" 
                    data-punit="${r.purchase_unit}" data-moq="${r.moq}">
                </td>
                <td class="num">${formatCurrency(r.avg_price)}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal()">취소</button>
        <button class="btn btn-primary" id="po-preview-btn">발주서 미리보기</button>
      </div>
    `;
    openModal(html, 'max-width:900px');

    document.getElementById('po-all').onchange = (e) => {
      document.querySelectorAll('.po-check').forEach(c => c.checked = e.target.checked);
    };

    // Auto-rounding logic
    document.querySelectorAll('.po-qty-input').forEach(input => {
      input.onblur = (e) => {
        const punit = parseFloat(e.target.dataset.punit);
        const moq = parseFloat(e.target.dataset.moq);
        let val = parseFloat(e.target.value);
        
        if (isNaN(val) || val <= 0) val = 0;
        else {
          // Check if it's a multiple of punit
          if (val > 0 && val < moq) {
            val = moq;
            showToast(`최소 발주 수량(${moq}) 미만으로 자동 조정되었습니다.`, 'info');
          }
          if (val % punit !== 0) {
            const rounded = Math.ceil(val / punit) * punit;
            showToast(`구매 단위(${punit})의 배수로 자동 올림 처리되었습니다: ${val} → ${rounded}`, 'info');
            val = rounded;
          }
        }
        e.target.value = val;
      };
    });

    document.getElementById('po-preview-btn').onclick = () => {
      const selected = [];
      document.querySelectorAll('.po-check:checked').forEach(c => {
        const row = c.closest('tr');
        const idx = row.dataset.idx;
        const qty = parseFloat(row.querySelector('.po-qty-input').value);
        if (qty > 0) {
          selected.push({ ...reorders[idx], po_qty: qty });
        }
      });
      if (selected.length === 0) return showToast('선택된 품목이 없습니다.', 'warn');
      openPOPreview(selected);
    };
  }

  function openPOPreview(items) {
    const vendorCodes = [...new Set(items.map(i => i.vendor_code || 'V-TBD'))];
    const today = new Date().toLocaleDateString('ko-KR', {year:'numeric',month:'long',day:'numeric'});
    
    const html = `
      <div class="modal-header no-print">
        <div class="modal-title">발주서 미리보기</div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-sm btn-secondary" onclick="window.print()">인쇄</button>
          <button class="modal-close"><svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg></button>
        </div>
      </div>
      <div class="modal-body po-preview-a4" id="po-print-area">
        <div class="po-document">
          <div class="po-title">주 문 서 (P/O)</div>
          <div class="po-header-meta">
            <div class="po-info-box">
              <div class="po-info-row"><span>발 주 번 호 :</span> <strong>PO-${Date.now().toString().slice(-8)}</strong></div>
              <div class="po-info-row"><span>발 주 일 자 :</span> <strong>${today}</strong></div>
              <div class="po-info-row"><span>수 신 (공급자):</span> <strong>${items[0].vendor_name || '협력업체'} 귀하</strong></div>
            </div>
            <div class="po-info-box">
              <div class="po-info-row"><span>발 신 (구매자):</span> <strong>Antigravity ERP</strong></div>
              <div class="po-info-row"><span>담 당 자 :</span> <strong>관리자 (02-123-4567)</strong></div>
              <div class="po-info-row"><span>납 기 장 소 :</span> <strong>본사 메인 창고</strong></div>
            </div>
          </div>
          <div class="po-table-wrap">
            <table class="po-table-a4">
              <thead><tr>
                <th>No</th><th>품명 및 규격</th><th>단위</th><th>수량</th><th>단가</th><th>금액</th><th>비고</th>
              </tr></thead>
              <tbody>${items.map((item, i) => `
                <tr>
                  <td style="text-align:center">${i+1}</td>
                  <td><strong>${item.name}</strong><br><small>${item.code} / ${item.spec||'-'}</small></td>
                  <td style="text-align:center">${item.unit}</td>
                  <td style="text-align:right">${formatNumber(item.po_qty)}</td>
                  <td style="text-align:right">${formatNumber(item.avg_price)}</td>
                  <td style="text-align:right">${formatNumber(item.po_qty * item.avg_price)}</td>
                  <td></td>
                </tr>`).join('')}
                <tr class="po-total-row">
                  <td colspan="3" style="text-align:center">합 계 (VAT 별도)</td>
                  <td style="text-align:right">${formatNumber(items.reduce((a,b)=>a+b.po_qty,0))}</td>
                  <td></td>
                  <td style="text-align:right;font-weight:700">${formatCurrency(items.reduce((a,b)=>a+(b.po_qty*b.avg_price),0))}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="po-footer">
            <div class="po-notes">
              <p>1. 상기 품목에 대하여 주문하오니 기일 내 납품 바랍니다.</p>
              <p>2. 기타 문의사항은 담당자에게 연락 바랍니다.</p>
            </div>
            <div class="po-sign">
              <span>(인)</span>
            </div>
          </div>
        </div>
      </div>
      <div class="modal-footer no-print">
        <button class="btn btn-secondary" onclick="Dashboard.exportCSV()">CSV 내보내기</button>
        <button class="btn btn-primary" onclick="showToast('발주가 확정되었습니다. (준비 중)', 'success'); closeModal();">발주 확정</button>
      </div>
    `;
    openModal(html, 'max-width:850px');
    
    // Simple CSV export logic
    Dashboard.exportCSV = () => {
      let csv = 'No,Item Code,Item Name,Unit,Qty,Price,Amount\n';
      items.forEach((it, i) => {
        csv += `${i+1},${it.code},${it.name},${it.unit},${it.po_qty},${it.avg_price},${it.po_qty*it.avg_price}\n`;
      });
      const blob = new Blob(["\ufeff"+csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `PO_${new Date().toISOString().slice(0,10)}.csv`;
      link.click();
    };
  }

  async function del(code, name) {
    confirmDialog(`<strong>${name}</strong> (${code}) 품목을 삭제하시겠습니까?<br>재고가 있는 경우 삭제되지 않습니다.`, async () => {
      try { await API.delete(`/materials/${code}`); showToast('삭제되었습니다.', 'success'); await loadData(); }
      catch (err) { showToast(err.message, 'error'); }
    });
  }

  return { render, openForm, openDrawer, delete: del, reset };
})();
window.Materials = Materials;
