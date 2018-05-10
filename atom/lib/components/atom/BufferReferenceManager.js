import { Directory } from "atom";
import React from "react";
import BufferReferences from "./BufferReferences";

export default class BufferReferenceManager extends React.Component {
	state = { editorIds: [] };
	editors = new Map();

	componentDidMount() {
		const repoDirectory = new Directory(this.props.workingDirectory);

		atom.workspace.observeActiveTextEditor(editor => {
			if (editor && !this.editors.has(editor.id) && repoDirectory.contains(editor.getPath())) {
				this.editors.set(editor.id, editor);
				this.setState({ editorIds: [...this.editors.keys()] });
				editor.onDidDestroy(() => {
					this.editors.delete(editor.id);
					this.setState({ editorIds: [...this.editors.keys()] });
				});
			}
		});
	}

	render() {
		return this.state.editorIds.map(id => (
			<BufferReferences key={id} repo={this.props.repo} editor={this.editors.get(id)} />
		));
	}
}
