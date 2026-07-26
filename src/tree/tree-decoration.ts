import { Disposable, TreeView, workspace } from "coc.nvim";
import {
  getNativeTreeDecorationSnapshot,
  onNativeTreeDidRender,
} from "./native-tree-view";
import {
  planTreeDecorations,
  TreeDecorationSettings,
  TREE_INDENT_GUIDE_HL,
} from "./tree-decoration-model";

function readTreeDecorationSettings(): TreeDecorationSettings {
  const config = workspace.getConfiguration("ui");
  return {
    indentGuidesEnabled: config.get<boolean>("tree.indentGuides.enabled", true),
    indentGuideCharacter: config.get<string>(
      "tree.indentGuides.character",
      "│",
    ),
    disclosureCollapsed: config.get<string>("tree.disclosure.collapsed", ""),
    disclosureExpanded: config.get<string>("tree.disclosure.expanded", ""),
  };
}

/**
 * Applies common indent-guide and disclosure decorations to a coc.nvim
 * TreeView buffer. Attached automatically from CocUi.createTreeView.
 */
export class TreeViewDecoration implements Disposable {
  private readonly disposables: Disposable[] = [];
  private namespace: number | undefined;
  private timer: NodeJS.Timeout | undefined;
  private revision = 0;
  private disposed = false;

  constructor(private readonly tree: TreeView<unknown>) {
    const onDidRender = onNativeTreeDidRender(tree, () => this.schedule());
    this.disposables.push(
      Disposable.create(() => {
        if (this.timer) clearTimeout(this.timer);
      }),
      // Expand/collapse updates nodesMap + buffer without firing onDidRefrash.
      tree.onDidExpandElement(() => this.schedule()),
      tree.onDidCollapseElement(() => this.schedule()),
      tree.onDidChangeVisibility(({ visible }) => {
        if (visible) this.schedule();
      }),
      workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration("ui.tree")) this.schedule();
      }),
    );
    if (onDidRender) this.disposables.push(onDidRender);
    this.schedule();
  }

  dispose(): void {
    this.disposed = true;
    this.revision += 1;
    if (this.timer) clearTimeout(this.timer);
    for (const disposable of this.disposables) disposable.dispose();
  }

  private schedule(delay = 0): void {
    const revision = ++this.revision;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.render(revision);
    }, delay);
  }

  private async render(revision: number): Promise<void> {
    if (this.disposed || revision !== this.revision || !this.tree.windowId) {
      return;
    }

    try {
      const nvim = workspace.nvim;
      const supported = (await nvim.call("has", ["nvim-0.5"])) === 1;
      if (!supported || revision !== this.revision) return;

      const snapshot = getNativeTreeDecorationSnapshot(this.tree);
      if (!snapshot || revision !== this.revision) return;

      const bufnr = (await nvim.call("nvim_win_get_buf", [
        this.tree.windowId,
      ])) as number;
      const namespace = await this.getNamespace();
      if (revision !== this.revision) return;

      const settings = readTreeDecorationSettings();
      const marks = planTreeDecorations(
        snapshot.entries,
        snapshot.startLnum,
        settings,
        snapshot.filtering,
        snapshot.indentColumns,
      );

      nvim.pauseNotification();
      nvim.call("nvim_buf_clear_namespace", [bufnr, namespace, 0, -1], true);
      if (settings.indentGuidesEnabled && settings.indentGuideCharacter) {
        nvim.command(
          `highlight default link ${TREE_INDENT_GUIDE_HL} LineNr`,
          true,
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
              hl_mode: "combine",
            },
          ],
          true,
        );
      }
      await nvim.resumeNotification(false);
    } catch {
      // TreeView window can disappear while an asynchronous render is pending.
    }
  }

  private async getNamespace(): Promise<number> {
    if (this.namespace === undefined) {
      this.namespace = (await workspace.nvim.call("nvim_create_namespace", [
        "coc-ui-tree-decoration",
      ])) as number;
    }
    return this.namespace;
  }
}

export function attachTreeViewDecoration<T>(tree: TreeView<T>): Disposable {
  return new TreeViewDecoration(tree as TreeView<unknown>);
}
