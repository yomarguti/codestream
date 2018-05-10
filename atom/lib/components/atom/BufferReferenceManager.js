import { CompositeDisposable, Directory } from "atom";
import React from "react";
import BufferReferences from "./BufferReferences";

export default class BufferReferenceManager extends React.Component {
	state = { editorIds: [] };
	editors = new Map();
	subscriptions = new CompositeDisposable();

	componentDidMount() {
		const repoDirectory = new Directory(this.props.workingDirectory);

		this.subscriptions.add(
			atom.workspace.observeActiveTextEditor(editor => {
				if (editor && !this.editors.has(editor.id) && repoDirectory.contains(editor.getPath())) {
					this.editors.set(editor.id, editor);
					this.setState({ editorIds: [...this.editors.keys()] });
					this.subscriptions.add(
						editor.onDidDestroy(() => {
							this.editors.delete(editor.id);
							this.setState({ editorIds: [...this.editors.keys()] });
						})
					);
				}
			})
		);
	}

	componentWillUnmount() {
		this.subscriptions.dispose();
	}

	render() {
		return this.state.editorIds.map(id => (
			<BufferReferences key={id} repo={this.props.repo} editor={this.editors.get(id)} />
		));
	}
}
