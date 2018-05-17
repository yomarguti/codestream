// @flow
/* eslint-disable */
import { Directory, Disposable, GitRepository, TextEditor } from "atom";

type Atom = {
	project: {
		repositoryForDirectory(Directory): Promise<GitRepository>
	},
	workspace: {
		getTextEditors(): TextEditor[],
		observeActiveTextEditor(callback: (editor: TextEditor | void) => any): Disposable
	}
};

declare var atom: Atom;
