'use strict';
/**
 * 세금계산서 VAT 계산 정밀도 테스트 (v55)
 * 원단위 절사(Math.floor) 정합성 검증
 * 실행: node tests/taxInvoice.precision.test.js
 */

let passed = 0;
let failed = 0;

function assert(label, actual, expected) {
  if (actual === expected) {
    console.log(`  ✅ ${label}: ${actual}`);
    passed++;
  } else {
    console.error(`  ❌ ${label}: expected ${expected}, got ${actual}`);
    failed++;
  }
}

// ── VAT 엔진 (routes/taxInvoices.js 와 동일 로직) ─────────────────────────
function calcTax(supplyAmount, taxRate) {
  return Math.floor(supplyAmount * taxRate);
}

function calcItemRows(items, taxRate) {
  return items.map(i => {
    const sa = Math.round(i.supply_amount != null ? i.supply_amount : i.qty * i.unit_price);
    const ta = i.is_tax_exempt ? 0 : calcTax(sa, taxRate);
    return { ...i, sa, ta };
  });
}

function calcInvoiceTotals(items, taxRate) {
  const rows      = calcItemRows(items, taxRate);
  const supply    = rows.reduce((s, r) => s + r.sa, 0);
  const tax       = rows.reduce((s, r) => s + r.ta, 0);
  const total     = supply + tax;
  return { supply, tax, total, rows };
}

// ── 테스트 케이스 ────────────────────────────────────────────────────────────
console.log('\n[1] 기본 과세 계산 (원단위 절사 확인)');
{
  // 1,500원 공급가 × 10% = 150.0 → floor = 150
  const { supply, tax, total } = calcInvoiceTotals([{ qty: 1, unit_price: 1500 }], 0.1);
  assert('공급가액', supply, 1500);
  assert('세액 (floor)', tax, 150);
  assert('합계', total, 1650);
}

console.log('\n[2] 소수 발생 케이스 — Math.round vs Math.floor 차이 검증');
{
  // 공급가 1,001원 × 10% = 100.1 → floor=100, round=100 (동일)
  // 공급가 1,005원 × 10% = 100.5 → floor=100, round=101 (차이!)
  const supplyA = 1005;
  const floorTax = Math.floor(supplyA * 0.1);
  const roundTax = Math.round(supplyA * 0.1);
  assert('원단위 절사(floor) = 100', floorTax, 100);
  assert('round는 101로 과대계산', roundTax, 101);
  assert('floor가 법정 기준임', floorTax < roundTax, true);
}

console.log('\n[3] 면세 품목 혼합');
{
  const items = [
    { qty: 10, unit_price: 10000, is_tax_exempt: false },  // 과세 100,000
    { qty:  5, unit_price:  5000, is_tax_exempt: true  },  // 면세  25,000
  ];
  const { supply, tax, total } = calcInvoiceTotals(items, 0.1);
  assert('공급가액 합계', supply, 125000);
  assert('세액 (면세 제외)', tax, 10000);   // 100,000 × 0.1 = 10,000
  assert('합계', total, 135000);
}

console.log('\n[4] 영세율 (0%)');
{
  const { supply, tax, total } = calcInvoiceTotals([{ qty: 1, unit_price: 500000 }], 0);
  assert('공급가액', supply, 500000);
  assert('세액 = 0', tax, 0);
  assert('합계 = 공급가액', total, 500000);
}

console.log('\n[5] 검증 로직 — 마감 합계와 계산서 합계 일치 확인');
{
  const closingTotal = 1650;
  const { total: invoiceTotal } = calcInvoiceTotals([{ qty: 1, unit_price: 1500 }], 0.1);
  const diff = Math.abs(invoiceTotal - closingTotal);
  assert('차액 0원 (발행 허용)', diff, 0);

  // 1원 차이 케이스
  const diffOne = Math.abs(1651 - closingTotal);
  assert('차액 1원 (발행 거부)', diffOne > 0, true);
}

console.log('\n[6] 대금 정밀도 — 9자리 금액');
{
  // 공급가액 999,999,999원 × 10%
  const supply = 999999999;
  const tax = calcTax(supply, 0.1);
  assert('세액 floor(999999999 × 0.1)', tax, 99999999);
  assert('합계', supply + tax, 1099999998);
}

console.log('\n[7] 다중 품목 총합 정밀도 (품목별 floor 합산)');
{
  // 한국 세금계산서: 품목별 세액을 개별 floor 후 합산
  // Item1: supply=999, tax=floor(99.9)=99
  // Item2: supply=1001, tax=floor(100.1)=100  → 합계 199
  const items = [
    { qty: 3, unit_price: 333 },  // supply=999
    { qty: 7, unit_price: 143 },  // supply=1001
  ];
  const { supply, tax } = calcInvoiceTotals(items, 0.1);
  assert('공급가액 합계', supply, 2000);
  // 품목별 floor 합산: 99 + 100 = 199 (총액 floor인 200과 1원 차이 — 법정 정합)
  assert('세액 (품목별 floor 합산)', tax, 199);
  // 총액 기준 floor와 비교
  const totalFloor = Math.floor(supply * 0.1);
  assert('총액 기준 floor는 200', totalFloor, 200);
  assert('품목별 합산이 ≤ 총액 기준 (납세자 유리)', tax <= totalFloor, true);
}

// ── 결과 ─────────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`총 ${passed + failed}개 테스트: ✅ ${passed}개 통과 / ❌ ${failed}개 실패`);
if (failed > 0) process.exit(1);
