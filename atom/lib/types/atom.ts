import { TextEditor, ThemeManager } from "atom";

declare module "atom" {
	interface TextEditor {
		getFirstVisibleScreenRow(): number;
		getLastVisibleScreenRow(): number;
		getVisibleRowRange(): [number, number];
		getApproximateLongestScreenRow(): number;
		bufferRowForScreenRow(screenRow: number): number;
	}

	interface ThemeManager {
		loadLessStylesheet(path: string, importFallbackVariables?: boolean): string;
	}
}
