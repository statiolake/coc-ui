"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  ViewContainerLocation: () => ViewContainerLocation,
  activate: () => activate
});
module.exports = __toCommonJS(index_exports);
var import_coc4 = require("coc.nvim");

// src/picker/list-picker.ts
var import_coc2 = require("coc.nvim");
var path3 = __toESM(require("node:path"));

// src/picker/list-source.ts
var import_coc = require("coc.nvim");
function getListSource(name) {
  const source = import_coc.listManager.listMap?.get(name);
  if (!source) {
    throw new Error(`Unknown CocList source: ${name}`);
  }
  return source;
}

// src/picker/item-display.ts
function formatPickerItem(label, positions, maxWidth) {
  const singleLine = label.replace(/\r?\n/g, " ");
  if (singleLine.length <= maxWidth) {
    return {
      text: singleLine,
      positions: positions ? Uint32Array.from(positions) : void 0
    };
  }
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(singleLine)) {
    return {
      text: singleLine,
      positions: positions ? Uint32Array.from(positions) : void 0
    };
  }
  const forwardSeparators = count(singleLine, "/");
  const backwardSeparators = count(singleLine, "\\");
  const separator = forwardSeparators >= backwardSeparators ? "/" : "\\";
  if (Math.max(forwardSeparators, backwardSeparators) < 2) {
    return {
      text: singleLine,
      positions: positions ? Uint32Array.from(positions) : void 0
    };
  }
  const compacted = compactPath(singleLine, separator, positions);
  if (compacted.text.length >= singleLine.length) {
    return {
      text: singleLine,
      positions: positions ? Uint32Array.from(positions) : void 0
    };
  }
  return compacted;
}
function compactPath(label, separator, positions) {
  const matched = new Set(positions ? Array.from(positions) : []);
  const components = [];
  let start = 0;
  for (let index = 0; index <= label.length; index++) {
    if (index === label.length || label[index] === separator) {
      components.push({ text: label.slice(start, index), start });
      start = index + 1;
    }
  }
  const last = components.length - 1;
  const keep = components.map((component, index) => {
    if (index === last || component.text === "") return true;
    for (let sourceIndex = component.start; sourceIndex < component.start + component.text.length; sourceIndex++) {
      if (matched.has(sourceIndex)) return true;
    }
    return component.start > 0 && matched.has(component.start - 1);
  });
  const output = [];
  const sourceToOutput = /* @__PURE__ */ new Map();
  let omitted = false;
  let outputLength = 0;
  const append = (text, sourceStart) => {
    output.push(text);
    if (sourceStart != null) {
      for (let offset = 0; offset < text.length; offset++) {
        sourceToOutput.set(sourceStart + offset, outputLength + offset);
      }
    }
    outputLength += text.length;
  };
  for (let index = 0; index < components.length; index++) {
    if (index > 0) append(separator, components[index].start - 1);
    if (keep[index]) {
      append(components[index].text, components[index].start);
      omitted = false;
    } else if (!omitted) {
      append("..");
      omitted = true;
    } else {
      output.pop();
      outputLength--;
    }
  }
  const remapped = positions == null ? void 0 : Uint32Array.from(
    Array.from(positions, (position) => sourceToOutput.get(position)).filter(
      (position) => position != null
    )
  );
  return { text: output.join(""), positions: remapped };
}
function count(value, needle) {
  let total = 0;
  for (const character of value) {
    if (character === needle) total++;
  }
  return total;
}

// src/picker/preview-content.ts
var import_node_fs = require("node:fs");
var import_promises = require("node:fs/promises");
var path = __toESM(require("node:path"));
var import_node_readline = require("node:readline");
var PREVIEW_MAX_BYTES = 512 * 1024;
var PREVIEW_MAX_LINES = 400;
var EXT_TO_FILETYPE = {
  c: "c",
  cc: "cpp",
  cpp: "cpp",
  css: "css",
  go: "go",
  h: "c",
  hpp: "cpp",
  html: "html",
  java: "java",
  js: "javascript",
  json: "json",
  jsx: "javascriptreact",
  lua: "lua",
  md: "markdown",
  mjs: "javascript",
  py: "python",
  rb: "ruby",
  rs: "rust",
  scss: "scss",
  sh: "sh",
  ts: "typescript",
  tsx: "typescriptreact",
  vim: "vim",
  yaml: "yaml",
  yml: "yaml",
  zig: "zig"
};
function guessFiletype(filePath) {
  const ext = path.extname(filePath).toLowerCase().replace(/^\./, "");
  return EXT_TO_FILETYPE[ext];
}
function isBinaryBuffer(buffer) {
  return buffer.includes(0);
}
function splitPreviewLines(text) {
  const raw = text.split(/\r?\n/);
  if (raw.length > 0 && raw[raw.length - 1] === "") raw.pop();
  if (raw.length <= PREVIEW_MAX_LINES) {
    return { lines: raw.length ? raw : [""], truncated: false };
  }
  return {
    lines: raw.slice(0, PREVIEW_MAX_LINES),
    truncated: true
  };
}
async function readPreviewContent(filePath, options = {}) {
  const maxBytes = options.maxBytes ?? PREVIEW_MAX_BYTES;
  const maxLines = Math.max(1, options.maxLines ?? PREVIEW_MAX_LINES);
  try {
    const info = await (0, import_promises.stat)(filePath);
    if (!info.isFile()) {
      return { kind: "unavailable", reason: "Not a regular file" };
    }
    if (options.targetLine != null || options.matchLine) {
      return await readFocusedPreviewContent(filePath, {
        maxLines,
        cancellation: options.cancellation,
        targetLine: options.targetLine,
        matchLine: options.matchLine
      });
    }
    const toRead = Math.min(info.size, maxBytes);
    if (toRead === 0) {
      return {
        kind: "text",
        lines: [""],
        truncated: false,
        startLine: 1,
        filetype: guessFiletype(filePath)
      };
    }
    const handle = await (0, import_promises.open)(filePath, "r");
    try {
      const buffer = Buffer.alloc(toRead);
      const { bytesRead } = await handle.read(buffer, 0, toRead, 0);
      const slice = buffer.subarray(0, bytesRead);
      if (isBinaryBuffer(slice)) return { kind: "binary" };
      const text = slice.toString("utf8");
      let { lines, truncated } = splitPreviewLines(text);
      if (info.size > maxBytes) truncated = true;
      if (lines.length > maxLines) {
        lines = lines.slice(0, maxLines);
        truncated = true;
      }
      return {
        kind: "text",
        lines,
        truncated,
        startLine: 1,
        filetype: guessFiletype(filePath)
      };
    } finally {
      await handle.close();
    }
  } catch {
    return { kind: "unavailable", reason: "Preview unavailable" };
  }
}
async function readFocusedPreviewContent(filePath, options) {
  const beforeCount = Math.floor((options.maxLines - 1) / 2);
  const stream = (0, import_node_fs.createReadStream)(filePath, { encoding: "utf8" });
  const reader = (0, import_node_readline.createInterface)({ input: stream, crlfDelay: Infinity });
  const abort = () => {
    stream.destroy();
  };
  const cancellation = options.cancellation?.isCancellationRequested ? void 0 : options.cancellation?.onCancellationRequested(abort);
  if (options.cancellation?.isCancellationRequested) abort();
  const before = [];
  const head = [];
  let lineNumber = 0;
  let exact;
  let partial;
  let reachedEof = true;
  try {
    for await (const line of reader) {
      lineNumber++;
      if (line.includes("\0")) {
        return { kind: "binary" };
      }
      if (options.targetLine == null && !partial && !exact && head.length < options.maxLines) {
        head.push(line);
      }
      if (exact) {
        if (exact.lines.length < options.maxLines) {
          exact.lines.push(line);
          exact.endLine = lineNumber;
          continue;
        }
        reachedEof = false;
        break;
      }
      if (partial && partial.lines.length < options.maxLines) {
        partial.lines.push(line);
        partial.endLine = lineNumber;
      }
      const targetMatches = options.targetLine != null && lineNumber === Math.max(1, Math.floor(options.targetLine));
      const exactMatches = options.matchLine != null && line === options.matchLine;
      const partialMatches = options.matchLine != null && options.matchLine.length > 0 && line.includes(options.matchLine);
      if (targetMatches || exactMatches) {
        exact = makeRetainedWindow(before, line, lineNumber);
        head.length = 0;
      } else if (!partial && partialMatches) {
        partial = makeRetainedWindow(before, line, lineNumber);
        head.length = 0;
      }
      before.push(line);
      if (before.length > beforeCount) before.shift();
    }
  } finally {
    cancellation?.dispose();
    reader.close();
    stream.destroy();
  }
  const retained = exact ?? partial;
  if (retained) {
    return {
      kind: "text",
      lines: retained.lines,
      startLine: retained.startLine,
      focusLine: retained.focusLine,
      truncated: retained.startLine > 1 || !reachedEof || retained.endLine < lineNumber,
      filetype: guessFiletype(filePath)
    };
  }
  const fallback = head.length ? head : before;
  return {
    kind: "text",
    lines: fallback.length ? fallback : [""],
    startLine: fallback.length ? lineNumber - fallback.length + 1 : 1,
    truncated: lineNumber > fallback.length,
    filetype: guessFiletype(filePath)
  };
}
function makeRetainedWindow(before, line, lineNumber) {
  return {
    lines: [...before, line],
    startLine: lineNumber - before.length,
    focusLine: before.length + 1,
    endLine: lineNumber
  };
}
function previewStatusLines(content) {
  if (content.kind === "binary") {
    return ["Binary file \u2014 preview unavailable"];
  }
  if (content.kind === "unavailable") {
    return [content.reason];
  }
  return content.lines;
}
function resolvePreviewFiletype(content, detected) {
  if (content.kind !== "text") return "";
  return content.filetype ?? detected ?? "";
}

