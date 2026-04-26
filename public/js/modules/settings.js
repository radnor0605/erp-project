/* ─── System Settings Module (v64) ─── */
const Settings = (() => {
  let _tab = 'ai';

  async function render() {
    const container = document.getElementById('page-container');
    const [config, profile, sysSettings] = await Promise.all([
      API.get('/ai/config').catch(() => ({ engine: 'gemini', keys: {} })),
      API.get('/company-profile').catch(() => ({})),
      API.get('/system-settings').catch(() => ({})),
    ]);

    container.innerHTML = `
      <div class="animate-fade">
        <div class="page-header">
          <div>
            <h2 class="page-title">시스템 설정</h2>
            <p class="page-subtitle">AI 엔진 및 자사 정보를 설정합니다.</p>
          </div>
        </div>

        <div style="display:flex;gap:8px;margin-bottom:20px;border-bottom:1px solid var(--border);padding-bottom:0">
          <button class="settings-tab ${_tab==='ai'?'active':''}" data-tab="ai">AI 서비스 설정</button>
          <button class="settings-tab ${_tab==='company'?'active':''}" data-tab="company">🏢 자사 정보 관리</button>
          <button class="settings-tab ${_tab==='mail'?'active':''}" data-tab="mail">✉️ 메일 설정</button>
        </div>

        <!-- AI 설정 패널 -->
        <div id="panel-ai" style="display:${_tab==='ai'?'block':'none'}">
          <div class="card" style="max-width:800px">
            <div class="section-title" style="margin-bottom:20px">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;vertical-align:middle;margin-right:8px"><path d="M12 2v8l6 3m-6-3l-6 3m6-3v8"/></svg>
              AI 서비스 통합 설정 (Multi-AI Abstraction)
            </div>
            <div class="form-group">
              <label>기본 AI 분석 엔진</label>
              <div class="ai-engine-selector" style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:8px">
                <div class="engine-card ${config.engine==='gemini'?'active':''}" id="en-gemini">
                  <div class="engine-header"><span class="engine-name">Gemini (Google)</span><span class="badge badge-success">Free Tier</span></div>
                  <p class="engine-desc">구글의 고성능 무료 AI 모델. 일상적인 재고 분석과 리포트 생성에 최적.</p>
                  <div class="engine-status">${config.keys?.gemini ? '✅ API 키 설정됨' : '❌ API 키 미설정 (.env)'}</div>
                </div>
                <div class="engine-card ${config.engine==='claude'?'active':''}" id="en-claude">
                  <div class="engine-header"><span class="engine-name">Claude Sonnet 4.6</span><span class="badge badge-primary">모드 1–3</span></div>
                  <p class="engine-desc">빠르고 균형 잡힌 Anthropic Sonnet 모델. 복잡한 물류 연산·OCR·ERP 분석에 최적.</p>
                  <div class="engine-status">${config.keys?.claude ? '✅ API 키 설정됨' : '⚠️ 키 미설정 (Gemini로 Fallback)'}</div>
                </div>
                <div class="engine-card ${config.engine==='claude-opus'?'active':''}" id="en-claude-opus" style="grid-column:span 2;border-color:${config.engine==='claude-opus'?'var(--warning)':'var(--border)'}">
                  <div class="engine-header"><span class="engine-name">⚡ 모드 4 — Claude Opus 4.6 (Max Intelligence)</span><span class="badge badge-warning">최고 성능 / 고비용</span></div>
                  <p class="engine-desc">Anthropic 최고 성능 모델. 다중 시스템 교차 분석, 복합 재무·공급망 추론에 사용. 일반 작업 대비 고비용이므로 꼭 필요한 경우에만 선택.</p>
                  <div class="engine-status">${config.keys?.claude ? '✅ ANTHROPIC_API_KEY 설정됨 — Opus 4.6 사용 가능' : '❌ API 키 미설정'}</div>
                </div>
              </div>
            </div>
            <div class="alert alert-info" style="margin-top:24px">
              <strong>모드 가이드:</strong>
              <span style="font-size:0.85rem">Gemini = 무료/빠름 &nbsp;|&nbsp; Claude Sonnet = 모드 1–3 &nbsp;|&nbsp; <strong style="color:var(--warning)">모드 4 Opus</strong> = 최고 품질, 고비용</span>
            </div>
            <div style="margin-top:24px;display:flex;justify-content:flex-end">
              <button class="btn btn-primary" id="save-ai-btn">AI 설정 저장</button>
            </div>
          </div>
        </div>

        <!-- 메일 설정 패널 -->
        <div id="panel-mail" style="display:${_tab==='mail'?'block':'none'}">
          <div class="card" style="max-width:800px">
            <div class="section-title" style="margin-bottom:20px">
              ✉️ 메일 (SMTP) 설정
              <span style="font-size:0.75rem;font-weight:400;color:var(--text-muted);margin-left:8px">— 견적서·발주서 이메일 발송에 사용됩니다</span>
            </div>
            <div class="form-grid">
              <div class="form-group">
                <label>SMTP 호스트</label>
                <input type="text" id="smtp-host" value="${escHtml(sysSettings.smtp_host||'')}" placeholder="smtp.gmail.com">
              </div>
              <div class="form-group">
                <label>포트</label>
                <input type="number" id="smtp-port" value="${sysSettings.smtp_port||'587'}" placeholder="587">
              </div>
              <div class="form-group">
                <label>계정 (이메일)</label>
                <input type="email" id="smtp-user" value="${escHtml(sysSettings.smtp_user||'')}" placeholder="your@company.com">
              </div>
              <div class="form-group">
                <label>비밀번호 / 앱 패스워드</label>
                <input type="password" id="smtp-pass" value="" placeholder="저장된 값 있음: ${sysSettings.smtp_pass?'예':'아니오'}">
                <div style="font-size:0.72rem;color:var(--text-muted);margin-top:3px">Gmail은 앱 비밀번호를 사용하세요. 비워두면 기존 값 유지.</div>
              </div>
              <div class="form-group" style="grid-column:1/-1">
                <label>발신자 표시 이름/주소 (From)</label>
                <input type="text" id="smtp-from" value="${escHtml(sysSettings.smtp_from||'')}" placeholder="Antigravity ERP &lt;noreply@company.com&gt;">
              </div>
              <div class="form-group">
                <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
                  <input type="checkbox" id="smtp-secure" ${sysSettings.smtp_secure==='true'?'checked':''}>
                  <span>SSL/TLS 사용 (포트 465)</span>
                </label>
              </div>
            </div>
            <div style="margin-top:20px;display:flex;gap:8px;justify-content:flex-end">
              <button class="btn btn-secondary" id="test-smtp-btn">연결 테스트</button>
              <button class="btn btn-primary" id="save-mail-btn">메일 설정 저장</button>
            </div>
          </div>
          <div class="card" style="max-width:800px;margin-top:16px">
            <div class="section-title" style="margin-bottom:16px">🔑 AI API 키 직접 입력 (DB 저장)</div>
            <div class="alert alert-info" style="margin-bottom:14px;font-size:0.82rem">
              아래에 입력하면 DB에 저장되어 .env보다 우선 적용됩니다. 비워두면 .env 값 사용.
            </div>
            <div class="form-grid">
              <div class="form-group"><label>Gemini API Key</label>
                <input type="password" id="ai-gemini-key" value="" placeholder="${sysSettings.ai_gemini_key?'저장됨 (수정하려면 입력)':'미설정'}">
              </div>
              <div class="form-group"><label>Anthropic (Claude) API Key</label>
                <input type="password" id="ai-claude-key" value="" placeholder="${sysSettings.ai_claude_key?'저장됨 (수정하려면 입력)':'미설정'}">
              </div>
              <div class="form-group"><label>OpenAI API Key</label>
                <input type="password" id="ai-openai-key" value="" placeholder="${sysSettings.ai_openai_key?'저장됨 (수정하려면 입력)':'미설정'}">
              </div>
            </div>
            <div style="margin-top:16px;display:flex;justify-content:flex-end">
              <button class="btn btn-primary" id="save-aikeys-btn">AI 키 저장</button>
            </div>
          </div>
        </div>

        <!-- 자사 정보 패널 -->
        <div id="panel-company" style="display:${_tab==='company'?'block':'none'}">
          <div class="card" style="max-width:800px">
            <div class="section-title" style="margin-bottom:20px">
              🏢 자사 정보 관리
              <span style="font-size:0.75rem;font-weight:400;color:var(--text-muted);margin-left:8px">— 거래명세서·발주서 등 PDF 출력에 자동 반영됩니다</span>
            </div>
            <div class="form-grid">
              <div class="form-group">
                <label>상호 (회사명) <span class="required">*</span></label>
                <input type="text" id="cp-name" value="${escHtml(profile.name||'')}" placeholder="(주)Antigravity">
              </div>
              <div class="form-group">
                <label>사업자등록번호</label>
                <input type="text" id="cp-bizno" value="${escHtml(profile.business_no||'')}" placeholder="000-00-00000">
              </div>
              <div class="form-group">
                <label>대표자명</label>
                <input type="text" id="cp-ceo" value="${escHtml(profile.ceo||'')}" placeholder="홍길동">
              </div>
              <div class="form-group">
                <label>전화번호</label>
                <input type="text" id="cp-phone" value="${escHtml(profile.phone||'')}" placeholder="02-0000-0000">
              </div>
              <div class="form-group">
                <label>업태</label>
                <input type="text" id="cp-btype" value="${escHtml(profile.business_type||'')}" placeholder="제조, 도매">
              </div>
              <div class="form-group">
                <label>종목</label>
                <input type="text" id="cp-bitem" value="${escHtml(profile.business_item||'')}" placeholder="전자부품">
              </div>
              <div class="form-group" style="grid-column:1/-1">
                <label>주사업장 주소</label>
                <input type="text" id="cp-addr" value="${escHtml(profile.address||'')}" placeholder="서울시 강남구 ...">
              </div>
              <div class="form-group">
                <label>팩스번호</label>
                <input type="text" id="cp-fax" value="${escHtml(profile.fax||'')}" placeholder="02-0000-0001">
              </div>
              <div class="form-group">
                <label>이메일</label>
                <input type="email" id="cp-email" value="${escHtml(profile.email||'')}" placeholder="info@company.com">
              </div>
              <div class="form-group" style="grid-column:1/-1">
                <label>회사 로고 이미지 URL / 경로</label>
                <input type="text" id="cp-logo" value="${escHtml(profile.logo_url||'')}" placeholder="/uploads/company/logo.png">
                ${profile.logo_url ? `<div style="margin-top:6px"><img src="${escHtml(profile.logo_url)}" style="height:40px;border-radius:4px;border:1px solid var(--border)" onerror="this.style.display='none'"></div>` : ''}
              </div>
              <div class="form-group" style="grid-column:1/-1">
                <label>직인 이미지 URL / 경로 <span style="font-size:0.75rem;color:var(--text-muted)">(PDF 공급자 란에 자동 삽입)</span></label>
                <input type="text" id="cp-seal" value="${escHtml(profile.seal_url||'')}" placeholder="/uploads/company/seal.png">
                ${profile.seal_url ? `<div style="margin-top:6px"><img src="${escHtml(profile.seal_url)}" style="height:60px;border-radius:4px;border:1px solid var(--border)" onerror="this.style.display='none'"></div>` : ''}
                <div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px">※ 로컬 파일은 <code>/uploads/company/</code> 하위에 업로드 후 경로를 입력하세요.</div>
              </div>
            </div>
            ${profile.updated_at ? `<div style="font-size:0.75rem;color:var(--text-muted);margin-top:8px">최근 저장: ${profile.updated_at}</div>` : ''}
            <div style="margin-top:24px;display:flex;justify-content:flex-end">
              <button class="btn btn-primary" id="save-company-btn">자사 정보 저장</button>
            </div>
          </div>
        </div>
      </div>

      <style>
        .settings-tab {
          padding: 8px 20px; border: none; background: none; color: var(--text-muted);
          font-size: 0.9rem; cursor: pointer; border-bottom: 2px solid transparent;
          margin-bottom: -1px; transition: all 0.15s;
        }
        .settings-tab:hover { color: var(--text-primary); }
        .settings-tab.active { color: var(--primary-light); border-bottom-color: var(--primary-light); font-weight: 600; }
        .engine-card { padding:20px; border:2px solid var(--border); border-radius:var(--radius-md); cursor:pointer; transition:all 0.2s; background:var(--bg-glass); }
        .engine-card:hover { border-color:var(--primary-light); background:rgba(255,255,255,0.05); }
        .engine-card.active { border-color:var(--primary); background:rgba(108,99,255,0.1); box-shadow:0 0 15px rgba(108,99,255,0.2); }
        .engine-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; }
        .engine-name { font-weight:700; font-size:1.1rem; }
        .engine-desc { font-size:0.85rem; color:var(--text-muted); line-height:1.5; margin-bottom:16px; }
        .engine-status { font-size:0.75rem; font-weight:500; }
      </style>
    `;

    initAI(config.engine);
    initCompany();
    initMail();

    document.querySelectorAll('.settings-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        _tab = btn.dataset.tab;
        document.querySelectorAll('.settings-tab').forEach(b => b.classList.toggle('active', b === btn));
        document.getElementById('panel-ai').style.display      = _tab === 'ai'      ? 'block' : 'none';
        document.getElementById('panel-company').style.display = _tab === 'company' ? 'block' : 'none';
        document.getElementById('panel-mail').style.display    = _tab === 'mail'    ? 'block' : 'none';
      });
    });
  }

  function escHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function initAI(currentEngine) {
    let selected = currentEngine;
    const cards = {
      gemini: document.getElementById('en-gemini'),
      claude: document.getElementById('en-claude'),
      'claude-opus': document.getElementById('en-claude-opus'),
    };
    const selectEngine = (eng) => {
      selected = eng;
      Object.entries(cards).forEach(([k, el]) => {
        if (!el) return;
        el.classList.toggle('active', k === eng);
        el.style.borderColor = k === eng ? (k === 'claude-opus' ? 'var(--warning)' : 'var(--primary)') : 'var(--border)';
      });
    };
    cards.gemini?.addEventListener('click', () => selectEngine('gemini'));
    cards.claude?.addEventListener('click', () => selectEngine('claude'));
    cards['claude-opus']?.addEventListener('click', () => selectEngine('claude-opus'));
    selectEngine(currentEngine);

    document.getElementById('save-ai-btn').onclick = async () => {
      try {
        await API.post('/ai/config', { engine: selected });
        showToast('AI 설정을 저장했습니다.', 'success');
      } catch (err) { showToast(err.message, 'error'); }
    };
  }

  function initMail() {
    document.getElementById('test-smtp-btn')?.addEventListener('click', async () => {
      try {
        const r = await API.get('/email/test');
        showToast(r.message || 'SMTP 연결 성공', 'success');
      } catch (err) { showToast(err.message, 'error'); }
    });

    document.getElementById('save-mail-btn')?.addEventListener('click', async () => {
      const body = {
        smtp_host:   document.getElementById('smtp-host').value.trim(),
        smtp_port:   document.getElementById('smtp-port').value.trim(),
        smtp_user:   document.getElementById('smtp-user').value.trim(),
        smtp_from:   document.getElementById('smtp-from').value.trim(),
        smtp_secure: document.getElementById('smtp-secure').checked ? 'true' : 'false',
      };
      const pass = document.getElementById('smtp-pass').value;
      if (pass) body.smtp_pass = pass;
      try {
        await API.put('/system-settings', body);
        showToast('메일 설정이 저장되었습니다.', 'success');
      } catch (err) { showToast(err.message, 'error'); }
    });

    document.getElementById('save-aikeys-btn')?.addEventListener('click', async () => {
      const body = {};
      const gemini = document.getElementById('ai-gemini-key').value.trim();
      const claude = document.getElementById('ai-claude-key').value.trim();
      const openai = document.getElementById('ai-openai-key').value.trim();
      if (gemini) body.ai_gemini_key = gemini;
      if (claude) body.ai_claude_key = claude;
      if (openai) body.ai_openai_key = openai;
      if (!Object.keys(body).length) return showToast('변경할 키를 입력하세요.', 'warn');
      try {
        await API.put('/system-settings', body);
        showToast('AI 키가 저장되었습니다. 서버 재시작 없이 즉시 적용됩니다.', 'success');
        render();
      } catch (err) { showToast(err.message, 'error'); }
    });
  }

  function initCompany() {
    document.getElementById('save-company-btn').onclick = async () => {
      const body = {
        name:          document.getElementById('cp-name').value.trim(),
        business_no:   document.getElementById('cp-bizno').value.trim(),
        ceo:           document.getElementById('cp-ceo').value.trim(),
        phone:         document.getElementById('cp-phone').value.trim(),
        business_type: document.getElementById('cp-btype').value.trim(),
        business_item: document.getElementById('cp-bitem').value.trim(),
        address:       document.getElementById('cp-addr').value.trim(),
        fax:           document.getElementById('cp-fax').value.trim(),
        email:         document.getElementById('cp-email').value.trim(),
        logo_url:      document.getElementById('cp-logo').value.trim() || null,
        seal_url:      document.getElementById('cp-seal').value.trim() || null,
      };
      try {
        await API.put('/company-profile', body);
        showToast('자사 정보가 저장되었습니다.', 'success');
        render();
      } catch (err) { showToast(err.message, 'error'); }
    };
  }

  return { render };
})();

window.Settings = Settings;
