const $ = (sel) => document.querySelector(sel);

const state = { category: "all", budget: "all", query: "", sort: "priority", view: "shelves", free: false };

let data = { categories: [], items: [], notes: [] };
const categoryById = new Map();
const itemById = new Map();
let listHash = "";
let listScroll = 0;

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// Stable hue per item, so each placeholder tile keeps its colour.
const hue = (str) => [...str].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
const normalize = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const categoryLabel = (id) => categoryById.get(id)?.label ?? id;

const chf = (n) => `CHF ${Number.isInteger(n) ? n : n.toFixed(2)}`;
const dateLabel = (iso) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("de-CH", { day: "numeric", month: "long", year: "numeric" });

/* ---------- Icons (inline, stroke-based) ---------- */

const ICON_PATHS = {
  all: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  gift: '<path d="M4 11h16v10H4zM3 7h18v4H3zM12 7v14"/><path d="M12 7C10 3 6.5 3.5 7 5.5S12 7 12 7s4.5-.5 5-1.5S14 3 12 7z"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2z"/><path d="M4 21V5"/><path d="M8 7h6"/>',
  tech: '<rect x="5" y="2" width="14" height="20" rx="3"/><path d="M11 18h2"/>',
  music: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  cup: '<path d="M4 8h13v5a6 6 0 0 1-6 6h-1a6 6 0 0 1-6-6z"/><path d="M17 10h1.5a2.5 2.5 0 0 1 0 5H17M8 2v3M12 2v3"/>',
  puzzle: '<path d="M4 7h4a2 2 0 1 1 4 0h4v4a2 2 0 1 1 0 4v4h-4a2 2 0 1 0-4 0H4v-4a2 2 0 1 0 0-4z"/>',
  shirt: '<path d="m8 3-5 3 2 4 2-1v12h10V9l2 1 2-4-5-3a4 4 0 0 1-8 0z"/>',
  ticket: '<path d="M3 8a2 2 0 0 0 0 4v0a2 2 0 0 1 0 4v2h18v-2a2 2 0 0 1 0-4 2 2 0 0 0 0-4V6H3z"/><path d="M14 6v12" stroke-dasharray="2 2"/>',
  camera: '<path d="M4 7h3l2-3h6l2 3h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="4"/>',
  wine: '<path d="M8 2h8l-.4 6.5a3.6 3.6 0 0 1-7.2 0z"/><path d="M12 12v9M8 21h8"/>',
  heart: '<path d="M12 20.5s-8-4.7-8-10.6A4.4 4.4 0 0 1 12 7.3a4.4 4.4 0 0 1 8 2.6c0 5.9-8 10.6-8 10.6z"/>',
  cart: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.6 12.4a2 2 0 0 0 2 1.6h8.2a2 2 0 0 0 2-1.5L21.5 8H6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  arrow: '<path d="M7 17 17 7M9 7h8v8"/>',
  link: '<path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  eyeoff: '<path d="M3 3l18 18M10.6 5.1A9.8 9.8 0 0 1 12 5c6 0 9.5 7 9.5 7a17 17 0 0 1-3 3.8M6.6 6.6A16.6 16.6 0 0 0 2.5 12S6 19 12 19a9.6 9.6 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
};
const icon = (name, cls = "") =>
  `<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" class="${cls}">${ICON_PATHS[name] ?? ICON_PATHS.gift}</svg>`;
const categoryIcon = (id) => categoryById.get(id)?.icon ?? "gift";

const CATEGORY_HUES = [16, 262, 145, 38, 200, 330, 225, 95, 280, 185];
const categoryHue = (id) => CATEGORY_HUES[Math.max(0, data.categories.findIndex((c) => c.id === id)) % CATEGORY_HUES.length];

/* ---------- Priority & budget ---------- */

const PRIORITY = {
  1: { label: "Top-Wunsch", short: "Top" },
  2: { label: "Würde mich sehr freuen", short: "Gern" },
  3: { label: "Kleine Freude", short: "Klein" },
};
const priorityOf = (item) => item.priority ?? 2;
const hearts = (item) => 4 - priorityOf(item);

