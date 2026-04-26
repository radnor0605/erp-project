/* ─── API Fetch Wrapper ─── */
const API = (() => {
  const BASE = '/api';

  function getToken() { return localStorage.getItem('ag_token'); }

  async function request(method, path, body = null) {
    const token = getToken();
    const opts = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    };
    if (body) opts.body = JSON.stringify(body);

    let res;
    try {
      res = await fetch(`${BASE}${path}`, opts);
    } catch (e) {
      if (method === 'GET') return []; // Return empty array on network/busy errors for GET
      throw new Error('네트워크 연결이 원활하지 않습니다.');
    }

    const data = await res.json().catch(() => (method === 'GET' ? [] : {}));

    if (!res.ok) {
      // Return empty array for 530 (Busy) or 500 on GET requests as requested
      if (method === 'GET' && (res.status === 530 || res.status === 500)) return [];
      
      const err = new Error(data.error || `HTTP ${res.status}`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  return {
    get:    (path)       => request('GET',    path),
    post:   (path, body) => request('POST',   path, body),
    put:    (path, body) => request('PUT',    path, body),
    patch:  (path, body) => request('PATCH',  path, body),
    delete: (path, body) => request('DELETE', path, body || null),
  };
})();

/* ─── Toast Notifications ─── */
function showToast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  const icons = {
    success: `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>`,
    error: `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/></svg>`,
    warning: `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>`,
    info: `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/></svg>`,
  };
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `${icons[type]}<span>${message}</span>`;
  toast.style.cursor = 'pointer';
  const dismiss = () => { toast.style.opacity = '0'; toast.style.transform = 'translateX(20px)'; toast.style.transition = 'all 0.3s'; setTimeout(() => toast.remove(), 300); };
  toast.onclick = dismiss;
  container.appendChild(toast);
  setTimeout(dismiss, duration);
}

/* ─── Modal Helpers ─── */
// opts: { size: 'modal-wide|modal-lg|modal-xl', persistent: true }
function openModal(html, size = '', opts = {}) {
  // Support legacy string shorthand: openModal(html, 'max-width:480px') stays as inline style
  const overlay = document.getElementById('modal-overlay');
  const container = document.getElementById('modal-container');

  const persistent = opts.persistent === true;
  const isInlineStyle = size && size.includes(':');
  container.className = `modal-container ${isInlineStyle ? '' : size}`.trim();
  if (isInlineStyle) container.style.cssText = size;
  else container.style.cssText = '';

  container.innerHTML = html;
  overlay.classList.remove('hidden');

  if (!persistent) {
    overlay.onclick = (e) => { if (e.target === overlay) closeModal(); };
    const escHandler = (e) => { if (e.key === 'Escape') { closeModal(); document.removeEventListener('keydown', escHandler); } };
    document.addEventListener('keydown', escHandler);
  } else {
    overlay.onclick = null;
  }

  container.querySelectorAll('.modal-close').forEach(btn => { btn.onclick = closeModal; });
}

function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  overlay.classList.add('hidden');
  document.getElementById('modal-container').innerHTML = '';
}

