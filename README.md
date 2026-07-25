# coc-ui

VS Code-style workbench surfaces for coc.nvim extensions. Extensions contribute
View Containers to the primary sidebar, secondary sidebar, or panel, then
contribute one or more Views to each container. The active container is selected
per surface; all non-hidden Views in that container remain mounted together.

The API intentionally mirrors VS Code's `ViewContainer` / `View` separation:

```ts
const container = ui.registerViewContainer({
  id: "example",
  title: "Example",
  icon: "󰏗",
  location: "primarySidebar",
});

ui.registerView({
  id: "example.items",
  containerId: "example",
  name: "Items",
  order: 1,
});

ui.createTreeView("example.items", {
  treeDataProvider,
  actions: [
    {
      id: "example.rename",
      title: "Rename",
      keys: ["r"],
      handler: (item) => item && rename(item),
    },
  ],
});

ui.registerView({
  id: "example.details",
  containerId: "example",
  name: "Details",
  order: 2,
  visibility: "collapsed",
});

ui.createTreeView("example.details", {
  treeDataProvider: detailsProvider,
});
```

This follows VS Code's `viewsContainers` and `views` model:

- A workbench surface has one active View Container.
- A View Container contains multiple ordered Views, not one active View.
- Views start as `visible`, `collapsed`, or `hidden`.
- User-chosen visible/collapsed state is restored per workspace.
- Sidebar Views are stacked vertically. Panel Views are arranged horizontally.
- The Activity Bar selects the active sidebar container.

`registerViewContainer()` and `registerView()` are the runtime equivalents of
VS Code's `viewsContainers` and `views` contribution points. `createTreeView()`
uses the VS Code shape: a stable View id followed by provider options.

`showContainer()` mounts every non-hidden View in the container. `showView()`
selects its container, expands that View, and focuses it without closing sibling
Views. Use `za` or double-click a View title to collapse or expand it.

Workbench surfaces have separate show/hide and close lifecycles. Hiding a
surface removes its windows while preserving the active container, TreeView
buffers, expansion state, and cursor position. Showing it restores that state;
only an explicit container close discards the active selection.

Locations can also be shown before a ViewContainer is contributed. In that
state coc-ui renders an empty workbench surface that can receive future views
instead of treating the location as unavailable.

View actions populate the tree item's context menu. Optional view-local keys
invoke the same action with the element under the cursor, keeping commands,
menus, and keybindings as one declaration.

`ui.switchPrimarySidebar`, `ui.switchSecondarySidebar`, and
`ui.switchPanel` provide command-driven container selection. Sidebar
Activity Bar icons provide direct keyboard and mouse selection. Containers on
distinct surfaces remain mounted concurrently.

Tree views retain coc.nvim's native single-click behavior. When
`ui.mouse.enable` is enabled, right-clicking a tree item opens the actions
provided by its `TreeDataProvider.resolveActions` implementation.

`ui.pickList` presents existing Coc List sources in a bounded floating picker.
Non-interactive sources use coc.nvim's native fuzzy matcher for scoring,
ordering, and match highlights. Interactive sources retain their own producer
and filtering semantics. `ui.picker.resume` reloads the last source with its
previous arguments and query.

Pressing `<Tab>` switches the picker to the selected source's actions. These
come directly from `IList.actions`; the default selection, persistence, and
reload behavior follow `defaultAction`, `persist`, and `reload`. `<Esc>` or
`<Tab>` returns to the item query without discarding it.

View content currently uses coc.nvim's native TreeView renderer. coc-ui owns the
workbench model, layout, Activity Bar, container lifecycle, and action
contributions; it does not duplicate TreeDataProvider rendering.

This repository is under local development and is not published yet.
