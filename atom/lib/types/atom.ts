import { TextEditor } from "atom";

declare module "atom" {
	interface TextEditor {
		getFirstVisibleScreenRow(): number;
		getLastVisibleScreenRow(): number;
		getVisibleRowRange(): [number, number];
		getApproximateLongestScreenRow(): number;
		bufferRowForScreenRow(screenRow: number): number;
	}
}
