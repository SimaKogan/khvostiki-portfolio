/* ===== Хвостики: меню, увеличение фото, фильтр питомцев, форма заявки ===== */
(function () {
  "use strict";

  /* ---------- Мобильное меню ---------- */
  var header = document.querySelector(".site-header");
  var burger = header && header.querySelector(".burger");
  if (burger) {
    var setMenu = function (open) {
      header.classList.toggle("nav-open", open);
      burger.setAttribute("aria-expanded", open ? "true" : "false");
      burger.setAttribute("aria-label", open ? "Закрыть меню" : "Открыть меню");
      burger.textContent = open ? "✕" : "☰";
    };
    burger.addEventListener("click", function () { setMenu(!header.classList.contains("nav-open")); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && header.classList.contains("nav-open")) { setMenu(false); burger.focus(); }
    });
    header.querySelector("nav").addEventListener("click", function (e) {
      if (e.target.tagName === "A") setMenu(false);
    });
  }

  /* ---------- Баннерное видео: кнопка паузы (WCAG 2.2.2) и prefers-reduced-motion ---------- */
  var heroVideo = document.querySelector(".hero-media video");
  if (heroVideo) {
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "hero-toggle";
    var sync = function () {
      var playing = !heroVideo.paused;
      toggle.textContent = playing ? "❚❚" : "▶";
      toggle.setAttribute("aria-label", playing ? "Остановить анимацию" : "Запустить анимацию");
    };
    toggle.addEventListener("click", function () {
      if (heroVideo.paused) { var p = heroVideo.play(); if (p && p.catch) p.catch(function () {}); }
      else heroVideo.pause();
    });
    heroVideo.addEventListener("play", sync);
    heroVideo.addEventListener("pause", sync);
    if (reduce) { heroVideo.removeAttribute("autoplay"); heroVideo.pause(); }
    sync();
    heroVideo.parentNode.appendChild(toggle);
  }

  /* ---------- Увеличение фото ----------
     При наведении фото плавно приближается (CSS, класс .zoomable).
     По клику открывается просмотр на весь экран: стрелки и Esc, а клик
     по фото приближает его ещё сильнее, и его можно рассматривать мышью. */
  var all = Array.prototype.slice.call(document.querySelectorAll(".ph img, .side-photo img"));
  var imgs = all; /* фото, видимые на странице (скрытые фильтром пропускаются) */
  var current = 0;
  var lb, stage, big, cap, count, lastFocus;

  function build() {
    lb = document.createElement("div");
    lb.className = "lb";
    lb.setAttribute("role", "dialog");
    lb.setAttribute("aria-modal", "true");
    lb.setAttribute("aria-label", "Просмотр фото");
    lb.innerHTML =
      '<span class="lb-count"></span>' +
      '<button type="button" class="lb-btn lb-close" aria-label="Закрыть">✕</button>' +
      '<button type="button" class="lb-btn lb-prev" aria-label="Предыдущее фото">‹</button>' +
      '<button type="button" class="lb-btn lb-next" aria-label="Следующее фото">›</button>' +
      '<figure><div class="lb-stage"><img alt=""></div>' +
      '<figcaption></figcaption>' +
      '<span class="lb-hint">Нажмите на фото, чтобы приблизить</span></figure>';
    document.body.appendChild(lb);
    stage = lb.querySelector(".lb-stage");
    big = stage.querySelector("img");
    cap = lb.querySelector("figcaption");
    count = lb.querySelector(".lb-count");

    lb.querySelector(".lb-close").addEventListener("click", close);
    lb.querySelector(".lb-prev").addEventListener("click", function (e) { e.stopPropagation(); step(-1); });
    lb.querySelector(".lb-next").addEventListener("click", function (e) { e.stopPropagation(); step(1); });
    lb.addEventListener("click", function (e) { if (e.target === lb || e.target.tagName === "FIGURE") close(); });

    stage.addEventListener("click", function () { stage.classList.toggle("zoomed"); });
    stage.addEventListener("mousemove", function (e) {
      if (!stage.classList.contains("zoomed")) return;
      var r = stage.getBoundingClientRect();
      var x = ((e.clientX - r.left) / r.width) * 100;
      var y = ((e.clientY - r.top) / r.height) * 100;
      big.style.transformOrigin = x + "% " + y + "%";
    });
  }

  function show(i) {
    current = (i + imgs.length) % imgs.length;
    var src = imgs[current];
    stage.classList.remove("zoomed");
    big.style.transformOrigin = "50% 50%";
    big.src = src.currentSrc || src.src;
    big.alt = src.alt || "";
    var text = visibleCaption(src);
    cap.textContent = text;
    cap.hidden = !text;
    count.textContent = (current + 1) + " / " + imgs.length;
  }

  /* Подпись в увеличенном виде = текст, который написан под фото на странице
     (заголовок и цитата карточки). Если под фото ничего нет, подписи нет. */
  function visibleCaption(img) {
    var box = img.closest(".ph, .side-photo");
    var parts = [];
    var n = box ? box.nextElementSibling : null;
    while (n) {
      if (/^H[1-6]$/.test(n.tagName) || n.classList.contains("quote") || n.classList.contains("caption")) {
        var t = n.textContent.replace(/\s+/g, " ").trim();
        if (t) parts.push(t);
      }
      n = n.nextElementSibling;
    }
    return parts.join(" — ");
  }

  function open(i) {
    if (!lb) build();
    var shown = all[i];
    imgs = all.filter(function (im) { return im.getClientRects().length > 0; });
    i = Math.max(0, imgs.indexOf(shown));
    lastFocus = document.activeElement;
    show(i);
    lb.classList.add("open");
    document.documentElement.style.overflow = "hidden";
    lb.querySelector(".lb-close").focus();
  }

  function close() {
    if (!lb) return;
    lb.classList.remove("open");
    stage.classList.remove("zoomed");
    document.documentElement.style.overflow = "";
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function step(d) { show(current + d); }

  document.addEventListener("keydown", function (e) {
    if (!lb || !lb.classList.contains("open")) return;
    if (e.key === "Escape") close();
    else if (e.key === "ArrowLeft") step(-1);
    else if (e.key === "ArrowRight") step(1);
  });

  imgs.forEach(function (img, i) {
    var box = img.closest(".ph, .side-photo");
    if (!box) return;
    box.classList.add("zoomable");
    box.tabIndex = 0;
    box.setAttribute("role", "button");
    box.setAttribute("aria-label", "Увеличить фото" + (img.alt ? ": " + img.alt : ""));
    box.addEventListener("click", function () { open(i); });
    box.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(i); }
    });
  });

  /* ---------- Копирование реквизитов ---------- */
  function copyText(text, done) {
    var fallback = function () {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); done(); } catch (e) { /* ничего */ }
      document.body.removeChild(ta);
    };
    try { navigator.clipboard.writeText(text).then(done, fallback); } catch (e) { fallback(); }
  }
  Array.prototype.forEach.call(document.querySelectorAll(".copy[data-copy]"), function (btn) {
    var label = btn.textContent;
    btn.addEventListener("click", function () {
      copyText(btn.getAttribute("data-copy"), function () {
        btn.textContent = "Скопировано ✓";
        btn.classList.add("done");
        setTimeout(function () { btn.textContent = label; btn.classList.remove("done"); }, 1800);
      });
    });
  });

  /* ---------- Фильтр питомцев ----------
     Карточки в #pet-grid помечены data-type="dog|cat" и (по желанию)
     data-age="young|adult|senior". Кнопки фильтра строятся сами. */
  var grid = document.getElementById("pet-grid");
  var bar = document.getElementById("pet-filter");
  if (grid && bar) {
    var cards = Array.prototype.slice.call(grid.children);
    var empty = document.getElementById("filter-empty");
    var names = {
      type: { dog: "Собаки", cat: "Кошки" },
      age: { young: "Малыши", adult: "Взрослые", senior: "Пожилые" }
    };
    var state = { type: "", age: "" };
    var groups = [];
    ["type", "age"].forEach(function (key) {
      var vals = [];
      cards.forEach(function (c) {
        var v = c.getAttribute("data-" + key);
        if (v && vals.indexOf(v) < 0) vals.push(v);
      });
      if (vals.length > 1 || (key === "age" && vals.length > 0)) groups.push([key, vals]);
    });
    if (groups.length) {
      groups.forEach(function (g) {
        var key = g[0], row = document.createElement("div");
        row.className = "filter-row";
        var mk = function (value, text) {
          var b = document.createElement("button");
          b.type = "button";
          b.className = "chip" + (value === "" ? " active" : "");
          b.textContent = text;
          b.setAttribute("aria-pressed", value === "" ? "true" : "false");
          b.addEventListener("click", function () {
            state[key] = value;
            Array.prototype.forEach.call(row.children, function (x) {
              var on = x === b;
              x.classList.toggle("active", on);
              x.setAttribute("aria-pressed", on ? "true" : "false");
            });
            apply();
          });
          row.appendChild(b);
        };
        mk("", key === "type" ? "Все животные" : "Любой возраст");
        g[1].forEach(function (v) { mk(v, names[key][v] || v); });
        bar.appendChild(row);
      });
      bar.hidden = false;
    }
    function apply() {
      var n = 0;
      cards.forEach(function (c) {
        var ok = (!state.type || c.getAttribute("data-type") === state.type) &&
                 (!state.age || c.getAttribute("data-age") === state.age);
        c.hidden = !ok;
        if (ok) n++;
      });
      if (empty) empty.hidden = n > 0;
    }
  }

  /* ---------- Форма заявки на усыновление ----------
     Если у <form> задан data-endpoint (URL Vercel Function из папки server/),
     заявка уходит на сервер и попадает волонтёрам в Telegram.
     Если адрес пуст или сервер недоступен, форма не теряет данные:
     показывает готовый текст, который можно скопировать и отправить вручную. */
  var form = document.getElementById("adopt-form-el");
  if (form) {
    var endpoint = (form.getAttribute("data-endpoint") || "").trim();
    var result = document.getElementById("form-result");
    var resultLead = document.getElementById("form-result-lead");
    var textBox = document.getElementById("form-text");
    var copyBtn = document.getElementById("form-copy");
    var status = document.getElementById("form-status");
    var submitBtn = form.querySelector("button[type=submit]");
    var submitLabel = submitBtn.textContent;

    if (!endpoint) {
      submitBtn.textContent = submitLabel = "Подготовить заявку";
      var lead = document.getElementById("form-lead");
      if (lead) lead.textContent = "Заполните форму: мы подготовим текст заявки, а вы отправите её нам в Telegram.";
    }

    function setStatus(text, kind) {
      status.textContent = text;
      status.className = "form-status " + (kind || "");
      status.hidden = !text;
    }

    function buildText(f) {
      var lines = [
        "Заявка на усыновление",
        "Имя: " + f["name"].value.trim(),
        "Телефон: " + f["phone"].value.trim(),
        "Питомец: " + (f["pet"].value.trim() || "пока не выбран")
      ];
      if (f["msg"].value.trim()) lines.push("О себе: " + f["msg"].value.trim());
      return lines.join("\n");
    }

    function showFallback(text, lead) {
      textBox.textContent = text;
      if (lead) resultLead.textContent = lead;
      result.hidden = false;
      result.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    function send(payload) {
      var ctrl = typeof AbortController === "function" ? new AbortController() : null;
      var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 10000);
      return fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: ctrl ? ctrl.signal : undefined
      }).then(function (r) {
        clearTimeout(timer);
        return r.json().catch(function () { return {}; }).then(function (data) {
          if (!r.ok || !data.ok) {
            var err = new Error(data.error || "http_" + r.status);
            err.userMessage = data.message;
            throw err;
          }
        });
      }, function (e) { clearTimeout(timer); throw e; });
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var f = form.elements;
      var text = buildText(f);
      result.hidden = true;
      setStatus("");

      if (!endpoint) { showFallback(text); return; }

      /* поле-ловушка для ботов: человек его не видит и не заполняет */
      if (f["website"].value) { setStatus("Спасибо! Заявка отправлена.", "ok"); form.reset(); return; }

      submitBtn.disabled = true;
      submitBtn.textContent = "Отправляем…";
      send({
        name: f["name"].value.trim(),
        phone: f["phone"].value.trim(),
        pet: f["pet"].value.trim(),
        msg: f["msg"].value.trim(),
        website: f["website"].value
      }).then(function () {
        setStatus("Спасибо! Заявка отправлена, волонтёры свяжутся с вами.", "ok");
        form.reset();
      }, function (err) {
        setStatus(err.userMessage || "Не удалось отправить заявку. Ничего страшного: скопируйте текст ниже и отправьте его нам в Telegram.", "error");
        showFallback(text, "Не удалось отправить автоматически. Скопируйте текст и отправьте его нам в Telegram или на info@khvostiki.example.");
      }).then(function () {
        submitBtn.disabled = false;
        submitBtn.textContent = submitLabel;
      });
    });

    if (copyBtn) {
      copyBtn.addEventListener("click", function () {
        var done = function () { copyBtn.textContent = "Скопировано ✓"; };
        try {
          navigator.clipboard.writeText(textBox.textContent).then(done, function () { selectText(textBox); });
        } catch (err) { selectText(textBox); }
      });
    }
  }

  function selectText(node) {
    var range = document.createRange();
    range.selectNodeContents(node);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }
})();
