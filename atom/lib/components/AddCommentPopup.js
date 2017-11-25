import React, { Component } from "react";

export default class AddCommentPopup extends Component {
	constructor(props) {
		super(props);
		this.state = {
			on: false
		};
		this.handleClick = this.handleClick.bind(this);
		this.handleSelectionChange = this.handleSelectionChange.bind(this);

		let editor = atom.workspace.getActiveTextEditor();
		if (editor) {
			editor.onDidChangeSelectionRange(this.handleSelectionChange);
			this.editor = editor;
		}
		this.marker = null;
	}

	componentDidMount() {}

	render() {
		// if (!this.state.on) return "";
		return "";
		return (
			<div className="codestream-add-comment-popup" onClick={this.handleClick}>
				<div className="body">+</div>
			</div>
		);
	}

	handleClick() {
		if (this.marker) this.marker.destroy();
		return this.props.handleClickAddComent();
	}

	handleSelectionChange(event) {
		let editor = atom.workspace.getActiveTextEditor();
		if (!editor) return;

		if (this.marker) this.marker.destroy();

		var range = editor.getSelectedBufferRange();
		let code = editor.getSelectedText();
		if (code.length > 0) {
			// console.log("READY TO QUOTE CODE");
		}
		let row = range.start.row > range.end.row ? range.end.row : range.start.row;
		let startRange = [[row, 0], [row, 0]];
		this.marker = editor.markBufferRange(startRange, { invalidate: "touch" });
		let item = document.createElement("div");
		item.innerHTML = "+";
		item.className = "codestream-add-comment-popup";
		item.onclick = this.handleClick;
		editor.decorateMarker(this.marker, { type: "overlay", item: item });
	}
}
