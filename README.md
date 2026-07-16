# coc-ui

VS Code-style view containers for coc.nvim extensions. Extensions register a
container in the primary sidebar, secondary sidebar, or bottom panel, then mount
one or more TreeView-backed views into it. coc-ui owns the active view for each
container and keeps an editor window available for location-opening actions.

The API intentionally mirrors VS Code's `ViewContainer` / `View` separation:

```ts
const container = ui.registerViewContainer({
  id: "example",
  title: "Example",
  location: "primarySidebar",
});

const view = ui.createTreeView({
  id: "example.items",
  containerId: "example",
  title: "Items",
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
```

View actions populate the tree item's context menu. Optional view-local keys
invoke the same action with the element under the cursor, keeping commands,
menus, and keybindings as one declaration.

Use `coc-ui.showContainer` to reveal the active view in a container and
`coc-ui.showView` to switch to a particular view. `coc-ui.switchPrimarySidebar`,
`coc-ui.switchSecondarySidebar`, and `coc-ui.switchPanel` are the Coc equivalent
of selecting a VS Code view container from its workbench surface. Containers on
distinct surfaces remain mounted concurrently.

Tree views retain coc.nvim's native single-click behavior. When
`coc-ui.mouse.enable` is enabled, right-clicking a tree item opens the actions
provided by its `TreeDataProvider.resolveActions` implementation.

This repository is under local development and is not published yet.
