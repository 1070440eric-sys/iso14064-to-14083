/* =========================================================
   碳碳：網站導覽吉祥物
   - 捲到不同展區講不同的話（每區只主動講一次，點它可以再講）
   - 身材跟著排放量變：入口看舞台累計排放，案例看試算工具的總排放
   - 可以拖到畫面任何位置；碰到畫面邊緣會被擠扁再彈回；位置會記住
   - 沒有 JS 時整個角色不出現，不影響網站內容
   ========================================================= */
(function () {
  "use strict";
  var root = document.getElementById("tan");
  if (!root || !root.querySelector) { return; }

  var stage = root;                                  // 整個視窗就是舞台
  var el = document.getElementById("tanBody");
  var bubble = document.getElementById("tanBubble");
  var bubbleText = document.getElementById("tanText");
  var closeBtn = document.getElementById("tanClose");
  var hideBtn = document.getElementById("tanHide");
  var showBtn = document.getElementById("tanShow");
  var shadow = document.getElementById("tanShadow");
  var live = document.getElementById("tanLive");
  var grow = el.querySelector(".grow");
  var motionQuery = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  function reduce() { return !!(motionQuery && motionQuery.matches); }

  function store(k, v) { try { if (v === undefined) { return localStorage.getItem(k); } if (v === null) { localStorage.removeItem(k); } else { localStorage.setItem(k, v); } } catch (err) { return null; } return null; }

  /* ---------- 台詞（數字都對得上網站內容） ---------- */
  var LINES = {
    route: ["嗨，我是碳碳！往下捲，貨櫃會往前跑，我也會跟著<strong>排放量</strong>變胖。想找什麼詞，按下面的「找關鍵字」。",
            "上排長條是距離、下排是排放。最短的那段公路，反而排最多。"],
    s1: ["ISO 14064 不是一本，是一個<strong>家族</strong>。先認識 -1、-2、-3 各管什麼。",
         "-1 算組織、-2 算減量專案，兩個算出來的結果，再交給 -3 查證。"],
    s2: ["14064-1 先把「一家公司」圈起來，圈內的排放分成<strong>六個類別</strong>。",
         "委外的貨運排放，屬於<strong>類別 3</strong>：運輸造成的間接排放。"],
    s3: ["14064-1 說運輸<strong>要算</strong>，但沒說一趟運輸<strong>怎麼拆</strong>。這就輪到 14083 了。",
         "兩個標準是搭檔，不是誰取代誰。"],
    s4: ["一趟運輸拆成好幾個 <strong>TCE</strong>。轉運站沒有公里數，但它的排放也要算！",
         "同類車輛歸成 TOC、轉運站歸成 HOC，各有自己的排放強度。"],
    glossary: ["看不懂的詞點一下，會打開說明，有白話也有例子。",
               "TCE、HOC、Allocation……我第一次看也頭暈。"],
    "case": ["照六個步驟走一遍，資料就會變成數字。",
             "下面的試算可以換運具，看看我會變多胖。"],
    s7: ["六題選擇題，答錯會告訴你回哪裡再看一次。",
         "不用緊張，答錯我不會跟別人講。"],
    refs: ["每個數字都有標出處。案例 B 是教學假設，不是真實數據。",
           "盤查的目的，就是找出我在哪一段長最多肉，再想辦法讓我變瘦。"]
  };

  /* ---------- 畫面與位置 ---------- */
  var size = 120;
  var EDGE = 10, MAXK = 0.36;
  var growScale = 1, growTarget = 1;
  var x = 0, y = 0, vx = 0, vy = 0, rot = 0, vr = 0, sq = 0, vsq = 0;
  var kx = 0, vkx = 0, ky = 0, vky = 0, wx = 0, wy = 0, pushX = 0, pushY = 0;
  var held = false, moved = false, ox = 0, oy = 0, lastX = 0, lastY = 0, lastT = 0, startX = 0, startY = 0;
  var raf = 0, POS_KEY = "tan-pos", HIDE_KEY = "tan-hidden";

  function measureSize() { size = el.offsetWidth || 120; }
  function ext() {
    var k = size / 200, g = growScale;
    return { l: (100 - 78 * g) * k, r: (100 + 78 * g) * k, t: (176 - 126 * g) * k, b: 176 * k };
  }
  function bounds() {
    var e = ext();
    return { minX: EDGE - e.l, maxX: stage.clientWidth - EDGE - e.r, minY: EDGE - e.t, maxY: stage.clientHeight - EDGE - e.b };
  }
  function clampPos() {
    var bd = bounds();
    x = Math.max(bd.minX, Math.min(bd.maxX, x));
    y = Math.max(bd.minY, Math.min(bd.maxY, y));
  }
  function startPos() {
    var bd = bounds();
    x = bd.maxX; y = bd.maxY - 8;                      // 預設：右下角
    try {
      var s = JSON.parse(store(POS_KEY) || "null");
      if (s && typeof s.fx === "number") { x = bd.minX + s.fx * (bd.maxX - bd.minX); y = bd.minY + s.fy * (bd.maxY - bd.minY); }
    } catch (err) {}
    clampPos();
  }
  function savePos() {
    var bd = bounds();
    store(POS_KEY, JSON.stringify({
      fx: (x - bd.minX) / Math.max(1, bd.maxX - bd.minX), fy: (y - bd.minY) / Math.max(1, bd.maxY - bd.minY)
    }));
  }

  function placeBubble() {
    if (bubble.hidden) { return; }
    var e = ext(), W = stage.clientWidth, H = stage.clientHeight;
    var bw = bubble.offsetWidth, bh = bubble.offsetHeight;
    var top = y + e.t - bh - 10 - (el.classList.contains("sleeping") ? size * 0.16 : 0);   // 睡著時讓出 Z 的位置
    if (top < 8) { top = y + e.b + 10; }
    if (top + bh > H - 8) { top = Math.max(8, H - 8 - bh); }
    var left = Math.max(8, Math.min(W - bw - 8, x + size / 2 - bw / 2));
    bubble.style.transform = "translate(" + left.toFixed(0) + "px," + top.toFixed(0) + "px)";
  }
  function render() {
    var e = ext();
    var ax = Math.max(0, kx), ay = Math.max(0, ky);
    var sx = (1 + sq) * (1 - kx + ay * 0.55);
    var sy = (1 - sq) * (1 - ky + ax * 0.55);
    var px = wx < 0 ? e.l : wx > 0 ? e.r : size / 2;
    var py = wy < 0 ? e.t : wy > 0 ? e.b : size * 0.85;
    el.style.transform = "translate(" + (x + px).toFixed(1) + "px," + (y + py).toFixed(1) + "px) rotate(" + rot.toFixed(2) + "deg) scale(" +
      sx.toFixed(3) + "," + sy.toFixed(3) + ") translate(" + (-px).toFixed(1) + "px," + (-py).toFixed(1) + "px)";
    el.classList.toggle("squished", ax > 0.12 || ay > 0.12);
    var s = held ? 0.7 : 1;
    shadow.style.transform = "translate(" + (x + size / 2 - size * 0.32).toFixed(1) + "px," + (y + e.b - size * 0.04 + (held ? 10 : 0)).toFixed(1) + "px) scale(" + (s * (1 + ay * 0.6)).toFixed(2) + "," + s + ")";
    shadow.style.opacity = held ? 0.5 : 1;
    if (grow) { grow.setAttribute("transform", "translate(100 176) scale(" + growScale.toFixed(3) + ") translate(-100 -176)"); }
    placeBubble();
  }

  function bump(axis, side, speed) {
    var amt = Math.min(MAXK, speed * 0.028);
    if (amt < 0.03) { return; }
    if (axis === "x") { wx = side; vkx += amt * 0.6; } else { wy = side; vky += amt * 0.6; }
  }
  function settled() {
    return !held && Math.abs(vx) < .05 && Math.abs(vy) < .05 && Math.abs(rot) < .1 && Math.abs(vr) < .1 &&
      Math.abs(sq) < .002 && Math.abs(vsq) < .002 && !kx && !ky && Math.abs(growScale - growTarget) < .002;
  }
  function tick() {
    raf = 0;
    // 變胖／變瘦：彈簧過去，胖到頂到邊框會被推回來
    growScale += (growTarget - growScale) * 0.16;
    if (!held) {
      x += vx; y += vy;
      vx *= 0.9; vy *= 0.9;
      var bd = bounds();
      if (x < bd.minX) { x = bd.minX; bump("x", -1, Math.abs(vx)); vx = -vx * 0.45; }
      if (x > bd.maxX) { x = bd.maxX; bump("x", 1, Math.abs(vx)); vx = -vx * 0.45; }
      if (y < bd.minY) { y = bd.minY; bump("y", -1, Math.abs(vy)); vy = -vy * 0.45; }
      if (y > bd.maxY) { y = bd.maxY; bump("y", 1, Math.abs(vy)); vy = -vy * 0.45; }
      vr += (0 - rot) * 0.12; vr *= 0.78; rot += vr;
      vkx += (0 - kx) * 0.22; vkx *= 0.74; kx += vkx;
      vky += (0 - ky) * 0.22; vky *= 0.74; ky += vky;
    } else {
      var tx = Math.min(MAXK, pushX / (size * 0.9)), ty = Math.min(MAXK, pushY / (size * 0.9));
      vkx += (tx - kx) * 0.35; vkx *= 0.6; kx += vkx;
      vky += (ty - ky) * 0.35; vky *= 0.6; ky += vky;
    }
    kx = Math.max(-0.14, Math.min(MAXK, kx)); ky = Math.max(-0.14, Math.min(MAXK, ky));
    var flat = Math.min(1, Math.max(Math.abs(kx), Math.abs(ky)) * 6);   // 貼牆壓扁時不旋轉
    rot *= 1 - flat; vr *= 1 - flat;
    if (Math.abs(kx) < 0.002 && Math.abs(vkx) < 0.002) { kx = vkx = 0; if (!held || !pushX) { wx = 0; } }
    if (Math.abs(ky) < 0.002 && Math.abs(vky) < 0.002) { ky = vky = 0; if (!held || !pushY) { wy = 0; } }
    vsq += (0 - sq) * 0.25; vsq *= 0.7; sq += vsq;
    render();
    if (!settled()) { raf = requestAnimationFrame(tick); }
    else if (!held) { vx = vy = rot = sq = 0; growScale = growTarget; render(); savePos(); }
  }
  function kick() {
    if (reduce()) { growScale = growTarget; clampPos(); render(); return; }
    if (!raf) { raf = requestAnimationFrame(tick); }
  }

  /* ---------- 拖曳 ---------- */
  el.addEventListener("pointerdown", function (e) {
    if (e.button !== undefined && e.button !== 0) { return; }
    held = true; moved = false; pushX = pushY = 0;
    try { el.setPointerCapture(e.pointerId); } catch (err) {}
    el.classList.add("held");
    var r = stage.getBoundingClientRect();
    ox = e.clientX - r.left - x; oy = e.clientY - r.top - y;
    startX = lastX = e.clientX; startY = lastY = e.clientY; lastT = performance.now();
    vx = vy = 0; vsq = -0.12;
    kick();
  });
  el.addEventListener("pointermove", function (e) {
    if (!held) { return; }
    var r = stage.getBoundingClientRect();
    if (Math.abs(e.clientX - startX) + Math.abs(e.clientY - startY) > 6) { moved = true; }
    var now = performance.now(), dt = Math.max(8, now - lastT);
    var dvx = (e.clientX - lastX) / dt * 16, dvy = (e.clientY - lastY) / dt * 16;
    vx = Math.max(-36, Math.min(36, dvx)); vy = Math.max(-36, Math.min(36, dvy));
    lastX = e.clientX; lastY = e.clientY; lastT = now;
    var rawX = e.clientX - r.left - ox, rawY = e.clientY - r.top - oy;
    x = rawX; y = rawY;
    clampPos();
    pushX = Math.abs(rawX - x); pushY = Math.abs(rawY - y);
    if (pushX) { wx = rawX < x ? -1 : 1; }
    if (pushY) { wy = rawY < y ? -1 : 1; }
    var target = (pushX || pushY) ? 0 : Math.max(-22, Math.min(22, -dvx * 2.2));
    rot += (target - rot) * 0.35;
    sq = (pushX || pushY) ? 0 : Math.max(-0.12, Math.min(0.12, Math.abs(dvx) * 0.006 - Math.abs(dvy) * 0.004));
    if (reduce()) { render(); } else { kick(); }
  });
  function release() {
    if (!held) { return; }
    held = false; pushX = pushY = 0;
    el.classList.remove("held");
    if (performance.now() - lastT > 80) { vx = vy = 0; }
    if (!moved) { vx = vy = 0; talkMore(); vsq = 0.18; }
    if (reduce()) { vx = vy = rot = sq = kx = ky = vkx = vky = 0; render(); savePos(); return; }
    vr = Math.max(-8, Math.min(8, vx * 0.6));
    kick();
  }
  el.addEventListener("pointerup", release);
  el.addEventListener("pointercancel", release);
  el.addEventListener("keydown", function (e) {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); talkMore(); vsq = 0.18; kick(); return; }
    if (e.key === "Escape") { hideBubble(); return; }
    var step = e.shiftKey ? 48 : 16, dx = 0, dy = 0;
    if (e.key === "ArrowLeft") { dx = -step; } else if (e.key === "ArrowRight") { dx = step; }
    else if (e.key === "ArrowUp") { dy = -step; } else if (e.key === "ArrowDown") { dy = step; }
    if (dx || dy) {
      e.preventDefault();
      var bx = x + dx, by = y + dy; x = bx; y = by; clampPos();
      if (bx !== x) { bump("x", dx < 0 ? -1 : 1, 7); }
      if (by !== y) { bump("y", dy < 0 ? -1 : 1, 7); }
      render(); savePos(); kick();
    }
  });

  /* ---------- 說話 ---------- */
  var hideTimer = 0, curSec = "", lineIdx = {}, spoken = {};
  function say(html, ms) {
    bubbleText.innerHTML = html;
    bubbleText.removeAttribute("data-idle");
    if (live) { live.textContent = "碳碳：" + bubbleText.textContent; }
    bubble.hidden = false;
    placeBubble();
    clearTimeout(hideTimer);
    hideTimer = setTimeout(hideBubble, ms || 8000);
    vsq = 0.16; kick();
  }
  function hideBubble() { clearTimeout(hideTimer); bubble.hidden = true; }
  function talkMore() {
    var lines = LINES[curSec] || LINES.route;
    var i = lineIdx[curSec] === undefined ? 0 : (lineIdx[curSec] + 1) % lines.length;
    lineIdx[curSec] = i;
    say(lines[i]);
  }
  closeBtn.addEventListener("click", hideBubble);

  /* ---------- 收起／叫出來 ---------- */
  function setHidden(h) {
    root.classList.toggle("is-away", h);
    showBtn.hidden = !h;
    store(HIDE_KEY, h ? "1" : null);
    if (h) { hideBubble(); } else { measureSize(); clampPos(); render(); }
  }
  hideBtn.addEventListener("click", function () { setHidden(true); showBtn.focus(); });
  showBtn.addEventListener("click", function () { setHidden(false); el.focus(); say("我回來了！"); });

  /* ---------- 目前在哪個展區 ---------- */
  var secIds = Object.keys(LINES);
  var secEls = secIds.map(function (id) { return document.getElementById(id); });
  var secTimer = 0;
  function currentSec() {
    var yLine = (window.pageYOffset || document.documentElement.scrollTop) + window.innerHeight * 0.4;
    var idx = 0;
    for (var i = 0; i < secEls.length; i++) {
      if (secEls[i] && secEls[i].getBoundingClientRect().top + window.pageYOffset <= yLine) { idx = i; }
    }
    return secIds[idx];
  }
  var growQueued = false;
  function onScroll() {
    if (!growQueued) { growQueued = true; requestAnimationFrame(function () { growQueued = false; updateGrowth(); }); }
    var s = currentSec();
    if (s === curSec) { return; }
    curSec = s;
    updateGrowth();
    clearTimeout(secTimer);
    // 停在這一區一下子才開口，快速捲過去就不吵
    secTimer = setTimeout(function () {
      if (curSec !== s || spoken[s] || root.classList.contains("is-away") || Date.now() < quietUntil) { return; }
      spoken[s] = true; lineIdx[s] = 0;
      say(LINES[s][0]);
    }, 900);
  }

  /* ---------- 身材跟著排放量 ---------- */
  var heroTotal = document.getElementById("heroTotal");
  var sbTotal = document.getElementById("sbTotal");
  var lastSb = null, sbBase = null;
  function num(node) { return node ? parseFloat(String(node.textContent).replace(/,/g, "")) || 0 : 0; }
  var sandbox = sbTotal ? (sbTotal.closest ? sbTotal.closest(".sandbox") : null) || sbTotal : null;
  function onScreen(node) {
    if (!node) { return false; }
    var r = node.getBoundingClientRect();
    return r.bottom > 0 && r.top < window.innerHeight;
  }
  function scaleFor(kg) { return 1 + 0.5 * Math.min(1, Math.max(0, kg) / 1000); }   // 0 kg → 1 倍，1,000 kg 以上 → 1.5 倍
  function updateGrowth() {
    var t = 1;
    if (curSec === "route") { t = scaleFor(num(heroTotal)); }
    else if (onScreen(sandbox)) { t = scaleFor(num(sbTotal)); }   // 只有試算工具在畫面上時才跟著它的數字
    if (Math.abs(t - growTarget) > 0.002) { growTarget = t; vsq = 0.12; kick(); }
  }
  function watch(node, fn) {
    if (!node || !window.MutationObserver) { return; }
    new MutationObserver(fn).observe(node, { childList: true, characterData: true, subtree: true });
  }
  watch(heroTotal, updateGrowth);
  watch(sbTotal, function () {
    updateGrowth();
    var v = num(sbTotal);
    if (sbBase === null) { sbBase = v; lastSb = v; return; }
    if (curSec !== "case" || root.classList.contains("is-away") || Math.abs(v - lastSb) < 0.05) { return; }
    var r = v / Math.max(1, sbBase);
    var msg = r >= 2 ? "排放變成 <strong>" + v.toFixed(1) + " kg</strong>，大約是原本的 " + r.toFixed(1) + " 倍……我快撐爆了。"
      : r <= 0.8 ? "降到 <strong>" + v.toFixed(1) + " kg</strong>，我瘦下來了！"
      : null;
    lastSb = v;
    if (msg) { clearTimeout(sbTalk); sbTalk = setTimeout(function () { say(msg); }, 350); }
  });
  var sbTalk = 0;

  /* ---------- 測驗反應 ---------- */
  document.addEventListener("click", function (e) {
    var b = e.target && e.target.closest ? e.target.closest(".mc-opt") : null;
    if (!b || root.classList.contains("is-away")) { return; }
    setTimeout(function () {
      var li = b.closest(".mc");
      if (!li) { return; }
      if (li.classList.contains("is-right")) { say("答對了！"); }
      else if (li.classList.contains("is-wrong")) { say("差一點，看一下下面的解說再往下。"); }
    }, 0);
  });

  /* =========================================================
     搜尋：輸入關鍵字，碳碳帶你到網站裡的那個地方
     ========================================================= */
  var sPanel = document.getElementById("tanSearch");
  var sInput = document.getElementById("tanQ");
  var sList = document.getElementById("tanResults");
  var sNote = document.getElementById("tanSNote");
  var sClose = document.getElementById("tanSClose");
  var findBtn = document.getElementById("tanFind");
  var INDEX = null, quietUntil = 0, sResults = [];

  function norm(t) { return String(t || "").normalize ? String(t || "").normalize("NFKC").toLowerCase() : String(t || "").toLowerCase(); }
  function clean(t) { return String(t || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim(); }
  function escHtml(t) { return String(t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  // 展區名稱：沿用左側導覽的編號與名稱
  var SEC_NAME = {};
  Array.prototype.forEach.call(document.querySelectorAll(".rail-list a"), function (a) {
    var id = (a.getAttribute("href") || "").replace("#", "");
    var no = a.querySelector("i") ? a.querySelector("i").textContent : "";
    SEC_NAME[id] = (no ? no + " " : "") + a.textContent.replace(no, "").trim();
  });
  function secOf(node) {
    var s = node && node.closest ? node.closest("section[id]") : null;
    return s ? (SEC_NAME[s.id] || "") : "";
  }

  function buildIndex() {
    var list = [], seen = {};
    function add(o) {
      var key = o.kind + "|" + o.title + "|" + o.text;
      if (seen[key]) { return; }
      seen[key] = 1;
      o.hay = norm(o.title + " " + o.text);
      o.tnorm = norm(o.title);
      list.push(o);
    }
    var main = document.getElementById("main") || document.body;
    var SKIP = "#glossList, #playerPanel, .sr, noscript, svg, .mc-fb, .drawer, .tan";
    // 1. 標題
    Array.prototype.forEach.call(main.querySelectorAll("h2, h3, h4, summary"), function (h) {
      if (h.closest(SKIP)) { return; }
      var t = clean(h.textContent);
      if (t) { add({ kind: "標題", w: 3, title: t, text: "", sec: secOf(h), el: h }); }
    });
    // 2. 術語（打開術語說明）
    var site = window.ISO_SITE || {};
    (site.gloss || []).forEach(function (t) {
      add({ kind: "術語", w: 3, title: t.zh + (t.abbr ? "（" + t.abbr + "）" : ""), text: t.en + "　" + t.plain + " " + (t.eg || ""),
        sec: SEC_NAME.glossary || "術語", term: t.id });
    });
    // 3. 案例的每一步（切到那一步）
    var cases = site.cases || {};
    Object.keys(cases).forEach(function (k) {
      (cases[k].steps || []).forEach(function (st, i) {
        add({ kind: "案例步驟", w: 2, title: "案例 " + k.toUpperCase() + "｜" + clean(st.h), text: clean(st.p) + " " + clean(st.extra),
          sec: SEC_NAME["case"] || "案例", caseKey: k, step: i });
      });
    });
    // 4. 內文段落
    Array.prototype.forEach.call(main.querySelectorAll("p, li, dt, dd, figcaption, td, th, .mc-q"), function (el) {
      if (el.closest(SKIP)) { return; }
      if (el.tagName === "LI" && el.querySelector("p, li, ul, ol")) { return; }   // 外層清單交給裡面的段落
      var t = clean(el.textContent);
      if (t.length < 4) { return; }
      add({ kind: "內文", w: 1, title: "", text: t, sec: secOf(el), el: el });
    });
    // 5. 互動元件上的文字（試算的運具選項、運輸鏈的節點等）；測驗選項不收，免得直接看到答案
    Array.prototype.forEach.call(main.querySelectorAll("button, label, legend"), function (el) {
      if (el.closest(SKIP) || el.closest(".mc-opt, [data-term], .quiz-btn")) { return; }
      var t = clean(el.innerText || el.textContent);   // innerText 會在按鈕內的小標之間留空白
      if (t.length < 2) { return; }
      add({ kind: "互動", w: 1, title: t.length <= 24 ? t : "", text: t.length > 24 ? t : "", sec: secOf(el), el: el });
    });
    return list;
  }

  function search(q) {
    var words = norm(q).split(/\s+/).filter(Boolean);
    if (!words.length) { return []; }
    var out = [];
    INDEX.forEach(function (o, n) {
      for (var i = 0; i < words.length; i++) { if (o.hay.indexOf(words[i]) < 0) { return; } }
      var score = o.w * 10;
      if (o.tnorm && o.tnorm.indexOf(words[0]) >= 0) { score += 8; }
      if (o.tnorm === words.join(" ")) { score += 6; }
      score -= o.hay.indexOf(words[0]) / 400;                       // 越早出現越前面
      out.push({ o: o, score: score, n: n });
    });
    out.sort(function (a, b) { return b.score - a.score || a.n - b.n; });
    return out.slice(0, 8).map(function (r) { return r.o; });
  }

  function snippet(text, word) {
    var t = clean(text);
    if (!t) { return ""; }
    var i = norm(t).indexOf(word);
    if (i < 0) { return escHtml(t.length > 70 ? t.slice(0, 70) + "…" : t); }
    var a = Math.max(0, i - 22), b = Math.min(t.length, i + word.length + 40);
    return (a > 0 ? "…" : "") + escHtml(t.slice(a, i)) + "<mark>" + escHtml(t.slice(i, i + word.length)) + "</mark>" +
      escHtml(t.slice(i + word.length, b)) + (b < t.length ? "…" : "");
  }

  var SUGGEST = ["TCE", "類別 3", "轉運", "全程卡車", "分配", "tkm", "14064-3"];
  function showSuggest(msg) {
    sNote.innerHTML = msg + '<span class="tan-chips">' + SUGGEST.map(function (w) {
      return '<button type="button" data-q="' + escHtml(w) + '">' + escHtml(w) + "</button>";
    }).join("") + "</span>";
  }
  function renderResults() {
    var q = sInput.value.trim();
    sList.innerHTML = "";
    if (!q) { sResults = []; showSuggest("試試看這些詞："); return; }
    sResults = search(q);
    if (!sResults.length) { showSuggest("找不到「" + escHtml(q) + "」。換個說法，或試試："); return; }
    sNote.textContent = "找到 " + sResults.length + " 個地方" + (sResults.length === 8 ? "（只列前 8 個）" : "") + "，點一下帶你過去";
    var w0 = norm(q).split(/\s+/)[0];
    sResults.forEach(function (o, i) {
      var li = document.createElement("li");
      var b = document.createElement("button");
      b.type = "button"; b.setAttribute("data-i", i);
      var head = o.title ? snippet(o.title, w0) : "";
      var body = o.kind === "內文" ? snippet(o.text, w0) : (o.text ? snippet(o.text, w0) : "");
      b.innerHTML = '<span class="tan-r-meta">' + escHtml(o.sec || "") + "・" + o.kind + "</span>" +
        (head ? '<span class="tan-r-title">' + head + "</span>" : "") +
        (body && o.kind !== "標題" ? '<span class="tan-r-text">' + body + "</span>" : "");
      li.appendChild(b);
      sList.appendChild(li);
    });
  }

  function openSearch(q) {
    if (!INDEX) { INDEX = buildIndex(); }
    hideBubble();
    sPanel.hidden = false;
    if (typeof q === "string") { sInput.value = q; }
    renderResults();
    sInput.focus();
    sInput.select();
  }
  function closeSearch(back) {
    if (sPanel.hidden) { return; }
    sPanel.hidden = true;
    if (back !== false && !root.classList.contains("is-away")) { el.focus({ preventScroll: true }); }
  }

  function visibleTarget(node) {
    // 打開所在的摺疊區塊；若元素本身看不到（例如被隱藏），退到最近看得到的外層
    for (var d = node; d; d = d.parentElement) { if (d.tagName === "DETAILS") { d.open = true; } }
    var t = node;
    while (t && t !== document.body && !(t.offsetWidth || t.offsetHeight || t.getClientRects().length)) { t = t.parentElement; }
    return t || node;
  }
  function jumpTo(o) {
    closeSearch(false);
    var site = window.ISO_SITE || {};
    if (o.term && site.openTerm) {
      site.openTerm(o.term);
      say("這是「" + escHtml(o.title) + "」的說明，看完按關閉就回來了。");
      return;
    }
    var target = o.el;
    if (o.caseKey && site.showCaseStep) { target = site.showCaseStep(o.caseKey, o.step); }
    if (!target) { return; }
    target = visibleTarget(target);
    var bar = document.querySelector(".topbar");
    var off = (bar ? bar.getBoundingClientRect().height : 0) + 24;
    var top = target.getBoundingClientRect().top + window.pageYOffset - off;
    // 跳轉途中經過的展區不要搶著講話，目的地那區也算講過了
    quietUntil = Date.now() + 2500;
    var dest = target.closest ? target.closest("section[id]") : null;
    if (dest) { spoken[dest.id] = true; }
    window.scrollTo({ top: Math.max(0, top), behavior: reduce() ? "auto" : "smooth" });
    clearTimeout(target._tanHitT);
    target.classList.remove("tan-hit"); void target.offsetWidth; target.classList.add("tan-hit");
    target._tanHitT = setTimeout(function () { target.classList.remove("tan-hit"); }, 2600);
    if (!target.hasAttribute("tabindex") && !/^(A|BUTTON|INPUT|SELECT|TEXTAREA|SUMMARY)$/.test(target.tagName)) { target.setAttribute("tabindex", "-1"); }
    try { target.focus({ preventScroll: true }); } catch (err) {}
    setTimeout(function () {
      if (!root.classList.contains("is-away")) { say("到了！這段在「" + escHtml(o.sec || "這裡") + "」。"); }
    }, reduce() ? 0 : 700);
  }

  sInput.addEventListener("input", renderResults);
  sInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") { e.preventDefault(); if (sResults[0]) { jumpTo(sResults[0]); } }
    if (e.key === "ArrowDown") { e.preventDefault(); var f = sList.querySelector("button"); if (f) { f.focus(); } }
  });
  sList.addEventListener("click", function (e) {
    var b = e.target.closest ? e.target.closest("button[data-i]") : null;
    if (b) { jumpTo(sResults[+b.getAttribute("data-i")]); }
  });
  sList.addEventListener("keydown", function (e) {
    var b = e.target.closest ? e.target.closest("button[data-i]") : null;
    if (!b) { return; }
    var li = b.parentElement;
    if (e.key === "ArrowDown" && li.nextElementSibling) { e.preventDefault(); li.nextElementSibling.querySelector("button").focus(); }
    if (e.key === "ArrowUp") { e.preventDefault(); if (li.previousElementSibling) { li.previousElementSibling.querySelector("button").focus(); } else { sInput.focus(); } }
  });
  sNote.addEventListener("click", function (e) {
    var b = e.target.closest ? e.target.closest("button[data-q]") : null;
    if (b) { sInput.value = b.getAttribute("data-q"); renderResults(); sInput.focus(); }
  });
  sClose.addEventListener("click", function () { closeSearch(); });
  sPanel.addEventListener("keydown", function (e) { if (e.key === "Escape") { e.preventDefault(); closeSearch(); } });
  findBtn.addEventListener("click", function () { openSearch(); });
  // 按 / 也能打開搜尋（正在打字或術語說明開著時不搶）
  document.addEventListener("keydown", function (e) {
    if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) { return; }
    var a = document.activeElement, tag = a ? a.tagName : "";
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag) || (a && a.isContentEditable)) { return; }
    var dr = document.getElementById("drawer");
    if (dr && !dr.hidden) { return; }
    e.preventDefault();
    openSearch();
  });
  // 點面板外面就收起
  document.addEventListener("pointerdown", function (e) {
    if (sPanel.hidden || sPanel.contains(e.target) || (findBtn.contains && findBtn.contains(e.target))) { return; }
    closeSearch(false);
  });

  /* =========================================================
     閒置提醒：太久沒動靜，碳碳會揮手叫你；再久一點就睡著
     - 只算「頁面開著、在前景」的時間；切到別的分頁則改用分頁標題提醒
     - 收起碳碳、搜尋或術語說明開著時不打擾
     ========================================================= */
  var IDLE_CALL = 90 * 1000;      // 90 秒沒動作：揮手叫你
  var IDLE_SLEEP = 180 * 1000;    // 3 分鐘：睡著，不再吵
  var lastAct = Date.now(), idleStage = 0, hiddenAt = 0, baseTitle = document.title, titleTimer = 0;
  var CALL_LINES = [
    "還在嗎？要不要我幫你<strong>找關鍵字</strong>？",
    "嘿～還在看嗎？卡住的話，點我一下我幫你帶路。",
    "這一段比較長，慢慢看沒關係。還在的話跟我揮個手（點我）！"
  ];
  function busy() {
    var dr = document.getElementById("drawer");
    return root.classList.contains("is-away") || !sPanel.hidden || (dr && !dr.hidden) || held;
  }
  function setMood(m) {
    el.classList.toggle("waving", m === "wave");
    el.classList.toggle("sleeping", m === "sleep");
  }
  function activity() {
    lastAct = Date.now();
    if (!idleStage) { return; }
    var wasSleeping = idleStage === 2;
    idleStage = 0;
    setMood("");
    if (wasSleeping && !busy()) { say("啊，我醒了！我們看到「" + escHtml(SEC_NAME[curSec] || "這裡") + "」。"); }
    else if (!bubble.hidden && bubbleText.getAttribute("data-idle")) { hideBubble(); }
  }
  var moveT = 0;
  ["scroll", "wheel", "keydown", "pointerdown", "touchstart"].forEach(function (t) {
    window.addEventListener(t, activity, { passive: true, capture: true });
  });
  window.addEventListener("pointermove", function () {   // 滑鼠移動也算，但不用每一下都處理
    var n = Date.now(); if (n - moveT > 1000) { moveT = n; activity(); }
  }, { passive: true, capture: true });

  setInterval(function () {
    if (document.visibilityState === "hidden") { return; }
    var idle = Date.now() - lastAct;
    if (busy()) { return; }
    if (idleStage === 0 && idle >= IDLE_CALL) {
      idleStage = 1;
      setMood(reduce() ? "" : "wave");
      say(CALL_LINES[Math.floor(Math.random() * CALL_LINES.length)], 20000);
      bubbleText.setAttribute("data-idle", "1");
      vsq = 0.3; kick();
    } else if (idleStage === 1 && idle >= IDLE_SLEEP) {
      idleStage = 2;
      setMood("sleep");
      say("沒人理我……我先睡一下。動一下滑鼠或捲一下，我就醒了。", 12000);
      bubbleText.setAttribute("data-idle", "1");
    }
  }, 5000);

  // 切到別的分頁：太久沒回來就在分頁標題上叫你；回來時打聲招呼
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") {
      hiddenAt = Date.now();
      clearTimeout(titleTimer);
      titleTimer = setTimeout(function () { document.title = "（碳碳在等你）" + baseTitle; }, IDLE_CALL);
    } else {
      clearTimeout(titleTimer);
      var away = hiddenAt ? Date.now() - hiddenAt : 0;
      hiddenAt = 0;
      if (document.title !== baseTitle) { document.title = baseTitle; }
      lastAct = Date.now(); idleStage = 0; setMood("");
      if (away >= IDLE_CALL && !busy()) { say("歡迎回來！我們剛剛看到「" + escHtml(SEC_NAME[curSec] || "這裡") + "」。"); }
    }
  });

  /* ---------- 啟動 ---------- */
  root.hidden = false;      // 先顯示，才量得到視窗與角色的尺寸
  measureSize();
  startPos();
  sbBase = sbTotal ? num(sbTotal) : null; lastSb = sbBase;
  if (store(HIDE_KEY) === "1") { setHidden(true); }
  curSec = currentSec();
  updateGrowth();
  growScale = growTarget;
  render();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", function () { measureSize(); clampPos(); render(); });
  if (motionQuery && motionQuery.addEventListener) { motionQuery.addEventListener("change", function () { kick(); }); }
  // 開場打招呼（只在入口）
  setTimeout(function () {
    if (root.classList.contains("is-away") || spoken[curSec]) { return; }
    spoken[curSec] = true; lineIdx[curSec] = 0;
    say(LINES[curSec][0]);
  }, 1200);
})();
