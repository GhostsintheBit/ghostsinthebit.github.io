// SQLite engine wrapper around sql.js (~1MB WASM, fast cold start)
// Provides: loadFromArrayBuffer, loadFromUrl, run, exec, schema, indexCreate, close

const SQLJS_CDN = "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3";

let sqljsInitPromise = null;

function initSqlJs() {
  if (sqljsInitPromise) return sqljsInitPromise;
  sqljsInitPromise = new Promise((resolve, reject) => {
    const tag = document.createElement("script");
    tag.src = `${SQLJS_CDN}/sql-wasm.js`;
    tag.onload = async () => {
      try {
        const SQL = await window.initSqlJs({
          locateFile: (f) => `${SQLJS_CDN}/${f}`,
        });
        resolve(SQL);
      } catch (e) {
        reject(e);
      }
    };
    tag.onerror = () => reject(new Error("Failed to load sql.js from CDN"));
    document.head.appendChild(tag);
  });
  return sqljsInitPromise;
}

export class SqliteEngine {
  constructor() {
    this.db = null;
    this.SQL = null;
    this.label = null;
  }

  async ready() {
    if (!this.SQL) this.SQL = await initSqlJs();
    return this.SQL;
  }

  // Decompress a gzip ArrayBuffer in the browser using DecompressionStream
  async _gunzip(buf) {
    if (typeof DecompressionStream === "undefined") {
      throw new Error(
        "Your browser does not support DecompressionStream. Please upload an uncompressed .db file."
      );
    }
    const ds = new DecompressionStream("gzip");
    const stream = new Blob([buf]).stream().pipeThrough(ds);
    return await new Response(stream).arrayBuffer();
  }

  async loadFromArrayBuffer(buf, label = "loaded.db") {
    await this.ready();
    if (this.db) this.db.close();
    // Detect gzip magic bytes (0x1f 0x8b)
    const head = new Uint8Array(buf, 0, 2);
    let bytes = buf;
    if (head[0] === 0x1f && head[1] === 0x8b) {
      bytes = await this._gunzip(buf);
    }
    this.db = new this.SQL.Database(new Uint8Array(bytes));
    this.label = label;
    return this.label;
  }

  async loadFromUrl(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch DB: ${res.status} ${res.statusText}`);
    const buf = await res.arrayBuffer();
    const label = url.split("/").pop() || "remote.db";
    return await this.loadFromArrayBuffer(buf, label);
  }

  isLoaded() {
    return this.db !== null;
  }

  // Returns {columns, rows, rowCount, truncated, elapsedMs}
  run(sql, { maxRows = 5000 } = {}) {
    if (!this.db) throw new Error("No database loaded. Please load a scenario first.");
    const t0 = performance.now();
    const stmt = this.db.prepare(sql);
    try {
      const rows = [];
      let truncated = false;
      let columns = [];
      while (stmt.step()) {
        if (rows.length === 0) columns = stmt.getColumnNames();
        if (rows.length >= maxRows) {
          truncated = true;
          break;
        }
        const row = stmt.get();
        rows.push(row.map((v) => (v === null ? null : v)));
      }
      // If no columns captured (zero rows), still try to get them
      if (columns.length === 0) {
        try { columns = stmt.getColumnNames(); } catch (_) {}
      }
      const elapsedMs = performance.now() - t0;
      return { columns, rows, rowCount: rows.length, truncated, elapsedMs };
    } finally {
      stmt.free();
    }
  }

  // For DDL or PRAGMA where we don't care about results
  exec(sql) {
    if (!this.db) throw new Error("No database loaded.");
    this.db.exec(sql);
  }

  // Get list of {name, sql, type, columns:[{name,type,pk}]} for tables
  schema() {
    if (!this.db) return [];
    const tables = [];
    const res = this.db.exec(
      "SELECT name, sql FROM sqlite_master WHERE type='table' ORDER BY name"
    );
    if (!res.length) return [];
    for (const row of res[0].values) {
      const [name, sql] = row;
      const colRes = this.db.exec(`PRAGMA table_info("${name}")`);
      const columns = colRes.length
        ? colRes[0].values.map((c) => ({
            name: c[1],
            type: c[2],
            notnull: !!c[3],
            pk: !!c[5],
          }))
        : [];
      tables.push({ name, sql, columns });
    }
    return tables;
  }

  // Create indexes for an array of columns on the primary table.
  // Safe to call multiple times (IF NOT EXISTS).
  ensureIndexes(table, columns) {
    if (!this.db || !table || !columns) return 0;
    let created = 0;
    for (const col of columns) {
      const idxName = `idx_${table}_${col}`.replace(/[^a-zA-Z0-9_]/g, "_");
      try {
        this.db.exec(
          `CREATE INDEX IF NOT EXISTS "${idxName}" ON "${table}"("${col}")`
        );
        created++;
      } catch (e) {
        // Column might not exist; skip silently
        console.warn(`Skipped index on ${table}.${col}: ${e.message}`);
      }
    }
    return created;
  }

  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this.label = null;
  }
}

// Single shared engine across the page
export const engine = new SqliteEngine();
