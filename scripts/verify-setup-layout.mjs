#!/usr/bin/env node
// ================================================================
// Kiểm chứng layout trang /setup (Quick Setup) bằng Chrome headless thật
// ================================================================
// Vì sao cần script thay vì "nhìn bằng mắt": lỗi căn giữa và horizontal
// overflow đều là LỖI KÍCH THƯỚC — chỉ đo được trong browser thật. Đọc CSS
// không đủ vì kết quả còn phụ thuộc layout cha.
//
// Script đo 3 thứ, ở TỪNG breakpoint:
//   1. OVERFLOW  : document.scrollWidth > clientWidth => có thanh scroll ngang.
//   2. CĂN GIỮA : khoảng cách trái vs phải của .setup-page so với viewport.
//   3. TRÀN RA  : element nào có mép phải vượt quá bề rộng viewport.
//
// Chạy: node scripts/verify-setup-layout.mjs
// Yêu cầu: dev server đang chạy ở http://localhost:3000
// ================================================================

import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const BASE = "http://localhost:3000";
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

// Breakpoint bắt buộc: desktop -> laptop -> tablet -> mobile.
const VIEWPORTS = [
  { name: "1440 (desktop)", width: 1440, height: 900 },
  { name: "1280 (laptop)", width: 1280, height: 800 },
  { name: "1024 (small laptop)", width: 1024, height: 768 },
  { name: "768 (tablet)", width: 768, height: 1024 },
  { name: "430 (mobile XL)", width: 430, height: 932 },
  { name: "390 (mobile)", width: 390, height: 844 },
  { name: "360 (mobile nho)", width: 360, height: 800 },
];

const TEST_EMAIL = "layout_verify_setup@example.com";
const TEST_PASSWORD = "VerifyPass123!";

/** CDP client tối giản: mở 1 tab, gửi lệnh, chờ đúng id trả về. */
class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data);
      const entry = this.pending.get(msg.id);
      if (!entry) return;
      this.pending.delete(msg.id);
      if (msg.error) entry.reject(new Error(JSON.stringify(msg.error)));
      else entry.resolve(msg.result);
    });
  }

  static async attach(wsUrl) {
    const ws = new WebSocket(wsUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener("open", resolve, { once: true });
      ws.addEventListener("error", () => reject(new Error("CDP socket error")), { once: true });
    });
    return new Cdp(ws);
  }

  /** Gửi 1 lệnh CDP và chờ đúng response cùng id. */
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
}

async function getJson(url, init) {
  const res = await fetch(url, init);
  return res.json();
}

