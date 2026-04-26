const Procurement = {
  render: async () => {
    const data = await API.get('/api/inventory/scm/recommendations').catch(() => []);
    
    return `
      <div class="content-header">
        <div>
          <h1 class="content-title">구매 권고 및 발주 관리 (Smart PO)</h1>
          <p class="content-subtitle">안전 재고 부족분에 대해 MOQ 및 구매 단위를 자동 반영한 권고량입니다.</p>
        </div>
        <div class="header-actions">
          <button id="export-po-csv" class="btn btn-secondary">CSV 내보내기</button>
        </div>
      </div>

      <div class="card">
        <div class="table-container">
          <table class="table">
            <thead>
              <tr>
                <th>품목</th><th>현재고</th><th>안전재고</th><th>D-Day</th><th>MOQ</th><th>구매단위</th><th>권고 수량</th><th>예상 금액</th><th>액션</th>
              </tr>
            </thead>
            <tbody>
              ${data.length ? data.map(item => `
                <tr>
                  <td><strong>${item.name}</strong> <small class="mono">${item.code}</small></td>
                  <td>${formatNumber(item.available_qty)}</td>
                  <td><span class="badge badge-info">${formatNumber(item.safety_stock)}</span></td>
                  <td>
                    ${item.d_day <= 3 ? `<span class="badge badge-danger">D${item.d_day >= 0 ? '-' : '+'}${Math.abs(item.d_day)}</span>` : 
                      item.d_day <= 7 ? `<span class="badge badge-warning">D-${item.d_day}</span>` : 
                      `<span class="badge badge-ghost">D-${item.d_day}</span>`}
                  </td>
                  <td>${formatNumber(item.moq)}</td>
                  <td>${formatNumber(item.purchase_unit)}</td>
                  <td><strong style="color:var(--primary)">${formatNumber(item.recommended_qty)}</strong> ${item.unit}</td>
                  <td>${formatCurrency(item.estimated_amount)}</td>
                  <td>
                    <button class="btn btn-sm btn-primary view-po" data-item='${JSON.stringify(item)}'>발주서 미리보기</button>
                  </td>
                </tr>
              `).join('') : '<tr><td colspan="8" style="text-align:center">발주 권고 대상이 없습니다.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  init: () => {
    document.querySelectorAll('.view-po').forEach(btn => {
      btn.onclick = (e) => {
        const item = JSON.parse(e.target.closest('button').getAttribute('data-item'));
        Procurement.showPOPreview(item);
      };
    });

    const exportBtn = document.getElementById('export-po-csv');
    if (exportBtn) {
      exportBtn.onclick = async () => {
        const data = await API.get('/api/inventory/scm/recommendations');
        let csv = '품목코드,품명,권고수량,단위,예상금액\n';
        data.forEach(r => {
          csv += `${r.code},${r.name},${r.recommended_qty},${r.unit},${r.estimated_amount}\n`;
        });
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `PO_Recommendation_${new Date().toISOString().slice(0,10)}.csv`;
        link.click();
      };
    }
  },

  showPOPreview: (item) => {
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    
    modal.innerHTML = `
      <div class="modal po-preview-modal" style="max-width: 800px; background: white; color: #333;">
        <div class="modal-header no-print">
          <div class="modal-title">공식 발주서 미리보기 (PO Preview)</div>
          <div style="display:flex; gap:8px;">
            <button class="btn btn-secondary" id="send-po-email-btn">이메일 발송</button>
            <button class="btn btn-secondary" onclick="window.print()">인쇄</button>
            <button class="modal-close btn btn-ghost">×</button>
          </div>
        </div>
        <div class="po-document" style="padding: 40px; font-family: 'Malgun Gothic', sans-serif;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px;">
            <h1 style="font-size: 32px; letter-spacing: 15px; border-bottom: 3px double #333;">발 주 서</h1>
            <div style="text-align: right; font-size: 14px;">
              <p>문서번호: PO-${new Date().toISOString().slice(0,10).replace(/-/g, '')}-001</p>
              <p>발행일자: ${new Date().toLocaleDateString()}</p>
            </div>
          </div>

          <div style="display: flex; gap: 20px; margin-bottom: 30px;">
            <div style="flex: 1; border: 1px solid #333; padding: 10px;">
              <p style="font-weight: bold; background: #eee; padding: 5px; margin: -10px -10px 10px -10px; border-bottom: 1px solid #333;">공급자 (Vendor)</p>
              <p>상호: (주) 해당 거래처</p>
              <p>사업자번호: 000-00-00000</p>
              <p>담당자: 영업팀</p>
              <p>연락처: 02-xxx-xxxx</p>
            </div>
            <div style="flex: 1; border: 1px solid #333; padding: 10px;">
              <p style="font-weight: bold; background: #eee; padding: 5px; margin: -10px -10px 10px -10px; border-bottom: 1px solid #333;">발주자 (Buyer)</p>
              <p>상호: Antigravity ERP System</p>
              <p>사업자번호: 123-45-67890</p>
              <p>주소: 서울특별시 강남구 테헤란로</p>
              <p>담당자: ${localStorage.getItem('username') || '시스템 관리자'}</p>
            </div>
          </div>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
            <thead>
              <tr style="background: #f4f4f4;">
                <th style="border: 1px solid #333; padding: 10px;">품목코드</th>
                <th style="border: 1px solid #333; padding: 10px;">품명 및 규격</th>
                <th style="border: 1px solid #333; padding: 10px;">수량</th>
                <th style="border: 1px solid #333; padding: 10px;">단가</th>
                <th style="border: 1px solid #333; padding: 10px;">금액</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="border: 1px solid #333; padding: 10px; text-align: center;">${item.code}</td>
                <td style="border: 1px solid #333; padding: 10px;">${item.name}</td>
                <td style="border: 1px solid #333; padding: 10px; text-align: right;">${formatNumber(item.recommended_qty)} ${item.unit}</td>
                <td style="border: 1px solid #333; padding: 10px; text-align: right;">${formatCurrency(item.avg_price)}</td>
                <td style="border: 1px solid #333; padding: 10px; text-align: right;">${formatCurrency(item.estimated_amount)}</td>
              </tr>
              ${Array(5).fill(0).map(() => `<tr><td style="border: 1px solid #333; padding: 10px; height: 25px;"></td><td style="border: 1px solid #333;"></td><td style="border: 1px solid #333;"></td><td style="border: 1px solid #333;"></td><td style="border: 1px solid #333;"></td></tr>`).join('')}
            </tbody>
            <tfoot>
              <tr style="background: #f4f4f4; font-weight: bold;">
                <td colspan="4" style="border: 1px solid #333; padding: 10px; text-align: right;">합계 (VAT 별도)</td>
                <td style="border: 1px solid #333; padding: 10px; text-align: right;">${formatCurrency(item.estimated_amount)}</td>
              </tr>
            </tfoot>
          </table>

          <div style="border: 1px solid #333; padding: 15px; font-size: 13px;">
            <p><strong>비고 (Notes):</strong></p>
            <p>1. 납기일자: 발주일로부터 7일 이내</p>
            <p>2. 결제조건: 검수 후 익월 말 현금 결제</p>
            <p>3. 기타: 품질 성적서(CoA) 동봉 요망</p>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    
    document.getElementById('send-po-email-btn').onclick = () => {
      const subject = encodeURIComponent(`[Antigravity ERP] 발주 요청의 건 (PO-${new Date().toISOString().slice(0,10)})`);
      const body = encodeURIComponent(
        `안녕하세요, (주) 해당 거래처 담당자님.\n\n` +
        `아래와 같이 품목 발주를 요청드리오니 검토 부탁드립니다.\n\n` +
        `[발주 내역]\n` +
        `- 품목: ${item.name} (${item.code})\n` +
        `- 수량: ${item.recommended_qty} ${item.unit}\n` +
        `- 단가: ${formatCurrency(item.avg_price)}\n` +
        `- 총액: ${formatCurrency(item.estimated_amount)}\n\n` +
        `납기 일관 및 상세 사항 확인 부탁드립니다.\n\n` +
        `감사합니다.\n` +
        `${localStorage.getItem('username') || '시스템 관리자'} 드림.`
      );
      window.location.href = `mailto:admin@vendor.com?subject=${subject}&body=${body}`;
    };

    modal.querySelector('.modal-close').onclick = () => modal.remove();
  }
};
window.Procurement = Procurement;
