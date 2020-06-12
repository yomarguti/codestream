import { TextEditor } from "atom";

export interface SplitDiffService {
	getMarkerLayers(): Promise<any>;
	diffEditors(editor1: TextEditor, editor2: TextEditor, options?: any): void;
	disable(): void;
}
