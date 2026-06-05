// Main console app. Orchestrates engine, editor, tabs, scenarios, history.

import { engine } from "/platform/lib/sqlite-engine.js";
import { SqlEditor } from "/platform/lib/editor.js";
import { renderResults, renderError } from "/platform/lib/results.js";
import { renderSchemaPanel } from "/platform/lib/schema-panel.js";
import {
  saveHistoryEntry, renderHistory, saveTabs, loadTabs,
} from "/platform/lib/history.js";
import {
  loadRegistry, loadScenarioManifest, getScenarioIdFromUrl, setScenarioIdInUrl,
} from "/platform/lib/scenarios.js";
import { renderSiteNav } from "/platform/lib/site-nav.js";

const $ = (id) => document.getElementById(id);

const state = {
  scenarioId: null,
  manifest: null,
  tabs: new Map(), // tabId -> {sqlEditor, sql, name}
  currentTabId: null,
  nextTabId: 1,
};

renderSiteNav($("site-nav-inline"), "console");

// ---------- Engine boot ----------
const engineStatus = $("engine-status");
const dbStatus = $("db-status");

(async function bootEngine() {
  try {
    await engine.ready();
    engineStatus.textContent = "Engine: ready";
    engineStatus.classList.remove("status-muted");
    engineStatus.classList.add("status-ok");
  } catch (e) {
    engineStatus.textContent = "Engine: failed to load";
    engineStatus.classList.add("status-error");
    console.error(e);
  }
})();

// ---------- Scenario picker ----------
const scenarioSelect = $("scenario-select");
const scenarioMeta = $("scenario-meta");
const scenarioTitle = $("scenario-title");
const scenarioDifficulty = $("scenario-difficulty");
const scenarioCategory = $("scenario-category");
const scenarioDescription = $("scenario-description");
const scenarioInstructionsLink = $("scenario-instructions");

(async function populateScenarios() {
  const registry = await loadRegistry();
  const fragment = document.createDocumentFragment();
  for (const s of registry.scenarios) {
    const opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = `${s.title} (${s.difficulty})`;
    fragment.appendChild(opt);
  }
  scenarioSelect.appendChild(fragment);

  scenarioSelect.addEventListener("change", () => {
    const id = scenarioSelect.value;
    setScenarioIdInUrl(id || null);
    if (id) loadScenario(id);
  });

  const initialId = getScenarioIdFromUrl();
  if (initialId) {
    scenarioSelect.value = initialId;
    loadScenario(initialId);
  }
})();

async function loadScenario(scenarioId) {
  dbStatus.textContent = `Loading ${scenarioId}…`;
  dbStatus.classList.remove("status-ok", "status-error");
  dbStatus.classList.add("status-muted");

  const manifest = await loadScenarioManifest(scenarioId);
  if (!manifest) {
    dbStatus.textContent = `Failed to load manifest for ${scenarioId}`;
    dbStatus.classList.add("status-error");
    return;
  }

  state.scenarioId = scenarioId;
  state.manifest = manifest;

  // Show meta
  scenarioMeta.hidden = false;
  scenarioTitle.textContent = manifest.title;
  scenarioDifficulty.textContent = manifest.difficulty || "";
  scenarioDifficulty.dataset.level = (manifest.difficulty || "").toLowerCase();
  scenarioCategory.textContent = manifest.category || "";
  scenarioDescription.hidden = !manifest.short_description;
  scenarioDescription.textContent = manifest.short_description || "";
  if (manifest.instructions) {
    scenarioInstructionsLink.hidden = false;
    scenarioInstructionsLink.href = `/scenarios/${scenarioId}/${manifest.instructions}`;
  } else {
    scenarioInstructionsLink.hidden = true;
  }

  // Load DB
  try {
    const dbUrl = `/scenarios/${scenarioId}/${manifest.data}`;
    await engine.loadFromUrl(dbUrl);
    dbStatus.textContent = `DB: ${manifest.data} loaded`;
    dbStatus.classList.remove("status-error", "status-muted");
    dbStatus.classList.add("status-ok");

    // Auto-create indexes
    if (manifest.indexes && Array.isArray(manifest.indexes) && manifest.primary_table) {
      const n = engine.ensureIndexes(manifest.primary_table, manifest.indexes);
      console.log(`Created/verified ${n} indexes on ${manifest.primary_table}`);
    }

    // Render sidebar content
    refreshSchemaPanel();
    refreshHints();
    refreshSamples();
    refreshHistory();

    // Restore or create tabs
    const restored = loadTabs(scenarioId);
    if (restored && restored.length > 0) {
      // Clear current tabs
      state.tabs.forEach((_, id) => removeTabDom(id));
      state.tabs.clear();
      state.nextTabId = 1;
      for (const t of restored) {
        await createTab({ name: t.name, sql: t.sql });
      }
    } else {
      state.tabs.forEach((_, id) => removeTabDom(id));
      state.tabs.clear();
      state.nextTabId = 1;
      await createTab({ name: "Scratch", sql: "" });
    }
  } catch (e) {
    dbStatus.textContent = `Error: ${e.message}`;
    dbStatus.classList.add("status-error");
    console.error(e);
  }
}