/* ─── Format Helpers ─── */
function formatNumber(n, decimals = 0) {
  if (n === null || n === undefined) return '-';
  return Number(n).toLocaleString('ko-KR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function formatCurrency(n) { return formatNumber(n, 0) + '원'; }

function formatDate(d) {
  if (!d) return '-';
  return d.substring(0, 10);
}

function formatDateTime(d) {
  if (!d) return '-';
  return d.substring(0, 16).replace('T', ' ');
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

/* ─── Status Badge Helpers ─── */
function receiptStatusBadge(status) {
  const map = {
    draft:      ['badge-ghost',   '초안',    '입고 전표 작성 중. 아직 재고에 반영되지 않음'],
    pending:    ['badge-ghost',   '대기',    '발주 자동생성된 입고 대기 전표'],
    inspecting: ['badge-warning', '검수중',  '검수 진행 중. 확정 전 재고 미반영'],
    partial:    ['badge-info',    '부분확정','일부 품목만 확정됨'],
    confirmed:  ['badge-success', '확정',    '재고 반영 완료. 수정 불가'],
    closed:     ['badge-primary', '마감',    '매입 마감 처리 완료. 회계 전기됨'],
    cancelled:  ['badge-danger',  '취소',    '취소된 전표. 재고 역산 완료'],
  };
  const [cls, label, tip] = map[status] || ['badge-ghost', status, ''];
  return `<span class="badge ${cls}" title="${tip}" style="cursor:help">${label}</span>`;
}

function salesOrderStatusBadge(status) {
  const map = {
    '수주': ['badge-info', '수주'],
    '주문': ['badge-info', '직접주문'],
    '출고': ['badge-success', '출고완료'],
    '반품대기': ['badge-danger', '반품대기'],
    '마감': ['badge-primary', '마감'],
    '취소': ['badge-danger', '취소'],
  };
  const [cls, label] = map[status] || ['badge-ghost', status];
  return `<span class="badge ${cls}">${label}</span>`;
}

function inspectionBadge(type) {
  const map = {
    '검사': ['badge-warning', '검사'],
    '무검사': ['badge-success', '무검사'],
    '보류': ['badge-danger', '보류'],
  };
  const [cls, label] = map[type] || ['badge-ghost', type || '-'];
  return `<span class="badge ${cls}">${label}</span>`;
}

function stockTypeBadge(type) {
  const map = {
    '가용': ['badge-success', '가용'],
    '검수': ['badge-warning', '검수'],
    '보류': ['badge-danger', '보류'],
  };
  const [cls, label] = map[type] || ['badge-ghost', type];
  return `<span class="badge ${cls}">${label}</span>`;
}

function movementTypeBadge(code) {
  const map = {
    '101': ['badge-success', '101 구매입고'],
    '201': ['badge-danger', '201 판매출고'],
    '311': ['badge-info', '311 창고이동'],
    '501': ['badge-primary', '501 기타입고'],
    '701': ['badge-success', '701 실사조정(+)'],
    '702': ['badge-danger', '702 실사조정(-)'],
  };
  const [cls, label] = map[code] || ['badge-ghost', code];
  return `<span class="badge ${cls}">${label}</span>`;
}

/* ─── Confirm Dialog ─── */
function confirmDialog(message, onConfirm, danger = true) {
  const html = `
    <div class="modal-header">
      <div class="modal-title">
        <svg viewBox="0 0 20 20" fill="currentColor" style="color:${danger?'var(--danger)':'var(--warning)'}"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>
        확인
      </div>
      <button class="modal-close"><svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg></button>
    </div>
    <div class="modal-body"><p style="color:var(--text-secondary);line-height:1.7">${message}</p></div>
    <div class="modal-footer">
      <button class="btn btn-secondary" id="confirm-cancel">취소</button>
      <button class="btn ${danger?'btn-danger':'btn-primary'}" id="confirm-ok">확인</button>
    </div>
  `;
  openModal(html);
  document.getElementById('confirm-cancel').onclick = closeModal;
  document.getElementById('confirm-ok').onclick = () => { closeModal(); onConfirm(); };
}

/* ─── Loading Helper ─── */
function loadingHTML() {
  return `<div class="loading-spinner"><div class="spinner"></div></div>`;
}

function skeletonTableHTML(rows = 5, cols = 4) {
  const widths = ['w2', 'w3', 'w4', 'w2'];
  return `<div class="skeleton">${Array(rows).fill(0).map(() =>
    `<div class="skeleton-row">${Array(cols).fill(0).map((_, i) =>
      `<div class="skeleton-cell ${widths[i % widths.length]}"></div>`
    ).join('')}</div>`
  ).join('')}</div>`;
}

function emptyHTML(msg = '데이터가 없습니다', sub = '') {
  return `<div class="empty-state">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <path stroke-linecap="round" stroke-linejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
    </svg>
    <h3>${msg}</h3>${sub ? `<p>${sub}</p>` : ''}
  </div>`;
}

/* ─── Warehouse Cache ─── */
let _warehouses = null;
async function getWarehouses() {
  if (!_warehouses) { _warehouses = await API.get('/inventory/warehouses'); }
  return _warehouses;
}

async function warehouseOptions(selectedCode) {
  const whs = await getWarehouses();
  return whs.map(w => `<option value="${w.code}" ${w.code===selectedCode?'selected':''}>${w.name} (${w.code})</option>`).join('');
}

/* ─── 폴더 스캔 트리거 ─── */
async function triggerScan(btnId, onComplete, scope) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  const origText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<svg viewBox="0 0 20 20" fill="currentColor" style="width:14px;height:14px;margin-right:4px;animation:spin 1s linear infinite"><path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"/></svg>스캔 중...';
  try {
    const body = scope ? { scope } : {};
    const res = await API.post('/scan/run', body);
    const summaryLine = res.summary ? `${res.summary} — ` : '';
    const detailLine  = `처리: ${res.processed}건 ↑ | 건너뜀: ${res.skipped}건 | 오류: ${res.errors}건`;
    const errNote     = res.errorFiles && res.errorFiles.length > 0 ? ` (판독불가 ${res.errorFiles.length}건 → error/ 이동)` : '';
    const toastType   = res.errors > 0 ? 'warning' : 'success';
    showToast(`${summaryLine}${detailLine}${errNote}`, toastType);
    if (onComplete) await onComplete();
  } catch (err) {
    showToast(err.message || '스캔 실행 중 오류가 발생했습니다.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = origText;
  }
}

/* ─── Excel Upload Modal ─── */
function showUploadModal(type, onComplete) {
  const titles = { materials: '품목 일괄 등록', vendors: '거래처 일괄 등록', customers: '고객사 일괄 등록' };
  const html = `
    <div class="modal-header">
      <div class="modal-title">${titles[type] || '엑셀 업로드'}</div>
      <button class="modal-close">×</button>
    </div>
    <div class="modal-body">
      <div style="margin-bottom:20px; padding:16px; background:rgba(59,130,246,0.05); border:1px dashed var(--primary); border-radius:var(--radius-md); text-align:center">
        <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:12px">업로드 양식 파일을 다운로드하여 데이터를 작성해주세요.</p>
        <a href="/api/upload/template/${type}" class="btn btn-sm btn-secondary">
          <svg viewBox="0 0 20 20" fill="currentColor" style="width:14px;height:14px;margin-right:6px"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
          양식 다운로드
        </a>
      </div>
      <form id="upload-form">
        <div class="form-group">
          <label>엑셀 파일 선택 (.xlsx)</label>
          <input type="file" id="upload-file" accept=".xlsx" required style="padding:10px; border:1px solid var(--border); width:100%">
        </div>
        <div class="form-group" style="margin-top:16px">
          <label>이미 존재하는 데이터 처리</label>
          <div style="display:flex; gap:20px; margin-top:8px">
            <label style="display:flex; align-items:center; gap:8px; cursor:pointer">
              <input type="radio" name="mode" value="skip" checked> <span>건너뛰기 (Skip)</span>
            </label>
            <label style="display:flex; align-items:center; gap:8px; cursor:pointer">
              <input type="radio" name="mode" value="merge"> <span>덮어쓰기 (Merge)</span>
            </label>
          </div>
        </div>
        <div id="upload-status" style="margin-top:20px; display:none">
          <div class="progress-bar"><div id="upload-progress" class="progress-fill" style="width:0%"></div></div>
          <p style="text-align:center; font-size:0.75rem; color:var(--text-muted); margin-top:8px">처리 중... 잠시만 기다려주세요.</p>
        </div>
        <button type="submit" id="upload-submit-btn" class="btn btn-primary btn-full" style="margin-top:24px">업로드 시작</button>
      </form>
    </div>
  `;
  openModal(html, 'max-width:480px');

  document.getElementById('upload-form').onsubmit = async (e) => {
    e.preventDefault();
    const fileInput = document.getElementById('upload-file');
    const mode = document.querySelector('input[name="mode"]:checked').value;
    if (!fileInput.files.length) return;

    const btn = document.getElementById('upload-submit-btn');
    const status = document.getElementById('upload-status');
    const progress = document.getElementById('upload-progress');
    
    btn.disabled = true;
    btn.innerText = '처리 중...';
    status.style.display = 'block';
    progress.style.width = '50%';

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    formData.append('mode', mode);

    try {
      const res = await fetch(`/api/upload/${type}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('ag_token')}` },
        body: formData
      });
      const result = await res.json();
      
      if (!res.ok) throw new Error(result.error || '업로드 실패');

      progress.style.width = '100%';
      setTimeout(() => {
        showUploadResult(result);
        if (onComplete) onComplete();
      }, 500);
    } catch (err) {
      showToast(err.message, 'error');
      btn.disabled = false;
      btn.innerText = '업로드 시작';
      status.style.display = 'none';
    }
  };
}

function showUploadResult(res) {
  const { summary, errors } = res;
  const html = `
    <div class="modal-header">
      <div class="modal-title">업로드 결과 보고</div>
      <button class="modal-close">×</button>
    </div>
    <div class="modal-body">
      <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:12px; margin-bottom:24px">
        <div style="text-align:center; padding:16px; background:rgba(59,130,246,0.05); border-radius:var(--radius-md)">
          <div style="font-size:0.7rem; color:var(--text-muted); margin-bottom:4px">총 항목</div>
          <div style="font-size:1.5rem; font-weight:700">${summary.total}</div>
        </div>
        <div style="text-align:center; padding:16px; background:rgba(16,185,129,0.05); border-radius:var(--radius-md)">
          <div style="font-size:0.7rem; color:var(--text-muted); margin-bottom:4px">성공</div>
          <div style="font-size:1.5rem; font-weight:700; color:var(--success)">${summary.success}</div>
        </div>
        <div style="text-align:center; padding:16px; background:rgba(239,68,68,0.05); border-radius:var(--radius-md)">
          <div style="font-size:0.7rem; color:var(--text-muted); margin-bottom:4px">실패</div>
          <div style="font-size:1.5rem; font-weight:700; color:var(--danger)">${summary.failed}</div>
        </div>
      </div>
      
      ${errors.length ? `
        <label style="font-size:0.8rem; font-weight:600; margin-bottom:8px; display:block">오류 상세 (상위 50건)</label>
        <div style="max-height:200px; overflow-y:auto; padding:12px; background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-sm); font-family:var(--font-mono); font-size:0.75rem; line-height:1.6">
          ${errors.map(e => `<div style="color:var(--danger); border-bottom:1px solid var(--border); padding:4px 0">${e}</div>`).join('')}
        </div>
      ` : `<p style="text-align:center; color:var(--success); padding:20px">모든 데이터가 성공적으로 처리되었습니다.</p>`}
      
      <button class="btn btn-primary btn-full modal-close" style="margin-top:24px">확인</button>
    </div>
  `;
  openModal(html, 'max-width:500px');
}
