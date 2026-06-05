// Schema panel builder. Renders a collapsible reference of the loaded DB,
// including any scenario-provided column hints.

export function renderSchemaPanel(container, tables, hints = {}) {
  container.innerHTML = "";
  if (!tables || tables.length === 0) {
    container.innerHTML = '<p class="schema-empty">Load a scenario to view the schema.</p>';
    return;
  }

  for (const table of tables) {
    const card = document.createElement("div");
    card.className = "schema-card";

    const header = document.createElement("div");
    header.className = "schema-card-header";
    const title = document.createElement("h3");
    title.className = "schema-table-name";
    title.textContent = table.name;
    const copy = document.createElement("button");
    copy.className = "ghost-btn schema-copy-btn";
    copy.textContent = "Copy SELECT *";
    copy.addEventListener("click", async () => {
      const sql = `SELECT * FROM ${table.name} LIMIT 100;`;
      try {
        await navigator.clipboard.writeText(sql);
        const o = copy.textContent;
        copy.textContent = "Copied!";
        setTimeout(() => (copy.textContent = o), 1200);
      } catch (_) {}
    });
    header.appendChild(title);
    header.appendChild(copy);
    card.appendChild(header);

    const tbl = document.createElement("table");
    tbl.className = "schema-columns-table";
    const colgroup = document.createElement("colgroup");
    colgroup.innerHTML = '<col class="col-name-col"><col class="col-type-col"><col class="col-hint-col">';
    tbl.appendChild(colgroup);
    const thead = document.createElement("thead");
    thead.innerHTML = "<tr><th>Column</th><th>Type</th><th>Hint</th></tr>";
    tbl.appendChild(thead);
    const tbody = document.createElement("tbody");
    for (const col of table.columns) {
      const tr = document.createElement("tr");
      const nameTd = document.createElement("td");
      nameTd.innerHTML = `<code>${col.name}</code>${col.pk ? ' <span class="pk-tag">PK</span>' : ""}`;
      const typeTd = document.createElement("td");
      typeTd.innerHTML = `<span class="col-type">${col.type || "TEXT"}</span>`;
      const hintTd = document.createElement("td");
      hintTd.className = "col-hint";
      hintTd.textContent = hints[col.name] || "";
      tr.appendChild(nameTd);
      tr.appendChild(typeTd);
      tr.appendChild(hintTd);
      tbody.appendChild(tr);
    }
    tbl.appendChild(tbody);
    card.appendChild(tbl);
    container.appendChild(card);
  }
}
