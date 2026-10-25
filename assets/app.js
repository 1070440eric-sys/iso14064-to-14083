/* =========================================================
   從 ISO 14064 到 ISO 14083 — 互動邏輯
   純原生 JS，無相依、無建置步驟。
   ========================================================= */
(function () {
  "use strict";

  /* ---------------------------------------------------------
     1. 術語資料
     定義依據：ISO 官方標準頁（標題／範圍）、
     CLECAT 譯自 Umweltbundesamt 之《Guide to ISO 14083》Glossary、
     NQA《An Introduction to ISO 14064-1》。
     plain／eg 欄位為本展以白話重述，非標準原文。
     --------------------------------------------------------- */
  var GLOSS = [
    {
      id: "tce", abbr: "TCE", en: "Transport Chain Element", zh: "運輸鏈元素",
      cat: "chain",
      def: "運輸鏈中的一個段落：貨物或旅客由同一運具在某一段移動，或在其中通過一個轉運節點。它取代舊標準 EN 16258 的「Leg（路段）」說法。",
      plain: "把一趟運輸切成可以單獨檢視的積木。一塊可能是「卡車跑的一段」，也可能是「在轉運站被搬上搬下的那一下」。",
      eg: "一批貨：卡車 50 km → 轉運站 A（卡車→火車）→ 貨列 500 km → 轉運站 B（火車→卡車） → 卡車 100 km，就是五個 TCE。",
      src: "Guide to ISO 14083（CLECAT／Umweltbundesamt）Glossary、§3.1"
    },
    {
      id: "tc", abbr: "TC", en: "Transport Chain", zh: "運輸鏈",
      cat: "chain",
      def: "貨物或旅客從一個起點到一個終點的運輸過程，由一連串 TCE 組成。",
      plain: "整趟旅程本身，從出貨到收貨。",
      eg: "上面那五個 TCE 加起來，就是一條完整的運輸鏈。",
      src: "Guide to ISO 14083 Glossary、§3.1"
    },
    {
      id: "hub", abbr: "HO / HOC", en: "Hub operation / Hub operation category", zh: "轉運作業／轉運作業類別",
      cat: "chain",
      def: "Hub operation 指貨物（如物流場站）或旅客（如客運站）的轉運、裝卸；性質相近的 hub operation 彙整成 Hub operation category（HOC）。Hub 本身也是一個 TCE。",
      plain: "貨物在中間被集中、分流、換運具的那個節點。轉運站不是「路過就沒事」，它會耗能、會排碳。",
      eg: "貨櫃在轉運站從卡車吊上貨列；機場把貨物從卡車轉上貨機。",
      src: "Guide to ISO 14083 Glossary、§3.2、Table 1"
    },
    {
      id: "hub-activity", abbr: "H", en: "Hub activity", zh: "轉運活動量",
      cat: "data",
      def: "描述一個 hub 處理了多少量的單位，通常以噸（t）或旅客人數（pax）表示。",
      plain: "這個轉運站經手了多少貨（或多少人），跟距離無關。",
      eg: "10 噸貨在轉運站卸櫃再裝櫃，hub activity 就是 10 t。",
      src: "Guide to ISO 14083 Glossary、§3.2"
    },
    {
      id: "transport-activity", abbr: "T", en: "Transport activity", zh: "運輸活動量",
      cat: "data",
      def: "描述運輸做了多少工作的量，貨運常用噸公里（tkm）、客運常用旅客公里（pkm）。",
      plain: "「搬多重」乘上「搬多遠」。這是排放計算裡的乘數。",
      eg: "10 噸貨運 500 km，運輸活動量 = 500 km × 10 t = 5,000 tkm。",
      src: "Guide to ISO 14083 Glossary、§3.2"
    },
    {
      id: "to-toc", abbr: "TO / TOC", en: "Transport operation / Transport operation category", zh: "運輸作業／運輸作業類別",
      cat: "chain",
      def: "Transport operation 指使用運具運送貨物或旅客；性質相近的 TO 在某段期間內彙整成 TOC。取代 EN 16258 的「vehicle operation system」。",
      plain: "「哪一種車、用什麼燃料、怎麼跑」的組合。同一批柴油連結卡車可以歸成同一類，一起算一個排放強度。",
      eg: "12 輛 Euro 6a-c 的柴油連結卡車歸成一個 TOC，一起算每噸公里排放。",
      src: "Guide to ISO 14083 Glossary、§3.2"
    },
    {
      id: "allocation", abbr: "Allocation", en: "Allocation", zh: "排放分配",
      cat: "data",
      def: "當一個運輸或轉運過程同時服務超過一種功能（例如同時載貨與載客），必須把溫室氣體活動或排放在不同貨物或旅客群體間分割。14083 規定以實際質量為基礎，也可使用標準附件提供的旅客當量等標準值。",
      plain: "一台車裝三批貨，不能把整趟排放都算給其中一批。要按「誰佔了多少」來分。",
      eg: "同一班貨列同時載貨車廂與客車廂，排放要依實際質量（含旅客行李）在貨與客之間分配。",
      src: "Guide to ISO 14083 §4.2.2、Table 5"
    },
    {
      id: "operation", abbr: "GVO / GHEO", en: "Operation GHG emissions", zh: "營運溫室氣體排放",
      cat: "ghg",
      def: "因運具或 hub 的運轉而產生的溫室氣體排放。取代 EN 16258 的 Tank-to-Wheel（TTW）。",
      plain: "運具與轉運站「實際運轉」當下排的碳：燃料燃燒、燃料洩漏、冷媒外洩，還有場站的照明與冷暖。不只是排氣管。",
      eg: "卡車引擎燒掉 30 公升柴油從排氣管排出的 CO₂、冷藏車外洩的冷媒，以及轉運站夜間照明用的電。",
      src: "Guide to ISO 14083 Glossary、§1.2"
    },
    {
      id: "energy-provision", abbr: "GVEP / GHEEP", en: "Energy provision GHG emissions", zh: "能源供應溫室氣體排放",
      cat: "ghg",
      def: "能源載體（含電力）在生產、儲存、加工與配送過程中所產生的溫室氣體排放。取代 EN 16258 的 Well-to-Tank（WTT）。",
      plain: "燃料還沒進油箱之前就已經排過的碳：開採、煉製、運到加油站、發電。",
      eg: "柴油從油井到煉油廠再到加油站的過程排放；電動車用的電在發電端產生的排放。",
      src: "Guide to ISO 14083 Glossary、§1.2"
    },
    {
      id: "total-ghg", abbr: "G_T", en: "Total GHG emissions", zh: "總溫室氣體排放",
      cat: "ghg",
      def: "能源供應排放與營運排放的合計。取代 EN 16258 的 Well-to-Wheel（WTW）。",
      plain: "油井到車輪全部加起來，才是 14083 要報的數。",
      eg: "能源供應 22.56 g CO₂e/MJ ＋ 營運 75.26 g CO₂e/MJ（柴油，歐洲能源載體表）≈ 97.82 g CO₂e/MJ。",
      src: "Guide to ISO 14083 Glossary、Table 17"
    },
    {
      id: "ef", abbr: "ε", en: "GHG emission factor", zh: "溫室氣體排放因子",
      cat: "data",
      def: "把溫室氣體活動（能源消耗、甲烷洩漏、冷媒損失等）換算成溫室氣體排放的係數。",
      plain: "一個換算倍數：每燒一 MJ 的柴油，等於排多少 CO₂e。",
      eg: "柴油營運排放約 75.26 g CO₂e/MJ、含能源供應約 97.82 g CO₂e/MJ（歐洲數值，僅供示意）。",
      src: "Guide to ISO 14083 Glossary、§4.2.1、Table 17"
    },
    {
      id: "intensity", abbr: "g", en: "GHG emission intensity", zh: "溫室氣體排放強度",
      cat: "data",
      def: "與對應的運輸或轉運活動相關的溫室氣體排放，常用每噸公里或每噸表示。",
      plain: "「每搬一噸一公里，大概排多少」。用它乘活動量，就得到排放量。",
      eg: "公路 0.150 kg CO₂e/tkm、鐵路 0.014 kg CO₂e/tkm：同距離下鐵路低一個數量級。",
      src: "Guide to ISO 14083 Glossary、§4.2"
    },
    {
      id: "primary", abbr: "", en: "Primary data", zh: "一次資料",
      cat: "data",
      def: "來自直接量測，或可由直接量測值計算得到的資料。",
      plain: "自己量出來、或從自己量的數字算出來的，不是抄平均值。",
      eg: "車隊自己的油耗紀錄、場站自己的用電表讀數。",
      src: "Guide to ISO 14083 Glossary、§2.2、§4.2.3"
    },
    {
      id: "secondary", abbr: "", en: "Secondary data", zh: "二次資料",
      cat: "data",
      def: "不符合一次資料要求者，包含模型推估資料與預設值。",
      plain: "拿別人建好的模型或表裡的預設值來用。可以用，但要在報告裡說明。",
      eg: "查一張公開的「每噸公里平均排放」表來估算自己的運輸。",
      src: "Guide to ISO 14083 Glossary、§2.2、§4.2.3"
    },
    {
      id: "sfd", abbr: "SFD / GCD", en: "Shortest feasible distance / Great circle distance", zh: "最短可行距離／大圓距離",
      cat: "data",
      def: "SFD 是考量既有基礎設施與適用運具後，最合適的最短路線；GCD 是地球表面兩點間的最短距離。",
      plain: "SFD 是「這種車實際能走的最短路」，不是直線距離。空駛、繞路怎麼處理，標準另有調整因數。",
      eg: "卡車走公路網的 SFD 50 km；若油耗是以實際行駛距離量得，指南示範用 5% 的調整因數。",
      src: "Guide to ISO 14083 Glossary、§3.2.1、Table 3"
    },
    {
      id: "co2e", abbr: "CO₂e", en: "Carbon dioxide equivalent", zh: "二氧化碳當量",
      cat: "ghg",
      def: "以全球暖化潛勢把不同溫室氣體換算成相同單位的表達方式，讓 CO₂、CH₄、N₂O 等可以相加比較。",
      plain: "把各種溫室氣體都折算成「相當於多少 CO₂」，才能加總成一個數字。",
      eg: "甲烷的暖化效應比 CO₂ 強很多，所以 1 噸甲烷會換算成遠大於 1 噸的 CO₂e。",
      src: "通識性定義；換算值依適用標準與選用的評估報告而異，本展未採用特定數值"
    },
    {
      id: "ghg", abbr: "GHG", en: "Greenhouse gas", zh: "溫室氣體",
      cat: "ghg",
      def: "能吸收紅外輻射、增強溫室效應的氣體，慣用清單包含二氧化碳、甲烷、氧化亞氮、氟化氣體等。",
      plain: "讓地球保熱的氣體。碳盤查算的就是它們。",
      eg: "燒柴油排 CO₂、垃圾掩埋場排 CH₄、冷氣冷媒洩漏排氟化氣體。",
      src: "通識性定義；正式氣體清單依適用公約與標準"
    },
    {
      id: "iso14064", abbr: "ISO 14064", en: "ISO 14064 series", zh: "ISO 14064 系列",
      cat: "org",
      def: "溫室氣體標準系列。核心三份：-1 組織層級的量化與報告、-2 專案層級減量或移除增強的量化與監測、-3 溫室氣體聲明的查證與確證。另有兩份指引文件：ISO/TS 14064-4:2025（如何應用 14064-1，取代 ISO/TR 14069:2013）與 ISO 14064-5:2026（查證／確證哪些工作可遠端進行）。",
      plain: "一套「算公司、算專案、查別人」的規矩；-4 與 -5 不新增要求，只是教你前面那三份要怎麼用。",
      eg: "食品公司年報用 -1；換鍋爐的減量專案用 -2；第三方來查報告用 -3；要決定怎麼畫組織邊界看 -4；查核要不要跑現場看 -5。",
      src: "ISO 官方目錄頁（14064-1:2018／-2:2019／-3:2019／TS 14064-4:2025／14064-5:2026）；NQA《An Introduction to ISO 14064-1》（2024）"
    },
    {
      id: "ts", abbr: "TS / TR", en: "Technical Specification / Technical Report", zh: "技術規範／技術報告",
      cat: "org",
      def: "ISO 的一種文件類型：在尚未成熟到可直接成為國際標準、或屬於指引性質的主題上發布。編號寫成 ISO/TS xxxx。它不是「比較不重要的標準」，但性質上多為說明與建議，而非符合性要求。",
      plain: "標準家族裡的「說明書」。看到 ISO/TS 就知道這份主要在教你怎麼用別份標準。",
      eg: "ISO/TS 14064-4:2025 是「怎麼應用 ISO 14064-1」的指引，本身不另設一套盤查要求。",
      src: "ISO 官方目錄對文件類型的標示（ISO/TS 14064-4:2025 文件類型為 technical specification）"
    },
    {
      id: "org-level", abbr: "", en: "Organisation level", zh: "組織層級",
      cat: "org",
      def: "以一個組織（公司、集團、據點組合）為邊界的盤查範圍，14064-1 的核心視角。",
      plain: "先畫一個圈，把圈裡這家公司當成一個整體來算。",
      eg: "把總部與三座工廠圈成一個組織，三座的排放一起算成「公司總排放」。",
      src: "ISO 14064-1:2018 範圍（ISO 官方目錄頁）＋ NQA 介紹"
    },
    {
      id: "scope", abbr: "Scope 1/2/3", en: "Scopes (GHG Protocol)", zh: "溫室氣體範疇（慣稱）",
      cat: "org",
      def: "GHG Protocol 的分類慣稱：Scope 1 直接排放、Scope 2 外購能源的間接排放、Scope 3 其他間接排放（含 15 個子類別）。14064-1 本身以直接、外購能源、運輸、產品使用等類別表述，實務常借用 Scope 對照。",
      plain: "把公司的排放分成「自己排的」「買來的電排的」「上下游其他來源排的」三堆。注意同一件事落在哪一堆，取決於排放源是不是你的。",
      eg: "公司自有卡車是 Scope 1；委外物流商的出貨運輸通常落在 Scope 3 的上游／下游運輸。",
      src: "GHG Protocol Corporate Standard；Innovation Center for U.S. Dairy《Scope 3 GHG Inventory Guidance》（2019，產業實務範例）；NQA 介紹之對照"
    },
    {
      id: "verify", abbr: "", en: "Verification / Validation", zh: "查證／確證",
      cat: "org",
      def: "Verification 針對既存溫室氣體聲明（如組織盤查報告）；Validation 針對計畫中的專案設計。14064-3 提供執行與管理這些活動的原則與要求。",
      plain: "請可信的第三方來查：你講的這個數字站不站得住。",
      eg: "驗證機構查一家公司的年度盤查報告；確證則查一個尚未執行的減碳專案設計。",
      src: "NQA《An Introduction to ISO 14064-1》（2024）"
    },
    {
      id: "tkm", abbr: "tkm / pkm", en: "tonne-kilometre / passenger-kilometre", zh: "噸公里／旅客公里",
      cat: "data",
      def: "運輸活動量的單位：貨運為噸公里，客運為旅客公里。",
      plain: "一噸貨移動一公里就是一 tkm；一個人移動一公里就是一 pkm。",
      eg: "10 噸貨運 500 km = 5,000 tkm；150 人搭 100 km = 15,000 pkm。",
      src: "Guide to ISO 14083 Glossary、§3.2"
    }
  ];

  /* ---------------------------------------------------------
     2. 術語渲染 + 抽屜
     --------------------------------------------------------- */
  var glossList = document.getElementById("glossList");
  var glossCount = document.getElementById("glossCount");
  var searchBox = document.getElementById("glossSearch");
  var drawer = document.getElementById("drawer");
  var lastFocus = null;

  function findTerm(id) {
    for (var i = 0; i < GLOSS.length; i++) { if (GLOSS[i].id === id) { return GLOSS[i]; } }
    return null;
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  var activeFilter = "all";
  // 提案書列的 7 個核心術語：預設只顯示這些，避免第一眼像在讀字典
  var CORE_TERMS = ["tce", "transport-activity", "hub", "allocation", "energy-provision", "operation", "co2e"];
  var showAllTerms = false;

  function renderGloss() {
    var q = (searchBox.value || "").trim().toLowerCase();
    var items = GLOSS.filter(function (t) {
      if (activeFilter !== "all" && t.cat !== activeFilter) { return false; }
      if (!q) { return showAllTerms || activeFilter !== "all" || CORE_TERMS.indexOf(t.id) >= 0; }
      var hay = (t.abbr + " " + t.en + " " + t.zh + " " + t.plain + " " + t.eg).toLowerCase();
      return hay.indexOf(q) >= 0;
    });

    glossList.innerHTML = "";
    if (!items.length) {
      var li = document.createElement("li");
      li.className = "gloss-empty";
      li.textContent = "找不到符合的術語。試試看：allocation、轉運、tkm、能源。";
      glossList.appendChild(li);
    }
    items.forEach(function (t) {
      var row = document.createElement("li");
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "g-card";
      btn.setAttribute("data-term", t.id);
      btn.innerHTML =
        '<span><span class="g-abbr">' + esc(t.abbr || "—") + "</span>" +
        '<span class="g-en" lang="en">' + esc(t.en) + "</span></span>" +
        '<span><span class="g-plain"><strong>' + esc(t.zh) + "</strong>　" + esc(t.plain) + "</span>" +
        '<span class="g-tag">點我看完整四層說明</span></span>';
      row.appendChild(btn);
      glossList.appendChild(row);
    });
    var coreView = !q && activeFilter === "all" && !showAllTerms;
    glossCount.textContent = coreView
      ? "先看最常用的 " + items.length + " 個（全部共 " + GLOSS.length + " 個）"
      : "共 " + items.length + " 個術語" + (activeFilter === "all" ? "" : "（分類：" + filterLabel(activeFilter) + "）");
    if (coreView) {
      var moreLi = document.createElement("li");
      moreLi.className = "gloss-more";
      var moreBtn = document.createElement("button");
      moreBtn.type = "button";
      moreBtn.className = "btn";
      moreBtn.textContent = "看全部 " + GLOSS.length + " 個術語 ↓";
      moreBtn.addEventListener("click", function () { showAllTerms = true; renderGloss(); });
      moreLi.appendChild(moreBtn);
      glossList.appendChild(moreLi);
    }
  }

  function filterLabel(f) {
    return { chain: "運輸鏈結構", data: "資料與計算", ghg: "排放與氣體", org: "14064 相關" }[f] || f;
  }

  function openDrawer(id) {
    var t = findTerm(id);
    if (!t) { return; }
    lastFocus = document.activeElement;
    drawer.hidden = false;
    document.body.style.overflow = "hidden";
    drawer.querySelector("#drawerTitle").textContent = t.zh + (t.abbr ? "（" + t.abbr + "）" : "");
    drawer.querySelector(".drawer-body").innerHTML =
      "<div><dt>正式名稱</dt><dd lang=\"en\">" + esc(t.en) + "</dd></div>" +
      "<div><dt>中文說明</dt><dd>" + esc(t.def) + "</dd></div>" +
      "<div><dt>白話解釋</dt><dd>" + esc(t.plain) + "</dd></div>" +
      "<div><dt>實際情境</dt><dd>" + esc(t.eg) + "</dd></div>";
    drawer.querySelector(".drawer-src").textContent = "定義依據：" + t.src;
    drawer.querySelector("#drawerClose").focus();
  }

  function closeDrawer() {
    drawer.hidden = true;
    document.body.style.overflow = "";
    if (lastFocus && lastFocus.focus) { lastFocus.focus(); }
  }

  // 簡易焦點循環：抽屜開啟時 Tab 不跑到背後的內容
  document.addEventListener("keydown", function (e) {
    if (drawer.hidden || e.key !== "Tab") { return; }
    var f = drawer.querySelectorAll("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])");
    if (!f.length) { return; }
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  document.addEventListener("click", function (e) {
    var t = e.target.closest ? e.target.closest("[data-term]") : null;
    if (t) { openDrawer(t.getAttribute("data-term")); return; }
    if (e.target === drawer || (e.target.closest && e.target.closest(".drawer-close"))) { closeDrawer(); }
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !drawer.hidden) { closeDrawer(); }
  });

  if (glossList) {
    document.querySelectorAll(".filters .chip").forEach(function (chip) {
      chip.addEventListener("click", function () {
        document.querySelectorAll(".filters .chip").forEach(function (c) { c.classList.remove("is-on"); });
        chip.classList.add("is-on");
        activeFilter = chip.getAttribute("data-filter");
        renderGloss();
      });
    });
    searchBox.addEventListener("input", renderGloss);
    renderGloss();
  }

  /* ---------------------------------------------------------
     3. 手風琴（步驟、測驗）
     --------------------------------------------------------- */
  function wireAccordion(rootSel, btnSel, panelClass) {
    var root = document.querySelector(rootSel);
    if (!root) { return; }
    root.querySelectorAll(btnSel).forEach(function (btn) {
      btn.addEventListener("click", function () {
        var open = btn.getAttribute("aria-expanded") === "true";
        var panel = btn.getAttribute("aria-controls")
          ? document.getElementById(btn.getAttribute("aria-controls"))
          : null;
        if (!panel) { panel = btn.nextElementSibling; }
        btn.setAttribute("aria-expanded", open ? "false" : "true");
        if (panel) { panel.classList.toggle("is-open", !open); }
      });
    });
  }
  wireAccordion("#invSteps", ".step-btn");
  wireAccordion("#quiz", ".quiz-btn");

  /* ---------------------------------------------------------
     3b. 測驗：把展開式問答升級成選擇題（無 JS 時保留原本的問答）
     --------------------------------------------------------- */
  var QUIZ = [
    { q: "ISO 14064-1 在處理什麼問題？",
      opts: ["一家公司（組織）整體排了多少溫室氣體", "一批貨的運輸鏈排了多少", "一個減碳專案到底少排了多少", "第三方怎麼檢查別人的排放報告"],
      a: 0, why: "14064-1 管的是「組織層級」：先畫一個圈把公司圈起來，再算圈裡圈外跟它有關的排放。減碳專案是 14064-2，查核是 14064-3。" },
    { q: "ISO 14083 又在處理什麼問題？",
      opts: ["一家公司全年總排放", "一條運輸鏈（貨運或客運）的排放怎麼量化與報告", "一個產品從搖籃到墳墓的碳足跡", "卡車工廠製造車輛時的排放"],
      a: 1, why: "14083 專門處理運輸鏈：拆成 TCE、每格收活動資料、算排放、再回報。產品碳足跡是 ISO 14067 的範圍。" },
    { q: "14064-1 和 14083 是什麼關係？",
      opts: ["14083 取代了 14064-1", "14064-1 取代了 14083", "互補：14064-1 說運輸要算，14083 說怎麼算，結果可以放回盤查", "兩者完全無關"],
      a: 2, why: "它們在不同層級工作。14083 算出的運輸數字，可以放回 14064-1 的盤查裡（運輸造成的間接排放，類別 3）。" },
    { q: "轉運站不產生任何「噸公里」，它的排放要算進運輸鏈嗎？",
      opts: ["不用，沒有距離就沒有排放", "要，轉運站本身也是一個 TCE，耗能就會排碳", "只有冷藏轉運站才要算", "算進公司盤查就好，不算運輸鏈"],
      a: 1, why: "轉運（hub operation）的照明、裝卸、冷暖都會耗能。案例 A 兩個轉運站共 21.4 kg CO₂e，約佔 7%，不大但不能漏。" },
    { q: "為什麼 100 km 的公路，排得比 500 km 的貨列還多？",
      opts: ["公路比較會塞車", "公路每噸公里的排放強度約是鐵路的 10 倍", "貨列完全不排放", "其實是計算錯誤"],
      a: 1, why: "公路 0.150、鐵路 0.014 kg CO₂e/tkm。1,000 tkm × 0.150 ＝ 150 kg，比 5,000 tkm 的貨列（約 70 kg）還多。距離短不代表排得少。" },
    { q: "如果只報告「車跑起來排了多少」，會發生什麼事？",
      opts: ["剛好就是 14083 要的總排放", "會少算燃料進油箱前的能源供應排放（案例 A 約 47%）", "會多算一倍", "差不到 1%，可以忽略"],
      a: 1, why: "14083 的總排放＝營運排放＋能源供應排放。柴油在開採、煉製、運輸的過程就已經排過一次碳。" }
  ];
  var quizRoot = document.getElementById("quiz");
  if (quizRoot) {
    var quizDone = 0, quizScore = 0;
    quizRoot.classList.add("quiz-mc");
    quizRoot.innerHTML = QUIZ.map(function (it, i) {
      return '<li class="mc" data-i="' + i + '"><p class="mc-q"><b>Q' + (i + 1) + '</b>' + esc(it.q) + '</p>' +
        '<div class="mc-opts" role="group" aria-label="第 ' + (i + 1) + ' 題選項">' +
        it.opts.map(function (o, k) {
          return '<button type="button" class="mc-opt" data-k="' + k + '"><span class="mc-key">' + "ABCD"[k] + '</span>' + esc(o) + '</button>';
        }).join("") + '</div><div class="mc-fb" aria-live="polite"></div></li>';
    }).join("") + '<li class="mc-score" id="mcScore" aria-live="polite"></li>';
    var scoreEl = document.getElementById("mcScore");
    function renderScore() {
      if (quizDone < QUIZ.length) {
        scoreEl.innerHTML = '<span class="mc-prog">已作答 ' + quizDone + ' / ' + QUIZ.length + ' 題</span>';
        return;
      }
      var msg = quizScore === QUIZ.length ? "全對！你已經可以跟別人解釋 14064-1 和 14083 的差別了。"
        : quizScore >= 4 ? "很不錯！答錯的題目可以回到對應展區再看一次。"
        : "沒關係，回到參觀路線再走一次，答案都在展區裡。";
      scoreEl.innerHTML = '<p class="mc-total"><b>' + quizScore + ' / ' + QUIZ.length + '</b> 題答對</p><p>' + msg +
        '</p><button type="button" class="btn" id="mcRetry">重新作答</button>';
      document.getElementById("mcRetry").addEventListener("click", function () {
        quizDone = 0; quizScore = 0;
        quizRoot.querySelectorAll(".mc").forEach(function (li) {
          li.classList.remove("is-right", "is-wrong");
          li.querySelector(".mc-fb").innerHTML = "";
          li.querySelectorAll(".mc-opt").forEach(function (b) { b.disabled = false; b.classList.remove("is-pick", "is-ans"); });
        });
        renderScore();
        quizRoot.querySelector(".mc-opt").focus();
      });
    }
    quizRoot.addEventListener("click", function (e) {
      var btn = e.target.closest ? e.target.closest(".mc-opt") : null;
      if (!btn || btn.disabled) { return; }
      var li = btn.closest(".mc");
      var it = QUIZ[+li.getAttribute("data-i")];
      var k = +btn.getAttribute("data-k");
      var ok = k === it.a;
      li.querySelectorAll(".mc-opt").forEach(function (b) {
        b.disabled = true;
        if (+b.getAttribute("data-k") === it.a) { b.classList.add("is-ans"); }
      });
      btn.classList.add("is-pick");
      li.classList.add(ok ? "is-right" : "is-wrong");
      li.querySelector(".mc-fb").innerHTML = '<p><strong>' + (ok ? "答對了！" : "差一點，正確答案是 " + "ABCD"[it.a] + "。") + '</strong>' + esc(it.why) + '</p>';
      quizDone++; if (ok) { quizScore++; }
      renderScore();
    });
    renderScore();
  }

  /* ---------------------------------------------------------
     4. 運輸鏈節點
     --------------------------------------------------------- */
  var CHAIN_INFO = {
    "1": {
      title: "TCE 1｜公路運輸（pre-carriage，前段接駁）",
      text: "這是<strong>運輸活動</strong>：貨物由同一輛卡車在一段路上移動。需要的活動資料是<strong>距離</strong>與<strong>貨物質量</strong>——這裡用最短可行距離（SFD）50 km、貨物 10 t，所以運輸活動量是 50 × 10 = 500 tkm。14083 把它單獨切出來，是因為這段可能由不同的運具、不同的業者執行，排放強度也不同。"
    },
    "2": {
      title: "TCE 2｜轉運 A（Hub operation）",
      text: "這是<strong>轉運活動</strong>：貨櫃在場站從卡車吊上火車。它的活動資料<strong>不含距離</strong>，只有處理量 10 t。重點：轉運站不產生噸公里，但它的耗能與排放<strong>仍然計入整條運輸鏈</strong>——這是很多人第一次算會漏掉的地方。"
    },
    "3": {
      title: "TCE 3｜鐵路運輸（line haul，主線）",
      text: "這是<strong>運輸活動</strong>，由電力貨列執行。距離 500 km、貨物 10 t → 5,000 tkm。注意：貨櫃本身的皮重 2.25 t 會影響能耗，但<strong>不算貨物質量</strong>。鐵路的排放強度比公路低一個數量級，這正是「同一批貨換運具，數字差很多」的原因。"
    },
    "4": {
      title: "TCE 4｜轉運 B（Hub operation）",
      text: "第二個<strong>轉運活動</strong>：貨櫃從火車吊回卡車。活動量同樣是 10 t。兩個轉運站加起來只有 21.4 kg CO₂e，佔整條鏈約 7%——不大，但不能省。"
    },
    "5": {
      title: "TCE 5｜公路運輸（on-carriage，後段配送）",
      text: "最後一段<strong>運輸活動</strong>：SFD 100 km × 10 t = 1,000 tkm。它只有 100 km，卻貢獻整條鏈最大的單一排放（150 kg CO₂e）。<strong>短不代表小</strong>，公路的排放強度比鐵路高很多。"
    }
  };
  var chainDetailText = document.getElementById("chainDetailText");
  var chain = document.getElementById("chain");
  if (chain) {
    chain.querySelectorAll(".node").forEach(function (node) {
      node.addEventListener("click", function () {
        chain.querySelectorAll(".node").forEach(function (n) {
          n.setAttribute("aria-pressed", "false");
        });
        node.setAttribute("aria-pressed", "true");
        var info = CHAIN_INFO[node.getAttribute("data-tce")];
        if (info && chainDetailText) {
          chainDetailText.innerHTML = "<strong>" + info.title + "</strong><br>" + info.text;
        }
      });
    });

    function syncLayer(inputId, cls) {
      var el = document.getElementById(inputId);
      if (!el) { return; }
      var apply = function () { chain.classList.toggle(cls, !el.checked); };
      el.addEventListener("change", apply);
      apply();
    }
    syncLayer("layerActivity", "hide-activity");
    syncLayer("layerFactor", "hide-factor");
    syncLayer("layerResult", "hide-result");
  }

  /* ---------------------------------------------------------
     5. 案例播放器
     --------------------------------------------------------- */
  var CASES = {
    a: {
      metaTitle: "案例 A 的背景（取自 CLECAT／Umweltbundesamt 指南的實際範例）",
      viz: {
        from: "工廠", to: "客戶",
        take: "鐵路扛了約 77% 的運輸活動量，排放卻只佔約 23%；最後那 100 km 公路，活動量只佔 15%，排放卻接近一半。",
        tces: [
          { n: "TCE 1", mode: "road", name: "公路前段", km: 50, tkm: 500, kg: 75.0 },
          { n: "TCE 2", mode: "hub", name: "轉運 A", km: 0, tkm: 0, kg: 10.7 },
          { n: "TCE 3", mode: "rail", name: "鐵路主線", km: 500, tkm: 5000, kg: 71.9 },
          { n: "TCE 4", mode: "hub", name: "轉運 B", km: 0, tkm: 0, kg: 10.7 },
          { n: "TCE 5", mode: "road", name: "公路後段", km: 100, tkm: 1000, kg: 150.0 }
        ]
      },
      facts: [
        ["貨物", "10 t（貨櫃內貨物；貨櫃皮重 2.25 t 不計入貨物質量）"],
        ["運送方式", "公路 → 轉運 → 鐵路 → 轉運 → 公路（複合運輸）"],
        ["距離", "SFD 50 km／500 km／100 km"],
        ["排放強度", "公路 0.150、鐵路 0.014 kg CO₂e/tkm；轉運 1.07 kg CO₂e/t"],
        ["總排放", "318.3 kg CO₂e"],
        ["運輸活動量", "6,500 tkm（只計三段運輸）"]
      ],
      source: "數值與計算取自《Greenhouse gas emissions in the transport sector — Guide to ISO 14083》（CLECAT 譯自 Umweltbundesamt）案例 A。該指南是說明標準用法的公開出版品；這些數字示範的是「那趟範例運輸」，不是你公司或你貨物的實際排放。",
      steps: [
        {
          h: "步驟 1｜界定運輸鏈",
          p: "先說清楚這條鏈的起點與終點：一批 10 噸的貨，用貨櫃從發貨地送到收貨地，中間走公路、轉複合運輸的鐵路、再走公路。14083 的計算單位是「運輸鏈」，所以第一步是把這條鏈的邊界畫出來。",
          extra: "<p class='hint'>同時要決定：距離用最短可行距離（SFD）還是大圓距離（GCD）。本例用 SFD，這是公路與鐵路貨運常見的做法。</p>"
        },
        {
          h: "步驟 2｜拆成五個 TCE",
          p: "鏈子切成五段，每一段是一個可以獨立算的單位。轉運站也是 TCE。",
          extra: "<table><thead><tr><th>TCE</th><th>內容</th><th>類型</th></tr></thead><tbody>" +
            "<tr><td>TCE 1</td><td>公路前段接駁</td><td>運輸活動</td></tr>" +
            "<tr><td>TCE 2</td><td>轉運站 A（卡車 → 火車）</td><td>轉運活動</td></tr>" +
            "<tr><td>TCE 3</td><td>鐵路主線</td><td>運輸活動</td></tr>" +
            "<tr><td>TCE 4</td><td>轉運站 B（火車 → 卡車）</td><td>轉運活動</td></tr>" +
            "<tr><td>TCE 5</td><td>公路後段配送</td><td>運輸活動</td></tr></tbody></table>"
        },
        {
          h: "步驟 3｜算出每個 TCE 的活動量",
          p: "運輸活動量 = 距離 × 貨物質量；轉運活動量 = 處理的質量（不含距離）。",
          extra: "<table><thead><tr><th>TCE</th><th>算法</th><th class='num'>活動量</th></tr></thead><tbody>" +
            "<tr><td>TCE 1</td><td>50 km × 10 t</td><td class='num'>500 tkm</td></tr>" +
            "<tr><td>TCE 2</td><td>10 t 經手</td><td class='num'>10 t</td></tr>" +
            "<tr><td>TCE 3</td><td>500 km × 10 t</td><td class='num'>5,000 tkm</td></tr>" +
            "<tr><td>TCE 4</td><td>10 t 經手</td><td class='num'>10 t</td></tr>" +
            "<tr><td>TCE 5</td><td>100 km × 10 t</td><td class='num'>1,000 tkm</td></tr></tbody></table>" +
            "<div class='formula'>運輸活動量（tkm）＝ 距離（km） × 貨物質量（t）</div>" +
            "<p class='hint'>若油耗是以實際行駛距離量得、而距離用 SFD，指南示範用 5% 的距離調整因數（500 → 525 tkm）。本展為簡化未納入。</p>"
        },
        {
          h: "步驟 4｜選排放強度，並說明資料等級",
          p: "排放強度乘上活動量就得到排放。強度來自「運輸作業類別（TOC）」或「轉運作業類別（HOC）」，而它可能來自一次資料（自己量）或二次資料（模型／預設值）。用二次資料必須在報告中揭露。",
          extra: "<table><thead><tr><th>類別</th><th class='num'>排放強度</th><th>資料等級（指南說明）</th></tr></thead><tbody>" +
            "<tr><td>公路（柴油連結卡車，複合運輸）</td><td class='num'>0.150 kg CO₂e/tkm</td><td>依車隊油耗等資料建立</td></tr>" +
            "<tr><td>鐵路（電力貨列）</td><td class='num'>0.014 kg CO₂e/tkm</td><td>向鐵路公司取得</td></tr>" +
            "<tr><td>轉運（貨櫃場）</td><td class='num'>1.07 kg CO₂e/t</td><td>場站耗能資料換算</td></tr></tbody></table>" +
            "<p class='hint'>這些值是該指南範例所用的數值，會因運具、載重率、能源組合而大幅變動，不能當成通用排放因子。</p>"
        },
        {
          h: "步驟 5｜逐段相乘",
          p: "每個 TCE 的排放 = 排放強度 × 活動量。",
          extra: "<table><thead><tr><th>TCE</th><th>算式</th><th class='num'>kg CO₂e</th></tr></thead><tbody>" +
            "<tr><td>TCE 1 公路</td><td>0.150 × 500</td><td class='num'>75.0</td></tr>" +
            "<tr><td>TCE 2 轉運 A</td><td>1.07 × 10</td><td class='num'>10.7</td></tr>" +
            "<tr><td>TCE 3 鐵路</td><td>來源回報值（0.014 × 5,000 會得 70.0，見下方說明）</td><td class='num'>71.9</td></tr>" +
            "<tr><td>TCE 4 轉運 B</td><td>1.07 × 10</td><td class='num'>10.7</td></tr>" +
            "<tr><td>TCE 5 公路</td><td>0.150 × 1,000</td><td class='num'>150.0</td></tr>" +
            "<tr class='total'><td>合計</td><td>五段相加</td><td class='num'>318.3</td></tr></tbody></table>" +
            "<div class='formula'>TCE 排放（kg CO₂e）＝ 排放強度（kg CO₂e/tkm 或 /t） × 活動量（tkm 或 t）</div>" +
            "<p class='hint'><strong>注意 TCE 3 這一行：</strong>用表上的 0.014 去乘 5,000，你會得到 <strong>70.0</strong>，不是 71.9。" +
            "這不是本展算錯，而是<strong>來源文件前後兩個章節不一致</strong>：指南在說明章節把鐵路強度寫成 14 g CO₂e/tkm 並算出 70.0 kg CO₂e；" +
            "但在報告章節與結果摘要表（Table 14）寫的是 0.014 × 5,000 = 71.9 kg CO₂e，總計 318.3 kg CO₂e（該表其他欄位相減也確實得 71.9）。" +
            "<strong>來源本身沒有解釋這個落差，我們也無法從公開資料證實原因是什麼。</strong>常見的推測是計算用了比顯示值更多位數的強度，" +
            "但這只是推測，本展不把它當成結論。" +
            "本展照實呈現來源最終回報的 71.9 與 318.3，同時把這個矛盾標出來。實務上這也提醒我們：同一份文件裡的數字也要能回溯、要能核對。</p>"
        },
        {
          h: "步驟 6｜加總，並換算回運輸鏈的排放強度",
          p: "整條鏈的排放就是五段之和。要比較不同運輸鏈的效率，再把總排放除以運輸活動量合計（轉運不計入分母，但轉運的排放仍在分子裡）。",
          extra: "<div class='formula'>總排放 = 75.0 + 10.7 + 71.9 + 10.7 + 150.0 = 318.3 kg CO₂e<br>" +
            "運輸活動量 = 500 + 5,000 + 1,000 = 6,500 tkm<br>" +
            "運輸鏈排放強度 = 318.3 ÷ 6,500 = 0.049 kg CO₂e/tkm</div>" +
            "<p><strong>怎麼解讀：</strong>0.049 kg CO₂e/tkm 代表這批貨平均每噸每公里排約 49 公克 CO₂e。它比純公路（0.150）低很多，因為主線改走鐵路；但它比純鐵路（0.014）高，因為前後兩段公路與兩個轉運站都算進來了。這就是 14083 要讓你看見的結構。</p>" +
            "<p class='hint'>若把鐵路段改用顯示精度算出的 70.0 kg CO₂e，總排放會是 316.4 kg CO₂e、鏈強度約 0.0487 kg CO₂e/tkm——差異不到 1%，不影響「鐵路主線比全程公路乾淨得多」這個結論。</p>"
        }
      ]
    },
    b: {
      metaTitle: "案例 B 的背景（教學假設，非真實排放數據）",
      viz: {
        from: "台中工廠", to: "台北客戶",
        take: "全程公路，所以活動量占比和排放占比幾乎一樣；唯一多出來的，是轉運站那約 5% 的排放——它不產生任何噸公里。",
        tces: [
          { n: "TCE 1", mode: "road", name: "台中 → 桃園", km: 90, tkm: 90, kg: 13.50 },
          { n: "TCE 2", mode: "hub", name: "桃園轉運站", km: 0, tkm: 0, kg: 1.07 },
          { n: "TCE 3", mode: "road", name: "桃園 → 台北", km: 40, tkm: 40, kg: 6.00 }
        ]
      },
      facts: [
        ["貨物", "1,000 kg（1 t）"],
        ["路線", "台中工廠 → 桃園轉運站 → 台北客戶（全程公路）"],
        ["距離", "假設 90 km／40 km"],
        ["排放強度", "沿用案例 A 的示意值：公路 0.150 kg CO₂e/tkm、轉運 1.07 kg CO₂e/t"],
        ["總排放", "20.57 kg CO₂e（依上述假設算出）"],
        ["運輸活動量", "130 tkm"]
      ],
      source: "⚠ 本案例的距離與質量是「教學假設」，排放強度沿用案例 A 的示意值，只用於示範流程。這些不是真實排放因子，也不是依 ISO 14083 完成的正式計算。",
      steps: [
        {
          h: "步驟 1｜界定運輸鏈",
          p: "一批 1,000 kg 的貨從台中工廠送到台北客戶，中途在桃園物流中心轉運。先決定邊界：起點是工廠月台，終點是客戶收貨月台，轉運站算在鏈內。",
          extra: "<p class='hint'>邊界怎麼定，直接影響數字。同一批貨，如果轉運站不算在鏈內，你就會漏掉它的排放。</p>"
        },
        {
          h: "步驟 2｜拆成三個 TCE",
          p: "兩段公路加一個轉運節點。",
          extra: "<table><thead><tr><th>TCE</th><th>內容</th><th>類型</th></tr></thead><tbody>" +
            "<tr><td>TCE 1</td><td>台中 → 桃園（公路）</td><td>運輸活動</td></tr>" +
            "<tr><td>TCE 2</td><td>桃園轉運站分撥</td><td>轉運活動</td></tr>" +
            "<tr><td>TCE 3</td><td>桃園 → 台北（公路）</td><td>運輸活動</td></tr></tbody></table>"
        },
        {
          h: "步驟 3｜算活動量",
          p: "把假設的距離與質量乘起來。",
          extra: "<table><thead><tr><th>TCE</th><th>算法（假設值）</th><th class='num'>活動量</th></tr></thead><tbody>" +
            "<tr><td>TCE 1</td><td>90 km × 1 t</td><td class='num'>90 tkm</td></tr>" +
            "<tr><td>TCE 2</td><td>1 t 經手</td><td class='num'>1 t</td></tr>" +
            "<tr><td>TCE 3</td><td>40 km × 1 t</td><td class='num'>40 tkm</td></tr></tbody></table>" +
            "<p class='hint'>真實案例這裡會用一次資料（實際行駛距離、實際貨重）或標明來源的二次資料，而不是假設值。</p>"
        },
        {
          h: "步驟 4｜選排放強度",
          p: "這裡沿用案例 A 的公路與轉運示意值，為了讓兩個案例可以對照。實務上必須依運具、載重率、能源組合選取有來源依據的強度。",
          extra: "<table><thead><tr><th>類別</th><th class='num'>排放強度（示意）</th></tr></thead><tbody>" +
            "<tr><td>公路</td><td class='num'>0.150 kg CO₂e/tkm</td></tr>" +
            "<tr><td>轉運</td><td class='num'>1.07 kg CO₂e/t</td></tr></tbody></table>" +
            "<p class='hint'>注意：0.150 是案例 A 中「複合運輸的柴油連結卡車」的數值，直接套到任何卡車都不嚴謹。本展明確標示為示意值。</p>"
        },
        {
          h: "步驟 5｜逐段相乘",
          p: "同樣的公式，換成案例 B 的數字。",
          extra: "<table><thead><tr><th>TCE</th><th>算式</th><th class='num'>kg CO₂e</th></tr></thead><tbody>" +
            "<tr><td>TCE 1</td><td>0.150 × 90</td><td class='num'>13.50</td></tr>" +
            "<tr><td>TCE 2</td><td>1.07 × 1</td><td class='num'>1.07</td></tr>" +
            "<tr><td>TCE 3</td><td>0.150 × 40</td><td class='num'>6.00</td></tr>" +
            "<tr class='total'><td>合計</td><td>三段相加</td><td class='num'>20.57</td></tr></tbody></table>"
        },
        {
          h: "步驟 6｜加總與解讀",
          p: "把三段加起來，再除以運輸活動量，得到這條鏈的排放強度。",
          extra: "<div class='formula'>總排放 = 13.50 + 1.07 + 6.00 = 20.57 kg CO₂e<br>" +
            "運輸活動量 = 90 + 40 = 130 tkm<br>" +
            "運輸鏈排放強度 = 20.57 ÷ 130 = 0.158 kg CO₂e/tkm</div>" +
            "<p><strong>怎麼解讀：</strong>0.158 比案例 A 的 0.049 高很多，因為全程公路、沒有改走鐵路。轉運站只佔 1.07 kg（約 5%），但依然要算。把兩個案例放在一起看，你就會明白 14083 的價值不在「算出一個數」，而在<strong>讓你能看見數字從哪裡來、改哪個環節會變</strong>。</p>"
        }
      ]
    }
  };

  var curCase = "a";
  var curStep = 0;
  var panel = document.getElementById("playerPanel");
  var tabsWrap = document.querySelector(".player-tabs");

  function renderCaseMeta() {
    var c = CASES[curCase];
    document.getElementById("caseMetaTitle").textContent = c.metaTitle;
    document.getElementById("caseFacts").innerHTML = c.facts.map(function (f) {
      return "<div><dt>" + esc(f[0]) + "</dt><dd>" + esc(f[1]) + "</dd></div>";
    }).join("");
    document.getElementById("caseSource").textContent = c.source;
    renderCaseViz();
  }

  function renderCaseViz() {
    var box = document.getElementById("caseViz");
    var v = CASES[curCase].viz;
    if (!box || !v) { return; }
    var sumKm = 0, sumTkm = 0, sumKg = 0;
    v.tces.forEach(function (t) { sumKm += t.km; sumTkm += t.tkm; sumKg += t.kg; });
    function pct(x, tot) { return tot ? (x / tot * 100) : 0; }
    var route = v.tces.map(function (t) {
      if (t.mode === "hub") {
        return '<span class="rb-hub" title="' + esc(t.n + "｜" + t.name + "（轉運，不產生距離）") + '"></span>';
      }
      return '<span class="rb-seg vz-' + t.mode + '" style="flex:' + t.km + ' 1 0" title="' +
        esc(t.n + "｜" + t.name + "：" + t.km + " km") + '"></span>';
    }).join("");
    function bar(key, tot, unit) {
      return v.tces.filter(function (t) { return t[key] > 0; }).map(function (t) {
        var p = pct(t[key], tot);
        return '<span class="sb-seg vz-' + t.mode + '" style="width:' + p.toFixed(2) + '%" title="' +
          esc(t.n + "｜" + t.name + "：" + t[key].toLocaleString() + " " + unit + "（" + p.toFixed(1) + "%）") + '"></span>';
      }).join("");
    }
    var rows = v.tces.map(function (t) {
      return "<tr><td><i class='viz-sw vz-" + t.mode + "'></i>" + esc(t.n + " " + t.name) + "</td>" +
        "<td class='num'>" + (t.km ? t.km + " km" : "—") + "</td>" +
        "<td class='num'>" + (t.tkm ? pct(t.tkm, sumTkm).toFixed(1) + "%" : "0%") + "</td>" +
        "<td class='num'>" + pct(t.kg, sumKg).toFixed(1) + "%</td></tr>";
    }).join("");
    box.innerHTML =
      '<p class="viz-title">路線示意（長度依距離比例，共 ' + sumKm + ' km；斜線方塊＝轉運站）</p>' +
      '<div class="route-bar" role="img" aria-label="路線示意，詳見下方表格">' + route + '</div>' +
      '<div class="route-ends"><span>' + esc(v.from) + '</span><span>' + esc(v.to) + '</span></div>' +
      '<p class="viz-title">同一條鏈：活動量占比 vs 排放占比</p>' +
      '<div class="share-row"><span class="share-label">運輸活動量（tkm）</span><div class="share-bar" role="img" aria-label="運輸活動量占比，詳見下方表格">' + bar("tkm", sumTkm, "tkm") + '</div></div>' +
      '<div class="share-row"><span class="share-label">排放（kg CO₂e）</span><div class="share-bar" role="img" aria-label="排放占比，詳見下方表格">' + bar("kg", sumKg, "kg CO₂e") + '</div></div>' +
      '<table class="viz-table"><thead><tr><th>TCE</th><th class="num">距離</th><th class="num">活動量占比</th><th class="num">排放占比</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<p class="viz-take"><strong>看出什麼：</strong>' + esc(v.take) + '</p>';
  }

  function renderStep() {
    var c = CASES[curCase];
    var s = c.steps[curStep];
    panel.innerHTML = "<h4>" + esc(s.h) + "</h4><p>" + s.p + "</p>" + (s.extra || ""); // s.p 為站內寫死內容，允許 <strong>
    Array.prototype.forEach.call(tabsWrap.children, function (li, i) {
      li.setAttribute("aria-selected", i === curStep ? "true" : "false");
      li.setAttribute("tabindex", i === curStep ? "0" : "-1");
      if (i === curStep && li.id) panel.setAttribute("aria-labelledby", li.id);
    });
    document.getElementById("prevStep").disabled = curStep === 0;
    document.getElementById("nextStep").disabled = curStep === c.steps.length - 1;
  }

  if (panel) {
    renderCaseMeta();
    renderStep();

    document.querySelectorAll(".case-tab").forEach(function (tab) {
      tab.addEventListener("click", function () {
        document.querySelectorAll(".case-tab").forEach(function (t) {
          t.classList.remove("is-on"); t.setAttribute("aria-pressed", "false");
        });
        tab.classList.add("is-on"); tab.setAttribute("aria-pressed", "true");
        curCase = tab.getAttribute("data-case");
        curStep = 0;
        renderCaseMeta(); renderStep();
      });
    });

    tabsWrap.addEventListener("click", function (e) {
      var li = e.target.closest("li[data-step]");
      if (!li) { return; }
      curStep = parseInt(li.getAttribute("data-step"), 10);
      renderStep();
    });
    tabsWrap.addEventListener("keydown", function (e) {
      var li = e.target.closest("li[data-step]");
      if (!li) { return; }
      var i = parseInt(li.getAttribute("data-step"), 10);
      if (e.key === "ArrowRight" && i < CASES[curCase].steps.length - 1) { curStep = i + 1; renderStep(); tabsWrap.children[curStep].focus(); }
      if (e.key === "ArrowLeft" && i > 0) { curStep = i - 1; renderStep(); tabsWrap.children[curStep].focus(); }
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); curStep = i; renderStep(); }
    });
    document.getElementById("prevStep").addEventListener("click", function () {
      if (curStep > 0) { curStep--; renderStep(); }
    });
    document.getElementById("nextStep").addEventListener("click", function () {
      if (curStep < CASES[curCase].steps.length - 1) { curStep++; renderStep(); }
    });
  }

  /* ---------------------------------------------------------
     6. Allocation 互動
     --------------------------------------------------------- */
  var TRIP = 120; // 教學假設：這趟車總共排 120 kg CO₂e
  var allocKey = "mass";
  var allocOut = document.getElementById("allocOut");

  function renderAlloc() {
    if (!allocOut) { return; }
    var mA = +document.getElementById("mA").value;
    var mB = +document.getElementById("mB").value;
    var mC = +document.getElementById("mC").value;
    document.getElementById("oA").textContent = mA;
    document.getElementById("oB").textContent = mB;
    document.getElementById("oC").textContent = mC;
    var total = mA + mB + mC;
    var items = [
      { name: "貨件 A", m: mA },
      { name: "貨件 B", m: mB },
      { name: "貨件 C", m: mC }
    ];
    items.forEach(function (it) {
      it.share = allocKey === "mass" ? it.m / total : 1 / 3;
      it.kg = TRIP * it.share;
    });

    // 視覺化：方塊面積與質量成正比，色帶高度＝分配比例
    var vis = document.getElementById("allocVis");
    if (vis) {
      var maxM = Math.max(mA, mB, mC, 1);
      var MAX_SIDE = 104; // 最重那批貨的邊長（px）
      vis.innerHTML = items.map(function (it, i) {
        // 面積要與質量成正比，邊長必須取 sqrt(m/maxM)，且不能加任何基準偏移，
        // 否則面積比例會被壓縮、變成不嚴格的示意。
        var side = MAX_SIDE * Math.sqrt(it.m / maxM);
        var band = (it.share * 100).toFixed(1);
        var areaPct = (it.m / maxM * 100).toFixed(0);
        return '<div class="av-item av-' + "abc".charAt(i) + '" style="--side:' + side.toFixed(1) + 'px">' +
          '<span class="av-box" aria-hidden="true"><i style="height:' + band + '%"></i></span>' +
          '<span class="av-cap"><b>' + it.name + "</b>" + it.m + " t・面積 " + areaPct + "%・分到 " + it.kg.toFixed(1) + " kg</span></div>";
      }).join("") +
        '<p class="av-note">方塊的<strong>面積</strong>與質量成正比：最重的那批面積設為基準 100%，' +
        "其餘依「質量 ÷ 最重質量」的面積比例縮小（所以邊長取平方根比例）。" +
        "方塊內色帶的高度＝這批貨<strong>分到的排放比例</strong>，與方塊大小是兩件事。" +
        "這是示意圖，不是貨物的實際尺寸。</p>";
    }

    allocOut.innerHTML = items.map(function (it, i) {
      // 柱長 = 真正的百分比（0～100%），不是相對最大值，避免最長柱被誤讀成 100%
      var pct = it.share * 100;
      return '<div class="bar' + (i % 2 ? " alt" : "") + '">' +
        '<span class="bar-name">' + it.name + "（" + it.m + " t）</span>" +
        '<span class="bar-track"><span class="bar-fill" style="width:' + pct.toFixed(1) + '%"></span></span>' +
        '<span class="bar-val">' + pct.toFixed(1) + "% · " + it.kg.toFixed(1) + " kg</span></div>";
    }).join("") +
      '<div class="bar" aria-hidden="true"><span></span><span class="bar-axis"><i>0%</i><i>25%</i><i>50%</i><i>75%</i><i>100%</i></span><span></span></div>';
    document.getElementById("allocNote").textContent = allocKey === "mass"
      ? "依質量分配：整趟 " + TRIP + " kg CO₂e（教學假設）按各貨件質量比例分給三批貨。" +
        "依指南對 14083 的說明，當一個程序同時服務多個對象時，分配要以實際質量為基礎；" +
        "指南也提到可以採用標準附錄提供的換算值（例如旅客當量），偏離時需說明理由。" +
        "此處示範的是最常見的「按質量」情境，不代表所有情況都只用質量一個基準。"
      : "平均分配（對照用）：三批貨各得 " + (TRIP / 3).toFixed(1) + " kg CO₂e。當三批貨質量差很多時，這樣會嚴重高估輕的貨件、低估重的貨件，所以指南說明 14083 不採這種分法。";
  }
  if (allocOut) {
    ["mA", "mB", "mC"].forEach(function (id) {
      document.getElementById(id).addEventListener("input", renderAlloc);
    });
    document.querySelectorAll(".seg-btn").forEach(function (b) {
      b.addEventListener("click", function () {
        document.querySelectorAll(".seg-btn").forEach(function (x) {
          x.classList.remove("is-on"); x.setAttribute("aria-pressed", "false");
        });
        b.classList.add("is-on"); b.setAttribute("aria-pressed", "true");
        allocKey = b.getAttribute("data-key");
        renderAlloc();
      });
    });
    renderAlloc();
  }

  /* ---------------------------------------------------------
     7. 視覺互動：進場、視差、貨物行進、場景高亮、運具沙盒
     全部只用 transform／opacity，並尊重 prefers-reduced-motion。
     --------------------------------------------------------- */
  var motionQuery = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  function reduced() { return !!(motionQuery && motionQuery.matches); }

  /* --- 7a. 捲動進場：由 JS 加上 class，無 JS 時內容本來就全部可見。
         刻意不用 IntersectionObserver：觀察器若未觸發會讓內容永遠停在 opacity:0，
         改用 scroll + getBoundingClientRect，失敗模式最壞也只是「沒有動畫」。--- */
  var revealSel = ".exhibit .body > p, .exhibit .body > h3, .exhibit .body > ul, .exhibit .body > ol, " +
    ".exhibit .body > div, .exhibit .body > figure, .diorama, .hook, .em-scene, .chain-run, .splitbar, .sandbox, .fam, .zoommap";
  var revealEls = Array.prototype.slice.call(document.querySelectorAll(revealSel));
  var pending = [];
  if (!reduced()) {
    revealEls.forEach(function (el) { el.classList.add("reveal"); pending.push(el); });
  }
  function sweepReveal() {
    if (!pending.length) { return; }
    var vh = window.innerHeight || document.documentElement.clientHeight;
    var still = [];
    for (var i = 0; i < pending.length; i++) {
      var el = pending[i];
      var r = el.getBoundingClientRect();
      if (r.top >= vh * 0.94) { still.push(el); }   // 還在下方，等捲動到再揭露
      else { el.classList.add("is-in"); }           // 已在視窗內或已捲過（例如直接跳錨點）
    }
    pending = still;
  }
  sweepReveal();

  /* 橫向插畫若超出可視寬度，加上提示（需要滑動才看得到全圖） */
  var svgPans = Array.prototype.slice.call(document.querySelectorAll(".svg-pan"));
  function markPannable() {
    svgPans.forEach(function (p) {
      var pan = p.scrollWidth > p.clientWidth + 8;
      p.classList.toggle("is-pannable", pan);
      // 可滑動的容器必須也能用鍵盤方向鍵操作（WCAG 2.1.1）
      if (pan) {
        p.setAttribute("tabindex", "0");
        p.setAttribute("role", "group");
        if (!p.getAttribute("aria-label")) { p.setAttribute("aria-label", "可左右滑動的插畫，用方向鍵查看完整內容"); }
      } else {
        p.removeAttribute("tabindex");
        p.removeAttribute("role");
        p.removeAttribute("aria-label");
      }
    });
  }
  markPannable();
  document.querySelectorAll("details.more").forEach(function (d) {
    d.addEventListener("toggle", function () { markPannable(); sweepReveal(); });
  });

  /* --- 7b. 場景視差（入口與展區 04 的剖面共用同一套深度語言） --- */
  var parallaxTargets = [];
  [["diorama", 46], ["chainRun", 30]].forEach(function (pair) {
    var fig = document.getElementById(pair[0]);
    if (!fig) { return; }
    parallaxTargets.push({
      fig: fig,
      amp: pair[1],
      layers: Array.prototype.slice.call(fig.querySelectorAll(".layer"))
    });
  });
  var parallaxQueued = false;
  function applyParallax() {
    parallaxQueued = false;
    if (reduced()) { return; }
    var vh = window.innerHeight || 0;
    for (var n = 0; n < parallaxTargets.length; n++) {
      var t = parallaxTargets[n];
      if (!t.layers.length) { continue; }
      var r = t.fig.getBoundingClientRect();
      if (r.bottom < -80 || r.top > vh + 80) { continue; }
      // 以場景中心相對視窗中心的位移作為驅動量，範圍約 ±1
      var drive = (vh / 2 - (r.top + r.height / 2)) / Math.max(vh || 1, 1);
      drive = Math.max(-1.2, Math.min(1.2, drive));
      t.layers.forEach(function (g) {
        var d = parseFloat(g.getAttribute("data-depth")) || 0;
        g.setAttribute("transform", "translate(0," + (drive * d * t.amp).toFixed(2) + ")");
      });
    }
  }

  /* --- 7c. 通用「貨物沿軌道行進」播放器 --- */
  function makeRunner(cfg) {
    var marker = document.getElementById(cfg.markerId);
    var playBtn = document.getElementById(cfg.playId);
    var resetBtn = document.getElementById(cfg.resetId);
    var readEl = document.getElementById(cfg.readId);
    var totalEl = document.getElementById(cfg.totalId);
    var dataEl = cfg.dataId ? document.getElementById(cfg.dataId) : null;
    var tkmEl = cfg.tkmId ? document.getElementById(cfg.tkmId) : null;
    if (!marker || !playBtn) { return null; }

    var raf = 0, i = 0, running = false, scrubIdx = -1, scrubState = "idle", curBeat = 0;
    var fx = cfg.fx && cfg.fx.init ? cfg.fx.init(marker) : null;
    var durs = [], totalDur = 0;
    cfg.stops.forEach(function (st) { durs.push(st.dur); totalDur += st.dur; });

    function paint(idx, partial) {
      var st = cfg.stops[idx];
      var x = st.x0 + (st.x1 - st.x0) * partial;
      marker.setAttribute("transform", "translate(" + x.toFixed(1) + "," + st.y + ")");
      cfg.onStop && cfg.onStop(st);
      var acc = 0, tacc = 0;
      for (var k = 0; k < idx; k++) { acc += cfg.stops[k].kg; tacc += cfg.stops[k].tkm || 0; }
      acc += st.kg * partial;
      tacc += (st.tkm || 0) * partial;
      totalEl.textContent = acc.toFixed(1);
      if (tkmEl) { tkmEl.textContent = Math.round(tacc).toLocaleString("en-US"); }
      curBeat = idx + partial;   // 目前節拍位置（時間播放與捲動擦洗都經過這裡）
      // 每條長條的比例一次算給 fx：往前捲、往回捲結果都一樣，不會殘留
      var ratios = [];
      for (var m = 0; m < cfg.stops.length; m++) {
        ratios[cfg.stops[m].seg] = m < idx ? 1 : (m === idx ? partial : 0);
      }
      if (fx && fx.frame) { fx.frame(st, x, partial, acc, tacc, ratios, idx); }
    }

    function step(idx) {
      var st = cfg.stops[idx];
      readEl.textContent = st.read;
      if (dataEl) { dataEl.textContent = st.data; }
      cfg.highlight && cfg.highlight(st.seg);
      if (fx && fx.enter) { fx.enter(st); }
      var t0 = 0;
      function frame(ts) {
        if (!running) { return; }
        if (!t0) { t0 = ts; }
        var p = Math.min(1, (ts - t0) / st.dur);
        paint(idx, p);
        if (p < 1) { raf = requestAnimationFrame(frame); }
        else {
          i++;
          if (i < cfg.stops.length) { step(i); }
          else { finish(); }
        }
      }
      raf = requestAnimationFrame(frame);
    }

    function finish() {
      running = false;
      scrubState = "idle";   // 播完後把時間軸交還給捲動，兩者不會互相搶
      playBtn.disabled = false;
      resetBtn && (resetBtn.disabled = false);
      readEl.textContent = cfg.doneRead;
      if (dataEl) { dataEl.textContent = cfg.doneData; }
      totalEl.textContent = cfg.total.toFixed(1);
      if (tkmEl) { tkmEl.textContent = (cfg.tkmTotal || 0).toLocaleString("en-US"); }
      if (fx && fx.finish) { fx.finish(); }
      cfg.highlight && cfg.highlight("done");
    }

    function start() {
      if (reduced()) {
        // 不動畫：直接把所有段落與數字呈現出來，理解不依賴動畫
        cfg.highlight && cfg.highlight("done");
        totalEl.textContent = cfg.total.toFixed(1);
        if (tkmEl) { tkmEl.textContent = (cfg.tkmTotal || 0).toLocaleString("en-US"); }
        if (fx && fx.settle) { fx.settle(); }
        readEl.textContent = cfg.doneRead;
        if (dataEl) { dataEl.textContent = cfg.doneData; }
        playBtn.disabled = true;
        resetBtn && (resetBtn.disabled = false);
        return;
      }
      i = 0; running = true;
      scrubState = "manual";   // 使用者自己按播放後，捲動不再搶走時間軸
      if (fx && fx.clear) { fx.clear(); }
      playBtn.disabled = true;
      resetBtn && (resetBtn.disabled = true);
      step(0);
    }

    function reset() {
      running = false;
      scrubIdx = -1;
      scrubState = "idle";
      cancelAnimationFrame(raf);
      i = 0;
      if (fx && fx.clear) { fx.clear(); }
      paint(0, 0);
      totalEl.textContent = "0.0";
      if (tkmEl) { tkmEl.textContent = "0"; }
      readEl.textContent = cfg.idleRead;
      if (dataEl) { dataEl.textContent = cfg.idleData; }
      cfg.highlight && cfg.highlight(null);
      playBtn.disabled = false;
      resetBtn && (resetBtn.disabled = true);
    }

    function setDone() {
      scrubIdx = -1;
      scrubState = "done";
      curBeat = cfg.stops.length;
      if (fx && fx.clear) { fx.clear(); }
      if (fx && fx.settle) { fx.settle(); }
      cfg.highlight && cfg.highlight("done");
      totalEl.textContent = cfg.total.toFixed(1);
      if (tkmEl) { tkmEl.textContent = (cfg.tkmTotal || 0).toLocaleString("en-US"); }
      readEl.textContent = cfg.doneRead;
      if (dataEl) { dataEl.textContent = cfg.doneData; }
      playBtn.disabled = false;
      resetBtn && (resetBtn.disabled = false);
    }

    /* 捲動擦洗：p 是「節拍位置」（0..段數），整數就是第幾段、小數是該段走到幾％。
       每一段佔用等量的捲動距離，所以「正在讀的卡片」與「正在演的段落」永遠對齊。
       數值仍由 partial 直接驅動，所以不會跑偏。 */
    function seekBeat(p) {
      if (running) { return; }
      var n = cfg.stops.length;
      if (p <= 0) {
        // 捲回頂端：顯示完整結果（不捲動也能讀到全部資料）
        if (scrubState !== "idle") { restore(); }
        return;
      }
      if (p >= n) {
        if (scrubState !== "done") { setDone(); }
        return;
      }
      var idx = Math.floor(p);
      var partial = Math.max(0, Math.min(1, p - idx));
      if (idx !== scrubIdx) {
        scrubIdx = idx;
        if (fx && fx.clearParticles) { fx.clearParticles(); }
        stepEnter(idx);
      }
      scrubState = "live";
      paint(idx, partial);
    }

    function stepEnter(idx) {
      var st = cfg.stops[idx];
      readEl.textContent = st.read;
      if (dataEl) { dataEl.textContent = st.data; }
      cfg.highlight && cfg.highlight(st.seg);
      if (fx && fx.enter) { fx.enter(st); }
    }

    /* 回到「完整結果」的靜止狀態：載入時與捲回頂端時都用它，
       所以不捲動也能看到全部資料（理解不依賴動畫）。 */
    function restore() {
      running = false;
      scrubIdx = -1;
      scrubState = "idle";
      curBeat = 0;
      if (fx && fx.clear) { fx.clear(); }
      if (fx && fx.settle) { fx.settle(); }
      cfg.highlight && cfg.highlight("done");
      totalEl.textContent = cfg.total.toFixed(1);
      if (tkmEl) { tkmEl.textContent = (cfg.tkmTotal || 0).toLocaleString("en-US"); }
      readEl.textContent = cfg.idleRead;
      if (dataEl) { dataEl.textContent = cfg.idleData; }
      playBtn.disabled = false;
      resetBtn && (resetBtn.disabled = true);
    }

    playBtn.addEventListener("click", start);
    if (resetBtn) { resetBtn.addEventListener("click", reset); }
    // 載入時先把長條與數值填到定位：資料先可見，捲動或按「走一趟」才重新累積
    if (cfg.settleOnInit) { restore(); } else { reset(); }
    return {
      reset: reset, start: start, seekBeat: seekBeat, restore: restore,
      state: function () { return scrubState; },
      beat: function () { return curBeat; },
      beats: cfg.stops.length,
      totalDur: totalDur, durs: durs
    };
  }

  /* --- 7d-1. 運鏡相機 ---
     場景原本是靜態剖面圖，這裡加上一層「鏡頭」，三段運鏡：
     1. 開場＝全局視野：整條運輸鏈與五根長條一次看進來（導覽圖）。
     2. 推近後跟著貨櫃走：貨櫃在畫面上幾乎停在同一處，
        路段、長條、城市、風機從它身後划過 —— 這就是跟拍鏡頭。
     3. 最後一段拉回全局，五根長條重新排在一起，可以比較高低。

     實作：在每個視差層「內側」包一個相機群組（外側 .layer 的 transform
     由捲動視差使用，兩層不能互相覆蓋）。三層共用同一個縮放，但平移量
     依各層的 data-cam 係數衰減：遠景只走 45%、中景 78%、近景 100%，
     這個差異就是景深，也是「背景相對移動」的來源。

     相機只由「實際播放進度」驅動：捲動擦洗與按「走一趟」都會經過
     makeHeroFx 的 frame()，所以兩種模式下的運鏡路徑完全一致；
     而且它是 (段, 進度, 貨櫃位置) 的純函數，往回捲也不會跑偏。 */
  function easeInOut(t) { return t * t * (3 - 2 * t); }
  function clamp01(t) { return t < 0 ? 0 : (t > 1 ? 1 : t); }

  /* 建立一台相機：cfg = { ax, ay, fy, zoom, padIn, padOut, sway, beats, vigId, vigMax }
     ax／ay 是焦點在「畫面（使用者空間）」上的位置，fy 是跟拍時要對準的場景高度。 */
  function makeCamera(svg, cfg) {
    var layers = [];
    if (svg) {
      var NS = "http://www.w3.org/2000/svg";
      var gs = svg.querySelectorAll("g.layer");
      for (var i = 0; i < gs.length; i++) {
        var g = document.createElementNS(NS, "g");
        g.setAttribute("class", "cam");
        while (gs[i].firstChild) { g.appendChild(gs[i].firstChild); }
        gs[i].appendChild(g);
        layers.push({ g: g, c: parseFloat(gs[i].getAttribute("data-cam")) || 1 });
      }
    }
    var vig = cfg.vigId ? document.getElementById(cfg.vigId) : null;
    var on = !reduced();   // 減少動態效果時完全不運鏡，恆為全局視野
    if (vig && !on) { vig.setAttribute("opacity", "0"); }
    var beats = cfg.beats || 5;

    function apply(s, f) {
      var u = (s - 1) / (cfg.zoom - 1);   // 推近程度 0..1（s=1 時為 0）
      for (var i = 0; i < layers.length; i++) {
        var L = layers[i];
        var sl = 1 + (s - 1) * L.c;
        var tx = (1 - sl) * cfg.ax - sl * L.c * (f - cfg.ax);
        var ty = (1 - sl) * cfg.ay - sl * (cfg.fy - cfg.ay) * u * L.c;
        L.g.setAttribute("transform",
          "translate(" + tx.toFixed(2) + " " + ty.toFixed(2) + ") scale(" + sl.toFixed(4) + ")");
      }
      if (vig) {
        vig.setAttribute("opacity", Math.max(0, Math.min(0.8, (s - 1) * (cfg.vigMax || 0))).toFixed(3));
      }
    }

    return {
      on: on,
      reset: function () { if (on && layers.length) { apply(1, cfg.ax); } },
      /* idx = 第幾段，x = 貨櫃目前位置，partial = 該段完成比例。
         焦點 f 以 x 為主，跨段時不會跳（每段的 x1 就是下一段的 x0）；
         再加一點擺動，鏡頭不會鎖得像釘書機一樣死。 */
      frame: function (idx, x, partial) {
        if (!on || !layers.length) { return; }
        var sway = (cfg.sway || 0) * Math.sin((idx + partial) * (Math.PI * 2 / beats));
        var s, f;
        if (idx === 0) {
          /* 第一段：從全局慢慢推近，焦點從畫面中心移到貨櫃 */
          var k = easeInOut(clamp01(partial / cfg.padIn));
          s = 1 + (cfg.zoom - 1) * k;
          f = cfg.ax + (x + sway - cfg.ax) * k;
        } else if (idx < beats - 1) {
          s = cfg.zoom;
          f = x + sway;
        } else {
          /* 最後一段：先跟拍，尾端 ease 拉回全局 */
          var q = 1 - cfg.padOut;
          if (partial < q) {
            s = cfg.zoom;
            f = x + sway;
          } else {
            var k2 = easeInOut(clamp01((partial - q) / cfg.padOut));
            s = cfg.zoom + (1 - cfg.zoom) * k2;
            f = (x + sway) * (1 - k2) + cfg.ax * k2;
          }
        }
        apply(s, f);
      }
    };
  }

  /* --- 7d-2. 排放粒子與場景動畫 --- */
  /* 排放粒子系統：排放從運具產生、沿弧線落進下方長條並累積成高度。
     粒子只是視覺強化，數值一律由 partial 直接驅動，所以數字永遠正確。
     同一套特效也給展區 04 的場景用，所以場景 id 與相機參數由 cfg 傳入。 */
  function makeSceneFx(marker, cfg) {
    var fig = document.getElementById(cfg.figId);
    var puffs = document.getElementById(cfg.puffsId);
    if (!fig || !puffs) { return null; }
    var cam = cfg.cam ? makeCamera(fig.querySelector("svg"), cfg.cam) : null;
    var NS = "http://www.w3.org/2000/svg";
    var TINT = {
      "#C89B57": "#F3CE86", "#4FA3A8": "#86DBDF", "#B07CD1": "#E0AEF5",
      // 展區 04 的長條用 CSS 變數，粒子要提亮才能對上深色場景
      "var(--road)": "#F3CE86", "var(--rail)": "#86DBDF", "var(--hub)": "#E0AEF5"
    };
    var veh = {
      road: fig.querySelector(".veh-road"),
      rail: fig.querySelector(".veh-rail"),
      hub: fig.querySelector(".veh-hub")
    };
    var bars = {};
    fig.querySelectorAll(".seg").forEach(function (g) {
      var bar = g.querySelector(".bar");
      if (!bar) { return; }
      var bx = parseFloat(bar.getAttribute("x"));
      var bw = parseFloat(bar.getAttribute("width"));
      var bh = parseFloat(bar.getAttribute("height"));
      var base = parseFloat(bar.getAttribute("y")) + bh;
      var fill = document.createElementNS(NS, "rect");
      fill.setAttribute("class", "bar-fill");
      fill.setAttribute("x", bx);
      fill.setAttribute("y", base);
      fill.setAttribute("width", bw);
      fill.setAttribute("height", 0);
      fill.setAttribute("fill", bar.getAttribute("fill"));
      bar.parentNode.insertBefore(fill, bar.nextSibling);
      bars[g.getAttribute("data-seg")] = {
        cx: bx + bw / 2, base: base, h: bh, fill: fill,
        dot: TINT[bar.getAttribute("fill")] || bar.getAttribute("fill")
      };
    });

    var pool = [], live = [], cur = null, emitAcc = 0, emitN = 20, lastPartial = 0, loopId = 0;

    function take() {
      var el = pool.pop();
      if (!el) {
        el = document.createElementNS(NS, "circle");
        el.setAttribute("r", "2.6");
        el.setAttribute("fill", "#E8B96A");
      }
      puffs.appendChild(el);
      return el;
    }
    function spawn(x0, y0, b) {
      if (live.length > 46) { return; }
      var el = take();
      el.setAttribute("cx", x0);
      el.setAttribute("cy", y0);
      el.setAttribute("r", "3.2");
      el.setAttribute("fill", b.dot);
      el.setAttribute("opacity", "0");
      var tx = b.cx + (Math.random() * 12 - 6);
      var dist = Math.abs(tx - x0);
      live.push({
        el: el, x0: x0, y0: y0,
        x1: tx, y1: b.base - 2,
        wob: Math.random() * 10 - 5,
        t0: performance.now(),
        dur: 480 + Math.min(820, dist * 1.1) + Math.random() * 180
      });
      startLoop();
    }
    /* 粒子自帶 rAF 迴圈：捲動擦洗時 frame() 會停，但已生成的粒子要能自己落完 */
    function startLoop() {
      if (loopId) { return; }
      loopId = requestAnimationFrame(tick);
    }
    function tick(now) {
      loopId = 0;
      drawParticles(now);
      if (live.length) { loopId = requestAnimationFrame(tick); }
    }
    function clearParticles() {
      while (live.length) { var p = live.pop(); puffs.removeChild(p.el); pool.push(p.el); }
      lastPartial = 0;
      emitAcc = 0;
    }
    function drawParticles(now) {
      for (var k = live.length - 1; k >= 0; k--) {
        var p = live[k];
        var q = (now - p.t0) / p.dur;
        if (q >= 1) {
          p.el.removeAttribute("opacity");
          p.el.setAttribute("opacity", "0");
          puffs.removeChild(p.el);
          pool.push(p.el);
          live.splice(k, 1);
          continue;
        }
        var g = q * q;                       // 越往下越快：重力感
        var s = q * q * (3 - 2 * q);         // 水平收攏用平滑曲線，看起來像被吸進長條
        // 先跟著運具走，再收攏進該 TCE 的長條：排放發生在路上、彙整成一段的總量
        var x = p.x0 + (p.x1 - p.x0) * s + Math.sin(q * Math.PI) * p.wob;
        var y = p.y0 + (p.y1 - p.y0) * g;
        var o = q < .18 ? q / .18 : (q > .78 ? (1 - q) / .22 : 1);
        p.el.setAttribute("cx", x.toFixed(1));
        p.el.setAttribute("cy", y.toFixed(1));
        p.el.setAttribute("opacity", (o * .85).toFixed(2));
      }
    }

    return {
      enter: function (st) {
        var kind = st.veh || "road";
        for (var key in veh) { if (veh[key]) { veh[key].classList.toggle("is-on", key === kind); } }
        cur = bars[String(st.seg)] || null;
        emitAcc = 0;
        lastPartial = 0;
        if (cur) {
          // 粒子數量與該段排放量成正比：排得多的段，視覺上就冒得比較密
          emitN = Math.max(6, Math.min(60, Math.round(st.kg / 2.5)));
        }
      },
      frame: function (st, x, partial, acc, tacc, ratios, idx) {
        // 運鏡：跟著這段實際進度走（捲動擦洗與按播放都經過同一條路徑）
        if (cam) { cam.frame(idx || 0, x, partial); }
        // 長條高度由 ratios 統一驅動（已完成段＝1、當前段＝partial、未走到的段＝0），
        // 所以往前捲或往回捲，畫面都跟當前進度一致，不會殘留。
        if (ratios) {
          for (var key in bars) {
            var b = bars[key];
            var r = ratios[key] || 0;
            var hh = b.h * r;
            b.fill.setAttribute("height", hh.toFixed(1));
            b.fill.setAttribute("y", (b.base - hh).toFixed(1));
          }
        }
        if (cur) {
          // 依「進度變化量」生成粒子：時間播放與捲動擦洗都適用，
          // 捲得快就一次多冒幾顆、捲得慢就少冒，總數恆等於該段應有的粒子數。
          if (partial > lastPartial && partial < 1) {
            emitAcc += (partial - lastPartial) * emitN;
            while (emitAcc >= 1) { emitAcc -= 1; spawn(x, st.y - 20, cur); }
          }
          lastPartial = partial;
        }
        drawParticles(performance.now());
      },
      finish: function () {
        if (cam) { cam.reset(); }
        for (var key in bars) {
          var b = bars[key];
          b.fill.setAttribute("height", b.h);
          b.fill.setAttribute("y", b.base - b.h);
        }
      },
      settle: function () {
        this.finish();
        clearParticles();
      },
      clear: function () {
        if (cam) { cam.reset(); }
        cur = null;
        lastPartial = 0;
        emitAcc = 0;
        for (var key in bars) { bars[key].fill.setAttribute("height", 0); bars[key].fill.setAttribute("y", bars[key].base); }
        clearParticles();
      },
      // 只清粒子、保留長條高度：捲動擦洗換段時用，避免把已完成的長條一起清空
      clearParticles: function () { clearParticles(); }
    };
  }

  var heroDataEl = document.getElementById("heroData");
  var heroBeatSync = null;   // 手動播放時，讓節拍卡高亮跟著動畫走
  /* 第 0 頁的場景特效設定：粒子、長條與運鏡參數都集中在這裡 */
  var HERO_FX = {
    figId: "diorama",
    puffsId: "heroPuffs",
    cam: {
      ax: 520,     // 跟拍時貨櫃停在畫面上的 x（約 43%，偏左一點比較像電影構圖）
      ay: 205,     // 鏡頭的垂直落點＝畫面垂直中心（410 的一半）
      fy: 285,     // 跟拍時的垂直焦點：落在兩排之間，上下排都留在畫面裡
      zoom: 1.75,  // 推近倍率：可見寬度約 686／1200，夠近也夠清楚
      padIn: 0.45, // 推近佔第一段行程的比例（約 720ms）
      padOut: 0.4, // 拉回佔最後一段行程的比例（約 760ms）
      sway: 18,    // 跟拍時鏡頭的輕微擺動，避免鎖死像釘書機
      beats: 5,
      vigId: "heroVig",
      vigMax: 0.62
    }
  };
  var heroRunner = makeRunner({
    markerId: "heroCargo", playId: "heroPlay", resetId: "heroReset",
    readId: "heroSeg", totalId: "heroTotal", dataId: "heroData",
    idleRead: "準備出發",
    doneRead: "抵達！五個 TCE 全部走完",
    doneData: "總排放 318.3 kg CO₂e・運輸活動量 6,500 tkm",
    idleData: "10 t 貨物・五個 TCE・三段運輸＋兩個轉運站",
    total: 318.3,
    tkmId: "heroTkm",
    tkmTotal: 6500,
    settleOnInit: true,
    fx: { init: function (marker) { return makeSceneFx(marker, HERO_FX); } },
    stops: [
      { seg: 1, x0: 120, x1: 191, y: 236, dur: 1600, kg: 75.0, tkm: 500, veh: "road", read: "TCE 1｜卡車 50 km × 10 t ＝ 500 tkm", data: "活動資料：距離 50 km・質量 10 t" },
      { seg: 2, x0: 191, x1: 207, y: 236, dur: 900, kg: 10.7, tkm: 0, veh: "hub", read: "TCE 2｜轉運站 A：處理 10 t（沒有距離）", data: "活動資料：處理量 10 t（轉運不含距離）" },
      { seg: 3, x0: 207, x1: 921, y: 236, dur: 3000, kg: 71.9, tkm: 5000, veh: "rail", read: "TCE 3｜貨列 500 km × 10 t ＝ 5,000 tkm", data: "活動資料：距離 500 km・質量 10 t" },
      { seg: 4, x0: 921, x1: 937, y: 236, dur: 900, kg: 10.7, tkm: 0, veh: "hub", read: "TCE 4｜轉運站 B：處理 10 t", data: "活動資料：處理量 10 t" },
      { seg: 5, x0: 937, x1: 1077, y: 236, dur: 1900, kg: 150.0, tkm: 1000, veh: "road", read: "TCE 5｜卡車 100 km × 10 t ＝ 1,000 tkm", data: "活動資料：距離 100 km・質量 10 t" }
    ],
    highlight: function (seg) {
      var fig = document.getElementById("diorama");
      if (!fig) { return; }
      fig.querySelectorAll(".seg").forEach(function (g) {
        g.classList.toggle("is-lit", String(seg) === g.getAttribute("data-seg"));
      });
      if (seg === "done") {
        fig.querySelectorAll(".seg").forEach(function (g) { g.classList.add("is-lit"); });
      }
    },
    onStop: function (st) {
      if (heroDataEl) { heroDataEl.textContent = st.data; }
      // 手動播放時，讓節拍卡與進度條跟著動畫走（seekBeat 在 manual 狀態下不會介入）
      if (heroBeatSync) { heroBeatSync(); }
    }
  });

  /* --- 7e0. 入口捲動敘事：捲動進度＝貨櫃的行進時間軸 --- */
  var heroStage = document.getElementById("heroStage");
  var heroPin = document.querySelector(".hero-pin");
  var heroStepEls = Array.prototype.slice.call(document.querySelectorAll("#heroSteps .hero-step"));
  var heroStepsEl = document.getElementById("heroSteps");
  var heroFill = document.getElementById("heroProgressFill");
  var heroTicks = Array.prototype.slice.call(document.querySelectorAll(".hp-ticks i"));
  var heroScrubQueued = false;

  /* 節拍卡採「吸頂堆疊」：卡片停在吸頂舞台正下方，下一張從下面推上來換代。
     停留的捲動距離＝該段動畫的行程，所以讀到哪張卡剛好等於演到哪一段；
     卡片全程完整可見，也不會出現空白等待區。 */
  var heroReadPad = 12;       /* 卡片頂與吸頂舞台下緣的留白 */
  var heroReadTop = 120;

  function heroPinHeight() {
   if (!heroPin) { return 0; }
   var wasPinned = heroPin.classList.contains("is-pinned");
   heroPin.classList.add("is-pinned");
   var h = heroPin.offsetHeight;
   if (!wasPinned) { heroPin.classList.remove("is-pinned"); }
   return h;
  }

  function heroLayout() {
   if (!heroPin || !heroStepEls.length) { return; }
   var vh = window.innerHeight || document.documentElement.clientHeight;
   var stickyTop = parseFloat(getComputedStyle(heroPin).top) || 0;
   heroReadTop = stickyTop + heroPinHeight() + heroReadPad;
   /* 每張卡停留的距離＝一屏閱讀區的高度，下一張卡才會剛好把它推走 */
   var stay = Math.max(220, vh - heroReadTop);
   var px = stay + "px";
   var lastIdx = heroStepEls.length - 1;
   heroStepEls.forEach(function (el, i) {
     /* 總結卡不需要停留空間：動畫此時已結束，讓它照正常排版出現、讀完再往下走。 */
     if (i === lastIdx) { el.classList.add("hs-last"); el.style.minHeight = ""; }
     else if (el.style.minHeight !== px) { el.style.minHeight = px; }
     if (el.style.top !== heroReadTop + "px") { el.style.top = heroReadTop + "px"; }
   });
   if (heroStepsEl) { heroStepsEl.style.paddingBottom = ""; }
   /* 總結卡也要吸頂，否則它會捲進高高的舞台後方。
      吸頂能停留的範圍是容器的 content box，所以用佔位元素補一段
      「剛好等於總結卡高度」的空間：讀完後，舞台與卡片一起捲走。 */
   var tail = heroStepsEl ? heroStepsEl.querySelector(".hero-steps-tail") : null;
   if (tail) {
     var lastEl = heroStepEls[lastIdx];
     var th = Math.round(stay + (lastEl ? lastEl.offsetHeight : 0) + 28) + "px";
     if (tail.style.height !== th) { tail.style.height = th; }
   }
  }

  function heroScrub() {
  heroScrubQueued = false;
  if (!heroRunner || !heroStage || !heroStepEls.length) { return; }
  var r = heroStage.getBoundingClientRect();
  var vh = window.innerHeight || document.documentElement.clientHeight;
  // 舞台完全離開視窗時不計算，避免無謂工作
  if (r.bottom < -40 || r.top > vh + 40) { return; }

  /* 吸頂與否決定吸頂區的高度（行動版吸頂時收掉講讀文字），
     用類別區分，頁面頂部才能看到完整舞台。 */
  if (heroPin) {
    var stuck = heroPin.getBoundingClientRect().top <= (parseFloat(getComputedStyle(heroPin).top) || 0) + 0.5;
    if (heroPin.classList.contains("is-pinned") !== stuck) { heroPin.classList.toggle("is-pinned", stuck); }
    /* 講讀文字換行、或吸頂後收掉文字，都會改變吸頂區高度：
       閱讀線要跟著更新，否則卡片會被舞台蓋住一小條。 */
    var wantTop = (parseFloat(getComputedStyle(heroPin).top) || 0) + heroPin.offsetHeight + heroReadPad;
    if (Math.abs(wantTop - heroReadTop) > 2) {
      heroReadTop = wantTop;
      /* 總結卡也要一起更新：它的 top 若停在舊值，會一直卡在閱讀線下方，
         讓「正在讀的卡片」永遠停在最後一段，被容器邊界推進舞台後面。 */
      heroStepEls.forEach(function (el) {
        if (el.style.top !== heroReadTop + "px") {
          el.style.top = heroReadTop + "px";
        }
      });
    }
  }

  var beats = heroRunner.beats || 5;
  var tops = heroStepEls.map(function (el) { return el.getBoundingClientRect().top; });
  /* 吸頂堆疊下，已通過閱讀線的卡片都停在 heroReadTop；
     第一張還沒吸頂的卡片，它的前一張就是現在正在讀的那張。 */
  var active = tops.length - 1;
  for (var i = 0; i < tops.length; i++) {
    if (tops[i] > heroReadTop + 0.5) { active = i - 1; break; }
  }
  if (active < 0) { active = 0; }
  /* 進度＝下一張卡從螢幕下緣推到閱讀線的距離 */
  var f = 1;
  if (active + 1 < tops.length) {
    var travel = Math.max(1, vh - heroReadTop);
    f = (vh - tops[active + 1]) / travel;
    f = Math.max(0, Math.min(1, f));
  }
  var p = active <= 0 ? 0 : (active >= beats + 1 ? beats : (active - 1) + f);

    /* 收尾：總結卡被容器邊界往上推時，會半卡在吸頂舞台後面。
       在它開始被推上去之前的最後一段捲動裡慢慢淡出，
       剛好「完全透明」的那一刻才開始被遮，像落幕而不是被切一半。 */
    var lastEl = heroStepEls[heroStepEls.length - 1];
    if (lastEl && heroStepsEl) {
      var lead = 110;
      var pushed = (heroReadTop + lastEl.offsetHeight) - heroStepsEl.getBoundingClientRect().bottom;
      var fade = pushed >= 0 ? 0 : (pushed <= -lead ? 1 : 1 + pushed / lead);
      var card = lastEl.querySelector(".hs-card");
      if (card) { card.style.opacity = fade >= 0.999 ? "" : fade.toFixed(2); }
    }

    if (reduced()) {
      // 減少動態：不擦洗動畫，但卡片高亮仍跟隨捲動（那是導覽線索，不是動畫）
      heroStepEls.forEach(function (el, k) { el.classList.toggle("is-on", k === active); });
      return;
    }
    // 使用者自己按「走一趟」時，動畫歸按鈕管，捲動不搶時間軸
    if (heroRunner.state() !== "manual") { heroRunner.seekBeat(p); }
    heroStepEls.forEach(function (el, k) { el.classList.toggle("is-on", k === active); });
    heroProgress(Math.min(p, beats), beats);
  }

  function heroProgress(b, beats) {
    if (heroFill) { heroFill.style.width = (b / beats * 100).toFixed(1) + "%"; }
    var segNo = b <= 0 ? 0 : (b >= beats ? beats : Math.floor(b) + 1);
    heroTicks.forEach(function (t) { t.classList.toggle("is-on", parseInt(t.getAttribute("data-seg"), 10) <= segNo); });
  }

  /* 手動播放時，節拍卡高亮與進度跟著動畫走 */
  function heroChrome() {
    var beats = heroRunner.beats || 5;
    var b = heroRunner.beat();
    var card = b <= 0 ? 0 : (b >= beats ? heroStepEls.length - 1 : Math.floor(b) + 1);
    heroStepEls.forEach(function (el, k) { el.classList.toggle("is-on", k === card); });
    heroProgress(Math.min(b, beats), beats);
  }
  heroBeatSync = heroChrome;

  /* --- 7e. 展區 04 運輸鏈行進動畫（場景化：剖面插畫＋粒子＋輕量運鏡） --- */
  var crStops = [
    { seg: 1, x0: 120, x1: 270, y: 286, dur: 1900, kg: 75.0, veh: "road", read: "TCE 1｜公路 500 tkm × 0.150 ＝ 75.0 kg CO₂e" },
    { seg: 2, x0: 270, x1: 390, y: 286, dur: 850, kg: 10.7, veh: "hub", read: "TCE 2｜轉運 A：10 t × 1.07 ＝ 10.7 kg CO₂e（不產生 tkm）" },
    { seg: 3, x0: 390, x1: 750, y: 286, dur: 2100, kg: 71.9, veh: "rail", read: "TCE 3｜鐵路 5,000 tkm，來源回報 71.9 kg CO₂e（用表上 0.014 去乘會得 70.0，見案例步驟 5）" },
    { seg: 4, x0: 750, x1: 870, y: 286, dur: 850, kg: 10.7, veh: "hub", read: "TCE 4｜轉運 B：10 t × 1.07 ＝ 10.7 kg CO₂e" },
    { seg: 5, x0: 870, x1: 1080, y: 286, dur: 1600, kg: 150.0, veh: "road", read: "TCE 5｜公路 1,000 tkm × 0.150 ＝ 150.0 kg CO₂e" }
  ];
  /* 展區 04 的場景特效：同一套粒子與相機，但推近幅度較小，
     因為這裡的重點是「長條一根一根長出來」，鏡頭必須把長條留在畫面裡。 */
  var CR_FX = {
    figId: "chainRun",
    puffsId: "crPuffs",
    cam: {
      ax: 520, ay: 225, fy: 286, zoom: 1.6,
      padIn: 0.42, padOut: 0.4, sway: 14, beats: 5,
      vigId: "crVig", vigMax: 0.55
    }
  };
  var crRunner = makeRunner({
    markerId: "crCargo", playId: "crPlay", resetId: "crReset",
    readId: "crRead", totalId: "crTotal",
    idleRead: "尚未出發。點「讓貨物走一趟」，看排放怎麼一段一段加起來。",
    doneRead: "全程走完：318.3 kg CO₂e，其中兩段公路就佔 225 kg（71%）。",
    total: 318.3,
    stops: crStops,
    fx: { init: function (marker) { return makeSceneFx(marker, CR_FX); } },
    highlight: function (seg) {
      var fig = document.getElementById("chainRun");
      if (!fig) { return; }
      fig.querySelectorAll(".seg").forEach(function (g) {
        g.classList.toggle("is-lit", String(seg) === g.getAttribute("data-seg"));
      });
      if (seg === "done") { fig.querySelectorAll(".seg").forEach(function (g) { g.classList.add("is-lit"); }); }
    }
  });

  /* --- 7h. 展區 01 家族分工圖：把指引和它說明的標準連起來看 --- */
  var famMap = document.getElementById("famMap");
  if (famMap) {
    var PAIR = { "4": "1", "5": "3" };
    var famSvg = famMap.querySelector("svg");
    function famFocus(guideKey) {
      var coreKey = PAIR[guideKey];
      famMap.classList.toggle("is-focus", !!guideKey);
      famSvg.querySelectorAll(".fm-guide").forEach(function (g) {
        g.classList.toggle("is-lit", !!guideKey && g.getAttribute("data-guide") === guideKey);
      });
      famSvg.querySelectorAll(".fm-core").forEach(function (g) {
        g.classList.toggle("is-lit", !!guideKey && g.getAttribute("data-core") === coreKey);
      });
    }
    famSvg.querySelectorAll(".fm-guide").forEach(function (g) {
      var k = g.getAttribute("data-guide");
      g.setAttribute("tabindex", "0");
      if (!g.getAttribute("role")) { g.setAttribute("role", "group"); }
      if (!g.getAttribute("aria-label")) { g.setAttribute("aria-label", "指引 " + k + "：聚焦後會點亮它說明的標準"); }
      g.addEventListener("mouseenter", function () { famFocus(k); });
      g.addEventListener("mouseleave", function () { famFocus(null); });
      g.addEventListener("focus", function () { famFocus(k); });
      g.addEventListener("blur", function () { famFocus(null); });
    });
  }


  /* --- 7i. 展區 03 層級放大圖：聚焦「運輸」那一格，右側 14083 鏈被點亮 --- */
  var zoomMap = document.getElementById("zoomMap");
  if (zoomMap) {
    var zmCell = document.getElementById("zmTransport");
    function zmLit(on) { zoomMap.classList.toggle("is-lit", on); }
    zmCell.addEventListener("mouseenter", function () { zmLit(true); });
    zmCell.addEventListener("mouseleave", function () { zmLit(false); });
    zmCell.addEventListener("focus", function () { zmLit(true); });
    zmCell.addEventListener("blur", function () { zmLit(false); });
    zmCell.addEventListener("click", function () { zmLit(!zoomMap.classList.contains("is-lit")); });
    zmCell.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        zmLit(!zoomMap.classList.contains("is-lit"));
      }
    });
  }

  /* --- 7f. 展區 02 排放場景：圈層 ↔ 場景高亮 --- */
  var emScene = document.getElementById("emScene");
  var emRings = document.getElementById("emRings");
  var emNote = document.getElementById("emSceneNote");
  var EM_TEXT = {
    "1": "照亮的是<strong>這家公司自己擁有或控制</strong>的來源：自家煙囪、製程、以及公司自有車隊。注意那台卡車在左側——車是你的，油燒的碳就直接算你的。",
    "2": "照亮的是<strong>外部電廠</strong>與輸電線。排碳發生在發電端，但電是你用的，所以算你的（外購能源的間接排放）。",
    "3": "照亮的是<strong>上下游</strong>：供應商原料、委外物流商的卡車、通勤與出差。排放發生在別人的設備上，但由你的活動引起。右側那台委外卡車就是本展主角。",
    null: "點場景裡任一區、或點下方三個圈層按鈕，看排放發生在<strong>誰</strong>的設備上。三條箭頭同色對照圖例。"
  };
  function setEmZone(z) {
    if (!emScene) { return; }
    ["1", "2", "3"].forEach(function (k) {
      var g = emScene.querySelector('.emz[data-zone="' + k + '"]');
      var ring = emRings && emRings.querySelector('.ring[data-zone="' + k + '"]');
      var on = z === k;
      if (g) { g.classList.toggle("is-lit", on); g.classList.toggle("is-dim", z !== null && !on); }
      if (ring) { ring.setAttribute("aria-pressed", on ? "true" : "false"); ring.classList.toggle("is-lit", on); }
    });
    if (emNote) { emNote.innerHTML = EM_TEXT[z === null ? null : z] || EM_TEXT[null]; }
  }
  if (emRings) {
    emRings.querySelectorAll(".ring").forEach(function (r) {
      r.addEventListener("click", function () {
        var z = r.getAttribute("data-zone");
        setEmZone(emRings.querySelector('.ring[data-zone="' + z + '"]').getAttribute("aria-pressed") === "true" ? null : z);
      });
    });
  }
  if (emScene) {
    emScene.querySelectorAll(".emz").forEach(function (g) {
      var z = g.getAttribute("data-zone");
      g.addEventListener("click", function () { setEmZone(z); });
      /* 三個圈層是 tabindex="0" 的 SVG 群組，不是真正的 button，
         所以 Enter／空白鍵要自己接，鍵盤使用者才真的能操作。 */
      g.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter" || ev.key === " " || ev.key === "Spacebar") {
          ev.preventDefault();
          setEmZone(z);
        }
      });
    });
  }

  /* --- 7g. 運具沙盒：換運具／換距離，看數字怎麼變 --- */
  var SB = {
    rail: { name: "貨列", g: 0.014, src: "來源數據", hub: true },
    road: { name: "全程卡車", g: 0.150, src: "來源數據", hub: false },
    sea: { name: "海運", g: 0.012, src: "教學假設", hub: true },
    air: { name: "空運", g: 0.600, src: "教學假設", hub: true }
  };
  var SB_HUB = 1.07;   // kg CO₂e / t（GLEC Framework v3 轉運預設值，取自指南案例 A）
  var SB_PRE = 50;     // km，前段接駁（指南案例 A 的 SFD）
  var SB_POST = 100;   // km，後段配送（指南案例 A 的 SFD）
  var sbMode = "rail";
  var sbDist = document.getElementById("sbDist");
  var sbMass = document.getElementById("sbMass");
  var sbChain = document.getElementById("sbChain");

  function renderSandbox() {
    if (!sbChain) { return; }
    var m = SB[sbMode];
    var dist = +sbDist.value;
    var mass = +sbMass.value;
    document.getElementById("sbDistOut").textContent = dist;
    document.getElementById("sbMassOut").textContent = mass;

    var legs = [];
    legs.push({ tag: "TCE 1", name: "公路接駁", act: SB_PRE + " km × " + mass + " t", g: 0.150, kg: 0.150 * SB_PRE * mass });
    if (m.hub) { legs.push({ tag: "TCE 2", name: "轉運進站", act: mass + " t", g: SB_HUB, kg: SB_HUB * mass }); }
    legs.push({ tag: m.hub ? "TCE 3" : "TCE 2", name: m.name + "主線", act: dist + " km × " + mass + " t", g: m.g, kg: m.g * dist * mass });
    if (m.hub) { legs.push({ tag: "TCE 4", name: "轉運出站", act: mass + " t", g: SB_HUB, kg: SB_HUB * mass }); }
    legs.push({ tag: m.hub ? "TCE 5" : "TCE 3", name: "公路配送", act: SB_POST + " km × " + mass + " t", g: 0.150, kg: 0.150 * SB_POST * mass });

    var total = 0, tkm = 0;
    legs.forEach(function (l) {
      total += l.kg;
      if (l.act.indexOf("km") > -1) { tkm += parseFloat(l.act.split(" km")[0].replace(/,/g, "")) * mass; }
    });

    var maxKg = Math.max.apply(null, legs.map(function (l) { return l.kg; }));
    sbChain.innerHTML = legs.map(function (l) {
      var share = total > 0 ? (l.kg / total * 100) : 0;
      return '<div class="sbc">' +
        '<span class="sbc-tag">' + l.tag + "</span>" +
        '<span class="sbc-name">' + l.name + "</span>" +
        '<span class="sbc-act">' + l.act + "・" + l.g.toFixed(3) + " kg CO₂e/" + (l.act.indexOf("km") > -1 ? "tkm" : "t") + "</span>" +
        '<span class="sbc-bar" title="' + share.toFixed(1) + '% of total"><i style="width:' + share.toFixed(1) + '%"></i></span>' +
        '<span class="sbc-kg">' + l.kg.toFixed(1) + " kg・" + share.toFixed(1) + "%</span></div>";
    }).join("");

    document.getElementById("sbTotal").textContent = total.toFixed(1);
    document.getElementById("sbInt").textContent = tkm > 0 ? (total / tkm).toFixed(3) : "—";
    document.getElementById("sbAct").textContent = "運輸活動量 " + tkm.toLocaleString() + " tkm・" + legs.length + " 個 TCE";
    document.getElementById("sbNote").innerHTML =
      "目前情境：<strong>" + m.name + "</strong>（強度 " + m.g.toFixed(3) + " kg CO₂e/tkm，" + m.src + "）。" +
      (m.hub
        ? "主線前後各加一段公路接駁與一次轉運，所以就算主線很乾淨，總強度也不會等於主線的強度——這正是 14083 要你看見的<strong>鏈結構</strong>。"
        : "全程公路不需要轉運站，TCE 少一個，但兩段公路與主線都用同一個高強度，總排放因此最高。") +
      " 數字為教學示範，<strong>不是</strong>符合 ISO 14083 的正式盤查結果。";
  }
  if (sbChain) {
    document.querySelectorAll(".mode-btn").forEach(function (b) {
      b.addEventListener("click", function () {
        document.querySelectorAll(".mode-btn").forEach(function (x) {
          x.classList.remove("is-on"); x.setAttribute("aria-pressed", "false");
        });
        b.classList.add("is-on"); b.setAttribute("aria-pressed", "true");
        sbMode = b.getAttribute("data-mode");
        renderSandbox();
      });
    });
    sbDist.addEventListener("input", renderSandbox);
    sbMass.addEventListener("input", renderSandbox);
    renderSandbox();
  }

  /* ---------------------------------------------------------
     8. 導覽：閱讀進度與目前展區
     --------------------------------------------------------- */
  var bar = document.getElementById("progressBar");
  var railLinks = Array.prototype.slice.call(document.querySelectorAll(".rail-list a"));
  var sections = railLinks.map(function (a) {
    return document.querySelector(a.getAttribute("href"));
  });

  function onScroll() {
    var h = document.documentElement;
    var max = h.scrollHeight - h.clientHeight;
    if (bar) { bar.style.width = (max > 0 ? (h.scrollTop / max) * 100 : 0) + "%"; }
    var y = h.scrollTop + 140;
    var idx = -1;
    sections.forEach(function (s, i) { if (s && s.offsetTop <= y) { idx = i; } });
    railLinks.forEach(function (a, i) {
      a.classList.toggle("is-on", i === idx);
      // 讓螢幕閱讀器也知道現在停在哪個展區
      if (i === idx) { a.setAttribute("aria-current", "true"); }
      else { a.removeAttribute("aria-current"); }
    });
    sweepReveal();
    markPannable();
    if (!parallaxQueued && !reduced()) {
      parallaxQueued = true;
      requestAnimationFrame(applyParallax);
    }
    if (!heroScrubQueued) {
      heroScrubQueued = true;
      requestAnimationFrame(heroScrub);
    }
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", function () { heroLayout(); onScroll(); });
  heroLayout();
  onScroll();
  heroScrub();
  /* 字型與版面就緒後高度會變，重算一次卡片間距 */
  window.addEventListener("load", function () { heroLayout(); heroScrub(); });
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { heroLayout(); heroScrub(); });
  }
})();
