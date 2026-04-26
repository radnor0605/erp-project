const Scanner = {
  render: async () => {
    return `
      <div class="content-header">
        <div>
          <h1 class="content-title">바코드 / QR 스캔</h1>
          <p class="content-subtitle">카메라를 사용하여 품목의 바코드를 스캔하면 해당 정보로 즉시 이동합니다.</p>
        </div>
      </div>

      <div class="card" style="max-width: 600px; margin: 0 auto;">
        <div id="reader" style="width: 100%; border-radius:12px; overflow:hidden; background:#000;"></div>
        <div id="scanner-result" style="padding:20px; text-align:center; color:var(--text-muted)">
          카메라 권한을 허용하고 바코드를 스캔 영역에 맞춰주세요.
        </div>
      </div>
    `;
  },

  init: () => {
    const html5QrCode = new Html5Qrcode("reader");
    const config = { fps: 10, qrbox: { width: 250, height: 250 } };

    html5QrCode.start({ facingMode: "environment" }, config, (decodedText) => {
      // Success callback
      showToast(`스캔 성공: ${decodedText}`, 'success');
      html5QrCode.stop().then(() => {
        // Redirect to materials with the scanned code
        window.location.hash = `#materials?search=${encodeURIComponent(decodedText)}`;
      });
    }).catch(err => {
      console.error(err);
      document.getElementById('scanner-result').innerHTML = 
        `<div class="alert alert-danger">카메라를 시작할 수 없습니다. HTTPS 환경인지 확인해주세요.</div>`;
    });

    // Cleanup on page change
    window.addEventListener('hashchange', () => {
      try { html5QrCode.stop(); } catch(e) {}
    }, { once: true });
  }
};
window.Scanner = Scanner;
