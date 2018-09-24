import { Picker, store } from "emoji-mart";
import React, { Component } from "react";
import ReactDOM from "react-dom";
import createClassString from "classnames";
import * as actions from "./actions";
import { connect } from "react-redux";

export class SimpleEmojiPicker extends Component {
	constructor(props) {
		super(props);
		this.el = document.createElement("div");
		this.state = {};

		store.setHandlers({
			// keys are "skin", "frequently", and "last"
			getter: key => {
				return this.props.currentUser.preferences["emojiPicker-" + key];
			},

			setter: (key, value) => {
				this.props.setUserPreference(["emojiPicker-" + key], value);
			}
		});
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
				let left = rect.right - this._div.offsetWidth + 5;
				if (left < 10) left = 10;
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
				<Picker
					autoFocus={this.props.autoFocus}
					onSelect={addEmoji}
					emoji=""
					native={true}
					title=""
					style={style}
				/>
			</div>,
			this.el
		);
	}
}

const mapStateToProps = ({ session, users }) => {
	const currentUser = users[session.userId];
	return {
		currentUser
	};
};

export default connect(
	mapStateToProps,
	{
		...actions
	}
)(SimpleEmojiPicker);
