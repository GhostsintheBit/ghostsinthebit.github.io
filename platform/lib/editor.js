// Ace editor wrapper. Adds a real placeholder overlay, Cmd/Ctrl+Enter to run,
// and table/column autocompletion from the active schema.

const ACE_CDN = "https://cdnjs.cloudflare.com/ajax/libs/ace/1.32.3";

let aceLoaded = null;
function loadAce() {
  if (aceLoaded) return aceLoaded;
  aceLoaded = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `${ACE_CDN}/ace.js`;
    s.onload = () => {
      // After core loads, pull mode + theme + ext-language_tools
      const extras = [
        `${ACE_CDN}/mode-sql.min.js`,
        `${ACE_CDN}/theme-monokai.min.js`,
        `${ACE_CDN}/ext-language_tools.min.js`,
      ];
      let remaining = extras.length;
      extras.forEach((url) => {
        const t = document.createElement("script");
        t.src = url;
        t.onload = () => {
          remaining--;
          if (remaining === 0) resolve(window.ace);
        };
        t.onerror = () => reject(new Error(`Failed to load ${url}`));
        document.head.appendChild(t);
      });
    };
    s.onerror = () => reject(new Error("Failed to load Ace editor"));
    document.head.appendChild(s);
  });
  return aceLoaded;
}

const SQL_KEYWORDS = [
  "SELECT", "FROM", "WHERE", "GROUP BY", "ORDER BY", "HAVING", "LIMIT",
  "OFFSET", "JOIN", "LEFT JOIN", "INNER JOIN", "ON", "AS", "DISTINCT",
  "COUNT", "SUM", "AVG", "MIN", "MAX", "WITH", "UNION", "CASE", "WHEN",
  "THEN", "ELSE", "END", "IS NULL", "IS NOT NULL", "AND", "OR", "NOT",
  "IN", "LIKE", "BETWEEN", "OVER", "PARTITION BY", "ROW_NUMBER", "RANK",
  "DENSE_RANK", "LAG", "LEAD", "STRFTIME", "DATE", "DATETIME", "JSON_EXTRACT",
];

export class SqlEditor {
  constructor(container, { onRun, placeholder = "Write SQL here. Cmd/Ctrl+Enter to run." } = {}) {
    this.container = container;
    this.onRun = onRun;
    this.placeholderText = placeholder;
    this.editor = null;
    this.placeholderEl = null;
    this.schemaCompleter = null;
  }

  async init() {
    const ace = await loadAce();
    const editor = ace.edit(this.container);
    editor.setTheme("ace/theme/monokai");
    editor.session.setMode("ace/mode/sql");
    editor.session.setUseSoftTabs(true);
    editor.session.setTabSize(2);
    editor.setOptions({
      fontSize: "13px",
      showPrintMargin: false,
      wrap: true,
      enableBasicAutocompletion: true,
      enableLiveAutocompletion: true,
      enableSnippets: false,
      highlightActiveLine: true,
      fadeFoldWidgets: true,
    });

    // Cmd/Ctrl+Enter -> run
    editor.commands.addCommand({
      name: "runQuery",
      bindKey: { win: "Ctrl-Enter", mac: "Command-Enter" },
      exec: () => { if (this.onRun) this.onRun(); },
    });

    // Add placeholder overlay
    const placeholder = document.createElement("div");
    placeholder.className = "ace-placeholder";
    placeholder.textContent = this.placeholderText;
    this.container.style.position = "relative";
    this.container.appendChild(placeholder);

    const refreshPlaceholder = () => {
      const empty = editor.getValue().length === 0;
      placeholder.style.display = empty ? "block" : "none";
    };
    editor.on("change", refreshPlaceholder);
    refreshPlaceholder();

    this.editor = editor;
    this.placeholderEl = placeholder;
    return editor;
  }

  getValue() { return this.editor ? this.editor.getValue() : ""; }
  setValue(v) { if (this.editor) this.editor.setValue(v, -1); }
  focus() { if (this.editor) this.editor.focus(); }
  destroy() {
    if (this.editor) {
      this.editor.destroy();
      this.editor = null;
    }
  }

  // Update autocompletion with current schema (tables + columns)
  updateSchema(tables) {
    if (!this.editor || !window.ace) return;
    const langTools = window.ace.require("ace/ext/language_tools");
    if (!langTools) return;

    // Remove our previous completer to prevent stacking
    if (this.schemaCompleter) {
      const idx = langTools.completers ? langTools.completers.indexOf(this.schemaCompleter) : -1;
      if (idx >= 0) langTools.completers.splice(idx, 1);
    }

    const completions = [];
    for (const kw of SQL_KEYWORDS) {
      completions.push({ caption: kw, value: kw, meta: "keyword", score: 100 });
    }
    for (const t of tables) {
      completions.push({ caption: t.name, value: t.name, meta: "table", score: 1000 });
      for (const c of t.columns) {
        completions.push({
          caption: c.name,
          value: c.name,
          meta: `${t.name}.${c.type || "col"}`,
          score: 900,
        });
      }
    }
    this.schemaCompleter = {
      getCompletions(_editor, _session, _pos, _prefix, callback) {
        callback(null, completions);
      },
    };
    langTools.addCompleter(this.schemaCompleter);
  }
}
