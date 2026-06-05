// Result panel rendering. Builds a sortable, paginated table from
// {columns, rows, rowCount, truncated, elapsedMs} and exposes CSV export.

const PAGE_SIZE = 100;

export function renderResults(result, container, opts = {}) {
  container.innerHTML = "";
  container.classList.remove("results-empty");

  if (!result) {
    container.textContent = "No result.";
    container.classList.add("results-empty");
    return;
  }

  const { columns = [], rows = [], rowCount = 0, truncated = false, elapsedMs = 0 } = result;

  // Header meta bar (row count, time, export)
  const meta = document.createElement("div");
  meta.className = "results-meta";
  const stats = document.createElement("span");
  stats.className = "results-stats";
  stats.textContent =
    `${rowCount.toLocaleString()} row${rowCount === 1 ? "" : "s"}` +
    (truncated ? " (truncated)" : "") +
    ` · ${elapsedMs.toFixed(0)}ms`;
  meta.appendChild(stats);

  const actions = document.createElement("span");
  actions.className = "results-actions";

  if (rows.length > 0) {
    const csvBtn = document.createElement("button");
    csvBtn.className = "ghost-btn";
    csvBtn.textContent = "Export CSV";
    csvBtn.addEventListener("click", () => exportCsv(columns, rows, opts.filename || "phantomfeed_results.csv"));
    actions.appendChild(csvBtn);

    const copyBtn = document.createElement("button");
    copyBtn.className = "ghost-btn";
    copyBtn.textContent = "Copy TSV";
    copyBtn.addEventListener("click", () => copyTsv(columns, rows, copyBtn));
    actions.appendChild(copyBtn);
  }
  meta.appendChild(actions);
  container.appendChild(meta);

  if (rows.length === 0) {
    const empty = document.createElement("div");
    empty.className = "results-empty-msg";
    empty.textContent = columns.length > 0
      ? "Query ran successfully. Zero rows returned."
      : "Query ran successfully. No result set.";
    container.appendChild(empty);
    return;
  }

  // Sort state
  let sortCol = -1;
  let sortDir = 1; // 1 = asc, -1 = desc
  let displayRows = rows.slice();
  let page = 0;

  const tableWrap = document.createElement("div");
  tableWrap.className = "results-table-wrap";
  const table = document.createElement("table");
  table.className = "results-table";

  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  columns.forEach((col, idx) => {
    const th = document.createElement("th");
    th.textContent = col;
    th.title = `Click to sort by ${col}`;
    th.addEventListener("click", () => {
      if (sortCol === idx) {
        sortDir = -sortDir;
      } else {
        sortCol = idx;
        sortDir = 1;
      }
      displayRows = sortRows(rows, idx, sortDir);
      page = 0;
      rerender();
    });
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  table.appendChild(tbody);
  tableWrap.appendChild(table);
  container.appendChild(tableWrap);

  // Pagination footer
  const pager = document.createElement("div");
  pager.className = "results-pager";
  container.appendChild(pager);

  function renderHeaderArrows() {
    headerRow.querySelectorAll("th").forEach((th, i) => {
      th.classList.toggle("sort-asc", i === sortCol && sortDir === 1);
      th.classList.toggle("sort-desc", i === sortCol && sortDir === -1);
    });
  }

  function rerender() {
    tbody.innerHTML = "";
    const start = page * PAGE_SIZE;
    const end = Math.min(start + PAGE_SIZE, displayRows.length);
    for (let i = start; i < end; i++) {
      const tr = document.createElement("tr");
      for (const cell of displayRows[i]) {
        const td = document.createElement("td");
        td.textContent = cell === null ? "" : String(cell);
        if (cell === null) td.classList.add("null-cell");
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    // Pager
    pager.innerHTML = "";
    const totalPages = Math.max(1, Math.ceil(displayRows.length / PAGE_SIZE));
    const prev = document.createElement("button");
    prev.className = "ghost-btn";
    prev.textContent = "‹ Prev";
    prev.disabled = page === 0;
    prev.addEventListener("click", () => { page--; rerender(); });
    const next = document.createElement("button");
    next.className = "ghost-btn";
    next.textContent = "Next ›";
    next.disabled = page >= totalPages - 1;
    next.addEventListener("click", () => { page++; rerender(); });
    const info = document.createElement("span");
    info.className = "pager-info";
    info.textContent = `Page ${page + 1} of ${totalPages}  ·  rows ${start + 1}–${end} of ${displayRows.length.toLocaleString()}`;
    pager.appendChild(prev);
    pager.appendChild(info);
    pager.appendChild(next);
    renderHeaderArrows();
  }

  rerender();
}

function sortRows(rows, idx, dir) {
  const copy = rows.slice();
  copy.sort((a, b) => {
    const av = a[idx];
    const bv = b[idx];
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    const an = Number(av);
    const bn = Number(bv);
    if (!Number.isNaN(an) && !Number.isNaN(bn) && av !== "" && bv !== "") {
      return (an - bn) * dir;
    }
    return String(av).localeCompare(String(bv)) * dir;
  });
  return copy;
}

function csvCell(v) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function exportCsv(columns, rows, filename) {
  const lines = [columns.map(csvCell).join(",")];
  for (const row of rows) lines.push(row.map(csvCell).join(","));
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function copyTsv(columns, rows, btn) {
  const text = [columns.join("\t"), ...rows.map((r) => r.map((c) => (c == null ? "" : String(c))).join("\t"))].join("\n");
  try {
    await navigator.clipboard.writeText(text);
    const orig = btn.textContent;
    btn.textContent = "Copied!";
    setTimeout(() => { btn.textContent = orig; }, 1200);
  } catch (e) {
    alert("Copy failed: " + e.message);
  }
}

export function renderError(message, container) {
  container.innerHTML = "";
  container.classList.add("results-empty");
  const err = document.createElement("div");
  err.className = "results-error";
  err.textContent = message;
  container.appendChild(err);
}
