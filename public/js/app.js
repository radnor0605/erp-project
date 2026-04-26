/* ─── SPA Router & App Bootstrap ─── */

const Router = (() => {
  const pages = {
    dashboard: () => Dashboard.render(),
    materials: () => Materials.render(),
    partners: () => Partners.render(),
    warehouses: () => Warehouses.render(),
    'delivery-points': () => DeliveryPoints.render(),
    receipts: () => Receipts.render(),
    movements: () => Movements.render(),
    inventory: () => Inventory.render(),
    'price-history': () => PriceHistory.render(),
    closing: () => Closing.render(),
    'physical-inventory': () => PhysicalInventory.render(),
    backup: () => Backup.render(),
    audit: () => Audit.render(),
    procurement: () => Procurement.render(),
    'sales-orders': () => SalesOrders.render(),
    'quotations': () => Quotations.render(),
    'sales-closing': () => SalesClosing.render(),
    assets: () => Assets.render(),
    users: () => Users.render(),
    scanner: () => Scanner.render(),
    purchasing: () => Purchasing.render(),
    settings: () => Settings.render(),
    reports: () => Reports.render(),
    'scm-alerts': (p) => ScmAlerts.render(p),
    returns: () => Returns.render(),
    'ar-invoices': () => ArInvoices.render(),
    'ap-invoices': () => ApInvoices.render(),
    'bank-accounts': () => BankAccounts.render(),
    'transfer-orders': () => TransferOrders.render(),
    'tax-invoices':      () => TaxInvoices.render(),
    'expense-vouchers':  () => ExpenseVouchers.render(),
    'asset-management': () => AssetManagement.render(),
  };

  let currentPage = null;
  let _currentParams = {};

  function navigate(page, params = {}) {
    if (page === 'dashboard' && currentPage === 'dashboard') {
       // Force reset if clicking dashboard while already on it
       resetGlobalFilters();
    }
    _currentParams = params;
    if (page === 'dashboard') resetGlobalFilters();
    page = page || 'dashboard';
    currentPage = page;

    // Update nav
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.page === page);
    });

    // Render page
    const container = document.getElementById('page-container');
    container.innerHTML = loadingHTML();
    const renderer = pages[page];
    if (renderer) {
      try { 
        renderer(_currentParams).then(html => {
          if (html) container.innerHTML = html;
          // Initialize module-specific events
          const moduleName = page.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('');
          const mod = window[moduleName] || pages[page];
          if (mod && mod.init) mod.init();
          applyAiFeatureToggle();

          // Auto-hide sidebar on mobile after navigation
          if (window.innerWidth <= 768) {
            document.getElementById('sidebar').classList.add('collapsed');
          }
        });
      }
      catch(e) { container.innerHTML = `<div class="alert alert-danger">페이지 로드 오류: ${e.message}</div>`; }
    } else {
      container.innerHTML = emptyHTML('페이지를 찾을 수 없습니다');
    }
  }

  function init() {
    window.addEventListener('hashchange', () => {
      const page = location.hash.slice(1) || 'dashboard';
      navigate(page);
    });
    // Nav link clicks
    document.querySelectorAll('.nav-item').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        location.hash = '#' + el.dataset.page;
      });
    });
  }

  function resetGlobalFilters() {
    // Reset search and filter states in all major modules
    const modules = ['Materials', 'Partners', 'Receipts', 'Movements', 'Inventory', 'SalesOrders', 'Quotations', 'SalesClosing'];
    modules.forEach(m => {
      if (window[m] && typeof window[m].reset === 'function') {
        window[m].reset();
      }
    });
  }

  return { navigate, init, getCurrent: () => currentPage, getParams: () => _currentParams };
})();

window.Router = Router;

