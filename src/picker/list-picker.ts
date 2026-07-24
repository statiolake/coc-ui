import {
  CancellationTokenSource,
  Disposable,
  IList,
  ListContext,
  ListItem,
  ListOptions,
  ListTask,
  commands,
  window,
  workspace,
} from "coc.nvim";
import { getListSource } from "./list-source";

type FloatState = {
  namespace: number;
  promptBuffer: number;
  promptWindow: number;
  resultsBuffer: number;
  resultsWindow: number;
  targetBuffer: number;
  targetWindow: number;
};

type MatchedItem = {
  item: ListItem;
  positions?: Uint32Array;
  score: number;
};

const DEFAULT_LIMIT = 10_000;
const DEFAULT_VISIBLE_ITEMS = 200;
const POLL_INTERVAL = 35;

export class ListPicker implements Disposable {
  private state: FloatState | undefined;
  private source: IList | undefined;
  private args: string[] = [];
  private items: ListItem[] = [];
  private visibleItems: MatchedItem[] = [];
  private readonly fuzzyMatch = workspace.createFuzzyMatch();
  private selected = 0;
  private input = "";
  private generation = 0;
  private tokenSource: CancellationTokenSource | undefined;
  private task: ListTask | undefined;
  private pollTimer: NodeJS.Timeout | undefined;
  private renderTimer: NodeJS.Timeout | undefined;
  private filterTimer: NodeJS.Timeout | undefined;
  private limit = DEFAULT_LIMIT;
  private visibleLimit = DEFAULT_VISIBLE_ITEMS;

  async show(name: string, args: string[] = []): Promise<void> {
    await this.close();
    const config = workspace.getConfiguration("ui.picker");
    this.limit = Math.max(100, config.get<number>("maxItems", DEFAULT_LIMIT));
    this.visibleLimit = Math.max(
      20,
      config.get<number>("visibleItems", DEFAULT_VISIBLE_ITEMS),
    );
    this.source = getListSource(name);
    this.args = args;
    this.state = await this.openWindows(name);
    this.installCommands();
    this.pollTimer = setInterval(() => void this.pollInput(), POLL_INTERVAL);
    await workspace.nvim.call("win_gotoid", [this.state.promptWindow]);
    await workspace.nvim.command("startinsert");
    await this.reload();
  }