// src/picker/preview-layout.ts
var PREVIEW_MIN_COLUMNS = 120;
var LAYOUT_HORIZONTAL_PADDING = 4;
var LAYOUT_VERTICAL_PADDING = 7;
var LAYOUT_WIDTH_RATIO = 0.8;
var LAYOUT_HEIGHT_RATIO = 0.55;
var LAYOUT_MIN_WIDTH = 20;
var LAYOUT_MIN_HEIGHT = 5;
var LAYOUT_LIST_RATIO = 0.4;
var LAYOUT_MIN_LIST_WIDTH = 24;
var LAYOUT_MIN_PREVIEW_WIDTH = 30;
var LAYOUT_PREVIEW_GAP = 2;
function clampWidth(columns, ratio) {
  return Math.min(
    Math.max(1, columns - LAYOUT_HORIZONTAL_PADDING),
    Math.max(LAYOUT_MIN_WIDTH, Math.floor(columns * ratio))
  );
}
function clampHeight(lines) {
  return Math.min(
    Math.max(1, lines - LAYOUT_VERTICAL_PADDING),
    Math.max(LAYOUT_MIN_HEIGHT, Math.floor(lines * LAYOUT_HEIGHT_RATIO))
  );
}
function outerWidth(columns) {
  return clampWidth(columns, LAYOUT_WIDTH_RATIO);
}
function minPreviewSpan() {
  return LAYOUT_MIN_LIST_WIDTH + LAYOUT_PREVIEW_GAP + LAYOUT_MIN_PREVIEW_WIDTH;
}
function computePickerLayout(input) {
  const minColumns = input.minColumns ?? PREVIEW_MIN_COLUMNS;
  const height = clampHeight(input.lines);
  const row = Math.max(0, Math.floor((input.lines - height - 1) / 3));
  const width = outerWidth(input.columns);
  const col = Math.max(0, Math.floor((input.columns - width) / 2));
  const span = minPreviewSpan();
  const allowPreview = input.showPreview && input.columns >= minColumns && width >= span;
  if (!allowPreview) {
    return {
      prompt: { row, col, width, height: 1 },
      results: { row: row + 2, col, width, height }
    };
  }
  const listWidth = Math.max(
    LAYOUT_MIN_LIST_WIDTH,
    Math.min(
      width - LAYOUT_PREVIEW_GAP - LAYOUT_MIN_PREVIEW_WIDTH,
      Math.floor(width * LAYOUT_LIST_RATIO)
    )
  );
  const previewWidth = width - listWidth - LAYOUT_PREVIEW_GAP;
  const previewHeight = height + 2;
  return {
    prompt: { row, col, width: listWidth, height: 1 },
    results: { row: row + 2, col, width: listWidth, height },
    preview: {
      row,
      col: col + listWidth + LAYOUT_PREVIEW_GAP,
      width: previewWidth,
      height: previewHeight
    }
  };
}
function canShowPreviewPane(columns, minColumns = PREVIEW_MIN_COLUMNS) {
  return columns >= minColumns && outerWidth(columns) >= minPreviewSpan();
}
function paneGeometryEqual(a, b) {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return a.row === b.row && a.col === b.col && a.width === b.width && a.height === b.height;
}
function pickerLayoutsEqual(a, b) {
  return paneGeometryEqual(a.prompt, b.prompt) && paneGeometryEqual(a.results, b.results) && paneGeometryEqual(a.preview, b.preview);
}

// src/picker/preview-location.ts
var path2 = __toESM(require("node:path"));
var import_node_url = require("node:url");
function isLocationLike(value) {
  if (value == null || typeof value !== "object") return false;
  const candidate = value;
  if (typeof candidate.uri !== "string" || candidate.range == null) return false;
  if (typeof candidate.range !== "object") return false;
  const start = candidate.range.start;
  return start != null && typeof start === "object" && typeof start.line === "number";
}
function isLocationWithLineLike(value) {
  if (value == null || typeof value !== "object") return false;
  const candidate = value;
  return typeof candidate.uri === "string" && typeof candidate.line === "string";
}
function uriToLocalPath(uriOrPath, cwd) {
  if (uriOrPath.startsWith("file:")) {
    try {
      return (0, import_node_url.fileURLToPath)(uriOrPath);
    } catch {
      return void 0;
    }
  }
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(uriOrPath)) return void 0;
  if (!uriOrPath) return void 0;
  if (path2.isAbsolute(uriOrPath)) return uriOrPath;
  if (cwd != null && cwd !== "") return path2.resolve(cwd, uriOrPath);
  return uriOrPath;
}
function resolvePreviewTarget(location, cwd) {
  if (location == null) return void 0;
  if (typeof location === "string") {
    const resolved = uriToLocalPath(location, cwd);
    return resolved ? { path: resolved } : void 0;
  }
  if (isLocationLike(location)) {
    const resolved = uriToLocalPath(location.uri, cwd);
    if (!resolved) return void 0;
    return { path: resolved, line: location.range.start.line + 1 };
  }
  if (isLocationWithLineLike(location)) {
    const resolved = uriToLocalPath(location.uri, cwd);
    if (!resolved) return void 0;
    return {
      path: resolved,
      matchLine: location.line,
      matchText: location.text
    };
  }
  return void 0;
}
function previewIdentity(target) {
  return [
    target.path,
    target.line ?? "",
    target.matchLine ?? "",
    target.matchText ?? ""
  ].join("\0");
}