const BUDGETS = [
  { id: "u25", label: "Bis CHF 25", test: (p) => p <= 25 },
  { id: "u50", label: "CHF 25–50", test: (p) => p > 25 && p <= 50 },
  { id: "u100", label: "CHF 50–100", test: (p) => p > 50 && p <= 100 },
  { id: "o100", label: "Über CHF 100", test: (p) => p > 100 },
];
const budgetById = new Map(BUDGETS.map((b) => [b.id, b]));
// Budget filters only help once enough wishes carry a price.
const budgetsUseful = () => data.items.filter((i) => priceOf(i) !== null).length >= 3;

// Cheapest known price: shop-specific prices win over the item's own estimate.
function priceOf(item) {
  const prices = (item.shops ?? []).map((s) => s.price).filter((p) => typeof p === "number");
  if (typeof item.price === "number") prices.push(item.price);
  return prices.length ? Math.min(...prices) : null;
}
const priceText = (item) => {
  const p = priceOf(item);
  return p === null ? "" : `${item.priceFrom || (item.shops?.length ?? 0) > 1 ? "ab " : "ca. "}${chf(p)}`;
};

/* ---------- Reservations ("Ich besorge das") ---------- */
// Stored in a Google Sheet via a small Apps Script (tools/reservations.gs).
// Keys carry the year, so last year's reservations don't block this year's list.

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} },
};

const res = {
  url: "",
  status: "off", // off | loading | ready | error
  list: {},
  busy: false,
  message: "",
  token: store.get("wishlist:token"),
  mine: new Set(JSON.parse(store.get("wishlist:mine") || "[]")),
};
if (!res.token) {
  res.token = (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}-${Math.random()}`).replace(/[^\w-]/g, "");
  store.set("wishlist:token", res.token);
}

// The owner shouldn't see what has been reserved: "#ich" switches that off in their browser.
const isOwner = () => store.get("wishlist:owner") === "1";
const resKey = (item) => `${data.year}:${item.id}`;
const resActive = () => res.url && !isOwner();
const reservation = (item) => (resActive() && res.status === "ready" ? res.list[resKey(item)] ?? null : null);
const isMine = (item) => res.mine.has(resKey(item));

function saveMine() { store.set("wishlist:mine", JSON.stringify([...res.mine])); }

async function loadReservations() {
  if (!resActive()) return;
  if (res.status !== "ready") res.status = "loading";
  try {
    const r = await fetch(`${res.url}?action=list&t=${Date.now()}`);
    const json = await r.json();
    if (!json.ok) throw new Error(json.error);
    res.list = json.reservations ?? {};
    res.status = "ready";
    // Forget own reservations the owner cleared in the sheet.
    res.mine.forEach((k) => !res.list[k] && res.mine.delete(k));
    saveMine();
  } catch (err) {
    console.error(err);
    if (res.status !== "ready") res.status = "error";
  }
  rerender();
}

async function changeReservation(item, action, name = "") {
  res.busy = true;
  res.message = "";
  rerender();
  const key = resKey(item);
  try {
    // text/plain keeps this a "simple" request, which Apps Script accepts cross-origin.
    const r = await fetch(res.url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action, key, name, token: res.token }),
    });
    const json = await r.json();
    if (json.ok || json.error === "already-yours") {
      action === "reserve" ? res.mine.add(key) : res.mine.delete(key);
      saveMine();
      if (action === "reserve" && name) store.set("wishlist:name", name);
      res.message = action === "reserve" ? "reserved" : "released";
    } else {
      res.message = json.error === "taken" ? "taken" : json.error === "not-yours" ? "not-yours" : "failed";
    }
  } catch (err) {
    console.error(err);
    res.message = "failed";
  }
  res.busy = false;
  await loadReservations();
}

function rerender() {
  const m = location.hash.match(/^#\/(.+)$/);
  const item = m && itemById.get(decodeURIComponent(m[1]));
  if (item && !$("#detail-view").hidden) renderDetail(item, { keepScroll: true });
  else if (!$("#list-view").hidden) renderList();
}

/* ---------- Images (from the shop; placeholder tile otherwise) ---------- */

function thumb(item, cls = "") {
  const taken = reservation(item);
  return `<div class="thumb ${cls} ${taken ? "is-reserved" : ""}" style="--h:${hue(item.id)}">
    <div class="thumb__ph">${icon(categoryIcon(item.category))}<span>${esc(item.title)}</span></div>
    ${item.image ? `<img class="thumb__img" src="${esc(item.image)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onload="this.parentNode.classList.add('has-img')" onerror="this.remove()">` : ""}
    ${taken
      ? `<span class="thumb__badge thumb__badge--done">${icon(isMine(item) ? "check" : "lock")} ${isMine(item) ? "Von dir reserviert" : "Reserviert"}</span>`
      : priorityOf(item) === 1 ? `<span class="thumb__badge">${icon("heart")} Top-Wunsch</span>` : ""}
  </div>`;
}

/* ---------- URL state ---------- */
// "#/<id>" is a detail page; anything else is the list with its filters.

function readHash() {
  const p = new URLSearchParams(location.hash.slice(1));
  state.category = categoryById.has(p.get("c")) ? p.get("c") : "all";
  state.budget = budgetById.has(p.get("b")) ? p.get("b") : "all";
  state.query = p.get("q") || "";
  state.sort = p.get("sort") || "priority";
  state.view = p.get("view") || "shelves";
  state.free = p.get("frei") === "1";
}

function stateToHash() {
  const p = new URLSearchParams();
  if (state.category !== "all") p.set("c", state.category);
  if (state.budget !== "all") p.set("b", state.budget);
  if (state.query) p.set("q", state.query);
  if (state.sort !== "priority") p.set("sort", state.sort);
  if (state.view !== "shelves") p.set("view", state.view);
  if (state.free) p.set("frei", "1");
  return p.toString();
}

function writeHash() {
  listHash = stateToHash();
  history.replaceState(null, "", listHash ? `#${listHash}` : location.pathname + location.search);
}

