// @flow
/* eslint-disable */
import { Disposable, TextEditor } from "atom";

type Atom = {
	workspace: {
		observeActiveTextEditor(callback: (editor: TextEditor | void) => void): Disposable
	}
};

declare var atom: Atom;
