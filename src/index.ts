import {
  Disposable,
  ExtensionContext,
  Position,
  TreeView,
  TreeViewOptions,
  commands,
  window,
  workspace,
} from 'coc.nvim';

export type ViewPlacement = 'sidebar' | 'panel';

export interface ViewRegistration<T> extends TreeViewOptions<T> {
  id: string;
  title?: string;
  description?: string;
  placement?: ViewPlacement;
}

export interface CocUiApi {
  registerView<T>(registration: ViewRegistration<T>): Disposable;
  showView(id: string): Promise<void>;
  closeView(): Promise<void>;
  openLocation(uri: string, line: number, character: number): Promise<void>;
}

type RegisteredView = {
  placement: ViewPlacement;
  tree: TreeView<unknown>;
};

class ViewContainer implements CocUiApi, Disposable {
  private readonly views = new Map<string, RegisteredView>();
  private activeViewId: string | undefined;
  private targetWindowId: number | undefined;

  registerView<T>(registration: ViewRegistration<T>): Disposable {
    if (this.views.has(registration.id)) {
      throw new Error(`View already registered: ${registration.id}`);
    }

    const tree = window.createTreeView(registration.id, registration);
    tree.title = registration.title ?? registration.id;
    tree.description = registration.description;
    this.views.set(registration.id, {
      placement: registration.placement ?? 'sidebar',
      tree: tree as TreeView<unknown>,
    });

    return Disposable.create(() => {
      if (this.activeViewId === registration.id) this.activeViewId = undefined;
      this.views.delete(registration.id);
      tree.dispose();
    });
  }

  async showView(id: string): Promise<void> {
    const view = this.views.get(id);
    if (!view) throw new Error(`Unknown view: ${id}`);

    const currentWindowId = (await workspace.nvim.call('win_getid')) as number;
    const activeWindowId = this.activeViewId
      ? this.views.get(this.activeViewId)?.tree.windowId
      : undefined;
    if (currentWindowId !== activeWindowId) this.targetWindowId = currentWindowId;

    if (activeWindowId && activeWindowId !== view.tree.windowId) {
      await workspace.nvim.call('nvim_win_close', [activeWindowId, true]);
    }

    await view.tree.show(this.splitCommand(view.placement));
    this.activeViewId = id;
  }

  async closeView(): Promise<void> {
    if (!this.activeViewId) return;
    const winid = this.views.get(this.activeViewId)?.tree.windowId;
    if (winid) await workspace.nvim.call('nvim_win_close', [winid, true]);
    this.activeViewId = undefined;
  }

  async openLocation(uri: string, line: number, character: number): Promise<void> {
    if (this.targetWindowId) {
      const valid = (await workspace.nvim.call('nvim_win_is_valid', [this.targetWindowId])) as boolean;
      if (valid) await workspace.nvim.call('win_gotoid', [this.targetWindowId]);
    }
    await workspace.jumpTo(uri, Position.create(line, character), 'edit');
  }

  dispose(): void {
    for (const view of this.views.values()) view.tree.dispose();
    this.views.clear();
  }

  private splitCommand(placement: ViewPlacement): string {
    const config = workspace.getConfiguration('coc-ui');
    if (placement === 'panel') {
      const height = Math.max(3, config.get<number>('panel.height', 12));
      return `botright ${height}split`;
    }

    const width = Math.max(10, config.get<number>('sidebar.width', 40));
    const side = config.get<'left' | 'right'>('sidebar.position', 'left');
    return `${side === 'left' ? 'topleft' : 'botright'} ${width}vsplit`;
  }
}

export async function activate(context: ExtensionContext): Promise<CocUiApi> {
  const container = new ViewContainer();
  context.subscriptions.push(
    container,
    commands.registerCommand('coc-ui.show', (id: unknown) => container.showView(String(id))),
    commands.registerCommand('coc-ui.close', () => container.closeView())
  );
  return container;
}