// src/picker/list-picker.ts
var DEFAULT_LIMIT = 1e4;
var DEFAULT_VISIBLE_ITEMS = 200;
var POLL_INTERVAL = 35;
var PICKER_ZINDEX = 40;
function pickerBorders(rounded) {
  const [topLeft, topRight, bottomRight, bottomLeft] = rounded ? ["\u256D", "\u256E", "\u256F", "\u2570"] : ["\u250C", "\u2510", "\u2518", "\u2514"];
  return {
    prompt: [topLeft, "\u2500", topRight, "\u2502", "\u2524", "\u2500", "\u251C", "\u2502"],
    results: ["\u251C", "\u2500", "\u2524", "\u2502", bottomRight, "\u2500", bottomLeft, "\u2502"],
    preview: [topLeft, "\u2500", topRight, "\u2502", bottomRight, "\u2500", bottomLeft, "\u2502"]
  };
}
function floatConfig(geometry, border, extra = {}) {
  return {
    relative: "editor",
    row: geometry.row,
    col: geometry.col,
    width: geometry.width,
    height: geometry.height,
    style: "minimal",
    border,
    zindex: PICKER_ZINDEX,
    ...extra
  };
}
var ListPicker = class {
  state;
  name;
  source;
  args = [];
  items = [];
  visibleItems = [];
  fuzzyMatch = import_coc2.workspace.createFuzzyMatch();
  selected = 0;
  input = "";
  generation = 0;
  previewGeneration = 0;
  previewTokenSource;
  tokenSource;
  task;
  pollTimer;
  renderTimer;
  filterTimer;
  limit = DEFAULT_LIMIT;
  visibleLimit = DEFAULT_VISIBLE_ITEMS;
  previewEnabled = true;
  previewMinColumns = PREVIEW_MIN_COLUMNS;
  async show(name, args = []) {
    await this.open(name, args, "");
  }
  async resume() {
    if (!this.name) return;
    await this.open(this.name, this.args, this.input);
  }
  async open(name, args, input) {
    await this.close();
    const config = import_coc2.workspace.getConfiguration("ui.picker");
    this.limit = Math.max(100, config.get("maxItems", DEFAULT_LIMIT));
    this.visibleLimit = Math.max(
      20,
      config.get("visibleItems", DEFAULT_VISIBLE_ITEMS)
    );
    this.previewEnabled = config.get("preview.enable", true);
    this.previewMinColumns = Math.max(
      LAYOUT_MIN_COLUMNS_FLOOR,
      config.get("preview.minColumns", PREVIEW_MIN_COLUMNS)
    );
    this.name = name;
    this.source = getListSource(name);
    this.args = [...args];
    this.input = input;
    this.state = await this.openWindows(name);
    await import_coc2.workspace.nvim.call("nvim_buf_set_lines", [
      this.state.promptBuffer,
      0,
      -1,
      false,
      [input]
    ]);
    this.installCommands();
    this.pollTimer = setInterval(() => void this.pollInput(), POLL_INTERVAL);
    await import_coc2.workspace.nvim.call("win_gotoid", [this.state.promptWindow]);
    await import_coc2.workspace.nvim.call("nvim_win_set_cursor", [
      this.state.promptWindow,
      [1, Buffer.byteLength(input)]
    ]);
    await import_coc2.workspace.nvim.command("startinsert");
    await this.reload();
  }
  async close() {
    this.cancelProducer();
    this.previewGeneration++;
    this.previewTokenSource?.cancel();
    this.previewTokenSource?.dispose();
    this.previewTokenSource = void 0;
    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.renderTimer) clearTimeout(this.renderTimer);
    if (this.filterTimer) clearTimeout(this.filterTimer);
    this.pollTimer = void 0;
    this.renderTimer = void 0;
    this.filterTimer = void 0;
    const state = this.state;
    this.state = void 0;
    if (!state) return;
    await import_coc2.workspace.nvim.command("stopinsert");
    const windows = [
      state.promptWindow,
      state.resultsWindow,
      state.preview?.window
    ].filter((winid) => winid != null);
    for (const winid of windows) {
      const valid = await import_coc2.workspace.nvim.call("nvim_win_is_valid", [
        winid
      ]);
      if (valid) await import_coc2.workspace.nvim.call("nvim_win_close", [winid, true]);
    }
    if (state.preview) {
      const bufValid = await import_coc2.workspace.nvim.call("nvim_buf_is_valid", [
        state.preview.buffer
      ]);
      if (bufValid) {
        await import_coc2.workspace.nvim.call("nvim_buf_delete", [
          state.preview.buffer,
          { force: true }
        ]);
      }
    }
    const targetValid = await import_coc2.workspace.nvim.call("nvim_win_is_valid", [
      state.targetWindow
    ]);
    if (targetValid) {
      await import_coc2.workspace.nvim.call("win_gotoid", [state.targetWindow]);
      if (state.targetMode.startsWith("i")) {
        await import_coc2.workspace.nvim.command("startinsert");
      } else if (state.targetMode.startsWith("R")) {
        await import_coc2.workspace.nvim.command("startreplace");
      }
    }
  }
  dispose() {
    void this.close();
  }
  async move(delta) {
    if (!this.visibleItems.length) return;
    this.selected = Math.max(
      0,
      Math.min(this.visibleItems.length - 1, this.selected + delta)
    );
    await this.render();
  }
  async accept() {
    const source = this.source;
    const item = this.visibleItems[this.selected]?.item;
    if (!source || !item) return;
    const action = source.actions.find((candidate) => candidate.name === source.defaultAction) ?? source.actions[0];
    if (!action) return;
    await this.executeAction(action, item);
  }
  async showActions() {
    const source = this.source;
    const item = this.visibleItems[this.selected]?.item;
    if (!source || !item || !source.actions.length) return;
    const index = await import_coc2.window.showMenuPicker(
      source.actions.map((action2) => action2.name),
      { title: "Actions" }
    );
    if (index < 0) {
      await this.focusPrompt();
      return;
    }
    const action = source.actions[index];
    if (!action) {
      await this.focusPrompt();
      return;
    }
    await this.executeAction(action, item);
    if (this.state) await this.focusPrompt();
  }
  async focusPrompt() {
    const state = this.state;
    if (!state) return;
    await import_coc2.workspace.nvim.call("win_gotoid", [state.promptWindow]);
    await import_coc2.workspace.nvim.call("nvim_win_set_cursor", [
      state.promptWindow,
      [1, Buffer.byteLength(this.input)]
    ]);
    await import_coc2.workspace.nvim.command("startinsert");
  }
  async executeAction(action, unresolvedItem) {
    const source = this.source;
    if (!source) return;
    const item = source.resolveItem ? await source.resolveItem(unresolvedItem) ?? unresolvedItem : unresolvedItem;
    const context = this.context(this.input);
    if (!action.persist) await this.close();
    await action.execute(item, context);
    if (action.persist && action.reload && this.state) await this.reload();
  }
  async reload() {
    const source = this.source;
    if (!source || !this.state) return;
    this.cancelProducer();
    const generation = ++this.generation;
    const tokenSource = this.tokenSource = new import_coc2.CancellationTokenSource();
    this.items = [];
    this.visibleItems = [];
    this.selected = 0;
    this.scheduleRender();
    const loaded = await source.loadItems(
      this.context(this.input),
      tokenSource.token
    );
    if (generation !== this.generation || tokenSource.token.isCancellationRequested)
      return;
    if (!loaded) return;
    if (Array.isArray(loaded)) {
      for (const item of loaded.slice(0, this.limit)) this.push(item, generation);
      this.scheduleFilter();
      return;
    }
    const task = this.task = loaded;
    task.on("data", (item) => this.push(item, generation));
    task.on("end", () => {
      if (generation === this.generation) this.task = void 0;
    });
    task.on("error", (error) => {
      if (generation !== this.generation) return;
      this.task = void 0;
      void this.close();
      void import_coc2.window.showErrorMessage(`Picker source failed: ${String(error)}`);
    });
  }
  push(item, generation) {
    if (generation !== this.generation) return;
    if (this.items.length >= this.limit) {
      this.task?.dispose();
      this.task = void 0;
      return;
    }
    this.items.push(item);
    this.scheduleFilter();
  }
  scheduleFilter() {
    if (this.filterTimer) return;
    this.filterTimer = setTimeout(() => {
      this.filterTimer = void 0;
      this.applyFilter();
    }, POLL_INTERVAL);
  }
  applyFilter() {
    const query = this.input;
    let filtered;
    if (this.source?.interactive || query.length === 0) {
      filtered = this.items.map((item) => ({ item, score: 0 }));
    } else {
      this.fuzzyMatch.setPattern(query);
      filtered = this.items.map((item, index) => {
        const filterText = item.filterText ?? item.label;
        const result = this.fuzzyMatch.match(filterText);
        if (!result) return void 0;
        const labelResult = filterText === item.label ? result : this.fuzzyMatch.match(item.label);
        return {
          item,
          index,
          positions: labelResult?.positions,
          score: result.score
        };
      }).filter(
        (item) => item != null
      ).sort((left, right) => right.score - left.score || left.index - right.index);
    }
    this.visibleItems = filtered;
    this.selected = Math.min(this.selected, Math.max(0, filtered.length - 1));
    this.scheduleRender();
  }
  cancelProducer() {
    this.generation++;
    this.tokenSource?.cancel();
    this.tokenSource?.dispose();
    this.tokenSource = void 0;
    this.task?.dispose();
    this.task = void 0;
  }
  async pollInput() {
    const state = this.state;
    if (!state) return;
    const valid = await import_coc2.workspace.nvim.call("nvim_buf_is_valid", [
      state.promptBuffer
    ]);
    if (!valid) return void this.close();
    const lines = await import_coc2.workspace.nvim.call("nvim_buf_get_lines", [
      state.promptBuffer,
      0,
      1,
      false
    ]);
    const input = lines[0] ?? "";
    if (input === this.input) return;
    this.input = input;
    if (this.source?.interactive) await this.reload();
    else this.applyFilter();
  }
  scheduleRender() {
    if (this.renderTimer) return;
    this.renderTimer = setTimeout(() => {
      this.renderTimer = void 0;
      void this.render();
    }, POLL_INTERVAL);
  }
  async render() {
    const state = this.state;
    if (!state) return;
    const half = Math.floor(this.visibleLimit / 2);
    const start = Math.max(
      0,
      Math.min(this.selected - half, this.visibleItems.length - this.visibleLimit)
    );
    const page = this.visibleItems.slice(start, start + this.visibleLimit);
    const displayItems = page.map(
      ({ item, positions }) => formatPickerItem(item.label, positions, state.layout.results.width)
    );
    const lines = displayItems.map(({ text }) => text);
    await import_coc2.workspace.nvim.pauseNotification();
    import_coc2.workspace.nvim.call("nvim_buf_set_option", [state.resultsBuffer, "modifiable", true], true);
    import_coc2.workspace.nvim.call("nvim_buf_set_lines", [state.resultsBuffer, 0, -1, false, lines.length ? lines : [""]], true);
    import_coc2.workspace.nvim.call("nvim_buf_set_option", [state.resultsBuffer, "modifiable", false], true);
    import_coc2.workspace.nvim.call("nvim_buf_clear_namespace", [state.resultsBuffer, state.namespace, 0, -1], true);
    if (page.length) {
      import_coc2.workspace.nvim.call("nvim_buf_add_highlight", [state.resultsBuffer, state.namespace, "PmenuSel", this.selected - start, 0, -1], true);
      for (const [line, displayed] of displayItems.entries()) {
        if (!displayed.positions) continue;
        for (const [startColumn, endColumn] of this.fuzzyMatch.matchSpans(
          lines[line],
          displayed.positions
        )) {
          import_coc2.workspace.nvim.call("nvim_buf_add_highlight", [
            state.resultsBuffer,
            state.namespace,
            "CocListSearch",
            line,
            startColumn,
            endColumn
          ], true);
        }
      }
    }
    await import_coc2.workspace.nvim.resumeNotification(false);
    await this.updatePreview();
  }
  async updatePreview() {
    const state = this.state;
    if (!state) return;
    this.previewTokenSource?.cancel();
    this.previewTokenSource?.dispose();
    const previewTokenSource = new import_coc2.CancellationTokenSource();
    this.previewTokenSource = previewTokenSource;
    const generation = ++this.previewGeneration;
    const item = this.visibleItems[this.selected]?.item;
    const target = item ? resolvePreviewTarget(item.location, import_coc2.workspace.cwd) : void 0;
    const columns = await import_coc2.workspace.nvim.getOption("columns");
    const lines = await import_coc2.workspace.nvim.getOption("lines");
    if (generation !== this.previewGeneration || !this.state) return;
    const wideEnough = this.previewEnabled && canShowPreviewPane(columns, this.previewMinColumns);
    if (!wideEnough || !target) {
      if (state.preview || state.layout.preview) {
        await this.hidePreview(columns, lines);
      }
      return;
    }
    const identity = previewIdentity(target);
    const layout = computePickerLayout({
      columns,
      lines,
      showPreview: true,
      minColumns: this.previewMinColumns
    });
    if (state.preview?.identity === identity) {
      if (pickerLayoutsEqual(state.layout, layout)) return;
      await this.applyLayout(layout, target.path);
      if (generation !== this.previewGeneration || !this.state) return;
      return;
    }
    const content = await readPreviewContent(target.path, {
      maxBytes: PREVIEW_MAX_BYTES,
      maxLines: PREVIEW_MAX_LINES,
      cancellation: previewTokenSource.token,
      targetLine: target.line,
      matchLine: target.matchLine
    });
    if (generation !== this.previewGeneration || !this.state) return;
    if (content.kind === "unavailable") {
      if (this.state.preview || this.state.layout.preview) {
        await this.hidePreview(columns, lines);
      }
      return;
    }
    await this.applyLayout(layout, target.path);
    if (generation !== this.previewGeneration || !this.state?.preview) return;
    const focusLine = content.kind === "text" ? content.focusLine : void 0;
    const display = previewStatusLines(content);
    const detected = content.kind === "text" && !content.filetype ? await this.detectFiletype(target.path) : void 0;
    if (generation !== this.previewGeneration || !this.state?.preview) return;
    await this.writePreviewBuffer(
      this.state.preview.buffer,
      display,
      resolvePreviewFiletype(content, detected)
    );
    if (generation !== this.previewGeneration || !this.state?.preview) return;
    await this.focusPreviewLine(this.state.preview, focusLine, display.length);
    this.state.preview.path = target.path;
    this.state.preview.identity = identity;
    this.state.preview.focusLine = focusLine;
  }
  async hidePreview(columns, lines) {
    const state = this.state;
    if (!state) return;
    if (state.preview) {
      const winValid = await import_coc2.workspace.nvim.call("nvim_win_is_valid", [
        state.preview.window
      ]);
      if (winValid) {
        await import_coc2.workspace.nvim.call("nvim_win_close", [state.preview.window, true]);
      }
      const bufValid = await import_coc2.workspace.nvim.call("nvim_buf_is_valid", [
        state.preview.buffer
      ]);
      if (bufValid) {
        await import_coc2.workspace.nvim.call("nvim_buf_delete", [
          state.preview.buffer,
          { force: true }
        ]);
      }
      state.preview = void 0;
    }
    const layout = computePickerLayout({
      columns,
      lines,
      showPreview: false,
      minColumns: this.previewMinColumns
    });
    await this.applyLayout(layout);
  }
  async applyLayout(layout, previewPath) {
    const state = this.state;
    if (!state) return;
    const rounded = import_coc2.workspace.getConfiguration("dialog").get("rounded", true);
    const borders = pickerBorders(rounded);
    const resultsWidthChanged = state.layout.results.width !== layout.results.width;
    state.layout = layout;
    if (resultsWidthChanged) this.scheduleRender();
    await import_coc2.workspace.nvim.call("nvim_win_set_config", [
      state.promptWindow,
      floatConfig(layout.prompt, borders.prompt, {
        title: ` ${this.name ?? ""} `,
        title_pos: "left"
      })
    ]);
    await import_coc2.workspace.nvim.call("nvim_win_set_config", [
      state.resultsWindow,
      floatConfig(layout.results, borders.results, { focusable: false })
    ]);
    if (!layout.preview) return;
    const title = previewPath ? ` ${path3.basename(previewPath)} ` : " preview ";
    if (state.preview) {
      await import_coc2.workspace.nvim.call("nvim_win_set_config", [
        state.preview.window,
        floatConfig(layout.preview, borders.preview, {
          focusable: false,
          title,
          title_pos: "left"
        })
      ]);
      return;
    }
    const buffer = await import_coc2.workspace.nvim.call("nvim_create_buf", [
      false,
      true
    ]);
    await this.configurePreviewBuffer(buffer);
    const previewWindow = await import_coc2.workspace.nvim.call("nvim_open_win", [
      buffer,
      false,
      floatConfig(layout.preview, borders.preview, {
        focusable: false,
        title,
        title_pos: "left"
      })
    ]);
    await import_coc2.workspace.nvim.call("nvim_win_set_option", [
      previewWindow,
      "winhighlight",
      "NormalFloat:NormalFloat,FloatBorder:CocUiPickerBorder,FloatTitle:CocUiPickerBorder"
    ]);
    await import_coc2.workspace.nvim.call("nvim_win_set_option", [
      previewWindow,
      "wrap",
      false
    ]);
    await import_coc2.workspace.nvim.call("nvim_win_set_option", [
      previewWindow,
      "cursorline",
      false
    ]);
    state.preview = {
      buffer,
      window: previewWindow,
      path: previewPath ?? "",
      identity: ""
    };
  }
  async configurePreviewBuffer(buffer) {
    await import_coc2.workspace.nvim.call("nvim_buf_set_option", [buffer, "buftype", "nofile"]);
    await import_coc2.workspace.nvim.call("nvim_buf_set_option", [buffer, "bufhidden", "wipe"]);
    await import_coc2.workspace.nvim.call("nvim_buf_set_option", [buffer, "swapfile", false]);
    await import_coc2.workspace.nvim.call("nvim_buf_set_option", [buffer, "modifiable", false]);
    await import_coc2.workspace.nvim.call("nvim_buf_set_option", [buffer, "readonly", true]);
    await import_coc2.workspace.nvim.call("nvim_buf_set_option", [buffer, "undolevels", -1]);
  }
  async writePreviewBuffer(buffer, lines, filetype) {
    await import_coc2.workspace.nvim.pauseNotification();
    import_coc2.workspace.nvim.call("nvim_buf_set_option", [buffer, "modifiable", true], true);
    import_coc2.workspace.nvim.call("nvim_buf_set_option", [buffer, "readonly", false], true);
    import_coc2.workspace.nvim.call(
      "nvim_buf_set_lines",
      [buffer, 0, -1, false, lines.length ? lines : [""]],
      true
    );
    import_coc2.workspace.nvim.call("nvim_buf_set_option", [buffer, "modifiable", false], true);
    import_coc2.workspace.nvim.call("nvim_buf_set_option", [buffer, "readonly", true], true);
    import_coc2.workspace.nvim.call("nvim_buf_set_option", [buffer, "filetype", filetype], true);
    await import_coc2.workspace.nvim.resumeNotification(false);
  }
  async detectFiletype(filePath) {
    try {
      const detected = await import_coc2.workspace.nvim.lua(
        `return vim.filetype.match({ filename = ... })`,
        [filePath]
      );
      return typeof detected === "string" && detected ? detected : void 0;
    } catch {
      return void 0;
    }
  }
  async focusPreviewLine(preview, focusLine, lineCount) {
    const state = this.state;
    if (!state) return;
    await import_coc2.workspace.nvim.call("nvim_buf_clear_namespace", [
      preview.buffer,
      state.namespace,
      0,
      -1
    ]);
    if (!focusLine || lineCount < 1) return;
    const line = Math.max(1, Math.min(focusLine, lineCount));
    await import_coc2.workspace.nvim.call("nvim_buf_add_highlight", [
      preview.buffer,
      state.namespace,
      "PmenuSel",
      line - 1,
      0,
      -1
    ]);
    await import_coc2.workspace.nvim.lua(
      `
      local win, line = ...
      if vim.api.nvim_win_is_valid(win) then
        vim.api.nvim_win_call(win, function()
          vim.api.nvim_win_set_cursor(win, { line, 0 })
          vim.cmd('normal! zz')
        end)
      end
      `,
      [preview.window, line]
    );
  }
  context(input) {
    const state = this.state;
    if (!state) throw new Error("Picker is not visible");
    const options = {
      position: "float",
      reverse: false,
      input,
      ignorecase: true,
      interactive: this.source?.interactive ?? false,
      sort: false,
      mode: "insert",
      matcher: "fuzzy",
      autoPreview: false,
      numberSelect: false,
      noQuit: false,
      first: false
    };
    return {
      args: this.args,
      input,
      cwd: import_coc2.workspace.cwd,
      options,
      window: import_coc2.workspace.nvim.createWindow(state.targetWindow),
      buffer: import_coc2.workspace.nvim.createBuffer(state.targetBuffer),
      listWindow: import_coc2.workspace.nvim.createWindow(state.resultsWindow)
    };
  }
  async openWindows(name) {
    const targetWindow = await import_coc2.workspace.nvim.call("win_getid");
    const targetBuffer = await import_coc2.workspace.nvim.call("bufnr", ["%"]);
    const targetMode = await import_coc2.workspace.nvim.call("mode", [1]);
    await this.configureHighlights();
    const columns = await import_coc2.workspace.nvim.getOption("columns");
    const lines = await import_coc2.workspace.nvim.getOption("lines");
    const layout = computePickerLayout({
      columns,
      lines,
      showPreview: false,
      minColumns: this.previewMinColumns
    });
    const namespace = await import_coc2.workspace.nvim.call("nvim_create_namespace", [
      "coc-ui-picker"
    ]);
    const promptBuffer = await import_coc2.workspace.nvim.call("nvim_create_buf", [false, true]);
    const resultsBuffer = await import_coc2.workspace.nvim.call("nvim_create_buf", [false, true]);
    const borders = pickerBorders(
      import_coc2.workspace.getConfiguration("dialog").get("rounded", true)
    );
    const promptWindow = await import_coc2.workspace.nvim.call("nvim_open_win", [
      promptBuffer,
      true,
      floatConfig(layout.prompt, borders.prompt, {
        title: ` ${name} `,
        title_pos: "left"
      })
    ]);
    const resultsWindow = await import_coc2.workspace.nvim.call("nvim_open_win", [
      resultsBuffer,
      false,
      floatConfig(layout.results, borders.results, { focusable: false })
    ]);
    for (const buffer of [promptBuffer, resultsBuffer]) {
      await import_coc2.workspace.nvim.call("nvim_buf_set_option", [buffer, "buftype", "nofile"]);
      await import_coc2.workspace.nvim.call("nvim_buf_set_option", [buffer, "bufhidden", "wipe"]);
      await import_coc2.workspace.nvim.call("nvim_buf_set_option", [buffer, "swapfile", false]);
    }
    await import_coc2.workspace.nvim.call("nvim_buf_set_option", [promptBuffer, "filetype", "cocui-picker-prompt"]);
    await import_coc2.workspace.nvim.call("nvim_buf_set_option", [resultsBuffer, "filetype", "cocui-picker"]);
    await import_coc2.workspace.nvim.call("nvim_win_set_option", [
      promptWindow,
      "winhighlight",
      "NormalFloat:NormalFloat,FloatBorder:CocUiPickerBorder,FloatTitle:CocUiPickerBorder"
    ]);
    await import_coc2.workspace.nvim.call("nvim_win_set_option", [
      promptWindow,
      "wrap",
      false
    ]);
    await import_coc2.workspace.nvim.call("nvim_win_set_option", [resultsWindow, "cursorline", false]);
    await import_coc2.workspace.nvim.call("nvim_win_set_option", [resultsWindow, "wrap", false]);
    await import_coc2.workspace.nvim.call("nvim_win_set_option", [
      resultsWindow,
      "winhighlight",
      "NormalFloat:NormalFloat,FloatBorder:CocUiPickerBorder,FloatTitle:CocUiPickerBorder"
    ]);
    return {
      namespace,
      promptBuffer,
      promptWindow,
      resultsBuffer,
      resultsWindow,
      targetBuffer,
      targetMode,
      targetWindow,
      layout
    };
  }
  async configureHighlights() {
    const normal = await import_coc2.workspace.nvim.call("nvim_get_hl", [
      0,
      { name: "NormalFloat", link: false }
    ]);
    const border = await import_coc2.workspace.nvim.call("nvim_get_hl", [
      0,
      { name: "FloatBorder", link: false }
    ]);
    const pickerBorder = { ...border };
    for (const key of ["bg", "ctermbg", "blend"]) {
      if (normal[key] == null) delete pickerBorder[key];
      else pickerBorder[key] = normal[key];
    }
    await import_coc2.workspace.nvim.call("nvim_set_hl", [
      0,
      "CocUiPickerBorder",
      pickerBorder
    ]);
  }
  installCommands() {
    const state = this.state;
    if (!state) return;
    const mappings = [
      ["<Esc>", "ui.picker.close"],
      ["<C-c>", "ui.picker.close"],
      ["<Tab>", "ui.picker.actions"],
      ["<CR>", "ui.picker.accept"],
      ["<C-n>", "ui.picker.next"],
      ["<Down>", "ui.picker.next"],
      ["<C-p>", "ui.picker.previous"],
      ["<Up>", "ui.picker.previous"]
    ];
    for (const [key, command] of mappings) {
      void import_coc2.workspace.nvim.call("nvim_buf_set_keymap", [state.promptBuffer, "i", key, `<Cmd>CocCommand ${command}<CR>`, { noremap: true, silent: true, nowait: true }]);
    }
  }
};
var LAYOUT_MIN_COLUMNS_FLOOR = 40;
var activePicker;
function registerPickerCommands(picker) {
  activePicker = picker;
  return [
    import_coc2.commands.registerCommand("ui.picker.close", () => activePicker?.close()),
    import_coc2.commands.registerCommand("ui.picker.resume", () => activePicker?.resume()),
    import_coc2.commands.registerCommand(
      "ui.picker.actions",
      () => activePicker?.showActions()
    ),
    import_coc2.commands.registerCommand("ui.picker.accept", () => activePicker?.accept()),
    import_coc2.commands.registerCommand("ui.picker.next", () => activePicker?.move(1)),
    import_coc2.commands.registerCommand("ui.picker.previous", () => activePicker?.move(-1))
  ];
}

