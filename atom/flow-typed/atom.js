// @flow
declare module "atom" {
	declare export class Disposable {
		constructor(disposalAction: () => void): Disposable;
		dispose(): void;
		static isDisposable(object: any): boolean;
	}

	declare export class CompositeDisposable {
		constructor(...disposables?: Disposable[]): CompositeDisposable;
		add(...disposables: Disposable[]): void;
		remove(disposable: Disposable): void;
		clear(): void;
		dispose(): void;
	}

	declare class TextBuffer {
		onDidReload(callback: Function): Disposable;
	}

	declare export class TextEditor {
		id: number;
		getBuffer(): TextBuffer;
		onDidStopChanging(callback: Function): Disposable;
		onDidDestroy(callback: Function): Disposable;
	}

	declare export class GitRepository {
		static open(path: string, options?: { refreshOnWindowFocus: boolean }): GitRepository | null;
		destroy(): void;
		isDestroyed(): boolean;
		relativize(path: string): string;
	}

	declare export class Directory {
		constructor(path: string, symlink?: boolean): Directory;
	}
}
