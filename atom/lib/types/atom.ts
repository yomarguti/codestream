import { Dock, TextEditor, ThemeManager, WorkspaceCenter } from "atom";

declare module "atom" {
	interface TextEditor {
		getFirstVisibleScreenRow(): number;
		getLastVisibleScreenRow(): number;
		getVisibleRowRange(): [number, number];
		getApproximateLongestScreenRow(): number;
		bufferRowForScreenRow(screenRow: number): number;
	}

	// not an exported type from atom
	interface WorkspaceItem {
		getURI?(): string;
	}

	interface WorkspaceCenter {
		getActivePaneItem(): WorkspaceItem | undefined;
	}

	interface Dock {
		getActivePaneItem(): WorkspaceItem | undefined;
	}

	interface ThemeManager {
		loadLessStylesheet(path: string, importFallbackVariables?: boolean): string;
	}
}