// src/tree/tree-decoration.ts
var import_coc3 = require("coc.nvim");

// src/tree/tree-decoration-model.ts
var CollapsibleState = {
  None: 0,
  Collapsed: 1,
  Expanded: 2
};
var TREE_INDENT_GUIDE_HL = "CocUiTreeIndentGuide";
var TREE_DISCLOSURE_HL = "CocTreeOpenClose";
function isCollapsible(state) {
  return state === CollapsibleState.Collapsed || state === CollapsibleState.Expanded;
}
function disclosureMarkerFor(state, settings) {
  if (state === CollapsibleState.Expanded) {
    return settings.disclosureExpanded || void 0;
  }
  if (state === CollapsibleState.Collapsed) {
    return settings.disclosureCollapsed || void 0;
  }
  return void 0;
}
function planTreeDecorations(entries, startLine, settings, filtering, indentColumns) {
  const marks = [];
  const guide = settings.indentGuidesEnabled ? settings.indentGuideCharacter : "";
  const width = Math.max(0, indentColumns);
  for (let index = 0; index < entries.length; index += 1) {
    const { level, collapsibleState } = entries[index];
    const line = startLine + index;
    if (guide) {
      for (let ancestor = 0; ancestor < level; ancestor += 1) {
        marks.push({
          line,
          col: ancestor * width,
          text: guide,
          hlGroup: TREE_INDENT_GUIDE_HL
        });
      }
    }
    if (filtering || !isCollapsible(collapsibleState)) continue;
    const marker = disclosureMarkerFor(collapsibleState, settings);
    if (!marker) continue;
    marks.push({
      line,
      col: level * width,
      text: marker,
      hlGroup: TREE_DISCLOSURE_HL
    });
  }
  return marks;
}

