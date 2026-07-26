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
and filtering semantics. Picker border shape follows coc.nvim's
`dialog.rounded` setting (rounded corners when true, square box-drawing
corners when false). `ui.picker.resume` reloads the last source with its
previous arguments and query.

When the selected item's `location` resolves to an existing local file and the
editor is wide enough (`ui.picker.preview.minColumns`, default 120), the picker
reflows to a left list pane with a framed file preview on the right. Preview
eligibility is item-driven (string URI, LSP `Location`, or `LocationWithLine`),
not source-name-driven. Narrow screens keep the original single-column picker
geometry. Disable with `ui.picker.preview.enable`.

Pressing `<Tab>` opens coc.nvim's native menu picker for the selected source
item's actions from `IList.actions`. Canceling the menu leaves the floating
picker, query, and selection intact. Choosing an action still honors
`resolveItem`, default source context, `persist`, and `reload`.

View content currently uses coc.nvim's native TreeView renderer. coc-ui owns the
workbench model, layout, Activity Bar, container lifecycle, and action
contributions; it does not duplicate TreeDataProvider rendering.

This repository is under local development and is not published yet.
