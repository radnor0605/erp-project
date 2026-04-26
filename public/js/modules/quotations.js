/* ─── Quotations Module ─── */
const Quotations = (() => {
  let _filters = { status: '', customer_code: '' };

  function reset() { _filters = { status: '', customer_code: '' }; }

  async function render() {
    const [quotes, customers, expiring] = await Promise.all([
      API.get('/quotations'),
      API.get('/partners?type=customer'),
      API.get('/quotations/expiring?days=7').catch(() => []),
    ]);

    const html = `
      <div class="page-header">
        <div>
          <h2 class="page-title">견적 관리</h2>
          <p class="page-subtitle">견적서 작성 및 수주 전환 관리</p>
        </div>
        <button class="btn btn-primary" id="new-quo-btn">
          <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clip-rule="evenodd"/></svg>
          신규 견적 작성
        </button>
      </div>

      ${expiring.length ? `
      <div class="alert alert-warning" style="margin-bottom:12px;display:flex;align-items:center;gap:12px">
        <span style="font-size:1.1rem">⏰</span>
        <strong>유효기간 만료 임박 ${expiring.length}건</strong>
        <span style="font-size:0.8rem;color:var(--text-muted)">${expiring.slice(0,3).map(q=>`${q.customer_name||q.customer_code} (${q.quote_no}, ~${formatDate(q.valid_until)})`).join(' / ')}${expiring.length>3?' 외 '+(expiring.length-3)+'건':''}</span>
      </div>` : ''}

      <div class="card" style="margin-bottom:12px;padding:12px 16px">
        <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center">
          <select id="quo-filter-status" style="width:130px">
            <option value="">전체 상태</option>
            <option value="견적" ${_filters.status==='견적'?'selected':''}>견적</option>
            <option value="수주" ${_filters.status==='수주'?'selected':''}>수주</option>
            <option value="만료" ${_filters.status==='만료'?'selected':''}>만료</option>
          </select>
          <select id="quo-filter-customer" style="width:180px">
            <option value="">전체 고객사</option>
            ${customers.map(c=>`<option value="${c.code}" ${c.code===_filters.customer_code?'selected':''}>${c.name}</option>`).join('')}
          </select>
          <button class="btn btn-secondary" id="quo-apply-filter">조회</button>
        </div>
      </div>

      <div class="card">
        <table class="table hover">
          <thead><tr>
            <th>견적번호</th><th>견적일</th><th>고객사</th><th>유효기간</th>
            <th class="num">견적금액</th><th>상태</th><th>작업</th>
          </tr></thead>
          <tbody>
            ${quotes.length ? quotes.map(q => {
              const isExpiring = q.valid_until && q.status === '견적' && new Date(q.valid_until) <= new Date(Date.now() + 7*86400000);
              const isExpired  = q.valid_until && q.status === '견적' && new Date(q.valid_until) < new Date();
              return `<tr class="clickable-row" data-id="${q.id}">
                <td><span class="mono" style="color:var(--primary-light)">${q.quote_no}</span></td>
                <td>${formatDate(q.quote_date)}</td>
                <td class="font-bold">${q.customer_name||q.customer_code}</td>
                <td style="color:${isExpired?'var(--danger)':isExpiring?'var(--warning)':''}">
                  ${formatDate(q.valid_until)||'-'}${isExpired?' ⚠️만료':isExpiring?' ⏰임박':''}
                </td>
                <td class="num font-bold">${formatCurrency(q.total_amount)}</td>
                <td>${q.status==='견적'?'<span class="badge badge-info">견적</span>':q.status==='수주'?'<span class="badge badge-success">수주전환</span>':'<span class="badge badge-ghost">'+q.status+'</span>'}</td>
                <td>
                  <div class="table-actions">
                    ${q.status==='견적'?`<button class="btn btn-xs btn-primary convert-quo" data-id="${q.id}" data-no="${q.quote_no}">수주전환</button>`:''}
                    <button class="btn btn-xs btn-secondary print-quo" data-id="${q.id}" title="PDF 출력">
                      <svg viewBox="0 0 20 20" fill="currentColor" style="width:11px;height:11px"><path fill-rule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a1 1 0 001 1h8a1 1 0 001-1v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a1 1 0 00-1-1H6a1 1 0 00-1 1zm2 0h6v3H7V4zm-1 9v-2a1 1 0 011-1h6a1 1 0 011 1v2H6zm7 2H7v-1h6v1z" clip-rule="evenodd"/></svg>출력
                    </button>
                    <button class="btn btn-xs btn-ghost send-quo" data-id="${q.id}" data-no="${q.quote_no}" data-email="${q.customer_email||''}" title="이메일 발송">
                      <svg viewBox="0 0 20 20" fill="currentColor" style="width:11px;height:11px"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/></svg>발송
                    </button>
                    <button class="btn btn-xs btn-danger del-quo" data-id="${q.id}">삭제</button>
                  </div>
                </td>
              </tr>`;
            }).join('') : `<tr><td colspan="7" class="text-center">${emptyHTML('견적서가 없습니다')}</td></tr>`}
          </tbody>
        </table>
      </div>
    `;
    return html;
  }

  function init() {
    document.getElementById('new-quo-btn')?.addEventListener('click', showQuoForm);

    document.getElementById('quo-apply-filter')?.addEventListener('click', () => {
      _filters.status = document.getElementById('quo-filter-status').value;
      _filters.customer_code = document.getElementById('quo-filter-customer').value;
      Router.navigate('quotations');
    });

    document.querySelectorAll('.clickable-row').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        viewQuoDetail(row.dataset.id);
      });
    });

    document.querySelectorAll('.convert-quo').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        showConvertConfirm(btn.dataset.id, btn.dataset.no);
      });
    });

    document.querySelectorAll('.del-quo').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        confirmDialog('견적서를 삭제하시겠습니까?', async () => {
          await API.delete(`/quotations/${btn.dataset.id}`);
          showToast('삭제되었습니다.', 'success');
          Router.navigate('quotations');
        });
      });
    });

    document.querySelectorAll('.print-quo').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        window.open(`/api/quotations/${btn.dataset.id}/print?token=${localStorage.getItem('ag_token')}`, '_blank');
      });
    });

    document.querySelectorAll('.send-quo').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const q = await API.get(`/quotations/${btn.dataset.id}`).catch(() => null);
        showEmailModal({
          to: q?.customer_email || btn.dataset.email || '',
          subject: `[견적서] ${btn.dataset.no} 송부드립니다`,
          body: `안녕하세요,\n\n견적번호 ${btn.dataset.no}에 대한 견적서를 송부드립니다.\n\n견적금액: ${q ? formatCurrency(q.total_amount) : ''}\n유효기간: ${q?.valid_until || '-'}\n\n검토 후 회신 부탁드립니다.\n\n감사합니다.`,
          docType: 'quotation',
          docId: btn.dataset.id,
        });
      });
    });
  }

  async function viewQuoDetail(id) {
    const q = await API.get(`/quotations/${id}`);
    const html = `
      <div class="modal-header">
        <div class="modal-title">견적서 상세 [${q.quote_no}]</div>
        <button class="modal-close"><svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg></button>
      </div>
      <div class="modal-body">
        <div class="details-grid" style="margin-bottom:16px">
          <div class="detail-item"><label>고객사</label><span>${q.customer_name||q.customer_code}</span></div>
          <div class="detail-item"><label>견적일</label><span>${formatDate(q.quote_date)}</span></div>
          <div class="detail-item"><label>유효기간</label><span>${formatDate(q.valid_until)||'-'}</span></div>
          <div class="detail-item"><label>상태</label><span>${q.status}</span></div>
          ${q.notes?`<div class="detail-item full"><label>비고</label><span>${q.notes}</span></div>`:''}
        </div>
        <table class="table">
          <thead><tr><th>품목</th><th class="num">수량</th><th class="num">단가</th><th class="num">기준단가</th><th class="num">마진</th><th class="num">합계</th></tr></thead>
          <tbody>
            ${(q.items||[]).map(i=>`
              <tr>
                <td>${i.material_name||i.material_code} <span class="mono" style="font-size:0.7rem;color:var(--text-muted)">(${i.material_code})</span></td>
                <td class="num">${formatNumber(i.qty)}</td>
                <td class="num">${formatCurrency(i.unit_price)}</td>
                <td class="num" style="color:var(--text-muted)">${formatCurrency(i.std_price)}</td>
                <td class="num" style="color:${i.margin_rate<0?'var(--danger)':i.margin_rate<5?'var(--warning)':'var(--success)'}">${(i.margin_rate||0).toFixed(1)}%</td>
                <td class="num font-bold">${formatCurrency(i.qty*i.unit_price)}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot><tr>
            <td colspan="5" class="text-right font-bold">합계</td>
            <td class="num font-bold text-primary">${formatCurrency(q.total_amount)}</td>
          </tr></tfoot>
        </table>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary modal-close">닫기</button>
        ${q.status==='견적'?`<button class="btn btn-primary" id="detail-convert-btn">수주 전환</button>`:''}
      </div>
    `;
    openModal(html, 'modal-wide', { persistent: true });
    document.getElementById('detail-convert-btn')?.addEventListener('click', () => {
      closeModal();
      showConvertConfirm(id, q.quote_no);
    });
  }

  async function showQuoForm() {
    const [customers, materials] = await Promise.all([
      API.get('/partners?type=customer'),
      API.get('/materials'),
    ]);
    const matMap = {};
    materials.forEach(m => matMap[m.code] = m);

    const vDate = new Date(); vDate.setDate(vDate.getDate()+30);
    const defaultValid = vDate.toISOString().slice(0,10);

    const html = `
      <div class="modal-header">
        <div class="modal-title">신규 견적서 작성</div>
        <button class="modal-close"><svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg></button>
      </div>
      <div class="modal-body">
        <form id="quo-form">
          <div class="grid-form" style="margin-bottom:20px">
            <div class="form-group">
              <label>고객사 <span class="required">*</span></label>
              <select id="quo-cust" name="customer_code" required>
                <option value="">고객사 선택</option>
                ${customers.map(c=>`<option value="${c.code}">${c.name} (${c.code})</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>견적일 <span class="required">*</span></label>
              <input type="date" name="quote_date" value="${today()}" required>
            </div>
            <div class="form-group">
              <label>유효기간</label>
              <input type="date" name="valid_until" value="${defaultValid}">
            </div>
            <div class="form-group">
              <label>비고</label>
              <input type="text" name="notes" placeholder="견적 특이사항">
            </div>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <strong style="font-size:0.85rem">견적 품목</strong>
            <button type="button" class="btn btn-sm btn-ghost" id="quo-add-row">+ 품목 추가</button>
          </div>
          <div style="overflow-x:auto">
            <table class="table">
              <thead><tr>
                <th style="min-width:220px">품목</th>
                <th style="width:90px">수량</th>
                <th style="width:140px">견적단가</th>
                <th style="width:110px">기준단가</th>
                <th style="width:80px">마진율</th>
                <th style="width:36px"></th>
              </tr></thead>
              <tbody id="quo-items-body"></tbody>
              <tfoot><tr>
                <td colspan="3" class="text-right font-bold">견적 합계</td>
                <td colspan="3" class="font-bold text-primary" id="quo-total-cell">0원</td>
              </tr></tfoot>
            </table>
          </div>
        </form>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="quo-cancel-btn">취소</button>
        <button class="btn btn-primary" id="quo-save-btn">견적 저장</button>
      </div>
    `;
    openModal(html, 'modal-wide', { persistent: true });

    // Wire cancel
    document.getElementById('quo-cancel-btn').addEventListener('click', closeModal);

    function addRow(code='', qty=1, price='') {
      const tr = document.createElement('tr');
      tr.className = 'quo-row';
      tr.innerHTML = `
        <td><select class="quo-mat">
          <option value="">품목 선택</option>
          ${materials.map(m=>`<option value="${m.code}" ${m.code===code?'selected':''}>${m.name} (${m.code})</option>`).join('')}
        </select></td>
        <td><input type="number" class="quo-qty" value="${qty}" min="1" step="any" style="width:80px"></td>
        <td><input type="number" class="quo-price" value="${price||0}" min="0" step="any" style="width:120px" placeholder="0"></td>
        <td class="quo-std num text-muted" style="font-size:0.8rem">-</td>
        <td class="quo-mrg num" style="font-size:0.8rem">-</td>
        <td><button type="button" style="background:none;border:none;cursor:pointer;color:var(--danger);font-size:1.1rem" class="quo-del-row">×</button></td>
      `;
      document.getElementById('quo-items-body').appendChild(tr);

      const matSel = tr.querySelector('.quo-mat');
      const qtyInp = tr.querySelector('.quo-qty');
      const priceInp = tr.querySelector('.quo-price');

      const calcRow = () => {
        const m = matMap[matSel.value];
        if (!m) return;
        const map = m.avg_price || 0;
        const std = m.standard_unit_price || m.standard_price || map || 0;
        const p   = parseFloat(priceInp.value) || 0;
        tr.querySelector('.quo-std').textContent = std ? formatCurrency(std) : '-';
        // margin vs MAP (loss guard)
        const base = map || std;
        const mrg  = base > 0 ? ((p - base) / base * 100) : 0;
        const mEl  = tr.querySelector('.quo-mrg');
        if (base > 0) {
          mEl.textContent = mrg.toFixed(1) + '%' + (mrg < 0 ? ' ⚠️손실' : mrg < 5 ? ' ⚠️저마진' : '');
          mEl.style.color = mrg < 0 ? 'var(--danger)' : mrg < 5 ? 'var(--warning)' : 'var(--success)';
          priceInp.style.borderColor = mrg < 0 ? 'var(--danger)' : '';
        } else {
          mEl.textContent = '-'; priceInp.style.borderColor = '';
        }
        updateTotal();
      };

      matSel.addEventListener('change', async () => {
        const m = matMap[matSel.value];
        if (!m) return;
        const custCode = document.getElementById('quo-cust').value;
        const lastPrices = custCode
          ? await API.get(`/sales-orders/last-prices?customer_code=${custCode}&material_code=${m.code}`).catch(()=>[])
          : [];
        priceInp.value = lastPrices[0]?.unit_price || m.standard_unit_price || m.avg_price || 0;
        if (lastPrices[0]) {
          priceInp.title = `최종거래단가: ${formatCurrency(lastPrices[0].unit_price)} (${lastPrices[0].order_date})`;
          priceInp.style.borderColor = 'var(--info,#06b6d4)';
        }
        calcRow();
      });

      if (code) matSel.dispatchEvent(new Event('change'));
      qtyInp.addEventListener('input', calcRow);
      priceInp.addEventListener('input', calcRow);
      tr.querySelector('.quo-del-row').addEventListener('click', () => { tr.remove(); updateTotal(); });
    }

    function updateTotal() {
      let sum = 0;
      document.querySelectorAll('#quo-items-body .quo-row').forEach(r => {
        sum += (parseFloat(r.querySelector('.quo-qty').value)||0) * (parseFloat(r.querySelector('.quo-price').value)||0);
      });
      document.getElementById('quo-total-cell').textContent = formatCurrency(sum);
    }

    document.getElementById('quo-add-row').addEventListener('click', () => addRow());
    addRow(); // start with one row

    document.getElementById('quo-save-btn').addEventListener('click', async () => {
      const fd = new FormData(document.getElementById('quo-form'));
      const data = Object.fromEntries(fd);
      if (!data.customer_code) return showToast('고객사를 선택하세요.', 'error');

      const items = [];
      let hasNegMargin = false;
      document.querySelectorAll('#quo-items-body .quo-row').forEach(r => {
        const mc = r.querySelector('.quo-mat').value;
        const q2 = parseFloat(r.querySelector('.quo-qty').value)||0;
        const p = parseFloat(r.querySelector('.quo-price').value)||0;
        if (mc && q2 > 0) {
          if (r.querySelector('.quo-mrg').style.color === 'var(--danger)') hasNegMargin = true;
          items.push({ material_code: mc, qty: q2, unit_price: p });
        }
      });
      if (!items.length) return showToast('품목을 하나 이상 추가하세요.', 'error');

      const doSave = async () => {
        const saveBtn = document.getElementById('quo-save-btn');
        if (!saveBtn) return;
        saveBtn.disabled = true; saveBtn.textContent = '저장 중...';
        try {
          const res = await API.post('/quotations', { ...data, items });
          showToast(`견적서 저장 완료: ${res.quote_no}`, 'success');
          closeModal();
          Router.navigate('quotations');
        } catch (err) {
          saveBtn.disabled = false; saveBtn.textContent = '견적 저장';
          showToast(err.message, 'error');
        }
      };

      if (hasNegMargin) {
        confirmDialog('⚠️ 역마진 품목이 포함되어 있습니다 (단가 < MAP). 이익률이 손실 구간입니다. 그래도 저장하시겠습니까?', doSave);
      } else {
        await doSave();
      }
    });
  }

  async function showConvertConfirm(id, quoteNo) {
    // 프리뷰: 견적 상세 + ATP 체크를 보여주는 80% 모달
    const q = await API.get(`/quotations/${id}`);
    const today_dt = new Date().toISOString().slice(0, 10);

    // ATP 체크 (가용재고 조회)
    const atpRows = await Promise.all((q.items || []).map(async i => {
      try {
        const inv = await API.get(`/inventory?material_code=${i.material_code}`);
        const avail = (inv || []).filter(r => r.stock_type === '가용').reduce((s, r) => s + (r.qty || 0), 0);
        const shortage = Math.max(0, i.qty - avail);
        return { ...i, available: avail, shortage };
      } catch { return { ...i, available: 0, shortage: i.qty }; }
    }));

    const hasShortage = atpRows.some(r => r.shortage > 0);

    const html = `
      <div class="modal-header">
        <div class="modal-title">수주 전환 확인 — ${quoteNo}</div>
        <button class="modal-close"><svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414-1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg></button>
      </div>
      <div class="modal-body">
        ${hasShortage ? `
        <div class="alert alert-warning" style="margin-bottom:14px;display:flex;align-items:center;gap:10px">
          <span style="font-size:1.2rem">⚠️</span>
          <div>
            <strong>ATP 경고 — 재고 부족 품목 존재</strong>
            <div style="font-size:0.78rem;margin-top:2px">부족 품목에 대해 <strong>발주 초안(Draft PO)</strong>이 자동 생성됩니다. 구매팀에서 검토 후 승인하세요.</div>
          </div>
        </div>` : `
        <div class="alert alert-success" style="margin-bottom:14px;display:flex;align-items:center;gap:10px">
          <span style="font-size:1.2rem">✓</span><strong>재고 충분 — 즉시 수주 가능합니다.</strong>
        </div>`}

        <table class="table" style="font-size:0.82rem">
          <thead><tr>
            <th>품목</th>
            <th class="num">수주수량</th>
            <th class="num">가용재고</th>
            <th class="num">부족</th>
            <th class="num">MOQ 기반 권고수량</th>
            <th>출고 예정일</th>
            <th>상태</th>
          </tr></thead>
          <tbody>
            ${atpRows.map(r => {
              const moq  = r.moq || 1;
              const sugg = r.shortage > 0 ? Math.ceil(r.shortage / moq) * moq : 0;
              const lt   = r.lead_time || 0;
              let estDate = '-';
              if (r.shortage > 0 && lt > 0) {
                const d = new Date(); d.setDate(d.getDate() + lt);
                estDate = `~${d.toISOString().slice(0,10)} (↑${lt}일)`;
              } else if (r.shortage === 0) {
                estDate = `${today_dt} ✓`;
              }
              const statusHtml = r.shortage > 0
                ? `<span style="color:var(--danger)">⚠️ 부족 ${r.shortage}</span>`
                : `<span style="color:var(--success)">✓ 충족</span>`;
              return `<tr>
                <td>${r.material_name || r.material_code}</td>
                <td class="num">${formatNumber(r.qty)}</td>
                <td class="num">${formatNumber(r.available)}</td>
                <td class="num" style="color:${r.shortage>0?'var(--danger)':'var(--success)'}">
                  ${r.shortage > 0 ? `↓ ${r.shortage}` : '0'}
                </td>
                <td class="num" style="color:var(--warning)">
                  ${sugg > 0 ? `${formatNumber(sugg)} (MOQ: ${moq})` : '-'}
                </td>
                <td style="font-size:0.78rem">${estDate}</td>
                <td>${statusHtml}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>

        <div class="details-grid" style="margin-top:14px">
          <div class="detail-item"><label>고객사</label><span>${q.customer_name || q.customer_code}</span></div>
          <div class="detail-item"><label>견적금액</label><span class="font-bold text-primary">${formatCurrency(q.total_amount)}</span></div>
          <div class="detail-item"><label>유효기간</label><span>${formatDate(q.valid_until) || '-'}</span></div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary modal-close">취소</button>
        <button class="btn btn-primary" id="do-convert-btn">
          ${hasShortage ? '수주전환 + 발주초안 자동생성' : '수주 전환 확정'}
        </button>
      </div>
    `;
    openModal(html, 'modal-xl', { persistent: true });

    document.getElementById('do-convert-btn')?.addEventListener('click', async () => {
      const btn = document.getElementById('do-convert-btn');
      btn.disabled = true; btn.textContent = '처리 중...';
      try {
        const r = await API.put(`/quotations/${id}/convert`, {});
        let msg = `수주 전환 완료: ${r.so_no}`;
        if (r.atp_warnings?.length)  msg += ` | ⚠️ ATP ${r.atp_warnings.length}건`;
        if (r.draft_pos?.length)     msg += ` | 발주초안 ${r.draft_pos.length}건 자동생성`;
        showToast(msg, r.atp_warnings?.length ? 'warning' : 'success', 6000);
        closeModal();
        Router.navigate('quotations');
      } catch (err) {
        btn.disabled = false;
        btn.textContent = hasShortage ? '수주전환 + 발주초안 자동생성' : '수주 전환 확정';
        showToast(err.message, 'error');
      }
    });
  }

  return { render, init, reset };
})();
window.Quotations = Quotations;
