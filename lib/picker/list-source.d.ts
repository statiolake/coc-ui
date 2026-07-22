import { CancellationToken, IList, ListItem } from "coc.nvim";
/** Isolates the only dependency on coc.nvim's currently private list registry. */
export declare function getListSource(name: string): IList;
export interface ItemProducer {
    start(input: string, token: CancellationToken, emit: (item: ListItem) => void): Promise<ListItem[] | {
        dispose(): void;
    } | undefined>;
}