// src/tree/native-tree-view.ts
var NATIVE_TREE_INDENT_COLUMNS = 2;
function collapsibleStateOf(item) {
  const state = item?.collapsibleState;
  if (state === CollapsibleState.Expanded) return CollapsibleState.Expanded;
  if (state === CollapsibleState.Collapsed) return CollapsibleState.Collapsed;
  return CollapsibleState.None;
}
function getNativeTreeDecorationSnapshot(tree) {
  const surface = tree;
  if (!Array.isArray(surface.renderedItems)) return void 0;
  const nodesMap = surface.nodesMap;
  const entries = surface.renderedItems.map(
    ({ level, node }) => ({
      level,
      collapsibleState: collapsibleStateOf(nodesMap?.get(node)?.item)
    })
  );
  return {
    startLnum: typeof surface.startLnum === "number" && surface.startLnum >= 0 ? surface.startLnum : 0,
    filtering: surface.filtering === true,
    indentColumns: NATIVE_TREE_INDENT_COLUMNS,
    entries
  };
}
function onNativeTreeDidRender(tree, listener) {
  const event = tree.onDidRefrash;
  if (!event) return void 0;
  return event(listener);
}

// src/tree/tree-decoration.ts
function readTreeDecorationSettings() {
  const config = import_coc3.workspace.getConfiguration("ui");
  return {
    indentGuidesEnabled: config.get("tree.indentGuides.enabled", true),
    indentGuideCharacter: config.get(
      "tree.indentGuides.character",
      "\u2502"
    ),
    disclosureCollapsed: config.get("tree.disclosure.collapsed", "\uF460"),
    disclosureExpanded: config.get("tree.disclosure.expanded", "\uF47C")
  };
}
var TreeViewDecoration = class {
  constructor(tree) {
    this.tree = tree;
    const onDidRender = onNativeTreeDidRender(tree, () => this.schedule());
    this.disposables.push(
      import_coc3.Disposable.create(() => {
        if (this.timer) clearTimeout(this.timer);
      }),
      // Expand/collapse updates nodesMap + buffer without firing onDidRefrash.
      tree.onDidExpandElement(() => this.schedule()),
      tree.onDidCollapseElement(() => this.schedule()),
      tree.onDidChangeVisibility(({ visible }) => {
        if (visible) this.schedule();
      }),
      import_coc3.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration("ui.tree")) this.schedule();
      })
    );
    if (onDidRender) this.disposables.push(onDidRender);
    this.schedule();
  }
  disposables = [];
  namespace;
  timer;
  revision = 0;
  disposed = false;
  dispose() {
    this.disposed = true;
    this.revision += 1;
    if (this.timer) clearTimeout(this.timer);
    for (const disposable of this.disposables) disposable.dispose();
  }
  schedule(delay = 0) {
    const revision = ++this.revision;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = void 0;
      void this.render(revision);
    }, delay);
  }
  async render(revision) {
    if (this.disposed || revision !== this.revision || !this.tree.windowId) {
      return;
    }
    try {
      const nvim = import_coc3.workspace.nvim;
      const supported = await nvim.call("has", ["nvim-0.5"]) === 1;
      if (!supported || revision !== this.revision) return;
      const snapshot = getNativeTreeDecorationSnapshot(this.tree);
      if (!snapshot || revision !== this.revision) return;
      const bufnr = await nvim.call("nvim_win_get_buf", [
        this.tree.windowId
      ]);
      const namespace = await this.getNamespace();
      if (revision !== this.revision) return;
      const settings = readTreeDecorationSettings();
      const marks = planTreeDecorations(
        snapshot.entries,
        snapshot.startLnum,
        settings,
        snapshot.filtering,
        snapshot.indentColumns
      );
      nvim.pauseNotification();
      nvim.call("nvim_buf_clear_namespace", [bufnr, namespace, 0, -1], true);
      if (settings.indentGuidesEnabled && settings.indentGuideCharacter) {
        nvim.command(
          `highlight default link ${TREE_INDENT_GUIDE_HL} LineNr`,
          true
        );
      }
      for (const mark of marks) {
        nvim.call(
          "nvim_buf_set_extmark",
          [
            bufnr,
            namespace,
            mark.line,
            mark.col,
            {
              virt_text: [[mark.text, mark.hlGroup]],
              virt_text_pos: "overlay",
              hl_mode: "combine"
            }
          ],
          true
        );
      }
      await nvim.resumeNotification(false);
    } catch {
    }
  }
  async getNamespace() {
    if (this.namespace === void 0) {
      this.namespace = await import_coc3.workspace.nvim.call("nvim_create_namespace", [
        "coc-ui-tree-decoration"
      ]);
    }
    return this.namespace;
  }
};
function attachTreeViewDecoration(tree) {
  return new TreeViewDecoration(tree);
}

// src/tree/tree-view-options.ts
function toNativeTreeViewOptions(options) {
  return {
    ...options,
    bufhidden: options.bufhidden ?? "hide",
    disableLeafIndent: true
  };
}

