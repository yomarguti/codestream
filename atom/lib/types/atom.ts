import { Dock, Range, TextEditor, ThemeManager, WorkspaceCenter } from "atom";

declare module "atom" {
	interface TextEditor {
		readonly rowsPerPage: number;
		readonly element: TextEditorElement;
		readonly displayLayer: {
			onDidChange(cb: () => void): Disposable;
		};

		getFirstVisibleScreenRow(): number;
		getLastVisibleScreenRow(): number;
		getVisibleRowRange(): [number, number];
		getApproximateLongestScreenRow(): number;
		bufferRowForScreenRow(screenRow: number): number;

		screenRowForBufferRow(bufferRow: number): number;

		setScrollTopRow(row: number): void;

		onDidRequestAutoscroll(cb: (event: { options: any; screenRange: Range }) => void): Disposable;
	}

	// not an exported type from atom
	interface WorkspaceItem {
		getURI?(): string;
		destroy?(): void;
	}

	interface WorkspaceCenter {
		getActivePaneItem(): WorkspaceItem | undefined;

		getPaneItems(): WorkspaceItem[];
	}

	interface Dock {
		getActivePaneItem(): WorkspaceItem | undefined;

		getPaneItems(): WorkspaceItem[];
	}

	interface ThemeManager {
		loadLessStylesheet(path: string, importFallbackVariables?: boolean): string;
	}
}
