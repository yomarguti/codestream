import React, { Component } from "react";

export default class AddCommentPopup extends Component {
	constructor(props) {
		super(props);
		this.state = {
			on: false
		};
		this.handleClick = this.handleClick.bind(this);

		// FIXME -- we want these event triggers to be installed when we create
		// the popup, and torn down when we destroy it
		let editor = atom.workspace.getActiveTextEditor();
		if (editor) {
			editor.onDidChangeSelectionRange(this.handleSelectionChange);
			editor.onDidChange(this.handleChange);
			this.editor = editor;
		}
		this.marker = null;
	}

	componentDidMount() {}

	render() {
		// nothing to render until there is a selection
		return null;
	}

	handleClick() {
		if (this.marker) this.marker.destroy();
		return this.props.handleClickAddComment();
	}

	// FIXME -- add an ID to the style element so we can re-use it,
	// and move this function into a util package
	addStyleString(str) {
		var node = document.createElement("style");
		node.innerHTML = str;
		document.body.appendChild(node);
	}

	handleChange = event => {
		// console.log("HANDLING A CHANGE");
		// console.log(this.marker);
		if (this.marker) this.marker.destroy();
	};

	handleSelectionChange = event => {
		// console.log("SELECTION HAS CHANGED");
		let editor = atom.workspace.getActiveTextEditor();
		if (!editor) return;

		if (this.marker) this.marker.destroy();

		var range = editor.getSelectedBufferRange();
		let code = editor.getSelectedText();
		if (code.length > 0) {
			// console.log("READY TO QUOTE CODE");

			// FIXME -- this seems fragile, and it is also not responsive to
			// window resizes, which is the only time it really needs to run
			// let lineDivs = document.querySelectorAll("atom-text-editor.is-focused .lines");
			let scrollViewDivs = document.querySelectorAll("atom-text-editor.is-focused .scroll-view");
			if (scrollViewDivs && scrollViewDivs.length) {
				// let lineLeft = lineDivs[0].getBoundingClientRect().left;
				// let codestreamLeft = codestreamDivs[0].getBoundingClientRect().left;
				let width = scrollViewDivs[0].offsetWidth - 20;
				let newStyle = ".codestream-add-comment-popup { left: " + width + "px; }";
				console.log("Adding style string; " + newStyle);
				this.addStyleString(newStyle);
			}

			this.addMarker(editor, range);
		}
	};

	addMarker(editor, range) {
		// FIXME set the position of this marker here
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
