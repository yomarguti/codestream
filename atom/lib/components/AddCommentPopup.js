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

	addStyleString(str) {
		let node = document.getElementById("codestream-style-tag") || document.createElement("style");
		node.id = "codestream-style-tag";
		node.innerHTML = str;
		document.body.appendChild(node);
	}

	handleSelectionChange = event => {
		let editor = atom.workspace.getActiveTextEditor();
		if (!editor) return;

		this.destroyMarker();

		let code = editor.getSelectedText();
		if (code.length > 0) {
			// FIXME -- this seems fragile, and it is also not responsive to
			// window resizes, which is the only time it really needs to run
			// let lineDivs = document.querySelectorAll("atom-text-editor.is-focused .lines");
			let scrollViewDivs = document.querySelectorAll("atom-text-editor.is-focused .scroll-view");
			if (scrollViewDivs && scrollViewDivs.length) {
				// let lineLeft = lineDivs[0].getBoundingClientRect().left;
				// let codestreamLeft = codestreamDivs[0].getBoundingClientRect().left;
				let width = scrollViewDivs[0].offsetWidth - 20;
				let newStyle = ".codestream-comment-popup { left: " + width + "px; }";
				console.log("Adding style string; " + newStyle);
				this.addStyleString(newStyle);
			}

			this.addMarker(editor, editor.getSelectedBufferRange());
		}
	};

	addMarker(editor, range) {
		let row = range.start.row > range.end.row ? range.end.row : range.start.row;
		let startRange = [[row, 0], [row, 0]];
		this.marker = editor.markBufferRange(startRange, { invalidate: "touch" });
		let item = document.createElement("div");
		item.innerHTML = "+";
		item.className = "codestream-comment-popup";
		item.onclick = this.handleClick;
		editor.decorateMarker(this.marker, {
			type: "overlay",
			item: item,
			class: "codestream-overlay"
		});
		this.tooltip = atom.tooltips.add(item, { title: "Add a comment" });
	}

	destroyMarker = () => {
		if (!this.marker) return;

		this.marker.destroy();
		this.tooltip.dispose();
	};
}
