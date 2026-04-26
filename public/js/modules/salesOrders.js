const SalesOrders = (() => {
  let _filters = { status: '', customer_code: '', from: '', to: '' };

  function reset() {
    _filters = { status: '', customer_code: '', from: '', to: '' };
  }

  async function render(params = {}) {
    if (params.status) _filters.status = params.status;
    if (params.customer_code) _filters.customer_code = params.customer_code;
    
    const qs = new URLSearchParams(_filters).toString();
    const [orders, customers, expiringQuotes] = await Promise.all([
      API.get(`/sales-orders?${qs}`),
      API.get('/partners?type=customer'),
      API.get('/quotations/expiring?days=7').catch(() => []),
    ]);

    return `
      ${expiringQuotes.length ? `
      <div class="alert alert-warning" style="margin-bottom:12px;display:flex;align-items:center;gap:12px">
        <span style="font-size:1.1rem">⏰</span>
        <div>
          <strong>견적 유효기간 만료 임박 ${expiringQuotes.length}건</strong>
          <span style="font-size:0.8rem;margin-left:8px;color:var(--text-muted)">${expiringQuotes.slice(0,3).map(q=>`${q.customer_name} (${q.quote_no}, ~${formatDate(q.valid_until)})`).join(' / ')}${expiringQuotes.length>3?' 외 '+(expiringQuotes.length-3)+'건':''}</span>
        </div>
      </div>` : ''}
      <div class="page-header">
        <div>
          <h2 class="page-title">영업 주문 관리</h2>
          <p class="page-subtitle">판매 주문을 접수하고 출고 처리를 수행합니다.</p>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-secondary" id="scan-po-btn" title="고객사 발주서(PO) OCR 스캔 → SO 초안 자동 생성">
            <svg viewBox="0 0 20 20" fill="currentColor" style="width:14px;height:14px;margin-right:4px"><path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"/></svg>
            PO 스캔
          </button>
          <button class="btn btn-primary" id="new-so-btn">
            <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clip-rule="evenodd"/></svg>
            신규 주문 등록
          </button>
        </div>
      </div>

      <div class="card filter-card">
        <div class="filter-row">
          <div class="filter-group">
            <label>기간</label>
            <div class="date-range">
              <input type="date" id="filter-from" value="${_filters.from}">
              <span>~</span>
              <input type="date" id="filter-to" value="${_filters.to}">
            </div>
          </div>
          <div class="filter-group">
            <label>고객사</label>
            <select id="filter-customer">
              <option value="">전체 고객사</option>
              ${customers.map(c => `<option value="${c.code}" ${c.code===_filters.customer_code?'selected':''}>${c.name}</option>`).join('')}
            </select>
          </div>
          <div class="filter-group">
            <label>상태</label>
            <select id="filter-status">
              <option value="">전체 상태</option>
              <option value="수주" ${_filters.status==='수주'?'selected':''}>수주(견적전환)</option>
              <option value="주문" ${_filters.status==='주문'?'selected':''}>직접주문</option>
              <option value="출고" ${_filters.status==='출고'?'selected':''}>출고완료</option>
              <option value="마감" ${_filters.status==='마감'?'selected':''}>마감</option>
            </select>
          </div>
          <button class="btn btn-secondary" id="apply-filters">조회</button>
        </div>
      </div>

      <div class="card">
        <div class="table-responsive">
          <table class="table hover">
            <thead>
              <tr>
                <th>주문번호</th>
                <th>주문일자</th>
                <th>고객사</th>
                <th>품목수</th>
                <th>총액</th>
                <th>상태</th>
                <th>비고</th>
                <th>작업</th>
              </tr>
            </thead>
            <tbody>
              ${orders.length ? orders.map(o => `
                <tr class="clickable-row" data-id="${o.id}">
                  <td><span class="code-badge">${o.so_no}</span></td>
                  <td>${formatDate(o.order_date)}</td>
                  <td class="font-bold">${o.customer_name}</td>
                  <td class="text-right">${o.item_count}종</td>
                  <td class="text-right font-bold text-primary">${formatCurrency(o.total_amount)}</td>
                  <td>${salesOrderStatusBadge(o.status)}</td>
                  <td class="text-muted text-sm truncate" style="max-width:150px">${o.notes || '-'}</td>
                  <td>
                    <div class="table-actions" style="gap:4px">
                      ${o.status === '주문' || o.status === '수주' ? `<button class="btn btn-xs btn-success confirm-so" data-id="${o.id}">출고확정</button>` : ''}
                      ${(o.status === '출고' || o.status === '마감') && !o.statement_issued_at ? `<button class="btn btn-xs btn-secondary issue-stmt" data-id="${o.id}" title="거래명세서 PDF 발행">📄 명세서 발행</button>` : ''}
                      ${o.status === '출고' ? `<button class="btn btn-xs btn-secondary close-so" data-id="${o.id}" title="매출마감">마감</button>` : ''}
                      ${o.statement_path ? `<a class="btn btn-xs btn-ghost" href="/${o.statement_path}" target="_blank" title="명세서 다운로드"><svg viewBox="0 0 20 20" fill="currentColor" style="width:10px;height:10px;margin-right:2px"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>PDF</a>` : ''}
                      ${(o.status === '주문'||o.status === '수주') ? `<button class="btn btn-xs btn-danger delete-so" data-id="${o.id}" title="주문 삭제"><svg viewBox="0 0 20 20" fill="currentColor" style="width:11px;height:11px"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>삭제</button>` : ''}
                    </div>
                  </td>
                </tr>
              `).join('') : `<tr><td colspan="8" class="text-center">${emptyHTML('주문 내역이 없습니다.')}</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function init() {
    document.getElementById('new-so-btn').onclick  = () => showSOModal();
    document.getElementById('scan-po-btn').onclick = () => showScanPoModal();

    // 거래명세서 발행
    document.querySelectorAll('.issue-stmt').forEach(btn => {
      btn.onclick = async (e) => {
        e.stopPropagation();
        try {
          const r = await API.put(`/sales-orders/${btn.dataset.id}/issue-statement`, {});
          showToast(`명세서 ${r.already_issued ? '재다운로드' : '생성 완료'}: ${r.file_name} (${r.size_kb}KB)`, 'success');
          window.open('/' + r.path, '_blank');
          Router.navigate('sales-orders');
        } catch (err) { showToast(err.message, 'error'); }
      };
    });

    // 매출마감
    document.querySelectorAll('.close-so').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        confirmDialog('매출마감 처리하시겠습니까? 전표가 확정됩니다.', async () => {
          try {
            await API.put(`/sales-orders/${btn.dataset.id}/close`, {});
            showToast('매출마감 완료', 'success');
            Router.navigate('sales-orders');
          } catch (err) { showToast(err.message, 'error'); }
        });
      };
    });

    document.querySelectorAll('.clickable-row').forEach(row => {
      row.onclick = (e) => {
        if (e.target.closest('button') || e.target.closest('a')) return;
        viewSODetails(row.dataset.id);
      };
    });

    document.querySelectorAll('.confirm-so').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        SalesOrders._showDeliveryDateModal(btn.dataset.id, null, null);
      };
    });

    document.querySelectorAll('.delete-so').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        confirmDialog('주문을 삭제하시겠습니까?', async () => {
          await API.delete(`/sales-orders/${btn.dataset.id}`);
          showToast('주문이 삭제되었습니다.', 'success');
          Router.navigate('sales-orders');
        });
      };
    });

    document.getElementById('apply-filters').onclick = () => {
      _filters.from = document.getElementById('filter-from').value;
      _filters.to = document.getElementById('filter-to').value;
      _filters.customer_code = document.getElementById('filter-customer').value;
      _filters.status = document.getElementById('filter-status').value;
      Router.navigate('sales-orders');
    };
  }

  async function showScanPoModal() {
    const customers = await API.get('/partners?type=customer').catch(() => []);
    const html = `
      <div class="modal-header">
        <div class="modal-title">고객사 발주서(PO) 스캔 → 수주 자동 생성</div>
        <button class="modal-close">×</button>
      </div>
      <div class="modal-body">
        <div style="padding:10px;background:rgba(99,102,241,0.06);border-radius:6px;margin-bottom:12px;font-size:0.8rem;color:#6366f1">
          ℹ️ 고객사가 보낸 발주서(PDF/이미지)를 AI가 판독하여 수주 초안을 자동 생성합니다.
        </div>
        <div class="form-group">
          <label>고객사 <span style="font-size:0.75rem;color:var(--text-muted)">(OCR로 자동 감지, 필요 시 수동 선택)</span></label>
          <select id="scan-customer">
            <option value="">OCR 자동 감지</option>
            ${customers.map(c => `<option value="${c.code}">${c.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>발주서 파일 <span class="required">*</span></label>
          <input type="file" id="scan-po-file" accept=".pdf,.jpg,.jpeg,.png,.webp" style="padding:8px">
        </div>
        <div id="scan-result" style="display:none;margin-top:12px"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary modal-close">취소</button>
        <button class="btn btn-primary" id="scan-po-run">📄 OCR 판독</button>
      </div>`;
    openModal(html, 'modal-wide', { persistent: true });

    document.getElementById('scan-po-run').onclick = async () => {
      const file = document.getElementById('scan-po-file').files[0];
      if (!file) return showToast('파일을 선택하세요.', 'error');
      const btn = document.getElementById('scan-po-run');
      btn.disabled = true; btn.textContent = '판독 중…';
      try {
        const b64  = await fileToBase64(file);
        const mime = file.type || 'application/pdf';
        const custCode = document.getElementById('scan-customer').value;
        const result = await API.post('/sales-orders/scan-po', { base64Data: b64, mediaType: mime, customer_code: custCode || undefined });
        renderScanResult(result);
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        btn.disabled = false; btn.textContent = '📄 OCR 판독';
      }
    };

    function renderScanResult(r) {
      const div = document.getElementById('scan-result');
      div.style.display = 'block';
      const atpHtml = r.atp_warnings?.length
        ? `<div class="safety-alert-banner" style="margin-bottom:8px">⚠️ ATP 재고 부족: ${r.atp_warnings.map(w=>`${w.name}(가용:${w.available} vs 요청:${w.requested})`).join(', ')}</div>`
        : '';
      const unmatchedHtml = r.unmatched_items?.length
        ? `<div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:8px">⚠️ 미매칭 품목: ${r.unmatched_items.join(', ')}</div>` : '';
      div.innerHTML = `
        ${atpHtml}${unmatchedHtml}
        <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:8px">
          OCR 신뢰도: <strong>${(r.ocr_confidence * 100).toFixed(0)}%</strong> | 소스: ${r.ocr_source}
          | 고객사: <strong>${r.draft.buyer_name || '-'}</strong>
          | 발주번호: <strong>${r.draft.po_number || '-'}</strong>
        </div>
        <table class="table table-sm" style="font-size:0.8rem">
          <thead><tr><th>업체 품목명</th><th>사내 품목명</th><th>수량</th><th>단가</th><th>매칭</th></tr></thead>
          <tbody>${r.draft.items.map(i => `
            <tr>
              <td style="color:var(--text-muted)">${i.vendor_name}</td>
              <td>${i.material_name || '<span style="color:#ef4444">미매칭</span>'}</td>
              <td class="num">${i.qty}</td>
              <td class="num">${formatCurrency(i.unit_price)}</td>
              <td>${i.matched ? '✓' : '✗'}</td>
            </tr>`).join('')}
          </tbody>
        </table>
        <button class="btn btn-primary" id="create-so-from-scan" style="margin-top:8px">이 데이터로 수주 등록</button>
      `;
      document.getElementById('create-so-from-scan').onclick = async () => {
        const items = r.draft.items.filter(i => i.material_code).map(i => ({
          material_code: i.material_code, qty: i.qty, unit_price: i.unit_price
        }));
        if (!items.length) return showToast('매칭된 품목이 없습니다. 마스터 등록 후 재시도하세요.', 'error');
        if (!r.draft.customer_code) return showToast('고객사를 수동으로 선택해주세요.', 'error');
        try {
          const res = await API.post('/sales-orders', {
            customer_code: r.draft.customer_code, order_date: r.draft.order_date,
            notes: `[PO스캔] ${r.draft.po_number || ''}`, items
          });
          showToast(`수주 등록 완료: ${res.so_no}`, 'success');
          closeModal();
          Router.navigate('sales-orders');
        } catch (err) { showToast(err.message, 'error'); }
      };
    }
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function showSOModal() {
    const customers = await API.get('/partners?type=customer');
    const materials = await API.get('/materials');
    
    const html = `
      <div class="modal-header">
        <div class="modal-title">신규 영업 주문 등록</div>
        <button class="modal-close"><svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg></button>
      </div>
      <div class="modal-body">
        <form id="so-form">
          <div class="grid-form" style="margin-bottom:24px">
            <div class="form-group">
              <label>고객사 <span class="required">*</span></label>
              <select name="customer_code" required>
                <option value="">고객사 선택</option>
                ${customers.map(c => `<option value="${c.code}">${c.name} (${c.code})</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>주문일자 <span class="required">*</span></label>
              <input type="date" name="order_date" value="${today()}" required>
            </div>
            <div class="form-group">
              <label>출고예정일</label>
              <input type="date" name="delivery_date">
            </div>
            <div class="form-group">
              <label>비고</label>
              <input type="text" name="notes" placeholder="주문 관련 특이사항">
            </div>
          </div>

          <div class="section-title">주문 품목</div>
          <div class="table-responsive">
            <table class="table" id="so-items-table">
              <thead>
                <tr>
                  <th style="width:220px">품목</th>
                  <th>가용재고</th>
                  <th style="width:80px">수량</th>
                  <th style="width:120px">단가(원)</th>
                  <th style="width:70px">할인(%)</th>
                  <th style="width:70px">세율(%)</th>
                  <th>합계(VAT)</th>
                  <th>마진(%)</th>
                  <th style="width:40px"></th>
                </tr>
              </thead>
              <tbody id="so-items-body"></tbody>
              <tfoot>
                <tr>
                  <td colspan="6" class="text-right font-bold">총 주문금액 (VAT 포함)</td>
                  <td class="text-right font-bold text-primary" id="total-price-sum">0원</td>
                  <td colspan="2"></td>
                </tr>
              </tfoot>
            </table>
          </div>
          <button type="button" class="btn btn-ghost btn-sm" style="margin-top:8px" id="add-item-row">
            <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clip-rule="evenodd"/></svg>
            품목 추가
          </button>
        </form>
        <div id="credit-limit-warning" class="alert alert-danger hidden" style="margin-top:16px">
          <div style="display:flex; align-items:center; gap:8px">
            <svg viewBox="0 0 20 20" fill="currentColor" style="width:20px"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92z" clip-rule="evenodd"/></svg>
            <span id="credit-warning-text"></span>
          </div>
          <div style="margin-top:8px">
            <label style="display:flex; align-items:center; gap:8px; cursor:pointer">
              <input type="checkbox" id="manager-approval-chk"> <strong>관리자 승인 후 강제 진행 (Manager Override)</strong>
            </label>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary modal-close">취소</button>
        <button class="btn btn-primary" id="save-so-btn">주문 저장</button>
      </div>
    `;
    openModal(html, 'modal-wide', { persistent: true });
    const form = document.getElementById('so-form');

    const materialMap = {};
    materials.forEach(m => materialMap[m.code] = m);

    function addItemRow() {
      const row = document.createElement('tr');
      row.className = 'so-item-row';
      row.innerHTML = `
        <td>
          <select name="items[].material_code" class="item-select" required>
            <option value="">품목 선택</option>
            ${materials.map(m => `<option value="${m.code}">${m.name} (${m.code})</option>`).join('')}
          </select>
        </td>
        <td class="text-right item-available">-</td>
        <td><input type="number" name="items[].qty" class="item-qty text-right" min="1" step="any" placeholder="0" required></td>
        <td><input type="number" name="items[].unit_price" class="item-price text-right" min="0" step="any" placeholder="0" required></td>
        <td><input type="number" name="items[].discount_rate" class="item-discount text-right" min="0" max="100" step="0.1" placeholder="0" value="0" title="할인율(%)"></td>
        <td><input type="number" name="items[].tax_rate" class="item-tax text-right" min="0" max="100" step="0.1" placeholder="10" value="10" title="부가세율(%)"></td>
        <td class="text-right item-sum">0원</td>
        <td class="text-right item-margin">-</td>
        <td><button type="button" class="btn-icon text-danger remove-row" onclick="this.closest('tr').remove(); document.getElementById('so-form').dispatchEvent(new Event('input', {bubbles:true})); updateTotals();"><svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg></button></td>
      `;
      document.getElementById('so-items-body').appendChild(row);

      const sel          = row.querySelector('.item-select');
      const qtyInput     = row.querySelector('.item-qty');
      const priceInput   = row.querySelector('.item-price');
      const discountInput = row.querySelector('.item-discount');
      const taxInput     = row.querySelector('.item-tax');

      sel.onchange = async () => {
        const code = sel.value;
        if (!code) return;
        const mat = materialMap[code];
        const [inv, lastPrices] = await Promise.all([
          API.get(`/inventory/status?material_code=${code}`),
          (() => {
            const custCode = document.querySelector('#so-form select[name="customer_code"]')?.value;
            return custCode ? API.get(`/sales-orders/last-prices?customer_code=${custCode}&material_code=${code}`).catch(()=>[]) : [];
          })(),
        ]);
        const available = inv.find ? (inv.find(i => i.stock_type === '가용')?.qty || 0) : 0;
        row.querySelector('.item-available').textContent = formatNumber(available);
        row.querySelector('.item-available').dataset.qty = available;

        const lastPrice = lastPrices[0]?.unit_price;
        if (lastPrice) {
          priceInput.value = lastPrice;
          priceInput.title = `고객사 최종거래단가: ${formatCurrency(lastPrice)} (${lastPrices[0].order_date})`;
          priceInput.style.borderColor = 'var(--info)';
        } else {
          priceInput.value = Math.round((mat.avg_price || 0) * 1.2 / 100) * 100;
          priceInput.title = '이동평균단가 기준 20% 마진 제안';
          priceInput.style.borderColor = '';
        }
        calculateRow();
      };

      const calculateRow = () => {
        const code = sel.value;
        if (!code) return;
        const qty      = parseFloat(qtyInput.value)     || 0;
        const price    = parseFloat(priceInput.value)   || 0;
        const dr       = Math.min(100, Math.max(0, parseFloat(discountInput.value) || 0)) / 100;
        const tr       = Math.min(100, Math.max(0, parseFloat(taxInput.value)      ?? 10)) / 100;
        const mat      = materialMap[code];
        const lineBase = qty * price * (1 - dr);
        const sum      = lineBase * (1 + tr);
        row.querySelector('.item-sum').textContent = formatCurrency(Math.round(sum));

        // Margin calculation (할인 후 단가 기준)
        const avgPrice   = mat.avg_price || 0;
        const effectiveP = price * (1 - dr);
        const marginRate = effectiveP > 0 ? ((effectiveP - avgPrice) / effectiveP) * 100 : 0;
        row.querySelector('.item-margin').textContent = marginRate.toFixed(1) + '%';
        row.querySelector('.item-margin').style.color = marginRate < 0 ? 'var(--danger)' : 'var(--success)';

        // Stock check UI
        const available = parseFloat(row.querySelector('.item-available').dataset.qty) || 0;
        qtyInput.style.color = qty > available ? 'var(--danger)' : '';

        updateTotalSum();
      };

      qtyInput.oninput     = calculateRow;
      priceInput.oninput   = calculateRow;
      discountInput.oninput = calculateRow;
      taxInput.oninput     = calculateRow;
      row.querySelector('.remove-row').onclick = () => { row.remove(); updateTotalSum(); };
    }

    function updateTotalSum() {
      let total = 0;
      document.querySelectorAll('#so-items-body .item-sum').forEach(el => {
        total += parseFloat(el.textContent.replace(/[^0-9.]/g, '')) || 0;
      });
      document.getElementById('total-price-sum').textContent = formatCurrency(Math.round(total));
    }

    document.getElementById('add-item-row').onclick = addItemRow;

    // Persistence Restore
    FormPersistence.restore('so-new', form, (data) => {
      const codes = Array.isArray(data['items[].material_code']) ? data['items[].material_code'] : (data['items[].material_code'] ? [data['items[].material_code']] : []);
      codes.forEach(() => addItemRow());
    });
    FormPersistence.bind('so-new', form);

    addItemRow(); // Start with one row

    document.getElementById('save-so-btn').onclick = async () => {
      const form = document.getElementById('so-form');
      const formData = new FormData(form);
      const data = Object.fromEntries(formData);
      
      const items = [];
      let stockError = false, negMarginItems = [];
      document.querySelectorAll('#so-items-body tr').forEach(row => {
        const matCode = row.querySelector('.item-select').value;
        const qty = parseFloat(row.querySelector('.item-qty').value);
        const price = parseFloat(row.querySelector('.item-price').value) || 0;
        const availableRaw = row.querySelector('.item-available').dataset.qty;
        const available = availableRaw !== undefined ? parseFloat(availableRaw) : null;

        if (matCode && qty > 0) {
          if (available !== null && qty > available) stockError = true;
          const marginEl = row.querySelector('.item-margin');
          if (marginEl && marginEl.textContent.startsWith('-')) negMarginItems.push(matCode);
          const dr = parseFloat(row.querySelector('.item-discount')?.value || 0) / 100;
          const tr = parseFloat(row.querySelector('.item-tax')?.value ?? 10) / 100;
          items.push({ material_code: matCode, qty, unit_price: price, discount_rate: dr, tax_rate: tr });
        }
      });

      if (stockError) {
        return showToast('가용 재고보다 많은 수량을 주문할 수 없습니다.', 'error');
      }
      if (negMarginItems.length) {
        showToast(`⚠️ 역마진 경고: ${negMarginItems.length}개 품목에서 판매가 < 원가입니다. 단가를 확인하세요.`, 'warning', 6000);
      }

      if (!data.customer_code) return showToast('고객사를 선택해주세요.', 'error');
      if (items.length === 0) return showToast('주문 품목을 하나 이상 추가해주세요.', 'error');

      const isApproved = document.getElementById('manager-approval-chk').checked;

      const saveBtn = document.getElementById('save-so-btn');
      if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '저장 중...'; }
      try {
        const result = await API.post('/sales-orders', { ...data, items, manager_approved: isApproved });
        FormPersistence.clear('so-new');
        const msg = result.atp_warnings?.length
          ? `주문 등록 완료 ⚠️ 백오더 ${result.atp_warnings.length}건: ${result.atp_warnings.map(w=>w.material_name).join(', ')}`
          : '주문이 등록되었습니다.';
        showToast(msg, result.atp_warnings?.length ? 'warning' : 'success', 5000);
        closeModal();
        Router.navigate('sales-orders');
      } catch (err) {
        if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '주문 저장'; }
        if (err.data?.code === 'CREDIT_LIMIT_EXCEEDED') {
          const warningBox = document.getElementById('credit-limit-warning');
          warningBox.classList.remove('hidden');
          document.getElementById('credit-warning-text').textContent = err.message;
        } else {
          showToast(err.message, 'error');
        }
      }
    };
  }

  async function viewSODetails(id) {
    const so = await API.get(`/sales-orders/${id}`);
    const html = `
      <div class="modal-header">
        <div class="modal-title">주문 상세 [${so.so_no}]</div>
        <button class="modal-close"><svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg></button>
      </div>
      <div class="modal-body">
        <div class="details-grid">
          <div class="detail-item"><label>고객사</label><span>${so.customer_name} (${so.customer_business_no})</span></div>
          <div class="detail-item"><label>주문일자</label><span>${formatDate(so.order_date)}</span></div>
          <div class="detail-item"><label>출고예정일</label><span>${formatDate(so.delivery_date)}</span></div>
          <div class="detail-item"><label>상태</label><span>${salesOrderStatusBadge(so.status)}</span></div>
          <div class="detail-item full"><label>비고</label><span>${so.notes || '-'}</span></div>
        </div>
        <div class="table-responsive" style="margin-top:20px">
          <table class="table">
            <thead>
              <tr>
                <th>품목</th>
                <th>주문수량</th>
                <th>출고수량</th>
                <th>단가</th>
                <th>합계</th>
                <th>마진(%)</th>
              </tr>
            </thead>
            <tbody>
              ${so.items.map(i => {
                const map = i.current_avg_price > 0 ? i.current_avg_price : (i.avg_price || 0);
                const effectiveP = i.unit_price * (1 - (i.discount_rate || 0));
                const marginRate = effectiveP > 0 ? ((effectiveP - map) / effectiveP) * 100 : (i.margin_rate || 0);
                const marginColor = marginRate < 0 ? 'color:var(--danger);font-weight:700' : 'color:var(--success)';
                const marginLabel = marginRate < 0 ? `▼ ${marginRate.toFixed(1)}%` : `${marginRate.toFixed(1)}%`;
                return `
                <tr>
                  <td>${i.material_name} (${i.material_code})</td>
                  <td class="text-right">${formatNumber(i.qty)}</td>
                  <td class="text-right">${formatNumber(i.delivered_qty)}</td>
                  <td class="text-right">${formatCurrency(i.unit_price)}</td>
                  <td class="text-right font-bold">${formatCurrency(i.qty * i.unit_price)}</td>
                  <td class="text-right" style="${marginColor}">${marginLabel}</td>
                </tr>`;
              }).join('')}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="4" class="text-right font-bold">결제 합계</td>
                <td class="text-right font-bold text-primary">${formatCurrency(so.total_amount)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary modal-close">닫기</button>
        ${so.status === '출고' ? `<button class="btn btn-warning" id="detail-cancel-btn" style="margin-right:auto">출고 취소 (수주 복원)</button>` : so.status !== '취소' && so.status !== '마감' ? `<button class="btn btn-danger" id="detail-cancel-btn" style="margin-right:auto">주문 취소</button>` : ''}
        ${so.statement_path ? `<a class="btn btn-secondary" href="/${so.statement_path}" target="_blank"><svg viewBox="0 0 20 20" fill="currentColor" style="width:14px;height:14px"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>명세서 PDF</a>` : ''}
        ${(so.status === '출고' || so.status === '마감') && !so.statement_issued_at ? `<button class="btn btn-primary" id="detail-stmt-btn">📄 명세서 발행</button>` : ''}
        ${so.status === '출고' ? `<button class="btn btn-warning" id="detail-close-btn">매출마감</button>` : ''}
        ${(so.status === '주문'||so.status === '수주') ? `<button class="btn btn-success" id="detail-confirm-btn">출고 확정</button>` : ''}
      </div>
    `;
    openModal(html, 'modal-wide', { persistent: true });

    if (so.status !== '취소' && so.status !== '마감') {
      document.getElementById('detail-cancel-btn').onclick = () => {
        const msg = so.status === '출고'
          ? '출고를 취소하고 수주 상태로 복원하시겠습니까?\n재고가 원복되며, 주문은 유지됩니다.'
          : '이 주문을 완전히 취소하시겠습니까?';
        confirmDialog(msg, async () => {
          try {
            const r = await API.put(`/sales-orders/${so.id}/cancel`, {});
            showToast(r.message || '처리되었습니다.', 'success');
            closeModal();
            Router.navigate('sales-orders');
          } catch (err) {
            showToast(err.message, 'error');
          }
        });
      };
    }
    
    if (so.status === '주문' || so.status === '수주') {
      document.getElementById('detail-confirm-btn').onclick = () => SalesOrders._showDeliveryDateModal(so.id, so.so_no, so.items);
    }
    const stmtBtn = document.getElementById('detail-stmt-btn');
    if (stmtBtn) {
      stmtBtn.onclick = async () => {
        stmtBtn.disabled = true; stmtBtn.textContent = '생성 중…';
        try {
          const r = await API.put(`/sales-orders/${so.id}/issue-statement`, {});
          showToast(`명세서 ${r.already_issued ? '재다운로드' : '생성 완료'}: ${r.file_name} (${r.size_kb}KB)`, 'success');
          window.open('/' + r.path, '_blank');
          closeModal(); Router.navigate('sales-orders');
        } catch (err) { showToast(err.message, 'error'); stmtBtn.disabled = false; stmtBtn.textContent = '📄 명세서 발행'; }
      };
    }
    const closeBtn = document.getElementById('detail-close-btn');
    if (closeBtn) {
      closeBtn.onclick = () => confirmDialog('매출마감 처리하시겠습니까?', async () => {
        try {
          await API.put(`/sales-orders/${so.id}/close`, {});
          showToast('매출마감 완료', 'success');
          closeModal(); Router.navigate('sales-orders');
        } catch (err) { showToast(err.message, 'error'); }
      });
    }
  }

  // Step 1: 출고일 선택 모달 (v40 — delivery_date 필수화)
  function _showDeliveryDateModal(soId, soNo, soItems) {
    const todayStr = today();
    const html = `
      <div class="modal-header">
        <div class="modal-title">출고일 확인${soNo ? ` — ${soNo}` : ''}</div>
        <button class="modal-close">×</button>
      </div>
      <div class="modal-body">
        <div style="padding:12px 14px;background:rgba(99,102,241,0.07);border-radius:6px;margin-bottom:16px;font-size:0.82rem">
          <strong>실제 출고일을 선택하세요.</strong>
          <div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px">출고일 기준으로 재고수불부와 매출 전표가 생성됩니다.</div>
        </div>
        <div class="form-group">
          <label>출고일 <span class="required">*</span></label>
          <input type="date" id="so-delivery-date" value="${todayStr}" max="${todayStr}" style="font-size:1rem;padding:8px 12px">
        </div>
        <div id="delivery-date-warn" style="display:none;margin-top:8px;padding:8px 12px;background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.4);border-radius:5px;font-size:0.8rem;color:#d97706"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary modal-close">취소</button>
        <button class="btn btn-success" id="dd-next-btn">다음 (자산 등록)</button>
        <button class="btn btn-primary" id="dd-confirm-btn">출고 확정 (자산 없음)</button>
      </div>`;
    openModal(html);

    const warnEl = document.getElementById('delivery-date-warn');
    document.getElementById('so-delivery-date').addEventListener('change', function() {
      const diff = Math.floor((new Date(todayStr) - new Date(this.value)) / 86400000);
      if (diff >= 3) {
        warnEl.style.display = '';
        warnEl.innerHTML = `⚠️ 소급 출고: 기준일로부터 <strong>${diff}일 전</strong> — 마감 기간 확인 필요`;
      } else { warnEl.style.display = 'none'; }
    });

    async function doConfirm(withAssets) {
      const delivery_date = document.getElementById('so-delivery-date')?.value;
      if (!delivery_date) return showToast('출고일을 선택하세요.', 'error');
      closeModal();
      if (withAssets && soItems?.length) {
        _showAssetModal(soId, soNo, soItems, delivery_date);
      } else {
        await _submitDelivery(soId, delivery_date, []);
      }
    }

    document.getElementById('dd-next-btn')?.addEventListener('click', () => doConfirm(true));
    document.getElementById('dd-confirm-btn')?.addEventListener('click', () => doConfirm(false));
  }

  // Step 2: 자산(시리얼/라이선스) 등록 모달
  function _showAssetModal(soId, soNo, soItems, deliveryDate) {
    const html = `
      <div class="modal-header">
        <div class="modal-title">자산 등록 — ${soNo||soId} (출고일: ${deliveryDate})</div>
        <button class="modal-close">×</button>
      </div>
      <div class="modal-body">
        <div class="alert alert-info" style="margin-bottom:16px;font-size:0.82rem">
          출고일: <strong>${deliveryDate}</strong> | 시리얼 / 라이선스 키를 입력하세요.
        </div>
        <table class="table table-sm">
          <thead><tr><th>품목</th><th>수량</th><th>시리얼 / 라이선스</th></tr></thead>
          <tbody>
            ${(soItems||[]).map((item, idx) => `
              <tr class="confirm-item-row" data-material-code="${item.material_code}" data-qty="${item.qty}">
                <td>${item.material_name||item.material_code}</td>
                <td>${formatNumber(item.qty)} ${item.unit||''}</td>
                <td>
                  ${Array.from({length: Math.ceil(item.qty)}).map((_, i) => `
                    <div style="display:flex;gap:6px;margin-bottom:3px">
                      <input type="text" class="ser-input" placeholder="시리얼 ${i+1}" style="flex:1">
                      <input type="text" class="lic-input" placeholder="라이선스 키 (선택)" style="flex:1">
                    </div>`).join('')}
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary modal-close">취소</button>
        <button class="btn btn-primary" id="final-confirm-btn">출고 확정 및 자산 저장</button>
      </div>`;
    openModal(html, 'modal-wide');

    document.getElementById('final-confirm-btn').onclick = async () => {
      const asset_items = [];
      document.querySelectorAll('.confirm-item-row').forEach(row => {
        const material_code = row.dataset.materialCode;
        row.querySelectorAll('.ser-input').forEach((input, i) => {
          const serial_no = input.value.trim();
          const license_key = row.querySelectorAll('.lic-input')[i]?.value.trim();
          if (serial_no) asset_items.push({ material_code, serial_no, license_key });
        });
      });
      closeModal();
      await _submitDelivery(soId, deliveryDate, asset_items);
    };
  }

  async function _submitDelivery(soId, deliveryDate, assetItems) {
    try {
      const result = await API.put(`/sales-orders/${soId}/confirm-delivery`, { delivery_date: deliveryDate, asset_items: assetItems });
      if (result.license_keys?.length) {
        const keyList = result.license_keys.map(k => `${k.material_code}: ${k.license_key}`).join('\n');
        openModal(`
          <div class="modal-header"><div class="modal-title">라이선스 키 발급 완료</div><button class="modal-close">×</button></div>
          <div class="modal-body">
            <div class="alert alert-success" style="margin-bottom:12px">✅ 디지털 상품 ${result.license_keys.length}건 출고 완료 — 라이선스 키가 자동 발급되었습니다.</div>
            <table class="table table-sm"><thead><tr><th>품목코드</th><th>라이선스 키</th></tr></thead>
            <tbody>${result.license_keys.map(k=>`<tr><td class="mono">${k.material_code}</td><td class="mono" style="color:var(--primary-light)">${k.license_key}</td></tr>`).join('')}</tbody></table>
          </div>
          <div class="modal-footer"><button class="btn btn-primary modal-close">확인</button></div>
        `, 'modal-wide');
      } else {
        showToast(`출고 확정 완료 — 출고일: ${deliveryDate}`, 'success', 4000);
      }
      Router.navigate('sales-orders');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function showQuotationModal() { Router.navigate('quotations'); }

  return { render, init, reset, _showDeliveryDateModal };
})();
window.SalesOrders = SalesOrders;