// src/index.ts
var ViewContainerLocation = {
  Sidebar: "primarySidebar",
  AuxiliaryBar: "secondarySidebar",
  Panel: "panel"
};
var CocUi = class {
  constructor(context) {
    this.context = context;
  }
  containers = /* @__PURE__ */ new Map();
  viewRegistrations = /* @__PURE__ */ new Map();
  views = /* @__PURE__ */ new Map();
  surfaces = /* @__PURE__ */ new Map();
  unmountingContainers = /* @__PURE__ */ new Set();
  editorWindowId;
  listPicker = new ListPicker();
  registerViewContainer(registration) {
    if (this.containers.has(registration.id)) {
      throw new Error(`View container already registered: ${registration.id}`);
    }
    this.containers.set(registration.id, {
      title: registration.title,
      icon: registration.icon ?? "\u2022",
      location: registration.location ?? "primarySidebar",
      order: registration.order ?? 0,
      viewIds: []
    });
    void this.renderActivityBar(registration.location ?? "primarySidebar");
    return import_coc4.Disposable.create(() => {
      void this.closeContainer(registration.id);
      this.containers.delete(registration.id);
    });
  }
  registerView(registration) {
    if (this.viewRegistrations.has(registration.id) || this.views.has(registration.id)) {
      throw new Error(`View already registered: ${registration.id}`);
    }
    const container = this.containers.get(registration.containerId);
    if (!container) {
      throw new Error(`Unknown view container: ${registration.containerId}`);
    }
    this.viewRegistrations.set(registration.id, registration);
    return import_coc4.Disposable.create(() => {
      this.viewRegistrations.delete(registration.id);
      this.views.delete(registration.id);
      container.viewIds = container.viewIds.filter(
        (id) => id !== registration.id
      );
    });
  }
  createTreeView(id, options) {
    if (this.views.has(id)) {
      throw new Error(`TreeView already created: ${id}`);
    }
    const registration = this.viewRegistrations.get(id);
    if (!registration) {
      throw new Error(`View contribution not registered: ${id}`);
    }
    const container = this.requireContainer(registration.containerId);
    const { actions = [], ...treeOptions } = options;
    const treeDataProvider = withViewActions(
      treeOptions.treeDataProvider,
      actions
    );
    const tree = import_coc4.window.createTreeView(
      id,
      toNativeTreeViewOptions({
        ...treeOptions,
        treeDataProvider
      })
    );
    const keymappableTree = tree;
    if (typeof keymappableTree.registerLocalKeymap !== "function") {
      throw new Error(
        "Installed coc.nvim does not support TreeView keybindings"
      );
    }
    const actionsByKey = /* @__PURE__ */ new Map();
    for (const action of actions) {
      for (const key of action.keys ?? []) {
        const keyedActions = actionsByKey.get(key) ?? [];
        keyedActions.push(action);
        actionsByKey.set(key, keyedActions);
      }
    }
    for (const [key, keyedActions] of actionsByKey) {
      keymappableTree.registerLocalKeymap(
        "n",
        key,
        (element) => {
          if (!element) return;
          const action = keyedActions.find(
            (candidate) => !candidate.when || candidate.when(element)
          );
          if (action) return action.handler(element);
        },
        true
      );
    }
    tree.title = registration.name;
    const registered = {
      containerId: registration.containerId,
      name: registration.name,
      order: registration.order ?? 0,
      visibility: this.context.workspaceState.get(
        this.viewStateKey(id),
        registration.visibility ?? "visible"
      ),
      tree,
      disposables: []
    };
    this.views.set(id, registered);
    container.viewIds.push(id);
    this.sortViews(container);
    registered.disposables.push(
      attachTreeViewDecoration(tree),
      tree.onDidChangeVisibility(({ visible }) => {
        if (!visible) void this.onViewHidden(id);
      })
    );
    return tree;
  }
  async showContainer(id, options) {
    const container = this.requireContainer(id);
    const visibleViews = this.containerViews(container).filter(
      (view) => view.visibility !== "hidden"
    );
    if (!visibleViews.length) {
      throw new Error(`View container has no views: ${id}`);
    }
    await this.withRedrawSuppressed(async () => {
      const editorWindowId = await this.findEditorWindow();
      if (editorWindowId) this.editorWindowId = editorWindowId;
      const surface = this.surface(container.location);
      if (surface.activeContainerId && surface.activeContainerId !== id) {
        await this.unmountContainer(surface.activeContainerId);
      }
      surface.activeContainerId = id;
      surface.visible = true;
      await this.closePlaceholder(container.location);
      await this.ensureActivityBar(container.location);
      await this.mountContainer(id);
      await this.layoutContainer(id);
      await this.renderActivityBar(container.location);
      if (options?.focus !== false) {
        const target = visibleViews.find((view) => view.visibility === "visible") ?? visibleViews[0];
        if (target?.tree.windowId) {
          await import_coc4.workspace.nvim.call("win_gotoid", [target.tree.windowId]);
        }
      } else if (editorWindowId) {
        await import_coc4.workspace.nvim.call("win_gotoid", [editorWindowId]);
      }
    });
  }
  async switchLocation(location) {
    const containers = [...this.containers.entries()].filter(([, container]) => container.location === location).sort(([, left], [, right]) => left.order - right.order);
    if (!containers.length) return;
    const index = await import_coc4.window.showQuickpick(
      containers.map(([id, container]) => `${container.title} (${id})`),
      "Select view container"
    );
    if (index >= 0) await this.showContainer(containers[index][0]);
  }
  async showLocation(location) {
    const surface = this.surface(location);
    const containerId = surface.activeContainerId ?? this.firstContainerId(location);
    if (containerId) await this.showContainer(containerId);
    else await this.showEmptyLocation(location);
  }
  async hideLocation(location) {
    const surface = this.surface(location);
    if (surface.activeContainerId) {
      await this.unmountContainer(surface.activeContainerId);
    }
    await this.closePlaceholder(location);
    surface.visible = false;
    await this.closeActivityBar(location);
  }
  async toggleLocation(location) {
    const surface = this.surface(location);
    if (surface.visible && !surface.activeContainerId && !await this.isValidWindow(surface.placeholder?.winid)) {
      surface.visible = false;
    }
    if (surface.visible) await this.hideLocation(location);
    else await this.showLocation(location);
  }
  async selectActivityBar(location) {
    const activityBar = this.surface(location).activityBar;
    if (!activityBar || !await this.isValidWindow(activityBar.winid)) return;
    const [line] = await import_coc4.workspace.nvim.call("nvim_win_get_cursor", [
      activityBar.winid
    ]);
    const containerId = activityBar.containerIds[line - 1];
    if (containerId) await this.showContainer(containerId);
  }
  async closeLocation(location) {
    const containerId = this.surface(location).activeContainerId;
    if (containerId) await this.closeContainer(containerId);
    else await this.hideLocation(location);
  }
  async toggleViewAtMouse(id) {
    const view = this.requireView(id);
    const [mouseWindowId, line] = await import_coc4.workspace.nvim.call(
      "coc#ui#get_mouse"
    );
    if (mouseWindowId === view.tree.windowId && line === 1) {
      await this.toggleView(id);
    }
  }
  async showView(id, options = {}) {
    const view = this.requireView(id);
    view.visibility = "visible";
    await this.context.workspaceState.update(
      this.viewStateKey(id),
      view.visibility
    );
    await this.showContainer(view.containerId, { focus: false });
    await this.layoutContainer(view.containerId);
    if (options.focus !== false && view.tree.windowId) {
      await import_coc4.workspace.nvim.call("win_gotoid", [view.tree.windowId]);
    }
  }
  async closeContainer(id) {
    const container = this.requireContainer(id);
    await this.unmountContainer(id);
    const surface = this.surface(container.location);
    if (surface.activeContainerId === id) {
      surface.activeContainerId = void 0;
      surface.visible = false;
      await this.closeActivityBar(container.location);
    }
  }
  async toggleView(id) {
    const view = this.requireView(id);
    view.visibility = view.visibility === "collapsed" ? "visible" : "collapsed";
    await this.context.workspaceState.update(
      this.viewStateKey(id),
      view.visibility
    );
    await this.showContainer(view.containerId, { focus: false });
    await this.layoutContainer(view.containerId);
    if (view.tree.windowId) {
      await import_coc4.workspace.nvim.call("win_gotoid", [view.tree.windowId]);
    }
  }
  async toggleTreeItem(id) {
    const view = this.requireView(id);
    if (!view.tree.windowId) return;
    await import_coc4.workspace.nvim.call("win_gotoid", [view.tree.windowId]);
    const key = import_coc4.workspace.getConfiguration("tree").get("key.toggle", "t");
    await import_coc4.workspace.nvim.input(key);
  }
  async openLocation(uri, line, character) {
    const editorWindowId = await this.findEditorWindow();
    if (editorWindowId) {
      this.editorWindowId = editorWindowId;
      await import_coc4.workspace.nvim.call("win_gotoid", [editorWindowId]);
    }
    await import_coc4.workspace.jumpTo(uri, import_coc4.Position.create(line, character), "edit");
  }
  async pickList(name, args = []) {
    await this.listPicker.show(name, args);
  }
  dispose() {
    this.listPicker.dispose();
    for (const view of this.views.values()) {
      for (const disposable of view.disposables) disposable.dispose();
      view.tree.dispose();
    }
    this.views.clear();
    this.viewRegistrations.clear();
    this.containers.clear();
    for (const surface of this.surfaces.values()) {
      if (surface.activityBar) {
        import_coc4.workspace.nvim.call(
          "nvim_buf_delete",
          [surface.activityBar.bufnr, { force: true }],
          true
        );
      }
      if (surface.placeholder) {
        import_coc4.workspace.nvim.call(
          "nvim_buf_delete",
          [surface.placeholder.bufnr, { force: true }],
          true
        );
      }
    }
    this.surfaces.clear();
  }
  requireContainer(id) {
    const container = this.containers.get(id);
    if (!container) throw new Error(`Unknown view container: ${id}`);
    return container;
  }
  requireView(id) {
    const view = this.views.get(id);
    if (!view) throw new Error(`Unknown view: ${id}`);
    return view;
  }
  viewStateKey(id) {
    return `view.${id}.visibility`;
  }
  async withRedrawSuppressed(operation) {
    const lazyredraw = await import_coc4.workspace.nvim.getOption(
      "lazyredraw"
    );
    if (!lazyredraw) await import_coc4.workspace.nvim.setOption("lazyredraw", true);
    try {
      return await operation();
    } finally {
      if (!lazyredraw) await import_coc4.workspace.nvim.setOption("lazyredraw", false);
      await import_coc4.workspace.nvim.command("redraw");
    }
  }
  sortViews(container) {
    container.viewIds.sort((left, right) => {
      return this.requireView(left).order - this.requireView(right).order;
    });
  }
  containerViews(container) {
    return container.viewIds.map((id) => this.requireView(id));
  }
  surface(location) {
    let surface = this.surfaces.get(location);
    if (!surface) {
      surface = { visible: false };
      this.surfaces.set(location, surface);
    }
    return surface;
  }
  firstContainerId(location) {
    return [...this.containers.entries()].filter(([, container]) => container.location === location).sort(([, left], [, right]) => left.order - right.order)[0]?.[0];
  }
  async mountContainer(id) {
    const container = this.requireContainer(id);
    const entries = container.viewIds.map((viewId) => [viewId, this.requireView(viewId)]).filter(([, view]) => view.visibility !== "hidden");
    let anchorWindowId;
    for (const [viewId, view] of entries) {
      if (await this.isValidWindow(view.tree.windowId)) {
        anchorWindowId = view.tree.windowId;
        continue;
      }
      const targetWindowId = anchorWindowId ?? await this.findEditorWindow();
      if (targetWindowId) {
        await import_coc4.workspace.nvim.call("win_gotoid", [targetWindowId]);
      }
      await view.tree.show(
        anchorWindowId ? this.stackSplitCommand(container.location) : this.splitCommand(container.location)
      );
      await this.installViewKeymaps(
        viewId,
        view.containerId,
        view.tree.windowId
      );
      anchorWindowId = view.tree.windowId;
    }
  }
  async unmountContainer(id) {
    const container = this.requireContainer(id);
    this.unmountingContainers.add(id);
    try {
      for (const view of this.containerViews(container)) {
        const winid = view.tree.windowId;
        if (await this.isValidWindow(winid)) {
          await import_coc4.workspace.nvim.call("nvim_win_close", [winid, true]);
        }
      }
    } finally {
      this.unmountingContainers.delete(id);
    }
  }
  async onViewHidden(id) {
    const view = this.views.get(id);
    if (!view || this.unmountingContainers.has(view.containerId)) return;
    const container = this.containers.get(view.containerId);
    if (!container) return;
    const surface = this.surface(container.location);
    if (surface.activeContainerId !== view.containerId) return;
    for (const sibling of this.containerViews(container)) {
      if (await this.isValidWindow(sibling.tree.windowId)) {
        await this.layoutContainer(view.containerId);
        return;
      }
    }
    surface.visible = false;
    await this.closeActivityBar(container.location);
  }
  async isValidWindow(winid) {
    if (!winid) return false;
    return await import_coc4.workspace.nvim.call("nvim_win_is_valid", [winid]);
  }
  async findEditorWindow() {
    const uiWindowIds = new Set(
      [...this.views.values()].map((view) => view.tree.windowId).filter((winid) => winid != null)
    );
    for (const surface of this.surfaces.values()) {
      if (surface.activityBar?.winid)
        uiWindowIds.add(surface.activityBar.winid);
      if (surface.placeholder?.winid)
        uiWindowIds.add(surface.placeholder.winid);
    }
    const currentWindowId = await import_coc4.workspace.nvim.call("win_getid");
    if (!uiWindowIds.has(currentWindowId)) return currentWindowId;
    if (this.editorWindowId) {
      const valid = await import_coc4.workspace.nvim.call("nvim_win_is_valid", [
        this.editorWindowId
      ]);
      if (valid) return this.editorWindowId;
    }
    const windowIds = await import_coc4.workspace.nvim.call("nvim_list_wins");
    return windowIds.find((winid) => !uiWindowIds.has(winid));
  }
  splitCommand(location) {
    const config = import_coc4.workspace.getConfiguration("ui");
    if (location === "panel") {
      const height = Math.max(3, config.get("panel.height", 12));
      return `botright ${height}split`;
    }
    const primary = location === "primarySidebar";
    const position = config.get(
      primary ? "primarySidebar.position" : "secondarySidebar.position",
      primary ? "left" : "right"
    );
    const width = Math.max(
      10,
      config.get(
        primary ? "primarySidebar.width" : "secondarySidebar.width",
        40
      )
    );
    return `${position === "left" ? "leftabove" : "rightbelow"} ${width}vsplit`;
  }
  async showEmptyLocation(location) {
    const surface = this.surface(location);
    if (await this.isValidWindow(surface.placeholder?.winid)) {
      surface.visible = true;
      await import_coc4.workspace.nvim.call("win_gotoid", [surface.placeholder?.winid]);
      return;
    }
    const editorWindowId = await this.findEditorWindow();
    if (!editorWindowId) return;
    this.editorWindowId = editorWindowId;
    await import_coc4.workspace.nvim.call("win_gotoid", [editorWindowId]);
    await import_coc4.workspace.nvim.command(this.splitCommand(location));
    const winid = await import_coc4.workspace.nvim.call("win_getid");
    const bufnr = await import_coc4.workspace.nvim.call("nvim_create_buf", [
      false,
      true
    ]);
    await import_coc4.workspace.nvim.call("nvim_buf_set_name", [
      bufnr,
      `coc-ui-placeholder://${location}`
    ]);
    await import_coc4.workspace.nvim.call("nvim_win_set_buf", [winid, bufnr]);
    await import_coc4.workspace.nvim.call("nvim_buf_set_lines", [
      bufnr,
      0,
      -1,
      false,
      ["No components mounted"]
    ]);
    for (const [name, value] of [
      ["buftype", "nofile"],
      ["bufhidden", "wipe"],
      ["modifiable", false],
      ["readonly", true],
      ["swapfile", false],
      ["filetype", "cocui-placeholder"]
    ]) {
      await import_coc4.workspace.nvim.call("nvim_buf_set_option", [bufnr, name, value]);
    }
    for (const [name, value] of [
      ["number", false],
      ["relativenumber", false],
      ["wrap", false],
      ["winfixwidth", location !== "panel"],
      ["winfixheight", location === "panel"],
      ["signcolumn", "no"],
      ["statusline", "%!repeat('\u2500',winwidth(g:statusline_winid))"]
    ]) {
      await import_coc4.workspace.nvim.call("nvim_win_set_option", [winid, name, value]);
    }
    const rhs = `<Cmd>CocCommand ui.hideLocation ${location}<CR>`;
    const options = { noremap: true, silent: true, nowait: true };
    await import_coc4.workspace.nvim.call("nvim_buf_set_keymap", [
      bufnr,
      "n",
      "q",
      rhs,
      options
    ]);
    surface.placeholder = { bufnr, winid };
    surface.visible = true;
  }
  async closePlaceholder(location) {
    const surface = this.surface(location);
    const placeholder = surface.placeholder;
    if (!placeholder) return;
    surface.placeholder = void 0;
    const valid = await import_coc4.workspace.nvim.call("nvim_buf_is_valid", [
      placeholder.bufnr
    ]);
    if (valid) {
      await import_coc4.workspace.nvim.call("nvim_buf_delete", [
        placeholder.bufnr,
        { force: true }
      ]);
    }
  }
  stackSplitCommand(location) {
    return location === "panel" ? "rightbelow vsplit" : "belowright split";
  }
  async layoutContainer(id) {
    const container = this.requireContainer(id);
    const entries = [];
    for (const view of this.containerViews(container)) {
      if (view.visibility === "hidden" || !view.tree.windowId) continue;
      if (await this.isValidWindow(view.tree.windowId)) {
        entries.push([view, view.tree.windowId]);
      }
    }
    if (!entries.length) return;
    const config = import_coc4.workspace.getConfiguration("ui");
    if (container.location === "panel") {
      const height = Math.max(3, config.get("panel.height", 12));
      for (const [, winid] of entries) {
        await import_coc4.workspace.nvim.call("nvim_win_set_height", [winid, height]);
      }
      const widths = await Promise.all(
        entries.map(
          ([, winid]) => import_coc4.workspace.nvim.call("nvim_win_get_width", [winid])
        )
      );
      const totalWidth = widths.reduce((sum, value) => sum + value, 0);
      const expanded2 = entries.filter(
        ([view]) => view.visibility !== "collapsed"
      );
      const collapsed2 = entries.filter(
        ([view]) => view.visibility === "collapsed"
      );
      const collapsedWidth = 12;
      for (const [, winid] of collapsed2) {
        await import_coc4.workspace.nvim.call("nvim_win_set_width", [
          winid,
          collapsedWidth
        ]);
      }
      if (expanded2.length) {
        const width2 = Math.max(
          12,
          Math.floor(
            (totalWidth - collapsed2.length * collapsedWidth) / expanded2.length
          )
        );
        for (const [, winid] of expanded2) {
          await import_coc4.workspace.nvim.call("nvim_win_set_width", [winid, width2]);
        }
      }
      return;
    }
    const primary = container.location === "primarySidebar";
    const width = Math.max(
      10,
      config.get(
        primary ? "primarySidebar.width" : "secondarySidebar.width",
        40
      )
    );
    for (const [, winid] of entries) {
      await import_coc4.workspace.nvim.call("nvim_win_set_width", [winid, width]);
    }
    const heights = await Promise.all(
      entries.map(
        ([, winid]) => import_coc4.workspace.nvim.call("nvim_win_get_height", [winid])
      )
    );
    const totalHeight = heights.reduce((sum, height) => sum + height, 0);
    const expanded = entries.filter(
      ([view]) => view.visibility !== "collapsed"
    );
    const collapsed = entries.filter(
      ([view]) => view.visibility === "collapsed"
    );
    for (const [, winid] of collapsed) {
      await import_coc4.workspace.nvim.call("nvim_win_set_height", [winid, 1]);
    }
    if (expanded.length) {
      const height = Math.max(
        2,
        Math.floor((totalHeight - collapsed.length) / expanded.length)
      );
      for (const [, winid] of expanded) {
        await import_coc4.workspace.nvim.call("nvim_win_set_height", [winid, height]);
      }
    }
  }
  async ensureActivityBar(location) {
    if (location === "panel") return;
    if (!import_coc4.workspace.getConfiguration("ui").get("activityBar.enable", true)) {
      return;
    }
    const surface = this.surface(location);
    if (await this.isValidWindow(surface.activityBar?.winid)) {
      await this.renderActivityBar(location);
      return;
    }
    const editorWindowId = await this.findEditorWindow();
    if (!editorWindowId) return;
    await import_coc4.workspace.nvim.call("win_gotoid", [editorWindowId]);
    const config = import_coc4.workspace.getConfiguration("ui");
    const primary = location === "primarySidebar";
    const position = config.get(
      primary ? "primarySidebar.position" : "secondarySidebar.position",
      primary ? "left" : "right"
    );
    const width = Math.max(2, config.get("activityBar.width", 3));
    await import_coc4.workspace.nvim.command(
      `${position === "left" ? "leftabove" : "rightbelow"} ${width}vsplit`
    );
    const winid = await import_coc4.workspace.nvim.call("win_getid");
    const bufnr = await import_coc4.workspace.nvim.call("nvim_create_buf", [
      false,
      true
    ]);
    await import_coc4.workspace.nvim.call("nvim_buf_set_name", [
      bufnr,
      `coc-ui-activitybar://${location}`
    ]);
    await import_coc4.workspace.nvim.call("nvim_win_set_buf", [winid, bufnr]);
    await import_coc4.workspace.nvim.call("nvim_buf_set_option", [
      bufnr,
      "buftype",
      "nofile"
    ]);
    await import_coc4.workspace.nvim.call("nvim_buf_set_option", [
      bufnr,
      "bufhidden",
      "wipe"
    ]);
    await import_coc4.workspace.nvim.call("nvim_buf_set_option", [
      bufnr,
      "swapfile",
      false
    ]);
    await import_coc4.workspace.nvim.call("nvim_buf_set_option", [
      bufnr,
      "filetype",
      "cocui-activitybar"
    ]);
    for (const [name, value] of [
      ["number", false],
      ["relativenumber", false],
      ["cursorline", true],
      ["wrap", false],
      ["winfixwidth", true],
      ["signcolumn", "no"],
      ["statusline", "\u2500".repeat(width)]
    ]) {
      await import_coc4.workspace.nvim.call("nvim_win_set_option", [winid, name, value]);
    }
    await import_coc4.workspace.nvim.call("nvim_win_set_width", [winid, width]);
    const options = { noremap: true, silent: true, nowait: true };
    const select = `<Cmd>CocCommand ui.selectActivityBar ${location}<CR>`;
    await import_coc4.workspace.nvim.call("nvim_buf_set_keymap", [
      bufnr,
      "n",
      "<CR>",
      select,
      options
    ]);
    await import_coc4.workspace.nvim.call("nvim_buf_set_keymap", [
      bufnr,
      "n",
      "<LeftRelease>",
      select,
      options
    ]);
    await import_coc4.workspace.nvim.call("nvim_buf_set_keymap", [
      bufnr,
      "n",
      "<RightMouse>",
      `<Cmd>CocCommand ui.switch${primary ? "PrimarySidebar" : "SecondarySidebar"}<CR>`,
      options
    ]);
    await import_coc4.workspace.nvim.call("nvim_buf_set_keymap", [
      bufnr,
      "n",
      "q",
      `<Cmd>CocCommand ui.hideLocation ${location}<CR>`,
      options
    ]);
    surface.activityBar = { bufnr, winid, containerIds: [] };
    await this.renderActivityBar(location);
  }
  async closeActivityBar(location) {
    const surface = this.surface(location);
    const activityBar = surface.activityBar;
    if (!activityBar) return;
    surface.activityBar = void 0;
    const valid = await import_coc4.workspace.nvim.call("nvim_buf_is_valid", [
      activityBar.bufnr
    ]);
    if (valid) {
      await import_coc4.workspace.nvim.call("nvim_buf_delete", [
        activityBar.bufnr,
        { force: true }
      ]);
    }
  }
  async renderActivityBar(location) {
    if (location === "panel") return;
    const surface = this.surface(location);
    const activityBar = surface.activityBar;
    if (!activityBar || !await this.isValidWindow(activityBar.winid)) return;
    const width = Math.max(
      2,
      import_coc4.workspace.getConfiguration("ui").get("activityBar.width", 3)
    );
    await import_coc4.workspace.nvim.call("nvim_win_set_width", [activityBar.winid, width]);
    const containers = [...this.containers.entries()].filter(([, container]) => container.location === location).sort(([, left], [, right]) => left.order - right.order);
    activityBar.containerIds = containers.map(([id]) => id);
    const lines = containers.map(([, container]) => ` ${container.icon}`);
    await import_coc4.workspace.nvim.call("nvim_buf_set_option", [
      activityBar.bufnr,
      "modifiable",
      true
    ]);
    await import_coc4.workspace.nvim.call("nvim_buf_set_lines", [
      activityBar.bufnr,
      0,
      -1,
      false,
      lines.length ? lines : [""]
    ]);
    await import_coc4.workspace.nvim.call("nvim_buf_set_option", [
      activityBar.bufnr,
      "modifiable",
      false
    ]);
    await import_coc4.workspace.nvim.call("nvim_buf_clear_namespace", [
      activityBar.bufnr,
      -1,
      0,
      -1
    ]);
    const activeLine = activityBar.containerIds.indexOf(
      surface.activeContainerId ?? ""
    );
    if (activeLine >= 0) {
      await import_coc4.workspace.nvim.call("nvim_win_set_cursor", [
        activityBar.winid,
        [activeLine + 1, 0]
      ]);
      await import_coc4.workspace.nvim.call("nvim_buf_add_highlight", [
        activityBar.bufnr,
        -1,
        "CocUiActivityBarActive",
        activeLine,
        0,
        -1
      ]);
    }
  }
  async installViewKeymaps(viewId, containerId, windowId) {
    if (!windowId) return;
    const bufferId = await import_coc4.workspace.nvim.call("nvim_win_get_buf", [
      windowId
    ]);
    const location = this.requireContainer(containerId).location;
    const rhs = `<Cmd>CocCommand ui.hideLocation ${location}<CR>`;
    const options = { noremap: true, silent: true, nowait: true };
    await import_coc4.workspace.nvim.call("nvim_buf_set_keymap", [
      bufferId,
      "n",
      "q",
      rhs,
      options
    ]);
    await import_coc4.workspace.nvim.call("nvim_buf_set_keymap", [
      bufferId,
      "n",
      "za",
      `<Cmd>CocCommand ui.toggleView ${viewId}<CR>`,
      options
    ]);
    await import_coc4.workspace.nvim.call("nvim_buf_set_keymap", [
      bufferId,
      "n",
      "<2-LeftMouse>",
      `<Cmd>CocCommand ui.toggleViewAtMouse ${viewId}<CR>`,
      options
    ]);
    if (import_coc4.workspace.getConfiguration("ui").get("mouse.enable", true)) {
      const contextMenu = `<Cmd>CocCommand ui.contextMenu ${viewId}<CR>`;
      await import_coc4.workspace.nvim.call("nvim_buf_set_keymap", [
        bufferId,
        "n",
        "<RightMouse>",
        contextMenu,
        options
      ]);
      await import_coc4.workspace.nvim.call("nvim_buf_set_keymap", [
        bufferId,
        "n",
        "<RightRelease>",
        "<Nop>",
        options
      ]);
    }
  }
  async showContextMenu(id) {
    const view = this.requireView(id);
    const windowId = view.tree.windowId;
    if (!windowId) return;
    const [mouseWindowId, line, column] = await import_coc4.workspace.nvim.call(
      "coc#ui#get_mouse"
    );
    if (mouseWindowId !== windowId || line < 1) return;
    await import_coc4.workspace.nvim.call("win_gotoid", [windowId]);
    await import_coc4.workspace.nvim.call("nvim_win_set_cursor", [
      windowId,
      [line, Math.max(0, column - 1)]
    ]);
    const key = import_coc4.workspace.getConfiguration("tree").get("key.actions", "<Tab>");
    await import_coc4.workspace.nvim.input(key);
  }
  async routeRightClick() {
    const [mouseWindowId] = await import_coc4.workspace.nvim.call("coc#ui#get_mouse");
    const view = [...this.views.entries()].find(
      ([, registered]) => registered.tree.windowId === mouseWindowId
    );
    if (view) {
      await this.showContextMenu(view[0]);
      return;
    }
    const termcodes = await import_coc4.workspace.nvim.call("nvim_replace_termcodes", [
      "<RightMouse>",
      true,
      false,
      true
    ]);
    await import_coc4.workspace.nvim.feedKeys(termcodes, "n", false);
  }
};
function withViewActions(provider, actions) {
  if (!actions.length) return provider;
  return {
    onDidChangeTreeData: provider.onDidChangeTreeData,
    getTreeItem: (element) => provider.getTreeItem(element),
    getChildren: (element) => provider.getChildren(element),
    getParent: provider.getParent ? (element) => provider.getParent?.(element) : void 0,
    resolveTreeItem: provider.resolveTreeItem ? (item, element, token) => provider.resolveTreeItem?.(item, element, token) : void 0,
    resolveActions: async (item, element) => {
      const inherited = provider.resolveActions ? await provider.resolveActions(item, element) ?? [] : [];
      const contributed = actions.filter((action) => !action.when || action.when(element)).map((action) => ({
        title: action.title,
        handler: action.handler
      }));
      return [...inherited, ...contributed];
    }
  };
}
async function activate(context) {
  const ui = new CocUi(context);
  context.subscriptions.push(
    ui,
    ...registerPickerCommands(ui.listPicker),
    import_coc4.commands.registerCommand("ui.showContainer", (id) => {
      return ui.showContainer(String(id));
    }),
    import_coc4.commands.registerCommand("ui.showView", (id) => {
      return ui.showView(String(id));
    }),
    import_coc4.commands.registerCommand(
      "ui.pickList",
      (name, ...args) => ui.pickList(String(name), args.map(String))
    ),
    import_coc4.commands.registerCommand("ui.closeContainer", (id) => {
      return ui.closeContainer(String(id));
    }),
    import_coc4.commands.registerCommand("ui.closeLocation", (location) => {
      return ui.closeLocation(String(location));
    }),
    import_coc4.commands.registerCommand("ui.showLocation", (location) => {
      return ui.showLocation(String(location));
    }),
    import_coc4.commands.registerCommand("ui.hideLocation", (location) => {
      return ui.hideLocation(String(location));
    }),
    import_coc4.commands.registerCommand("ui.toggleLocation", (location) => {
      return ui.toggleLocation(String(location));
    }),
    import_coc4.commands.registerCommand("ui.togglePrimarySidebar", () => {
      return ui.toggleLocation("primarySidebar");
    }),
    import_coc4.commands.registerCommand("ui.toggleSecondarySidebar", () => {
      return ui.toggleLocation("secondarySidebar");
    }),
    import_coc4.commands.registerCommand("ui.togglePanel", () => {
      return ui.toggleLocation("panel");
    }),
    import_coc4.commands.registerCommand("ui.toggleView", (id) => {
      return ui.toggleView(String(id));
    }),
    import_coc4.commands.registerCommand("ui.toggleViewAtMouse", (id) => {
      return ui.toggleViewAtMouse(String(id));
    }),
    import_coc4.commands.registerCommand(
      "ui.selectActivityBar",
      (location) => {
        return ui.selectActivityBar(String(location));
      }
    ),
    import_coc4.commands.registerCommand("ui.contextMenu", (id) => {
      return ui.showContextMenu(String(id));
    }),
    import_coc4.commands.registerCommand("ui.routeRightMouse", () => {
      return ui.routeRightClick();
    }),
    import_coc4.commands.registerCommand("ui.switchPrimarySidebar", () => {
      return ui.switchLocation("primarySidebar");
    }),
    import_coc4.commands.registerCommand("ui.switchSecondarySidebar", () => {
      return ui.switchLocation("secondarySidebar");
    }),
    import_coc4.commands.registerCommand(
      "ui.switchPanel",
      () => ui.switchLocation("panel")
    )
  );
  await import_coc4.workspace.nvim.command(
    "highlight default link CocUiActivityBarActive CursorLine"
  );
  if (import_coc4.workspace.getConfiguration("ui").get("mouse.enable", true)) {
    import_coc4.workspace.nvim.setKeymap(
      "n",
      "<RightMouse>",
      "<Cmd>CocCommand ui.routeRightMouse<CR>",
      { noremap: true, silent: true, nowait: true }
    );
    context.subscriptions.push(
      import_coc4.Disposable.create(() => import_coc4.workspace.nvim.deleteKeymap("n", "<RightMouse>"))
    );
  }
  return ui;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ViewContainerLocation,
  activate
});
//# sourceMappingURL=index.js.map
