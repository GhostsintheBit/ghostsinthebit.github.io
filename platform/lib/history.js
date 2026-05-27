// Query history stored in localStorage, keyed by scenario id.
// Stores last 50 queries per scenario with timestamp and result row count.

const KEY_PREFIX = "phantomfeed:history:";
const MAX_ENTRIES = 50;

function key(scenarioId) {
  return `${KEY_PREFIX}${scenarioId || "default"}`;
}

export function loadHistory(scenarioId) {
  try {
    const raw = localStorage.getItem(key(scenarioId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

export function saveHistoryEntry(scenarioId, entry) {
  try {
    const list = loadHistory(scenarioId);
    list.unshift(entry);
    while (list.length > MAX_ENTRIES) list.pop();
    localStorage.setItem(key(scenarioId), JSON.stringify(list));
  } catch (e) {
    console.warn("History save failed:", e.message);
  }
}

export function clearHistory(scenarioId) {
  try {
    localStorage.removeItem(key(scenarioId));
  } catch (_) {}
}

// Tab persistence: store open tabs + their SQL so a refresh restores work.
const TAB_KEY_PREFIX = "phantomfeed:tabs:";

export function saveTabs(scenarioId, tabs) {
  try {
    localStorage.setItem(`${TAB_KEY_PREFIX}${scenarioId || "default"}`, JSON.stringify(tabs));
  } catch (_) {}
}

export function loadTabs(scenarioId) {
  try {
    const raw = localStorage.getItem(`${TAB_KEY_PREFIX}${scenarioId || "default"}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch (e) {
    return null;
  }
}

// Render history list into a container element
export function renderHistory(container, scenarioId, onPick) {
  const entries = loadHistory(scenarioId);
  container.innerHTML = "";

  if (entries.length === 0) {
    container.innerHTML = '<p class="history-empty">No queries yet. Your history will appear here after you run queries.</p>';
    return;
  }

  const clearBtn = document.createElement("button");
  clearBtn.className = "ghost-btn history-clear-btn";
  clearBtn.textContent = "Clear history";
  clearBtn.addEventListener("click", () => {
    if (confirm("Clear all query history for this scenario?")) {
      clearHistory(scenarioId);
      renderHistory(container, scenarioId, onPick);
    }
  });
  container.appendChild(clearBtn);

  const list = document.createElement("ol");
  list.className = "history-list";
  for (const entry of entries) {
    const li = document.createElement("li");
    li.className = "history-item";
    const time = document.createElement("div");
    time.className = "history-time";
    const d = new Date(entry.ts);
    time.textContent = `${d.toLocaleString()} · ${entry.rowCount ?? "?"} rows · ${
      entry.ms != null ? entry.ms.toFixed(0) + "ms" : "?"
    }${entry.error ? " · ERROR" : ""}`;
    const code = document.createElement("pre");
    code.className = "history-sql";
    code.textContent = entry.sql;
    code.addEventListener("click", () => onPick && onPick(entry.sql));
    code.title = "Click to load into current tab";
    li.appendChild(time);
    li.appendChild(code);
    list.appendChild(li);
  }
  container.appendChild(list);
}