/* ─── Email Send Modal (공통 헬퍼) ─── */
function showEmailModal({ to = '', subject = '', body = '', docType = '', docId = '' } = {}) {
  const html = `
    <div class="modal-header">
      <div class="modal-title">✉️ 이메일 발송</div>
      <button class="modal-close"><svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg></button>
    </div>
    <div class="modal-body">
      <div class="form-grid">
        <div class="form-group" style="grid-column:1/-1">
          <label>받는 사람 <span class="required">*</span></label>
          <input type="email" id="em-to" value="${to}" placeholder="recipient@company.com">
        </div>
        <div class="form-group" style="grid-column:1/-1">
          <label>참조 (CC)</label>
          <input type="text" id="em-cc" placeholder="cc1@co.com, cc2@co.com">
        </div>
        <div class="form-group" style="grid-column:1/-1">
          <label>제목 <span class="required">*</span></label>
          <input type="text" id="em-subject" value="${subject}">
        </div>
        <div class="form-group" style="grid-column:1/-1">
          <label>본문</label>
          <textarea id="em-body" rows="8" style="width:100%;font-family:inherit;font-size:0.85rem;background:var(--bg-glass);border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px;color:var(--text-primary)">${body}</textarea>
        </div>
      </div>
      <div style="font-size:0.75rem;color:var(--text-muted);margin-top:8px">
        ※ SMTP 설정은 [환경 설정 &gt; 메일 설정]에서 구성하세요.
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">취소</button>
      <button class="btn btn-primary" id="em-send-btn">
        <svg viewBox="0 0 20 20" fill="currentColor" style="width:14px;height:14px;margin-right:4px"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"/></svg>
        발송
      </button>
    </div>
  `;
  openModal(html, 'modal-wide', { persistent: true });

  document.getElementById('em-send-btn').onclick = async () => {
    const btn = document.getElementById('em-send-btn');
    const toVal = document.getElementById('em-to').value.trim();
    const subjVal = document.getElementById('em-subject').value.trim();
    if (!toVal || !subjVal) return showToast('받는 사람과 제목은 필수입니다.', 'error');
    btn.disabled = true; btn.textContent = '발송 중...';
    try {
      const r = await API.post('/email/send', {
        to: toVal,
        cc: document.getElementById('em-cc').value.trim() || null,
        subject: subjVal,
        body: document.getElementById('em-body').value,
        doc_type: docType,
        doc_id: docId,
      });
      showToast(r.message || '이메일이 발송되었습니다.', 'success');
      closeModal();
    } catch (err) {
      btn.disabled = false; btn.innerHTML = `<svg viewBox="0 0 20 20" fill="currentColor" style="width:14px;height:14px;margin-right:4px"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"/></svg>발송`;
      showToast(err.message, 'error');
    }
  };
}
window.showEmailModal = showEmailModal;

/* ─── Auth ─── */
function getUser() {
  try { return JSON.parse(localStorage.getItem('ag_user')); } catch { return null; }
}

function setAuth(token, user) {
  localStorage.setItem('ag_token', token);
  localStorage.setItem('ag_user', JSON.stringify(user));
}

async function promptEmployeeId(userId) {
  const html = `
    <div class="modal-header">
      <div class="modal-title">사원번호 업데이트</div>
    </div>
    <div class="modal-body">
      <p style="margin-bottom:16px;color:var(--text-muted)">시스템 보안 및 관리를 위해 사원번호를 입력해주세요. <br>최초 1회 등록이 필요합니다.</p>
      <div class="form-group">
        <label>사원번호 (Employee ID) <span class="required">*</span></label>
        <input type="text" id="new-employee-id" placeholder="예: 20240401" style="width:100%">
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-primary" id="save-emp-id-btn" style="width:100%">업데이트 완료</button>
    </div>
  `;
  openModal(html, 'max-width:400px');
  
  return new Promise((resolve) => {
    document.getElementById('save-emp-id-btn').onclick = async () => {
      const eid = document.getElementById('new-employee-id').value.trim();
      if (!eid) return showToast('사원번호를 입력해주세요.', 'error');
      try {
        await API.put(`/users/${userId}/employee-id`, { employee_id: eid });
        showToast('사원번호가 업데이트되었습니다.', 'success');
        closeModal();
        resolve(eid);
      } catch (err) {
        showToast(err.message, 'error');
      }
    };
  });
}

function clearAuth() {
  localStorage.removeItem('ag_token');
  localStorage.removeItem('ag_user');
}

