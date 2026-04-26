const Customers = (() => {
  let _lastSearch = '';

  async function render() {
    const container = document.getElementById('page-container');
    if (container) container.innerHTML = loadingHTML();

    try {
      const customers = await API.get(`/customers?search=${_lastSearch}`);
    
      return `
        <div class="page-header">
          <div>
            <h2 class="page-title">고객사 관리</h2>
            <p class="page-subtitle">매출 고객사 정보를 관리합니다.</p>
          </div>
          <button class="btn btn-secondary" id="customer-upload-btn">
            <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 11-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clip-rule="evenodd"/></svg>
            일괄 업로드
          </button>
          <button class="btn btn-primary" id="add-customer-btn">
            <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clip-rule="evenodd"/></svg>
            신규 고객사 등록
          </button>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="search-bar">
              <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd"/></svg>
              <input type="text" id="customer-search" placeholder="고객사명, 코드, 사업자번호 검색..." value="${_lastSearch}">
            </div>
          </div>
          <div class="table-responsive">
            <table class="table">
              <thead>
                <tr>
                  <th>코드</th>
                  <th>고객사명</th>
                  <th>사업자번호</th>
                  <th>담당자</th>
                  <th>연락처</th>
                  <th>여신한도</th>
                  <th>결제조건</th>
                  <th>작업</th>
                </tr>
              </thead>
              <tbody>
                ${customers.length ? customers.map(c => `
                  <tr>
                    <td><span class="code-badge">${c.code}</span></td>
                    <td class="font-bold">${c.name}</td>
                    <td>${c.business_no}</td>
                    <td>${c.manager || '-'}</td>
                    <td>${c.contact || '-'}</td>
                    <td class="text-right">${formatCurrency(c.credit_limit)}</td>
                    <td>${c.payment_terms || '-'}</td>
                    <td>
                      <div class="table-actions">
                        <button class="btn-icon edit-customer" data-code="${c.code}" title="수정"><svg viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/></svg></button>
                        <button class="btn-icon delete-customer" data-code="${c.code}" title="삭제"><svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/></svg></button>
                      </div>
                    </td>
                  </tr>
                `).join('') : `<tr><td colspan="8" class="text-center">${emptyHTML('등록된 고객사가 없습니다.')}</td></tr>`}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } catch (err) {
      console.error(err);
      return `
        <div class="empty-state">
          <div style="color:var(--danger);margin-bottom:16px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></div>
          <h3>고객사 정보를 불러오지 못했습니다.</h3>
          <p>${err.message}</p>
          <button class="btn btn-secondary" onclick="Router.navigate('customers')" style="margin-top:16px">다시 시도</button>
        </div>
      `;
    }
  }

  function init() {
    // Search with debounce
    let timeout;
    document.getElementById('customer-search').oninput = (e) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        _lastSearch = e.target.value;
        Router.navigate('customers');
      }, 500);
    };

    document.getElementById('add-customer-btn').onclick = () => showCustomerModal();
    document.getElementById('customer-upload-btn').onclick = () => showUploadModal('customers', () => Router.navigate('customers'));

    document.querySelectorAll('.edit-customer').forEach(btn => {
      btn.onclick = async () => {
        const c = await API.get(`/customers/${btn.dataset.code}`);
        showCustomerModal(c);
      };
    });

    document.querySelectorAll('.delete-customer').forEach(btn => {
      btn.onclick = () => {
        confirmDialog('고객사를 삭제하시겠습니까?', async () => {
          await API.delete(`/customers/${btn.dataset.code}`);
          showToast('고객사가 삭제되었습니다.', 'success');
          Router.navigate('customers');
        });
      };
    });
  }

  function showCustomerModal(c = null) {
    const isEdit = !!c;
    const html = `
      <div class="modal-header">
        <div class="modal-title">${isEdit ? '고객사 정보 수정' : '신규 고객사 등록'}</div>
        <button class="modal-close"><svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg></button>
      </div>
      <div class="modal-body">
        <form id="customer-form" class="grid-form">
          <div class="form-group">
            <label>고객사 코드 <span class="required">*</span></label>
            <input type="text" name="code" value="${c?.code || ''}" ${isEdit ? 'disabled' : ''} placeholder="예: C001" required>
          </div>
          <div class="form-group">
            <label>고객사명 <span class="required">*</span></label>
            <input type="text" name="name" value="${c?.name || ''}" placeholder="예: (주)에이비씨" required>
          </div>
          <div class="form-group">
            <label>사업자번호 <span class="required">*</span></label>
            <input type="text" name="business_no" value="${c?.business_no || ''}" placeholder="000-00-00000" required>
          </div>
          <div class="form-group">
            <label>담당자</label>
            <input type="text" name="manager" value="${c?.manager || ''}" placeholder="홍길동">
          </div>
          <div class="form-group">
            <label>연락처</label>
            <input type="text" name="contact" value="${c?.contact || ''}" placeholder="010-0000-0000">
          </div>
          <div class="form-group">
            <label>여신한도 (원)</label>
            <input type="number" name="credit_limit" value="${c?.credit_limit || 0}" placeholder="0">
          </div>
          <div class="form-group">
            <label>결제조건</label>
            <input type="text" name="payment_terms" value="${c?.payment_terms || '익월말'}" placeholder="예: 익월말, 당월말, 현금">
          </div>
        </form>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary modal-close">취소</button>
        <button class="btn btn-primary" id="save-customer-btn">저장</button>
      </div>
    `;
    openModal(html);
    const form = document.getElementById('customer-form');
    if (!isEdit) FormPersistence.bind('customer-add', form);

    document.getElementById('save-customer-btn').onclick = async () => {
      const form = document.getElementById('customer-form');
      const data = Object.fromEntries(new FormData(form));
      
      try {
        if (isEdit) {
          await API.put(`/customers/${c.code}`, data);
          showToast('고객사 정보가 수정되었습니다.', 'success');
        } else {
          await API.post('/customers', data);
          FormPersistence.clear('customer-add');
          showToast('고객사가 등록되었습니다.', 'success');
        }
        closeModal();
        Router.navigate('customers');
      } catch (err) {
        showToast(err.message, 'error');
      }
    };
  }

  return { render, init };
})();
window.Customers = Customers;
