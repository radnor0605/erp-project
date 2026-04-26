'use strict';
/**
 * build.js — JS → JSC 컴파일 빌드 스크립트
 * 실행: node build.js
 *
 * 동작:
 *  1. routes / services / middleware / utils / database 의 .js 파일을 .jsc로 컴파일
 *  2. 원본 .js 를 얇은 래퍼(1줄)로 교체 → 기존 require() 경로 변경 불필요
 *  3. server.js → server.jsc 컴파일, loader.js 생성
 *  4. version.json 빌드 번호 갱신
 */

const bytenode = require('bytenode');
const fs       = require('fs');
const path     = require('path');

const ROOT = __dirname;

// 컴파일 대상 디렉토리
const TARGET_DIRS = ['routes', 'services', 'middleware', 'utils', 'database'];

// 컴파일 제외 파일 (진입점 / 빌드 스크립트 자신)
const EXCLUDE_FILES = new Set(['build.js', 'loader.js']);

let compiled = 0;
let failed   = 0;

function compileFile(jsPath) {
  const jscPath = jsPath.replace(/\.js$/, '.jsc');
  try {
    bytenode.compileFile({ filename: jsPath, output: jscPath, electron: false });

    // 원본 .js → 얇은 래퍼로 교체
    const rel = './' + path.basename(jscPath);
    fs.writeFileSync(jsPath,
      `'use strict';\nrequire('bytenode');\nmodule.exports = require('${rel}');\n`,
      'utf8'
    );
    console.log(`  [OK] ${path.relative(ROOT, jsPath)}`);
    compiled++;
  } catch (e) {
    console.error(`  [FAIL] ${path.relative(ROOT, jsPath)} — ${e.message}`);
    failed++;
  }
}

function processDir(dir) {
  const fullDir = path.join(ROOT, dir);
  if (!fs.existsSync(fullDir)) return;

  const files = fs.readdirSync(fullDir).filter(f =>
    f.endsWith('.js') && !EXCLUDE_FILES.has(f)
  );

  for (const file of files) {
    compileFile(path.join(fullDir, file));
  }
}

// ── 1. 하위 디렉토리 컴파일 ────────────────────────────────────
console.log('\n[BUILD] Compiling JS → JSC...\n');
for (const dir of TARGET_DIRS) {
  console.log(`📁 ${dir}/`);
  processDir(dir);
}

// ── 2. server.js 컴파일 ───────────────────────────────────────
console.log('\n📁 root/');
const serverJs  = path.join(ROOT, 'server.js');
const serverJsc = path.join(ROOT, 'server.jsc');

try {
  bytenode.compileFile({ filename: serverJs, output: serverJsc, electron: false });
  // server.js는 삭제하지 않고 loader.js가 대신 진입점이 됨
  fs.unlinkSync(serverJs);
  console.log('  [OK] server.js → server.jsc');
  compiled++;
} catch (e) {
  console.error(`  [FAIL] server.js — ${e.message}`);
  failed++;
}

// ── 3. loader.js 생성 (진입점) ────────────────────────────────
const loaderPath = path.join(ROOT, 'loader.js');
fs.writeFileSync(loaderPath, `'use strict';
require('bytenode');
require('./server.jsc');
`, 'utf8');
console.log('  [OK] loader.js created');

// ── 4. version.json 빌드 날짜 갱신 ───────────────────────────
const versionPath = path.join(ROOT, 'version.json');
if (fs.existsSync(versionPath)) {
  const v = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
  v.buildDate = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(versionPath, JSON.stringify(v, null, 2), 'utf8');
  console.log(`\n  [OK] version.json → v${v.version} (${v.buildDate})`);
}

console.log(`\n[BUILD DONE] compiled: ${compiled}, failed: ${failed}\n`);
if (failed > 0) process.exit(1);