function updateUserUI(user) {
  if (!user) return;
  document.getElementById('user-name').textContent = user.name || user.username;
  document.getElementById('user-role').textContent = (user.role === 'admin' ? '관리자' : '사용자') + (user.employee_id ? ` (${user.employee_id})` : '');
  document.getElementById('user-avatar').textContent = (user.name || user.username)[0].toUpperCase();
  
  const topLabel = document.getElementById('top-user-label');
  if (topLabel) topLabel.textContent = user.name || user.username;

  // Show/hide admin-only items
  document.querySelectorAll('.admin-only').forEach(el => {
    el.style.display = user.role === 'admin' ? '' : 'none';
  });
}

/* ─── Sidebar Toggle ─── */
function initSidebar() {
  const sidebar = document.getElementById('sidebar');
  const mainContent = document.querySelector('.main-content');
  const toggleBtn = document.getElementById('sidebar-toggle');

  toggleBtn.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    mainContent.classList.toggle('expanded');
  });

  // Initial check for mobile
  if (window.innerWidth <= 768) {
    sidebar.classList.add('collapsed');
  }
}

/* ─── AI Feature Toggle ─── */
window._aiStatus = { ai_enabled: false, ocr: false, gemini: false, claude: false };

async function loadAiStatus() {
  try {
    const s = await API.get('/ai/config');
    window._aiStatus = s;
    applyAiFeatureToggle();
  } catch { /* 비연결 상태에서도 앱은 동작 */ }
}

function applyAiFeatureToggle() {
  const enabled = window._aiStatus?.ai_enabled || false;
  const TIP = '환경설정(.env)에서 AI 연동이 필요한 기능입니다.';
  const selectors = [
    '#scan-po-btn',
    '#rc-scan-btn',
    '#part-scan-btn',
    '[data-ai-feature]',
  ];
  selectors.forEach(sel => {
    document.querySelectorAll(sel).forEach(btn => {
      if (!enabled) {
        btn.disabled = true;
        btn.title = TIP;
        btn.classList.add('ai-disabled');
      } else {
        btn.disabled = false;
        if (btn.title === TIP) btn.title = btn.dataset.originalTitle || '';
        btn.classList.remove('ai-disabled');
      }
    });
  });
}

window.loadAiStatus   = loadAiStatus;
window.applyAiFeatureToggle = applyAiFeatureToggle;

/* ─── Bootstrap ─── */
document.addEventListener('DOMContentLoaded', async () => {
  const loginScreen = document.getElementById('login-screen');
  const app = document.getElementById('app');
  const loginForm = document.getElementById('login-form');
  const logoutBtn = document.getElementById('logout-btn');
  const headerLogoutBtn = document.getElementById('header-logout-btn');

  // 로그아웃 이벤트 — 항상 먼저 바인딩 (자동 로그인 경로에서도 동작해야 함)
  const doLogout = () => {
    clearAuth();
    location.reload();
  };
  if (logoutBtn) logoutBtn.addEventListener('click', doLogout);
  if (headerLogoutBtn) headerLogoutBtn.addEventListener('click', doLogout);

  // Check existing auth
  const token = localStorage.getItem('ag_token');
  if (token) {
    try {
      const data = await API.get('/auth/me');
      updateUserUI(data.user);
      loginScreen.classList.add('hidden');
      app.classList.remove('hidden');
      initSidebar();
      Router.init();
      QuotaBadge.start();
      ScmAlertBadge.start();
      loadAiStatus();
      const page = location.hash.slice(1) || 'dashboard';
      Router.navigate(page);
      return;
    } catch {
      clearAuth();
    }
  }

  // Login form
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-error');
    const btn = document.getElementById('login-btn');

    btn.disabled = true;
    btn.innerHTML = '<div class="spinner" style="width:18px;height:18px;border-width:2px"></div>';
    errorEl.textContent = '';

    try {
      const data = await API.post('/auth/login', { username, password });
      
      if (data.needs_employee_id && data.user.role !== 'admin') {
        const empId = await promptEmployeeId(data.user.id);
        data.user.employee_id = empId;
      }
      
      setAuth(data.token, data.user);
      updateUserUI(data.user);
      loginScreen.classList.add('hidden');
      app.classList.remove('hidden');
      initSidebar();
      Router.init();
      Router.navigate('dashboard');
      QuotaBadge.start();
      ScmAlertBadge.start();
      loadAiStatus();
      showToast(`환영합니다, ${data.user.name || data.user.username}님!`, 'success');
    } catch (err) {
      errorEl.textContent = err.message || '로그인에 실패했습니다.';
      btn.disabled = false;
      btn.innerHTML = '<span>로그인</span>';
    }
  });

  // (로그아웃 리스너는 DOMContentLoaded 최상단에서 이미 바인딩됨)
});