/* ---------- Filtering ---------- */

const inBudget = (item, id = state.budget) => {
  if (id === "all") return true;
  const p = priceOf(item);
  return p !== null && budgetById.get(id).test(p);
};
const inCategory = (item, id = state.category) => id === "all" || item.category === id;

function haystack(item) {
  return (item._hay ??= normalize(
    [item.title, item.brand, item.note, item.size, item.color, categoryLabel(item.category),
      ...(item.shops ?? []).map((s) => s.name)].filter(Boolean).join(" ")
  ));
}
const matchesQuery = (item) =>
  !state.query || normalize(state.query).split(/\s+/).filter(Boolean).every((w) => haystack(item).includes(w));
const matches = (item) => inCategory(item) && inBudget(item) && matchesQuery(item) && !(state.free && reservation(item));

const byPrice = (dir) => (a, b) => ((priceOf(a) ?? 1e9) - (priceOf(b) ?? 1e9)) * dir;
// Reserved wishes always go to the end, so the free ones are seen first.
const freeFirst = (sort) => (a, b) => Boolean(reservation(a)) - Boolean(reservation(b)) || sort(a, b);
const sorters = {
  priority: (a, b) => priorityOf(a) - priorityOf(b) || byPrice(1)(a, b),
  "price-asc": byPrice(1),
  "price-desc": (a, b) => (priceOf(b) ?? -1) - (priceOf(a) ?? -1),
  title: (a, b) => a.title.localeCompare(b.title, "de"),
};

/* ---------- Building blocks ---------- */