/** Đăng ký + đăng nhập để lấy cookie session thật. */
async function authenticate() {
  await fetch(`${BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD, name: "Layout Verify" }),
  });

  // Jar tự quản lý: Auth.js KHÔNG set cookie ở response 302 mà set ở
  // response của trang đích sau khi redirect, nên phải tự đi theo chuỗi
  // redirect và gom cookie mới vào jar.
  const jar = new Map();
  const absorb = (res) => {
    for (const raw of res.headers.getSetCookie()) {
      const [pair] = raw.split(";");
      const eq = pair.indexOf("=");
      if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
  };
  const header = () => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");

  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  absorb(csrfRes);
  const { csrfToken } = await csrfRes.json();

  let url = `${BASE}/api/auth/callback/credentials`;
  for (let hop = 0; hop < 5; hop += 1) {
    const res = await fetch(url, {
      method: "POST",
      redirect: "manual",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: header() },
      body: url.includes("/csrf")
        ? undefined
        : new URLSearchParams({ csrfToken, email: TEST_EMAIL, password: TEST_PASSWORD, json: "true" }),
    });
    absorb(res);
    const loc = res.headers.get("location");
    if (!loc) break;
    url = loc.startsWith("http") ? loc : `${BASE}${loc}`;
  }

  const token = jar.get("authjs.session-token");
  if (!token) throw new Error(`Khong co session cookie. Jar: ${[...jar.keys()].join(", ")}`);
  return `authjs.session-token=${token}`;
}

/** Đo layout trong trang. */
const MEASURE = `(() => {
  const de = document.documentElement;
  const page = document.querySelector('.setup-page');
  if (!page) return { error: 'khong tim thay .setup-page', url: location.pathname };
  const r = page.getBoundingClientRect();
  const vw = de.clientWidth;

  // Element nào vượt mép phải viewport? (đây là cách tìu "icon tràn")
  const overflowing = [];
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.position === 'fixed' || cs.display === 'none' || cs.visibility === 'hidden') continue;
    const b = el.getBoundingClientRect();
    if (b.width === 0 && b.height === 0) continue;
    if (b.right > vw + 1) {
      overflowing.push({
        tag: el.tagName.toLowerCase(),
        cls: (el.className || '').toString().slice(0, 50),
        right: Math.round(b.right),
        width: Math.round(b.width),
      });
    }
  }

  const foot = document.querySelector('.setup-footnote');
  return {
    url: location.pathname,
    scrollWidth: de.scrollWidth,
    clientWidth: vw,
    hasHScroll: de.scrollWidth > vw,
    pageLeft: Math.round(r.left),
    pageRight: Math.round(vw - r.right),
    pageWidth: Math.round(r.width),
    footnoteColor: foot ? getComputedStyle(foot).color : null,
    overflowing: overflowing.slice(0, 6),
  };
})()`;

async function main() {
  const cookie = await authenticate();
  if (!cookie) throw new Error("Khong lay duoc session cookie.");

  const chrome = spawn(CHROME, [
    "--headless=new",
    "--remote-debugging-port=9222",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-gpu",
    "--user-data-dir=" + (process.env.TEMP || "C:\\Windows\\Temp") + "\\learnx-cdp-profile",
    "about:blank",
  ], { stdio: "ignore" });

  let version;
  for (let i = 0; i < 40; i += 1) {
    try {
      version = await getJson("http://localhost:9222/json/version");
      break;
    } catch {
      await sleep(250);
    }
  }
  if (!version) throw new Error("Chrome CDP khong khoi dong duoc.");

  const browser = await Cdp.attach(version.webSocketDebuggerUrl);
  const { targetId } = await browser.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await browser.send("Target.attachToTarget", { targetId, flatten: true });

  // Gui lenh CDP kem sessionId de dieu khien dung tab vua tao.
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++browser.id;
      browser.pending.set(id, { resolve, reject });
      browser.ws.send(JSON.stringify({ id, method, params, sessionId }));
    });

  await send("Page.enable");
  await send("Network.enable");
  const eq = cookie.indexOf("=");
  await send("Network.setCookie", {
    name: cookie.slice(0, eq),
    value: cookie.slice(eq + 1),
    domain: "localhost",
    path: "/",
  });

  let failures = 0;

  for (const vp of VIEWPORTS) {
    await send("Emulation.setDeviceMetricsOverride", {
      width: vp.width,
      height: vp.height,
      deviceScaleFactor: 1,
      mobile: vp.width < 768,
    });
    await send("Page.navigate", { url: `${BASE}/setup` });
    await sleep(2200);

    const { result } = await send("Runtime.evaluate", { returnByValue: true, expression: MEASURE });
    const m = result.value;

    if (m.error) {
      console.log(`FAIL  ${vp.name}: ${m.error} (url=${m.url})`);
      failures += 1;
      continue;
    }

    const centered = Math.abs(m.pageLeft - m.pageRight) <= 1;
    const ok = !m.hasHScroll && centered && m.overflowing.length === 0;
    if (!ok) failures += 1;

    console.log(
      `${ok ? "PASS" : "FAIL"}  ${vp.name.padEnd(20)} ` +
        `scroll=${m.scrollWidth}/${m.clientWidth} ` +
        `trai=${m.pageLeft}px phai=${m.pageRight}px card=${m.pageWidth}px ` +
        `hScroll=${m.hasHScroll} canGiua=${centered} ` +
        `footnote=${m.footnoteColor}` +
        (m.overflowing.length ? ` TRAN=${JSON.stringify(m.overflowing)}` : "")
    );
  }

  chrome.kill();
  console.log(failures === 0 ? "\nTAT CA BREAKPOINT DAT." : `\n${failures} breakpoint LOI.`);
  if (failures > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error("Loi:", e.message);
  process.exit(1);
});

