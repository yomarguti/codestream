export default class AddCommentPopup {
	constructor(props) {
		this.props = props;
		this.installHandlers();
	}

	installHandlers() {
		let editor = atom.workspace.getActiveTextEditor();
		if (editor && !editor.hasAddCommentPopupHandlers) {
			editor.onDidChangeSelectionRange(this.handleSelectionChange);
			editor.onDidChange(this.destroyMarker);
			editor.hasAddCommentPopupHandlers = true;
		}
		this.destroyMarker();
	}

	handleClick = () => {
		this.destroyMarker();
		return this.props.handleClickAddComment();
	};

	// FIXME -- add an ID to the style element so we can re-use it,
	// and move this function into a util package
	addStyleString(str) {
		var node = document.createElement("style");
		node.innerHTML = str;
		document.body.appendChild(node);
	}

	handleSelectionChange = event => {
		// console.log("SELECTION HAS CHANGED");
		let editor = atom.workspace.getActiveTextEditor();
		if (!editor) return;

		this.destroyMarker();

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

	destroyMarker = () => {
		if (!this.marker) return;

		this.marker.destroy();
		this.tooltip.dispose();
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
		editor.decorateMarker(this.marker, {
			type: "overlay",
			item: item,
			class: "codestream-overlay"
		});
		this.tooltip = atom.tooltips.add(item, { title: "Add a comment" });
	}
}