function card(item) {
  const shop = item.shops?.[0]?.name;
  return `<a class="wish ${reservation(item) ? "is-reserved" : ""}" href="#/${item.id}">
    ${thumb(item)}
    <div>
      <h3 class="wish__title">${esc(item.title)}</h3>
      ${item.brand ? `<p class="wish__brand">${esc(item.brand)}</p>` : ""}
      <div class="wish__meta">
        ${priceText(item) ? `<span class="price">${priceText(item)}</span>` : ""}
        ${shop ? `<span class="wish__shop">${esc(shop)}${item.shops.length > 1 ? ` +${item.shops.length - 1}` : ""}</span>` : ""}
      </div>
    </div>
  </a>`;
}

function shelf(title, items, { hue: h, category } = {}) {
  return `<section class="shelf">
    <div class="shelf__head">
      <h2>${h !== undefined ? `<span class="dot" style="--h:${h}"></span>` : ""}${esc(title)}</h2>
      ${category && items.length > 3 ? `<button type="button" class="link-btn" data-show-category="${category}">Alle ${items.length} anzeigen</button>` : ""}
    </div>
    <div class="shelf__row">${items.map(card).join("")}</div>
  </section>`;
}

const wishCount = (n) => `${n} ${n === 1 ? "Wunsch" : "Wünsche"}`;

/* ---------- List rendering ---------- */

function renderSidebar() {
  const pool = data.items.filter((i) => inBudget(i));
  $("#categories").innerHTML = [{ id: "all", label: "Alle Wünsche", icon: "all" }, ...data.categories]
    .map((c) => {
      const n = pool.filter((i) => inCategory(i, c.id)).length;
      if (!n && c.id !== "all" && state.category !== c.id) return "";
      return `<button type="button" role="tab" data-category="${c.id}" aria-selected="${state.category === c.id}">
        ${icon(c.icon)}<span>${esc(c.label)}</span><span class="n">${n}</span>
      </button>`;
    })
    .join("");

  $("#budgets").parentElement.hidden = !budgetsUseful() && state.budget === "all";
  const inCat = data.items.filter((i) => inCategory(i));
  $("#budgets").innerHTML = [{ id: "all", label: "Jedes Budget" }, ...BUDGETS]
    .map((b, idx) => `<button type="button" class="topic" data-budget="${b.id}" aria-pressed="${state.budget === b.id}">
        <span class="dot" style="--h:${[200, 145, 95, 38, 16][idx]}"></span>${esc(b.label)}<span class="n">${inCat.filter((i) => inBudget(i, b.id)).length}</span>
      </button>`)
    .join("");
  $("#feature").setAttribute("aria-current", state.category === "all" && state.budget === "all" && !state.query ? "true" : "false");
}

function renderStale() {
  // An old list should say so, so nobody buys from last year's wishes.
  const now = new Date().getFullYear();
  $("#stale").innerHTML = (data.year < now
    ? `<div class="notice">${icon("info")}<span>Diese Liste ist von ${data.year} – fragt ${esc(data.owner)} am besten kurz nach, ob sie noch aktuell ist.</span></div>`
    : "") + ownerNotice() + (resActive() && res.status === "error"
    ? `<div class="notice">${icon("info")}<span>Reservierungen konnten gerade nicht geladen werden.</span><button type="button" class="btn" data-action="retry">Nochmals versuchen</button></div>`
    : "");
}

const ownerNotice = () => res.url && isOwner()
  ? `<div class="notice notice--owner">${icon("eyeoff")}<span>Überraschungsmodus: Du siehst nicht, was schon reserviert ist.</span><button type="button" class="btn" data-action="owner-off">Reservierungen anzeigen</button></div>`
  : "";