// ---------- Custom DB upload ----------
$("upload-db-btn").addEventListener("click", () => $("db-file-input").click());
$("db-file-input").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  dbStatus.textContent = `Loading ${file.name}…`;
  dbStatus.classList.remove("status-ok", "status-error");
  try {
    const buf = await file.arrayBuffer();
    await engine.loadFromArrayBuffer(buf, file.name);
    dbStatus.textContent = `DB: ${file.name} (uploaded)`;
    dbStatus.classList.add("status-ok");

    // Reset scenario meta since this is an ad-hoc DB
    state.scenarioId = `custom:${file.name}`;
    state.manifest = null;
    scenarioMeta.hidden = false;
    scenarioTitle.textContent = `Custom upload: ${file.name}`;
    scenarioDifficulty.textContent = "custom";
    scenarioCategory.textContent = "ad-hoc";
    scenarioDescription.hidden = true;
    scenarioInstructionsLink.hidden = true;

    refreshSchemaPanel();
    refreshHints();
    refreshSamples();
    refreshHistory();
    if (state.tabs.size === 0) await createTab({ name: "Scratch", sql: "" });
  } catch (err) {
    dbStatus.textContent = `Error: ${err.message}`;
    dbStatus.classList.add("status-error");
  } finally {
    e.target.value = "";
  }
});

// ---------- Sidebar tab switching ----------
document.querySelectorAll(".sidebar-tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.sideTab;
    document.querySelectorAll(".sidebar-tab").forEach((b) => b.classList.toggle("active", b === btn));
    document.querySelectorAll(".sidebar-panel").forEach((p) => {
      p.hidden = p.id !== `side-panel-${target}`;
    });
  });
});

function refreshSchemaPanel() {
  const tables = engine.schema();
  const hints = state.manifest?.schema_hints || {};
  renderSchemaPanel($("schema-content"), tables, hints);
  // Update editor autocomplete
  state.tabs.forEach((tab) => tab.sqlEditor?.updateSchema(tables));
}

function refreshHints() {
  const el = $("hints-content");
  const hints = state.manifest?.hints || [];
  if (hints.length === 0) {
    el.innerHTML = '<p class="hints-empty">This scenario provides no progressive hints.</p>';
    return;
  }
  el.innerHTML = "";
  const note = document.createElement("p");
  note.className = "hints-note";
  note.textContent = "Hints are progressive — try to solve it on your own first.";
  el.appendChild(note);
  hints.forEach((h, i) => {
    const wrap = document.createElement("details");
    wrap.className = "hint-detail";
    const summary = document.createElement("summary");
    summary.textContent = `Hint ${i + 1}` + (h.label ? ` — ${h.label}` : "");
    wrap.appendChild(summary);
    const body = document.createElement("div");
    body.className = "hint-body";
    body.textContent = h.text;
    wrap.appendChild(body);
    el.appendChild(wrap);
  });
}