/* ─── AI Engine Badge (5-Engine Status) ─── */
const QuotaBadge = (() => {
  let _timer = null;
  const POLL_MS = 60000;

  const DOT_COLORS = {
    ok:       '#22c55e',   // 정상 — 초록
    unavail:  '#6b7280',   // 미설정 — 회색
    autherr:  '#ef4444',   // 인증 오류 — 빨강
    credit:   '#f59e0b',   // 크레딧 소진 — 노랑
    quota:    '#f97316',   // 쿼터 초과 — 주황
  };

  const ENGINE_IDS = {
    gemini:   'eng-gemini',
    vision:   'eng-vision',
    claude:   'eng-claude',
    openai:   'eng-openai',
    deepseek: 'eng-deepseek',
  };

  function setScanButtonState(disabled, reason) {
    const btns = document.querySelectorAll('[data-scan-trigger], #run-scan-btn, .scan-run-btn');
    btns.forEach(btn => {
      btn.disabled = disabled;
      if (disabled) {
        btn.title = reason || 'API 인증 오류로 스캔 불가';
        btn.classList.add('auth-error-disabled');
      } else {
        btn.title = '';
        btn.classList.remove('auth-error-disabled');
      }
    });
  }

  function setDot(id, color, title) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.color = color;
    el.style.textShadow = `0 0 6px ${color}`;
    if (title) el.title = title;
  }

  function update(d) {
    const badge    = document.getElementById('ai-engine-badge');
    const fill     = document.getElementById('quota-bar-fill');
    const text     = document.getElementById('quota-text');
    const offLabel = document.getElementById('quota-off-label');
    if (!badge) return;

    const engines    = d.engines    || {};
    const quota      = d.quota      || {};
    const authErrors = d.authErrors || {};

    // 엔진 도트 업데이트
    for (const [key, dotId] of Object.entries(ENGINE_IDS)) {
      const eng = engines[key];
      if (!eng) { setDot(dotId, DOT_COLORS.unavail, `${key}: 미설정`); continue; }
      if (eng.authError) {
        setDot(dotId, DOT_COLORS.autherr, `${key}: 인증 오류 ⚠️`);
      } else if (eng.creditError) {
        setDot(dotId, DOT_COLORS.credit, `${key}: 잔액 소진 💳 — 동적 대체 활성`);
      } else if (key === 'vision' && quota.blocked) {
        setDot(dotId, DOT_COLORS.quota, `Vision: 쿼터 초과 (${quota.count}/${quota.limit})`);
      } else if (eng.available) {
        setDot(dotId, DOT_COLORS.ok, `${key}: 정상`);
      } else {
        setDot(dotId, DOT_COLORS.unavail, `${key}: 미설정`);
      }
    }

    // Vision 쿼터 바
    if (fill && text) {
      const pct   = Math.min(quota.pct || 0, 100);
      const color = quota.blocked ? DOT_COLORS.autherr
                  : pct > 80     ? DOT_COLORS.quota
                  :                DOT_COLORS.ok;
      fill.style.width      = pct + '%';
      fill.style.background = color;
      text.textContent      = quota.count != null ? `V:${quota.count}/${quota.limit}` : '…';
      text.style.color      = color;
    }

    // OFF 레이블
    if (offLabel) {
      const hasAnyAuthErr = Object.keys(authErrors).length > 0;
      if (hasAnyAuthErr) {
        offLabel.textContent = 'AUTH_ERR';
        offLabel.classList.remove('hidden');
      } else if (quota.blocked) {
        offLabel.textContent = 'V-OFF';
        offLabel.classList.remove('hidden');
      } else {
        offLabel.classList.add('hidden');
      }
    }

    // 스캔 버튼 — Gemini 인증 오류 시만 비활성화 (핵심 엔진)
    const geminiAuthErr = engines.gemini?.authError;
    const hasAllAuthErr = Object.keys(authErrors).length >= 3; // 3개 이상 엔진 오류
    if (geminiAuthErr || hasAllAuthErr) {
      const providers = Object.keys(authErrors).join(', ');
      setScanButtonState(true, `AI 인증 오류 (${providers})`);
    } else {
      setScanButtonState(false);
    }
  }

  async function fetch_() {
    try {
      const data = await API.get('/ai/engine-status');
      update(data);
    } catch (_) {
      // 구 엔드포인트 fallback
      try {
        const q = await API.get('/ai/quota');
        update({ engines: {}, quota: q, authErrors: q.authErrors || {} });
      } catch (_) {}
    }
  }

  function start() {
    fetch_();
    if (_timer) clearInterval(_timer);
    _timer = setInterval(fetch_, POLL_MS);
  }

  function stop() { if (_timer) { clearInterval(_timer); _timer = null; } }

  return { start, stop, refresh: fetch_ };
})();

