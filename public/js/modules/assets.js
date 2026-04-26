/* ─── Assets (시리얼/자산) Module ─── */
const Assets = (() => {
  let _search = '';
  let _category = '';
  let _expiryFilter = false;

  const CATEGORY_OPTS = ['상품', '제품', '디지털(자체)', '디지털(외부)'];
  const CAT_COLORS = {
    '상품': 'badge-secondary',
    '제품': 'badge-primary',
    '디지털(자체)': 'badge-digital',
    '디지털(외부)': 'badge-digital-ext',
  };

  async function render(params = {}) {
    if (params.expiry_within_30) _expiryFilter = true;

    const container = document.getElementById('page-container');
    container.innerHTML = loadingHTML();

    const qs = new URLSearchParams();
    if (_search) qs.set('search', _search);
    if (_category) qs.set('category', _category);
    if (_expiryFilter) qs.set('expiry_within_30', '1');

    let assets = [];
    try {
      assets = await API.get(`/assets?${qs.toString()}`);
    } catch (err) {
      container.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
      return;
    }

    container.innerHTML = `
      <div class="animate-fade">
        <div class="page-header">
          <div>
            <h2 class="page-title">자산 (시리얼/SW) 관리</h2>
            <p class="page-subtitle">출고된 품목의 시리얼 번호 및 디지털 라이선스 키를 고객사별로 조회합니다.</p>
          </div>
          <div style="display:flex;gap:8px">
            <button class="btn btn-secondary" id="rma-search-btn">
              <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd"/></svg>
              RMA 조회
            </button>
            <button class="btn btn-primary" id="add-asset-btn">
              <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clip-rule="evenodd"/></svg>
              자산 등록
            </button>
          </div>
        </div>

        <div class="filter-bar">
          <div class="search-input" style="max-width:280px">
            <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd"/></svg>
            <input type="text" id="asset-search" placeholder="시리얼·라이선스 키·고객사·품목명..." value="${_search}">
          </div>
          <select id="asset-cat-filter" style="width:160px">
            <option value="">전체 구분</option>
            ${CATEGORY_OPTS.map(c => `<option value="${c}" ${_category === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
          <label style="display:flex;align-items:center;gap:6px;font-size:0.85rem;cursor:pointer">
            <input type="checkbox" id="expiry-30-filter" ${_expiryFilter ? 'checked' : ''}>
            <span>만료 30일 이내</span>
          </label>
        </div>

        <div class="table-container">
          ${assets.length ? `<div style="overflow-x:auto"><table>
            <thead><tr>
              <th>품목명</th>
              <th>구분</th>
              <th>시리얼 번호</th>
              <th>라이선스 키</th>
              <th>고객사</th>
              <th>출고일</th>
              <th>관련주문</th>
              <th>만료일</th>
              <th>상태</th>
              <th style="width:60px"></th>
            </tr></thead>
            <tbody>
              ${assets.map(a => {
                const near = isNearExpiry(a.expiry_date);
                const catBadge = CAT_COLORS[a.material_category] || 'badge-ghost';
                const isDigital = a.material_category === '디지털(자체)' || a.material_category === '디지털(외부)';
                const deliveryDay = a.delivery_date || a.order_date || '-';
                return `<tr style="${near ? 'background:rgba(239,68,68,0.05)' : ''}">
                  <td style="font-weight:600">${a.material_name || a.material_code}</td>
                  <td><span class="badge ${catBadge}" style="font-size:0.7rem">${a.material_category || '-'}</span></td>
                  <td class="mono" style="font-size:0.8rem">${a.serial_no || (isDigital ? '<span style="color:var(--text-muted)">-</span>' : '-')}</td>
                  <td class="mono" style="font-size:0.75rem;color:var(--primary-light)">${a.license_key || '-'}</td>
                  <td style="font-weight:600">${a.customer_name || '<span style="color:var(--text-muted)">-</span>'}</td>
                  <td>${deliveryDay !== '-' ? `<span style="font-size:0.82rem">${deliveryDay}</span>` : '-'}</td>
                  <td><span class="badge badge-ghost" style="font-size:0.72rem">${a.so_no || '-'}</span></td>
                  <td><span style="${near ? 'color:var(--danger);font-weight:700' : ''}">${a.expiry_date || '-'}</span></td>
                  <td><span class="badge ${a.status === 'active' ? 'badge-success' : 'badge-ghost'}" style="font-size:0.72rem">${a.status === 'active' ? '활성' : a.status}</span></td>
                  <td class="table-actions">
                    <button class="btn btn-xs btn-secondary edit-asset-btn" data-id="${a.id}">수정</button>
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
          </table></div>` : emptyHTML('조건에 맞는 자산이 없습니다')}
        </div>
      </div>
    `;
  }

  function init() {
    let timeout;
    document.getElementById('asset-search')?.addEventListener('input', (e) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => { _search = e.target.value; render(); }, 400);
    });

    document.getElementById('asset-cat-filter')?.addEventListener('change', (e) => {
      _category = e.target.value;
      render();
    });

    document.getElementById('expiry-30-filter')?.addEventListener('change', (e) => {
      _expiryFilter = e.target.checked;
      render();
    });

    document.getElementById('rma-search-btn')?.addEventListener('click', showRMASearchModal);
    document.getElementById('add-asset-btn')?.addEventListener('click', () => showAssetModal());

    document.querySelectorAll('.edit-asset-btn').forEach(btn => {
      btn.addEventListener('click', () => showAssetModal({ id: btn.dataset.id }));
    });
  }

  function isNearExpiry(date) {
    if (!date) return false;
    const diff = (new Date(date) - new Date()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 30;
  }

  function showRMASearchModal() {
    const html = `
      <div class="modal-header">
        <div class="modal-title">RMA / 시리얼 조회</div>
        <button class="modal-close"><svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg></button>
      </div>
      <div class="modal-body">
        <div class="search-input" style="margin-bottom:20px">
          <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd"/></svg>
          <input type="text" id="rma-serial-input" placeholder="시리얼 번호를 입력하고 Enter..." style="font-size:1rem">
          <button class="btn btn-primary btn-sm" id="rma-do-search" style="margin-left:4px">검색</button>
        </div>
        <div id="rma-result-container">${emptyHTML('시리얼 번호를 입력하세요')}</div>
      </div>
    `;
    openModal(html);

    const doSearch = async () => {
      const serial = document.getElementById('rma-serial-input').value.trim();
      if (!serial) return;
      const container = document.getElementById('rma-result-container');
      container.innerHTML = loadingHTML();
      try {
        const res = await API.get(`/assets/rma-search?serial=${encodeURIComponent(serial)}`);
        const daysLeft = Math.max(0, Math.floor(res.warranty_days_left));
        const isActive = res.warranty_days_left > 0;
        container.innerHTML = `
          <div style="border:1px solid ${isActive ? 'var(--success)' : 'var(--danger)'};border-radius:var(--radius-md);padding:16px;background:var(--bg-glass)">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
              <span class="badge ${isActive ? 'badge-success' : 'badge-danger'}">워런티 ${isActive ? '유효' : '만료'}</span>
              <span style="font-size:0.8rem;color:var(--text-muted)">잔여 ${daysLeft}일</span>
            </div>
            <div style="font-weight:700;font-size:1rem;margin-bottom:4px">${res.material_name}</div>
            <div class="mono" style="font-size:0.9rem;color:var(--primary-light);margin-bottom:12px">${res.serial_no}</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:0.82rem">
              <div><span style="color:var(--text-muted)">고객사</span><br><strong>${res.customer_name || '-'}</strong></div>
              <div><span style="color:var(--text-muted)">판매일</span><br>${res.order_date || '-'}</div>
              <div><span style="color:var(--text-muted)">주문번호</span><br><span class="mono">${res.so_no || '-'}</span></div>
              <div><span style="color:var(--text-muted)">만료일</span><br><span style="${!isActive ? 'color:var(--danger)' : ''}">${res.expiry_date || '-'}</span></div>
              ${res.license_key ? `<div style="grid-column:1/-1"><span style="color:var(--text-muted)">라이선스 키</span><br><span class="mono" style="font-size:0.78rem;color:var(--primary-light)">${res.license_key}</span></div>` : ''}
            </div>
          </div>
        `;
      } catch (err) {
        container.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
      }
    };

    document.getElementById('rma-serial-input').onkeypress = (e) => { if (e.key === 'Enter') doSearch(); };
    document.getElementById('rma-do-search').onclick = doSearch;
  }

  async function showAssetModal(asset = null) {
    const materials = await API.get('/materials');
    const html = `
      <div class="modal-header">
        <div class="modal-title">자산 등록</div>
        <button class="modal-close"><svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg></button>
      </div>
      <div class="modal-body">
        <form id="asset-form" class="form-grid">
          <div class="form-group" style="grid-column:1/-1"><label>품목 <span class="required">*</span></label>
            <select name="material_code" required>
              ${materials.map(m => `<option value="${m.code}">${m.name} (${m.code})</option>`).join('')}
            </select>
          </div>
          <div class="form-group"><label>시리얼 번호</label>
            <input type="text" name="serial_no" placeholder="실물 시리얼 번호">
          </div>
          <div class="form-group"><label>라이선스 키</label>
            <input type="text" name="license_key" placeholder="SW 라이선스 키">
          </div>
          <div class="form-group"><label>만료일</label>
            <input type="date" name="expiry_date">
          </div>
          <div class="form-group"><label>상태</label>
            <select name="status">
              <option value="active">활성</option>
              <option value="expired">만료</option>
              <option value="rma">RMA</option>
            </select>
          </div>
        </form>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal()">취소</button>
        <button class="btn btn-primary" id="save-asset-btn">저장</button>
      </div>
    `;
    openModal(html, 'modal-wide', { persistent: true });

    document.getElementById('save-asset-btn').onclick = async () => {
      const data = Object.fromEntries(new FormData(document.getElementById('asset-form')));
      try {
        await API.post('/assets', data);
        showToast('자산이 등록되었습니다.', 'success');
        closeModal();
        await render();
        init();
      } catch (err) {
        showToast(err.message, 'error');
      }
    };
  }

  function reset() {
    _search = ''; _category = ''; _expiryFilter = false;
  }

  return { render, init, reset };
})();
window.Assets = Assets;