function refreshSamples() {
  const el = $("samples-content");
  const samples = state.manifest?.sample_queries || [];
  if (samples.length === 0) {
    el.innerHTML = '<p class="samples-empty">No sample queries for this scenario.</p>';
    return;
  }
  el.innerHTML = "";
  const note = document.createElement("p");
  note.className = "samples-note";
  note.textContent = "Click any sample to load it into the current tab.";
  el.appendChild(note);
  samples.forEach((s) => {
    const card = document.createElement("div");
    card.className = "sample-card";
    const h = document.createElement("h4");
    h.textContent = s.title;
    const p = document.createElement("p");
    p.className = "sample-desc";
    p.textContent = s.description || "";
    const code = document.createElement("pre");
    code.className = "sample-sql";
    code.textContent = s.sql;
    code.addEventListener("click", () => loadIntoCurrentTab(s.sql));
    card.appendChild(h);
    if (s.description) card.appendChild(p);
    card.appendChild(code);
    el.appendChild(card);
  });
}

function refreshHistory() {
  renderHistory($("history-content"), state.scenarioId, (sql) => loadIntoCurrentTab(sql));
}

function loadIntoCurrentTab(sql) {
  const tab = state.tabs.get(state.currentTabId);
  if (!tab) return;
  tab.sqlEditor.setValue(sql);
  tab.sqlEditor.focus();
}

// ---------- Tabs ----------
const tabsHeader = $("tabs-header");
const tabsContainer = $("tabs-container");
const addTabBtn = $("add-tab-btn");

addTabBtn.addEventListener("click", () => createTab());

document.addEventListener("keydown", (e) => {
  // Cmd/Ctrl+T to new tab
  if ((e.metaKey || e.ctrlKey) && e.key === "t" && !e.shiftKey) {
    e.preventDefault();
    createTab();
  }
  // Cmd/Ctrl+W to close current tab
  if ((e.metaKey || e.ctrlKey) && e.key === "w" && !e.shiftKey) {
    if (state.currentTabId && state.tabs.size > 1) {
      e.preventDefault();
      closeTab(state.currentTabId);
    }
  }
});