function renderHero() {
  const hero = $("#hero");
  if (state.query || state.category !== "all" || state.budget !== "all") {
    hero.hidden = true;
    return;
  }
  const top = [...data.items].sort(freeFirst(sorters.priority));
  const pick = top.find((i) => i.image) ?? top[0];
  hero.hidden = false;
  hero.innerHTML = `
    <div>
      <span class="eyebrow">${icon("gift")} Weihnachten & Geburtstag ${data.year}</span>
      <h2>${esc(title())}</h2>
      <p class="hero__summary">${esc(data.intro ?? "")}</p>
      ${data.notes?.length ? `<dl class="facts facts--hero">${data.notes.map((n) =>
        `<div><dt>${esc(n.label)}</dt><dd>${esc(n.value)}</dd></div>`).join("")}</dl>` : ""}
      <div class="hero__actions">
        <span class="stamp">${icon("info")} Stand: ${dateLabel(data.updated)}</span>
        <span class="hero__count">${wishCount(data.items.length)}${res.status === "ready" && resActive()
          ? ` · ${data.items.filter((i) => !reservation(i)).length} noch frei` : ""}</span>
      </div>
    </div>
    ${pick ? `<a class="hero__cover" href="#/${pick.id}" tabindex="-1" aria-hidden="true">${thumb(pick)}</a>` : ""}`;
}

function listTitle() {
  if (state.query) return `Suche: „${state.query}“`;
  const parts = [];
  parts.push(state.category === "all" ? "Alle Wünsche" : categoryLabel(state.category));
  if (state.budget !== "all") parts.push(budgetById.get(state.budget).label);
  return parts.join(" · ");
}

function renderResults() {
  const list = data.items.filter(matches).sort(freeFirst(sorters[state.sort] ?? sorters.priority));
  $("#list-title").textContent = listTitle();
  const taken = list.filter((i) => reservation(i)).length;
  $("#count").textContent = `${wishCount(list.length)}${taken ? ` · ${taken} reserviert` : ""}`;
  const freeBtn = $("#free-toggle");
  freeBtn.hidden = !resActive() || res.status !== "ready";
  freeBtn.setAttribute("aria-pressed", state.free);

  if (!list.length) {
    $("#results").innerHTML = `<div class="empty">
      <p>Keine Wünsche für diese Auswahl.</p>
      <button type="button" class="btn" data-action="reset">Filter zurücksetzen</button>
    </div>`;
    return;
  }

  if (state.view === "grid" || state.category !== "all" || state.query) {
    $("#results").innerHTML = `<div class="grid">${list.map(card).join("")}</div>`;
    return;
  }
  $("#results").innerHTML = data.categories
    .map((c) => ({ c, items: list.filter((i) => i.category === c.id) }))
    .filter((g) => g.items.length)
    .map(({ c, items }) => shelf(c.label, items, { hue: categoryHue(c.id), category: c.id }))
    .join("");
}

function renderRail() {
  const top = data.items.filter((i) => priorityOf(i) === 1 && !reservation(i)).sort(sorters.priority).slice(0, 5);
  const counts = BUDGETS.map((b) => ({ b, n: data.items.filter((i) => inBudget(i, b.id)).length }));
  const max = Math.max(1, ...counts.map((c) => c.n));
  $("#rail").innerHTML = `
    ${top.length ? `<div class="rail__card">
      <h2>Top-Wünsche</h2>
      <ol class="toplist">${top.map((i) => `<li><a href="#/${i.id}">
        ${thumb(i, "thumb--mini")}
        <div><strong>${esc(i.title)}</strong><span>${esc(priceText(i) || i.brand || "")}</span></div>
      </a></li>`).join("")}</ol>
    </div>` : ""}
    ${budgetsUseful() ? `<div class="rail__card">
      <h2>Nach Budget</h2>
      <div class="mix">${counts.map(({ b, n }) => `<button type="button" class="mix__row" data-budget="${b.id}">
        <span>${esc(b.label.replace("CHF ", ""))}</span><span class="mix__bar"><i style="width:${(n / max) * 100}%"></i></span><span>${n}</span>
      </button>`).join("")}</div>
    </div>` : ""}
    <div class="rail__card rail__card--soft">
      <h2>So geht's</h2>
      <p class="rail__text">${resActive()
        ? "Wunsch anklicken und „Ich besorge das“ wählen – dann sehen die anderen, dass er schon vergeben ist. " + esc(data.owner) + " sieht das nicht."
        : "Damit nichts doppelt geschenkt wird: sprecht euch kurz untereinander ab, wer was besorgt."}</p>
    </div>`;
}