window.QuotaBadge = QuotaBadge;

/* ─── SCM Alert Nav Badge ─── */
const ScmAlertBadge = (() => {
  let _timer = null;
  async function fetch_() {
    try {
      const data = await API.get('/scm-alerts/count');
      const label = document.getElementById('nav-scm-alerts-label');
      if (!label) return;
      const cnt = data.open || 0;
      label.innerHTML = cnt > 0
        ? `SCM 경보 <span style="background:#EF4444;color:#fff;border-radius:10px;padding:1px 6px;font-size:0.68rem;margin-left:4px">${cnt}</span>`
        : 'SCM 경보';
    } catch {}
  }
  function start() { fetch_(); _timer = setInterval(fetch_, 60000); }
  function stop()  { if (_timer) { clearInterval(_timer); _timer = null; } }
  return { start, stop };
})();
window.ScmAlertBadge = ScmAlertBadge;

/* ─── Global Search (UI Optimization) ─── */
const GlobalSearch = (() => {
  let searchInput, searchResults;
  let debounceTimer;

  function getMenus() {
    return Array.from(document.querySelectorAll('.nav-item[data-page]')).map(el => {
      const section = el.closest('.accordion-item')?.querySelector('.accordion-header span')?.textContent?.trim() || '';
      return { title: el.querySelector('span')?.textContent?.trim() || '', page: el.dataset.page, desc: section };
    }).filter(m => m.title && m.page);
  }

  function init() {
    searchInput = document.getElementById('global-search-input');
    searchResults = document.getElementById('global-search-results');
    if (!searchInput) return;

    // Ctrl+K → Command Palette (handled by CommandPalette module)

    searchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => performSearch(e.target.value), 300);
    });

    searchInput.addEventListener('focus', () => {
      if (searchInput.value.trim().length > 0) {
        searchResults.classList.remove('hidden');
      }
    });

    // Close results when clicking outside
    document.addEventListener('click', (e) => {
      if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
        searchResults.classList.add('hidden');
      }
    });
  }

  async function performSearch(query) {
    query = query.trim().toLowerCase();
    if (!query) {
      searchResults.innerHTML = '';
      searchResults.classList.add('hidden');
      return;
    }

    let resultsHTML = '';

    // 1. Search Menus
    const matchedMenus = getMenus().filter(m => m.title.toLowerCase().includes(query) || m.desc.toLowerCase().includes(query));
    if (matchedMenus.length > 0) {
      resultsHTML += `<div style="padding:4px 12px;font-size:0.75rem;color:var(--text-muted);background:var(--bg-elevated);text-transform:uppercase">메뉴</div>`;
      matchedMenus.forEach(m => {
        resultsHTML += `
          <div class="search-result-item" onclick="GlobalSearch.goToPage('${m.page}')">
            <svg class="search-result-icon" viewBox="0 0 20 20" fill="currentColor"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zm6-4a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zm6-3a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/></svg>
            <div class="search-result-content">
              <div class="search-result-title">${m.title}</div>
              <div class="search-result-sub">${m.desc}</div>
            </div>
          </div>
        `;
      });
    }

    // 2. Search Materials (Async)
    try {
      const matData = await API.get(`/materials?search=${encodeURIComponent(query)}&limit=3`);
      if (matData.data && matData.data.length > 0) {
        resultsHTML += `<div style="padding:4px 12px;font-size:0.75rem;color:var(--text-muted);background:var(--bg-elevated);text-transform:uppercase">자재 / 품목</div>`;
        matData.data.forEach(mat => {
          resultsHTML += `
            <div class="search-result-item" onclick="GlobalSearch.goToMaterial('${mat.code}')">
              <svg class="search-result-icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd"/></svg>
              <div class="search-result-content">
                <div class="search-result-title">${mat.name} <span class="badge badge-secondary" style="font-size:0.6rem">${mat.category}</span></div>
                <div class="search-result-sub mono">${mat.code}</div>
              </div>
            </div>
          `;
        });
      }
    } catch(e) { }

    if (!resultsHTML) {
      resultsHTML = `<div style="padding:20px;text-align:center;color:var(--text-muted)">'${query}'에 대한 검색 결과가 없습니다.</div>`;
    }

    searchResults.innerHTML = resultsHTML;
    searchResults.classList.remove('hidden');
  }

  function goToPage(page) {
    searchResults.classList.add('hidden');
    searchInput.value = '';
    Router.navigate(page);
  }

  function goToMaterial(code) {
    searchResults.classList.add('hidden');
    searchInput.value = '';
    Router.navigate('materials', { search: code });
  }

  return { init, goToPage, goToMaterial };
})();