async function createTab({ name = null, sql = "" } = {}) {
  const id = String(state.nextTabId++);
  const tabName = name || `Query ${id}`;

  // Build header button
  const btn = document.createElement("button");
  btn.className = "tab-btn";
  btn.dataset.tabId = id;
  btn.innerHTML = `
    <span class="tab-title">${escapeHtml(tabName)}</span>
    <span class="tab-close" title="Close tab" aria-label="Close tab">×</span>
  `;
  tabsHeader.insertBefore(btn, addTabBtn);

  // Build content
  const content = document.createElement("div");
  content.className = "tab-content";
  content.dataset.tabId = id;
  content.innerHTML = `
    <div class="editor-row">
      <div class="editor-host" id="editor-${id}"></div>
    </div>
    <div class="editor-actions">
      <button class="run-btn primary-btn" data-tab-id="${id}">Run query · Ctrl/⌘ Enter</button>
      <span class="action-hint">Tip: highlight SQL to run only the selection.</span>
    </div>
    <div class="results-panel" id="results-${id}">
      <div class="results-empty-msg">Run a query to see results.</div>
    </div>
  `;
  tabsContainer.appendChild(content);

  // Init editor
  const editorEl = content.querySelector(`#editor-${id}`);
  const sqlEditor = new SqlEditor(editorEl, {
    onRun: () => runTab(id),
  });
  await sqlEditor.init();
  if (sql) sqlEditor.setValue(sql);
  const tables = engine.schema();
  if (tables.length > 0) sqlEditor.updateSchema(tables);

  state.tabs.set(id, { sqlEditor, name: tabName, content, btn });

  // Wire close + activate
  btn.addEventListener("click", (e) => {
    if (e.target.classList.contains("tab-close")) {
      closeTab(id);
    } else {
      switchToTab(id);
    }
  });
  btn.addEventListener("dblclick", () => renameTab(id));

  // Wire run
  content.querySelector(".run-btn").addEventListener("click", () => runTab(id));

  switchToTab(id);
  persistTabs();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function renameTab(id) {
  const tab = state.tabs.get(id);
  if (!tab) return;
  const newName = prompt("Rename tab:", tab.name);
  if (newName && newName.trim()) {
    tab.name = newName.trim();
    tab.btn.querySelector(".tab-title").textContent = tab.name;
    persistTabs();
  }
}

function switchToTab(id) {
  state.currentTabId = id;
  state.tabs.forEach((tab, tid) => {
    tab.btn.classList.toggle("active", tid === id);
    tab.content.classList.toggle("active", tid === id);
  });
  const tab = state.tabs.get(id);
  if (tab) setTimeout(() => tab.sqlEditor.focus(), 0);
}

function removeTabDom(id) {
  const tab = state.tabs.get(id);
  if (!tab) return;
  tab.sqlEditor.destroy();
  tab.btn.remove();
  tab.content.remove();
  state.tabs.delete(id);
}

function closeTab(id) {
  removeTabDom(id);
  if (state.currentTabId === id) {
    const next = state.tabs.keys().next();
    if (!next.done) {
      switchToTab(next.value);
    } else {
      state.currentTabId = null;
    }
  }
  persistTabs();
}

async function runTab(id) {
  const tab = state.tabs.get(id);
  if (!tab) return;
  const resultsEl = tab.content.querySelector(`#results-${id}`);
  const runBtn = tab.content.querySelector(".run-btn");

  // Allow running only selection if present
  const selection = tab.sqlEditor.editor.getSelectedText();
  const sql = (selection && selection.trim()) || tab.sqlEditor.getValue();
  const trimmed = sql.trim();

  if (!engine.isLoaded()) {
    renderError("Load a scenario or upload a .db file before running a query.", resultsEl);
    return;
  }
  if (!trimmed) {
    renderError("Enter a SQL query.", resultsEl);
    return;
  }

  runBtn.disabled = true;
  const originalLabel = runBtn.textContent;
  runBtn.textContent = "Running…";

  // Run in a microtask so the UI can update
  await new Promise((r) => setTimeout(r, 0));

  try {
    const result = engine.run(trimmed);
    renderResults(result, resultsEl, { filename: `${state.scenarioId || "phantomfeed"}_results.csv` });
    saveHistoryEntry(state.scenarioId, {
      sql: trimmed,
      ts: Date.now(),
      rowCount: result.rowCount,
      ms: result.elapsedMs,
    });
    refreshHistory();
  } catch (e) {
    renderError(prettifyError(e.message), resultsEl);
    saveHistoryEntry(state.scenarioId, {
      sql: trimmed,
      ts: Date.now(),
      error: true,
    });
    refreshHistory();
  } finally {
    runBtn.disabled = false;
    runBtn.textContent = originalLabel;
    persistTabs();
  }
}

function prettifyError(msg) {
  if (!msg) return "Unknown error";
  // sql.js sometimes wraps with "Error: ..."
  const m = msg.replace(/^Error:\s*/, "");
  if (/no such table/i.test(m)) {
    const t = m.match(/no such table:\s*(\S+)/i);
    return `${m}\n\nHint: Check the Schema panel for the correct table name.${t ? ` Looking for "${t[1]}".` : ""}`;
  }
  if (/no such column/i.test(m)) {
    const t = m.match(/no such column:\s*(\S+)/i);
    return `${m}\n\nHint: Check the Schema panel for available columns.${t ? ` Looking for "${t[1]}".` : ""}`;
  }
  if (/syntax error/i.test(m)) {
    return `${m}\n\nHint: Check for missing commas, unmatched quotes, or reserved words used as identifiers.`;
  }
  return m;
}

function persistTabs() {
  if (!state.scenarioId) return;
  const tabs = [];
  state.tabs.forEach((tab) => {
    tabs.push({ name: tab.name, sql: tab.sqlEditor.getValue() });
  });
  saveTabs(state.scenarioId, tabs);
}