  async close(): Promise<void> {
    this.cancelProducer();
    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.renderTimer) clearTimeout(this.renderTimer);
    if (this.filterTimer) clearTimeout(this.filterTimer);
    this.pollTimer = undefined;
    this.renderTimer = undefined;
    this.filterTimer = undefined;
    const state = this.state;
    this.state = undefined;
    if (!state) return;
    for (const winid of [state.promptWindow, state.resultsWindow]) {
      const valid = (await workspace.nvim.call("nvim_win_is_valid", [
        winid,
      ])) as boolean;
      if (valid) await workspace.nvim.call("nvim_win_close", [winid, true]);
    }
    const targetValid = (await workspace.nvim.call("nvim_win_is_valid", [
      state.targetWindow,
    ])) as boolean;
    if (targetValid) {
      await workspace.nvim.call("win_gotoid", [state.targetWindow]);
    }
  }

  dispose(): void {
    void this.close();
  }

  async move(delta: number): Promise<void> {
    if (!this.visibleItems.length) return;
    this.selected = Math.max(
      0,
      Math.min(this.visibleItems.length - 1, this.selected + delta),
    );
    await this.render();
  }

  async accept(): Promise<void> {
    const source = this.source;
    let item = this.visibleItems[this.selected]?.item;
    if (!source || !item) return;
    if (source.resolveItem) item = (await source.resolveItem(item)) ?? item;
    const action =
      source.actions.find((candidate) => candidate.name === source.defaultAction) ??
      source.actions[0];
    if (!action) return;
    const context = this.context(this.input);
    if (!action.persist) await this.close();
    await action.execute(item, context);
  }

  private async reload(): Promise<void> {
    const source = this.source;
    if (!source || !this.state) return;
    this.cancelProducer();
    const generation = ++this.generation;
    const tokenSource = (this.tokenSource = new CancellationTokenSource());
    this.items = [];
    this.visibleItems = [];
    this.selected = 0;
    this.scheduleRender();

    const loaded = await source.loadItems(
      this.context(this.input),
      tokenSource.token,
    );
    if (generation !== this.generation || tokenSource.token.isCancellationRequested)
      return;
    if (!loaded) return;
    if (Array.isArray(loaded)) {
      for (const item of loaded.slice(0, this.limit)) this.push(item, generation);
      this.scheduleFilter();
      return;
    }
    const task = (this.task = loaded);
    task.on("data", (item) => this.push(item, generation));
    task.on("end", () => {
      if (generation === this.generation) this.task = undefined;
    });
    task.on("error", (error) => {
      if (generation !== this.generation) return;
      this.task = undefined;
      void this.close();
      void window.showErrorMessage(`Picker source failed: ${String(error)}`);
    });
  }

  private push(item: ListItem, generation: number): void {
    if (generation !== this.generation) return;
    if (this.items.length >= this.limit) {
      this.task?.dispose();
      this.task = undefined;
      return;
    }
    this.items.push(item);
    this.scheduleFilter();
  }

  private scheduleFilter(): void {
    if (this.filterTimer) return;
    this.filterTimer = setTimeout(() => {
      this.filterTimer = undefined;
      this.applyFilter();
    }, POLL_INTERVAL);
  }

  private applyFilter(): void {
    const query = this.input;
    let filtered: MatchedItem[];
    if (this.source?.interactive || query.length === 0) {
      filtered = this.items.map((item) => ({ item, score: 0 }));
    } else {
      this.fuzzyMatch.setPattern(query);
      filtered = this.items
        .map((item, index): (MatchedItem & { index: number }) | undefined => {
          const filterText = item.filterText ?? item.label;
          const result = this.fuzzyMatch.match(filterText);
          if (!result) return undefined;
          const labelResult =
            filterText === item.label ? result : this.fuzzyMatch.match(item.label);
          return {
            item,
            index,
            positions: labelResult?.positions,
            score: result.score,
          };
        })
        .filter(
          (item): item is MatchedItem & { index: number } => item != null,
        )
        .sort((left, right) => right.score - left.score || left.index - right.index);
    }
    this.visibleItems = filtered;
    this.selected = Math.min(this.selected, Math.max(0, filtered.length - 1));
    this.scheduleRender();
  }

  private cancelProducer(): void {
    this.generation++;
    this.tokenSource?.cancel();
    this.tokenSource?.dispose();
    this.tokenSource = undefined;
    this.task?.dispose();
    this.task = undefined;
  }

  private async pollInput(): Promise<void> {
    const state = this.state;
    if (!state) return;
    const valid = (await workspace.nvim.call("nvim_buf_is_valid", [
      state.promptBuffer,
    ])) as boolean;
    if (!valid) return void this.close();
    const lines = (await workspace.nvim.call("nvim_buf_get_lines", [
      state.promptBuffer,
      0,
      1,
      false,
    ])) as string[];
    const input = lines[0] ?? "";
    if (input === this.input) return;
    this.input = input;
    if (this.source?.interactive) await this.reload();
    else this.applyFilter();
  }

  private scheduleRender(): void {
    if (this.renderTimer) return;
    this.renderTimer = setTimeout(() => {
      this.renderTimer = undefined;
      void this.render();
    }, POLL_INTERVAL);
  }

  private async render(): Promise<void> {
    const state = this.state;
    if (!state) return;
    const half = Math.floor(this.visibleLimit / 2);
    const start = Math.max(
      0,
      Math.min(this.selected - half, this.visibleItems.length - this.visibleLimit),
    );
    const page = this.visibleItems.slice(start, start + this.visibleLimit);
    const lines = page.map(({ item }) => item.label.replace(/\r?\n/g, " "));
    await workspace.nvim.pauseNotification();
    workspace.nvim.call("nvim_buf_set_option", [state.resultsBuffer, "modifiable", true], true);
    workspace.nvim.call("nvim_buf_set_lines", [state.resultsBuffer, 0, -1, false, lines.length ? lines : [""]], true);
    workspace.nvim.call("nvim_buf_set_option", [state.resultsBuffer, "modifiable", false], true);
    workspace.nvim.call("nvim_buf_clear_namespace", [state.resultsBuffer, state.namespace, 0, -1], true);
    if (page.length) {
      workspace.nvim.call("nvim_buf_add_highlight", [state.resultsBuffer, state.namespace, "CursorLine", this.selected - start, 0, -1], true);
      for (const [line, matched] of page.entries()) {
        if (!matched.positions) continue;
        for (const [startColumn, endColumn] of this.fuzzyMatch.matchSpans(
          lines[line],
          matched.positions,
        )) {
          workspace.nvim.call("nvim_buf_add_highlight", [
            state.resultsBuffer,
            state.namespace,
            "CocListSearch",
            line,
            startColumn,
            endColumn,
          ], true);
        }
      }
    }
    await workspace.nvim.resumeNotification(false);
  }

  private context(input: string): ListContext {
    const state = this.state;
    if (!state) throw new Error("Picker is not visible");
    const options: ListOptions = {
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
      first: false,
    };
    return {
      args: this.args,
      input,
      cwd: workspace.cwd,
      options,
      window: workspace.nvim.createWindow(state.targetWindow),
      buffer: workspace.nvim.createBuffer(state.targetBuffer),
      listWindow: workspace.nvim.createWindow(state.resultsWindow),
    };
  }

  private async openWindows(name: string): Promise<FloatState> {
    const targetWindow = (await workspace.nvim.call("win_getid")) as number;
    const targetBuffer = (await workspace.nvim.call("bufnr", ["%"])) as number;
    const columns = (await workspace.nvim.getOption("columns")) as number;
    const lines = (await workspace.nvim.getOption("lines")) as number;
    const width = Math.min(
      Math.max(1, columns - 4),
      Math.max(20, Math.floor(columns * 0.72)),
    );
    const height = Math.min(
      Math.max(1, lines - 7),
      Math.max(5, Math.floor(lines * 0.55)),
    );
    const col = Math.max(0, Math.floor((columns - width) / 2));
    const row = Math.max(0, Math.floor((lines - height - 1) / 3));
    const namespace = (await workspace.nvim.call("nvim_create_namespace", [
      "coc-ui-picker",
    ])) as number;
    const promptBuffer = (await workspace.nvim.call("nvim_create_buf", [false, true])) as number;
    const resultsBuffer = (await workspace.nvim.call("nvim_create_buf", [false, true])) as number;
    const promptWindow = (await workspace.nvim.call("nvim_open_win", [
      promptBuffer,
      true,
      {
        relative: "editor",
        row,
        col,
        width,
        height: 1,
        style: "minimal",
        border: ["╭", "─", "╮", "│", "┤", "─", "├", "│"],
        title: ` ${name} `,
        title_pos: "left",
      },
    ])) as number;
    const resultsWindow = (await workspace.nvim.call("nvim_open_win", [
      resultsBuffer,
      false,
      {
        relative: "editor",
        row: row + 2,
        col,
        width,
        height,
        style: "minimal",
        border: ["├", "─", "┤", "│", "╯", "─", "╰", "│"],
        focusable: false,
      },
    ])) as number;
    for (const buffer of [promptBuffer, resultsBuffer]) {
      await workspace.nvim.call("nvim_buf_set_option", [buffer, "buftype", "nofile"]);
      await workspace.nvim.call("nvim_buf_set_option", [buffer, "bufhidden", "wipe"]);
      await workspace.nvim.call("nvim_buf_set_option", [buffer, "swapfile", false]);
    }
    await workspace.nvim.call("nvim_buf_set_option", [promptBuffer, "filetype", "cocui-picker-prompt"]);
    await workspace.nvim.call("nvim_buf_set_option", [resultsBuffer, "filetype", "cocui-picker"]);
    await workspace.nvim.call("nvim_win_set_option", [
      promptWindow,
      "winhighlight",
      "NormalFloat:NormalFloat,FloatBorder:FloatBorder",
    ]);
    await workspace.nvim.call("nvim_win_set_option", [
      promptWindow,
      "wrap",
      false,
    ]);
    await workspace.nvim.call("nvim_win_set_option", [resultsWindow, "cursorline", false]);
    await workspace.nvim.call("nvim_win_set_option", [resultsWindow, "wrap", false]);
    await workspace.nvim.call("nvim_win_set_option", [
      resultsWindow,
      "winhighlight",
      "NormalFloat:NormalFloat,FloatBorder:FloatBorder",
    ]);
    return {
      namespace,
      promptBuffer,
      promptWindow,
      resultsBuffer,
      resultsWindow,
      targetBuffer,
      targetWindow,
    };
  }

  private installCommands(): void {
    const state = this.state;
    if (!state) return;
    const mappings: Array<[string, string]> = [
      ["<Esc>", "ui.picker.close"],
      ["<C-c>", "ui.picker.close"],
      ["<CR>", "ui.picker.accept"],
      ["<C-n>", "ui.picker.next"],
      ["<Down>", "ui.picker.next"],
      ["<C-p>", "ui.picker.previous"],
      ["<Up>", "ui.picker.previous"],
    ];
    for (const [key, command] of mappings) {
      void workspace.nvim.call("nvim_buf_set_keymap", [state.promptBuffer, "i", key, `<Cmd>CocCommand ${command}<CR>`, { noremap: true, silent: true, nowait: true }]);
    }
  }
}

let activePicker: ListPicker | undefined;

export function registerPickerCommands(picker: ListPicker): Disposable[] {
  activePicker = picker;
  return [
    commands.registerCommand("ui.picker.close", () => activePicker?.close()),
    commands.registerCommand("ui.picker.accept", () => activePicker?.accept()),
    commands.registerCommand("ui.picker.next", () => activePicker?.move(1)),
    commands.registerCommand("ui.picker.previous", () => activePicker?.move(-1)),
  ];
}