// Hook into app initialization
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => GlobalSearch.init(), 1000);
});

/* ═══════════════════════════════════════════════════
   Accordion Sidebar
═══════════════════════════════════════════════════ */
const Accordion = (() => {
  const STORAGE_KEY = 'ag_accordion_state';
  const PAGE_SECTION = {
    dashboard: 'main',
    materials: 'master', partners: 'master', warehouses: 'master', 'delivery-points': 'master',
    purchasing: 'purchase', receipts: 'purchase', procurement: 'purchase', 'scm-alerts': 'purchase', 'price-history': 'purchase',
    quotations: 'sales', 'sales-orders': 'sales', assets: 'sales',
    'ar-invoices': 'finance', 'ap-invoices': 'finance', 'bank-accounts': 'finance',
    'tax-invoices': 'finance', 'expense-vouchers': 'finance', closing: 'finance', 'sales-closing': 'finance',
    'asset-management': 'master',
    reports: 'reports',
    inventory: 'inventory', movements: 'inventory', 'transfer-orders': 'inventory', 'physical-inventory': 'inventory',
    backup: 'system', audit: 'system', returns: 'system', scanner: 'system', users: 'system', settings: 'system',
  };

  function getState() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
  }
  function saveState(state) { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

  function setSection(sectionId, open) {
    const el = document.querySelector(`.nav-section[data-section="${sectionId}"]`);
    if (!el) return;
    el.classList.toggle('open', open);
  }

  function openForPage(page) {
    const sid = PAGE_SECTION[page];
    if (!sid) return;
    const state = getState();
    state[sid] = true;
    saveState(state);
    setSection(sid, true);
  }

  function init() {
    const state = getState();
    document.querySelectorAll('.nav-section[data-section]').forEach(section => {
      const sid = section.dataset.section;
      const savedOpen = state[sid];
      if (savedOpen === true) section.classList.add('open');
      else if (savedOpen === false) section.classList.remove('open');
    });

    document.querySelectorAll('.accordion-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const sid = btn.dataset.section;
        const section = btn.closest('.nav-section');
        const isOpen = section.classList.toggle('open');
        const state = getState();
        state[sid] = isOpen;
        saveState(state);
      });
    });
  }

  return { init, openForPage };
})();