function renderList() {
  renderSidebar();
  renderStale();
  renderHero();
  renderResults();
  renderRail();
  document.querySelectorAll("[data-view]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.view === state.view));
  $("#sort").value = state.sort;
  if ($("#search").value !== state.query) $("#search").value = state.query;
  writeHash();
}

/* ---------- Detail page ---------- */

function relatedItems(item) {
  const ids = new Set(item.related ?? []);
  data.items.forEach((o) => o.related?.includes(item.id) && ids.add(o.id));
  ids.delete(item.id);
  return [...ids].map((id) => itemById.get(id)).filter(Boolean);
}

function renderDetail(item, { keepScroll = false } = {}) {
  const related = relatedItems(item);
  const skip = new Set([item.id, ...related.map((r) => r.id)]);
  const more = data.items.filter((o) => o.category === item.category && !skip.has(o.id)).sort(sorters.priority);
  const p = PRIORITY[priorityOf(item)];
  const heartsHtml = Array.from({ length: 3 }, (_, i) => icon("heart", i < hearts(item) ? "" : "off")).join("");
  const facts = [
    priceText(item) && ["Preis", priceText(item)],
    item.size && ["Grösse", item.size],
    item.color && ["Farbe", item.color],
    item.quantity && ["Anzahl", item.quantity],
  ].filter(Boolean);
  const shops = item.shops ?? [];

  $("#page").innerHTML = `
    <section class="page__hero">
      <div class="page__cover">${thumb(item, "thumb--big")}</div>
      <div>
        <div class="pills"><a class="type-pill" href="#c=${item.category}">${icon(categoryIcon(item.category))} ${esc(categoryLabel(item.category))}</a></div>
        <h1>${esc(item.title)}</h1>
        ${item.brand ? `<p class="page__subtitle">${esc(item.brand)}</p>` : ""}
        <div class="page__rating" aria-label="Wichtigkeit: ${p.label}">${heartsHtml}<b>${p.label}</b></div>
        ${facts.length ? `<dl class="facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>` : ""}
        ${item.note ? `<p class="page__note">${icon("info")}<span>${esc(item.note)}</span></p>` : ""}
        <div class="page__actions">
          ${shops.map((s, i) => `<a class="btn ${i === 0 ? "btn--primary" : ""}" href="${esc(s.url)}" target="_blank" rel="noopener">
            ${icon("cart")} ${i === 0 ? "Bei " : ""}${esc(s.name)}${typeof s.price === "number" ? ` · ${chf(s.price)}` : ""} ${icon("arrow")}</a>`).join("")}
          <button type="button" class="btn" data-action="share">${icon("link")} Link kopieren</button>
        </div>
        ${shops.length ? `<p class="page__hint">Preise sind ungefähr – im Shop gilt der aktuelle Preis.</p>` : ""}
        ${reserveBox(item)}
      </div>
    </section>

    ${related.length ? shelf("Passt dazu", related) : ""}
    ${more.length ? shelf(`Mehr aus „${categoryLabel(item.category)}“`, more) : ""}`;

  document.title = `${item.title} · ${title()}`;
  $("#back").href = `#${listHash}`;
  if (!keepScroll) res.message = "";
}

const RES_MESSAGES = {
  reserved: "Danke! Der Wunsch ist jetzt für dich reserviert.",
  released: "Reservierung aufgehoben – der Wunsch ist wieder frei.",
  taken: "Da war jemand schneller – dieser Wunsch ist schon reserviert.",
  "not-yours": "Diese Reservierung wurde in einem anderen Browser gemacht und kann nur dort aufgehoben werden.",
  failed: "Das hat leider nicht geklappt. Bitte versuch es nochmals.",
};

function reserveBox(item) {
  if (!res.url) return "";
  if (isOwner()) return `<div class="reserve reserve--muted">${icon("eyeoff")}<p>Überraschungsmodus – Reservierungen sind ausgeblendet.</p></div>`;
  const msg = res.message ? `<p class="reserve__msg">${esc(RES_MESSAGES[res.message] ?? "")}</p>` : "";
  if (res.status === "loading" || res.status === "off") return `<div class="reserve reserve--muted"><p>Reservierungen werden geladen …</p></div>`;
  if (res.status === "error") return `<div class="reserve reserve--muted"><p>Reservierungen konnten nicht geladen werden.</p>
    <button type="button" class="btn" data-action="retry">Nochmals versuchen</button></div>`;

  const r = reservation(item);
  if (r && isMine(item)) {
    return `<div class="reserve reserve--mine">
      <div class="reserve__head">${icon("check")}<div><strong>Du besorgst das.</strong><p>Die anderen sehen, dass der Wunsch vergeben ist – ${esc(data.owner)} nicht.</p></div></div>
      ${msg}
      <button type="button" class="btn" data-action="release" ${res.busy ? "disabled" : ""}>Reservierung aufheben</button>
    </div>`;
  }
  if (r) {
    return `<div class="reserve reserve--taken">
      <div class="reserve__head">${icon("lock")}<div><strong>Schon reserviert${r.name ? ` von ${esc(r.name)}` : ""}.</strong>
      <p>Diesen Wunsch besorgt schon jemand – such dir am besten einen anderen aus.</p></div></div>
      ${msg}
    </div>`;
  }
  return `<form class="reserve" data-reserve>
    <div class="reserve__head">${icon("gift")}<div><strong>Möchtest du das schenken?</strong>
    <p>Reserviere den Wunsch, damit ihn niemand doppelt kauft. ${esc(data.owner)} sieht nicht, wer was reserviert hat.</p></div></div>
    ${msg}
    <div class="reserve__row">
      <input name="name" maxlength="40" autocomplete="given-name" placeholder="Dein Name (optional)" value="${esc(store.get("wishlist:name") ?? "")}" aria-label="Dein Name (optional)">
      <button type="submit" class="btn btn--primary" ${res.busy ? "disabled" : ""}>${icon("gift")} ${res.busy ? "Einen Moment …" : "Ich besorge das"}</button>
    </div>
  </form>`;
}

/* ---------- Routing ---------- */

const title = () => `${data.owner}s Wunschliste ${data.year}`;

function route() {
  if (location.hash === "#ich") {
    store.set("wishlist:owner", "1");
    history.replaceState(null, "", location.pathname + location.search);
  }
  const m = location.hash.match(/^#\/(.+)$/);
  const item = m && itemById.get(decodeURIComponent(m[1]));
  const detail = Boolean(item);
  const wasDetail = $("#list-view").hidden;

  if (detail) {
    if (!wasDetail) listScroll = scrollY;
    renderSidebar();
    renderDetail(item);
    window.scrollTo(0, 0);
  } else {
    readHash();
    renderList();
    document.title = title();
    if (wasDetail) requestAnimationFrame(() => window.scrollTo(0, listScroll));
  }
  $("#list-view").hidden = detail;
  $("#detail-view").hidden = !detail;
  $(".app").classList.toggle("is-detail", detail);
}

/* ---------- Events ---------- */

function goList() {
  if (!$("#list-view").hidden) return renderList();
  location.hash = stateToHash() || "alle";
}

function bind() {
  window.addEventListener("hashchange", route);

  $("#categories").addEventListener("click", (e) => {
    const b = e.target.closest("[data-category]");
    if (!b) return;
    state.category = b.dataset.category;
    goList();
  });

  const pickBudget = (e) => {
    const b = e.target.closest("[data-budget]");
    if (!b) return;
    state.budget = state.budget === b.dataset.budget ? "all" : b.dataset.budget;
    goList();
  };
  $("#budgets").addEventListener("click", pickBudget);
  $("#rail").addEventListener("click", pickBudget);

  let t;
  $("#search").addEventListener("input", (e) => {
    clearTimeout(t);
    t = setTimeout(() => { state.query = e.target.value.trim(); goList(); }, 150);
  });

  $("#sort").addEventListener("change", (e) => { state.sort = e.target.value; renderList(); });

  document.querySelectorAll("[data-view]").forEach((b) =>
    b.addEventListener("click", () => { state.view = b.dataset.view; renderList(); })
  );

  $("#feature").addEventListener("click", (e) => {
    e.preventDefault();
    Object.assign(state, { category: "all", budget: "all", query: "" });
    goList();
  });

  $("#results").addEventListener("click", (e) => {
    const show = e.target.closest("[data-show-category]");
    if (show) {
      state.category = show.dataset.showCategory;
      renderList();
      window.scrollTo({ top: $(".toolbar").offsetTop - 16, behavior: "smooth" });
      return;
    }
    if (!e.target.closest("[data-action=reset]")) return;
    Object.assign(state, { category: "all", budget: "all", query: "" });
    renderList();
  });

  $("#page").addEventListener("submit", (e) => {
    const form = e.target.closest("[data-reserve]");
    if (!form || res.busy) return;
    e.preventDefault();
    const item = itemById.get(decodeURIComponent(location.hash.slice(2)));
    if (item) changeReservation(item, "reserve", form.elements.name.value.trim());
  });

  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-action=release],[data-action=retry],[data-action=owner-off]");
    if (!b) return;
    if (b.dataset.action === "retry") { res.status = "loading"; rerender(); return loadReservations(); }
    if (b.dataset.action === "owner-off") {
      if (!confirm("Damit siehst du, welche Wünsche schon reserviert sind – die Überraschung ist dann weg. Trotzdem anzeigen?")) return;
      store.set("wishlist:owner", null);
      res.status = "loading";
      rerender();
      return loadReservations();
    }
    const item = itemById.get(decodeURIComponent(location.hash.slice(2)));
    if (item && !res.busy && confirm("Reservierung wirklich aufheben?")) changeReservation(item, "release");
  });

  $("#free-toggle").addEventListener("click", () => { state.free = !state.free; renderList(); });

  // Pick up reservations others made while this tab was in the background.
  document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && loadReservations());

  $("#page").addEventListener("click", async (e) => {
    const share = e.target.closest("[data-action=share]");
    if (!share) return;
    try { await navigator.clipboard.writeText(location.href); share.lastChild.textContent = " Kopiert"; }
    catch { share.lastChild.textContent = ` ${location.href}`; }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && document.activeElement.tagName !== "INPUT") {
      e.preventDefault();
      $("#search").focus();
    }
    if (e.key === "Escape" && !$("#detail-view").hidden) location.hash = listHash || "alle";
  });

  const root = document.documentElement;
  const applyTheme = (v) => (v ? root.setAttribute("data-theme", v) : root.removeAttribute("data-theme"));
  try { applyTheme(localStorage.getItem("theme")); } catch {}
  document.querySelectorAll("[data-theme-toggle]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const isDark = root.dataset.theme
        ? root.dataset.theme === "dark"
        : matchMedia("(prefers-color-scheme: dark)").matches;
      const next = isDark ? "light" : "dark";
      applyTheme(next);
      try { localStorage.setItem("theme", next); } catch {}
    })
  );
}

async function init() {
  try {
    const version = new URL(import.meta.url).searchParams.get("v") ?? "";
    const res = await fetch(`data/wishlist.json?v=${version}`);
    data = await res.json();
  } catch (err) {
    $("#results").innerHTML = `<div class="empty"><p>Die Wunschliste konnte nicht geladen werden.</p></div>`;
    console.error(err);
    return;
  }
  data.categories.forEach((c) => categoryById.set(c.id, c));
  data.items.forEach((i) => itemById.set(i.id, i));

  $("#brand-name").textContent = "Wunschliste";
  $("#feature-title").textContent = title();
  $("#feature-date").textContent = `Stand: ${dateLabel(data.updated)}`;
  $("#footer").innerHTML = `${esc(title())} · Bilder und Preise von den jeweiligen Shops, Stand ${dateLabel(data.updated)}`;

  res.url = data.reservations?.url ?? "";

  bind();
  route();
  loadReservations();
}

init();
