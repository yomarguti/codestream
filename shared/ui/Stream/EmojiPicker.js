import { Picker } from "emoji-mart";
import React, { Component } from "react";
import ReactDOM from "react-dom";
import createClassString from "classnames";

export default class EmojiPicker extends Component {
	constructor(props) {
		super(props);
		this.el = document.createElement("div");
		this.state = {};
	}

	componentDidMount() {
		const modalRoot = document.getElementById("modal-root");
		modalRoot.appendChild(this.el);
		modalRoot.classList.add("active");
		modalRoot.onclick = event => {
			if (event.target.id === "modal-root") {
				this.setState({ closed: true });
			}
		};
		if (this.props && this.props.target) {
			const rect = this.props.target.getBoundingClientRect();
			console.log(rect);
			this._div.style.top = rect.top - this._div.offsetHeight + "px";

			if (this.props.align === "left") {
				// const left = rect.right - this._div.offsetWidth + 5;
				// this._div.style.left = left + "px";
			} else {
				const left = rect.right - this._div.offsetWidth + 5;
				this._div.style.left = left + "px";
			}

			// check to make sure the menu doesn't display
			// off the top of the screen
			const tooFar = rect.top - this._div.offsetHeight;
			if (tooFar < 50) this._div.style.top = "50px";
		}
	}

	componentWillUnmount() {
		const modalRoot = document.getElementById("modal-root");
		this.closePicker();
		modalRoot.removeChild(this.el);
	}

	closePicker() {
		const modalRoot = document.getElementById("modal-root");
		modalRoot.classList.remove("active");
	}

	componentDidUpdate(prevProps, prevState) {
		if (this.state.closed && !prevState.closed) {
			this.closePicker();
			this.props.addEmoji("");
			return null;
		}
	}

	render() {
		let { addEmoji, style, target } = this.props;

		return ReactDOM.createPortal(
			<div ref={ref => (this._div = ref)} style={target ? { position: "absolute" } : {}}>
				<Picker onSelect={addEmoji} emoji="" native={true} title="" style={style} />
			</div>,
			this.el
		);
	}
}