/* ═══════════════════════════════════════════════════
   Command Palette (Ctrl+K)
═══════════════════════════════════════════════════ */
const CommandPalette = (() => {
  let overlay, input, list, selectedIdx = -1, filtered = [];

  function buildMenu() {
    return Array.from(document.querySelectorAll('.nav-item[data-page]')).map(el => {
      const sectionEl = el.closest('.nav-section');
      const section = sectionEl?.querySelector('.accordion-toggle span')?.textContent?.trim() || '';
      const badge = el.querySelector('.nav-badge')?.textContent?.trim() || null;
      const spans = Array.from(el.querySelectorAll('span')).filter(s => !s.classList.contains('nav-badge'));
      const label = spans.map(s => s.textContent.trim()).join('') || el.textContent.trim();
      return { label, page: el.dataset.page, section, badge };
    });
  }

  function open() {
    overlay.classList.remove('hidden');
    input.value = '';
    render('');
    requestAnimationFrame(() => input.focus());
  }
  function close() {
    overlay.classList.add('hidden');
    selectedIdx = -1;
  }
  function render(q) {
    const MENU = buildMenu();
    const kw = q.toLowerCase();
    filtered = kw ? MENU.filter(m => m.label.toLowerCase().includes(kw) || m.section.toLowerCase().includes(kw) || m.page.includes(kw)) : MENU;
    selectedIdx = filtered.length ? 0 : -1;
    if (!filtered.length) { list.innerHTML = `<li class="cmd-palette-empty">검색 결과가 없습니다</li>`; return; }
    list.innerHTML = filtered.map((m, i) => `
      <li class="cmd-palette-item${i === 0 ? ' selected' : ''}" data-idx="${i}">
        <span>${m.label}</span>
        ${m.badge ? `<span class="cmd-item-badge">${m.badge}</span>` : ''}
        <span class="cmd-item-section">${m.section}</span>
      </li>`).join('');
    list.querySelectorAll('.cmd-palette-item').forEach(el => {
      el.addEventListener('click', () => navigate(+el.dataset.idx));
      el.addEventListener('mousemove', () => setSelected(+el.dataset.idx));
    });
  }
  function setSelected(idx) {
    selectedIdx = idx;
    list.querySelectorAll('.cmd-palette-item').forEach((el, i) => el.classList.toggle('selected', i === idx));
    const sel = list.querySelector('.selected');
    if (sel) sel.scrollIntoView({ block: 'nearest' });
  }
  function navigate(idx) {
    const item = filtered[idx];
    if (!item) return;
    close();
    location.hash = '#' + item.page;
  }

  function init() {
    overlay = document.getElementById('cmd-palette-overlay');
    input   = document.getElementById('cmd-palette-input');
    list    = document.getElementById('cmd-palette-list');
    if (!overlay) return;

    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    input.addEventListener('input', e => render(e.target.value));
    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(Math.min(selectedIdx + 1, filtered.length - 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(Math.max(selectedIdx - 1, 0)); }
      else if (e.key === 'Enter') { e.preventDefault(); navigate(selectedIdx); }
      else if (e.key === 'Escape') { e.preventDefault(); close(); }
    });
  }

  return { init, open, close };
})();

/* ═══════════════════════════════════════════════════
   Global Keyboard Shortcuts
═══════════════════════════════════════════════════ */
const KeyShortcuts = (() => {
  const isInput = () => {
    const t = document.activeElement?.tagName;
    return t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT' || document.activeElement?.isContentEditable;
  };

  function findBtn(keywords) {
    const container = document.getElementById('page-container');
    if (!container) return null;
    return Array.from(container.querySelectorAll('button')).find(b =>
      b.offsetParent !== null && keywords.some(kw => b.textContent.trim().includes(kw))
    );
  }

  const isFKey = (key) => ['F2','F4','F8','F9'].includes(key);

  function init() {
    document.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); CommandPalette.open(); return; }
      if (isInput() && !isFKey(e.key)) return;
      if (e.key === 'F2')      { e.preventDefault(); findBtn(['조회', '검색'])?.click(); }
      else if (e.key === 'F4') { e.preventDefault(); findBtn(['신규', '추가'])?.click(); }
      else if (e.key === 'F8') { e.preventDefault(); findBtn(['저장'])?.click(); }
      else if (e.key === 'F9') { e.preventDefault(); findBtn(['인쇄', '출력'])?.click(); }
    });
  }
  return { init };
})();

document.addEventListener('DOMContentLoaded', () => {
  Accordion.init();
  CommandPalette.init();
  KeyShortcuts.init();
});

// Patch Router.navigate to auto-open accordion section
const _origNavigate = Router.navigate.bind(Router);
Router.navigate = function(page, params, force) {
  _origNavigate(page, params, force);
  Accordion.openForPage(page);
};
