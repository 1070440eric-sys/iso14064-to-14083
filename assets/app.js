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
      eg: "一批貨：卡車 50 km → 轉運站 A 裝櫃 → 貨列 500 km → 轉運站 B 卸櫃 → 卡車 100 km，就是五個 TCE。",
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
      plain: "車、船、飛機、場站「實際運轉」當下排的碳。排氣管裡那些。",
      eg: "卡車引擎燒掉 30 公升柴油時從排氣管排出的 CO₂。",
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
      def: "由三份互補標準組成的系列：-1 組織層級的量化與報告、-2 專案層級減量或移除增強的量化與監測、-3 溫室氣體聲明的查證與確證。",
      plain: "一套「算公司、算專案、查別人」的規矩。",
      eg: "食品公司年報用 -1；換鍋爐的減量專案用 -2；第三方來查報告用 -3。",
      src: "NQA《An Introduction to ISO 14064-1》（2024）"
    },
    {
      id: "org-level", abbr: "", en: "Organisation level", zh: "組織層級",
      cat: "org",
      def: "以一個組織（公司、集團、據點組合）為邊界的盤查範圍，14064-1 的核心視角。",
      plain: "先畫一個圈，把圈裡這家公司當成一個整體來算。",
      eg: "把總部與三座工廠圈成一個組織，三座的排放一起算成「公司總排放」。",
      src: "ISO 14064-1:2019 範圍（ISO 官方目錄頁）＋ NQA 介紹"
    },
    {
      id: "scope", abbr: "Scope 1/2/3", en: "Scopes (GHG Protocol)", zh: "溫室氣體範疇（慣稱）",
      cat: "org",
      def: "GHG Protocol 的分類慣稱：Scope 1 直接排放、Scope 2 外購能源的間接排放、Scope 3 其他間接排放（含 15 個子類別）。14064-1 本身以直接、外購能源、運輸、產品使用等類別表述，實務常借用 Scope 對照。",
      plain: "把公司的排放分成「自己排的」「買來的電排的」「上下游其他來源排的」三堆。",
      eg: "公司自有卡車是 Scope 1；外包的出貨運輸通常落在 Scope 3 的上游／下游運輸。",
      src: "GHG Protocol Corporate Standard／Scope 3 Handbook；NQA 介紹之對照"
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

  function renderGloss() {
    var q = (searchBox.value || "").trim().toLowerCase();
    var items = GLOSS.filter(function (t) {
      if (activeFilter !== "all" && t.cat !== activeFilter) { return false; }
      if (!q) { return true; }
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
        '<span class="g-en">' + esc(t.en) + "</span></span>" +
        '<span><span class="g-plain"><strong>' + esc(t.zh) + "</strong>　" + esc(t.plain) + "</span>" +
        '<span class="g-tag">點我看完整四層說明</span></span>';
      row.appendChild(btn);
      glossList.appendChild(row);
    });
    glossCount.textContent = "共 " + items.length + " 個術語" +
      (activeFilter === "all" ? "" : "（分類：" + filterLabel(activeFilter) + "）");
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
      "<div><dt>正式名稱</dt><dd>" + esc(t.en) + "</dd></div>" +
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
        btn.setAttribute("aria-expanded", open ? "false" : "true");
        var id = btn.getAttribute("aria-controls");
        var panel = id ? document.getElementById(id) : btn.nextElementSibling;
        if (panel) { panel.classList.toggle("is-open", !open); }
      });
    });
  }
  wireAccordion("#invSteps", ".step-btn");
  wireAccordion("#quiz", ".quiz-btn");

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
      text: "這是<strong>運輸活動</strong>，由電力貨列執行。距離 500 km、貨物 10 t → 5,000 tkm。注意：貨櫃本身的皮重 2.25 t 會影響能耗，但<strong>不算貨物質量</strong>。畫面上的 0.014 是指南顯示的四捨五入值，所以 0.014 × 5,000 看起來是 70.0，但指南最終報告列為 71.9（詳見展區 06 步驟 5）。鐵路的排放強度比公路低一個數量級，這正是「同一批貨換運具，數字差很多」的原因。"
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
            "<tr><td>TCE 3 鐵路</td><td>0.014 × 5,000</td><td class='num'>71.9</td></tr>" +
            "<tr><td>TCE 4 轉運 B</td><td>1.07 × 10</td><td class='num'>10.7</td></tr>" +
            "<tr><td>TCE 5 公路</td><td>0.150 × 1,000</td><td class='num'>150.0</td></tr>" +
            "<tr class='total'><td>合計</td><td>五段相加</td><td class='num'>318.3</td></tr></tbody></table>" +
            "<div class='formula'>TCE 排放（kg CO₂e）＝ 排放強度（kg CO₂e/tkm 或 /t） × 活動量（tkm 或 t）</div>" +
            "<p class='hint'>為什麼 0.014 × 5,000 不是 70.0？指南在 §4.3 用 14 g CO₂e/tkm × 5,000 tkm 得到 70.0 kg，但在 §5.2 步驟 5 與最終報告改列 71.9 kg（總數 318.3 也是用 71.9 加出來的）。差異來自指南原文本身，推測是 0.014 為四捨五入後的顯示值。本展沿用指南最終報告的 71.9 與 318.3；若改用 70.0，總排放為 316.4 kg CO₂e，運輸鏈強度仍約 0.049 kg CO₂e/tkm。</p>"
        },
        {
          h: "步驟 6｜加總，並換算回運輸鏈的排放強度",
          p: "整條鏈的排放就是五段之和。要比較不同運輸鏈的效率，再把總排放除以<strong>運輸活動量合計</strong>（轉運不計入分母，但轉運的排放仍在分子裡）。",
          extra: "<div class='formula'>總排放 = 75.0 + 10.7 + 71.9 + 10.7 + 150.0 = 318.3 kg CO₂e<br>" +
            "運輸活動量 = 500 + 5,000 + 1,000 = 6,500 tkm<br>" +
            "運輸鏈排放強度 = 318.3 ÷ 6,500 = 0.049 kg CO₂e/tkm</div>" +
            "<p><strong>怎麼解讀：</strong>0.049 kg CO₂e/tkm 代表這批貨平均每噸每公里排約 49 公克 CO₂e。它比純公路（0.150）低很多，因為主線改走鐵路；但它比純鐵路（0.014）高，因為前後兩段公路與兩個轉運站都算進來了。這就是 14083 要讓你看見的結構。</p>"
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
    var maxShare = 0;
    items.forEach(function (it) {
      it.share = allocKey === "mass" ? it.m / total : 1 / 3;
      it.kg = TRIP * it.share;
      if (it.share > maxShare) { maxShare = it.share; }
    });
    allocOut.innerHTML = items.map(function (it, i) {
      return '<div class="bar' + (i % 2 ? " alt" : "") + '">' +
        '<span class="bar-name">' + it.name + "（" + it.m + " t）</span>" +
        '<span class="bar-track"><span class="bar-fill" style="width:' +
        Math.round((it.share / maxShare) * 100) + '%"></span></span>' +
        '<span class="bar-val">' + (it.share * 100).toFixed(1) + "% · " + it.kg.toFixed(1) + " kg</span></div>";
    }).join("");
    document.getElementById("allocNote").textContent = allocKey === "mass"
      ? "依質量分配：整趟 " + TRIP + " kg CO₂e（教學假設）按各貨件質量比例分給三批貨。這正是 14083 要求的做法——以實際質量為基礎，這裡的質量指貨物實際質量（含原始包裝，但不含貨運業者另加的棧板、貨櫃等運輸包裝）。"
      : "平均分配（對照用）：三批貨各得 " + (TRIP / 3).toFixed(1) + " kg CO₂e。當三批貨質量差很多時，這樣會嚴重高估輕的貨件、低估重的貨件，所以 14083 不用這種分法。";
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
     7. 導覽：閱讀進度與目前展區
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
    railLinks.forEach(function (a, i) { a.classList.toggle("is-on", i === idx); });
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  onScroll();
})();
