import {
  CancellationToken,
  IList,
  ListItem,
  listManager,
} from "coc.nvim";

type ListRegistry = typeof listManager & {
  listMap?: Map<string, IList>;
};

/** Isolates the only dependency on coc.nvim's currently private list registry. */
export function getListSource(name: string): IList {
  const source = (listManager as ListRegistry).listMap?.get(name);
  if (!source) {
    throw new Error(`Unknown CocList source: ${name}`);
  }
  return source;
}

export interface ItemProducer {
  start(
    input: string,
    token: CancellationToken,
    emit: (item: ListItem) => void,
  ): Promise<ListItem[] | { dispose(): void } | undefined>;
}
