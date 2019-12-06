import React, { Component } from "react";
import ReactDOM from "react-dom";
import createClassString from "classnames";
import Button from "./Button";
import VsCodeKeystrokeDispatcher from "../utilities/vscode-keystroke-dispatcher";

// this is a 'deprecated' strategy to determine which ide is hosting this
// the better method is to refer to the `ide` slice of redux state
// unfortunately, there is code that renders the Confirm component in a separate react tree,
// which means it needs its own reference to the redux store.
// Once this component is using the new <Modal/> api, we can delete this functiona
function isInVscode() {
	return !!document.querySelector("body.codestream");
}

export default class Confirm extends Component {
	disposables = [];

	constructor(props) {
		super(props);
		this.state = { selected: props.selected, loading: null };
		this.el = document.createElement("div");
	}

	componentDidMount() {
		const modalRoot = document.getElementById("confirm-root");
		modalRoot.appendChild(this.el);
		modalRoot.classList.add("active");

		if (isInVscode()) {
			this.disposables.push(
				VsCodeKeystrokeDispatcher.on("keydown", event => {
					if (event.key === "Escape") {
						this.closePopup();
					}
				})
			);
		}
	}

	componentWillUnmount() {
		this.closePopup();
		this.disposables.forEach(d => d.dispose());
	}

	closePopup = () => {
		const modalRoot = document.getElementById("confirm-root");
		modalRoot.classList.remove("active");
		// modalRoot.removeChild(this.el);
	};

	componentDidUpdate(prevProps, prevState) {
		if (this.state.closed && !prevState.closed) {
			this.closeMenu();
			this.props.action && this.props.action();
			return null;
		}
	}

	renderMessage() {
		const { message } = this.props;
		if (message) {
			return (
				<div className="confirm-message">{typeof message === "function" ? message() : message}</div>
			);
		}
	}

	render() {
		const bodyClass = createClassString({
			"confirm-popup-body": true,
			centered: this.props.centered
		});

		return ReactDOM.createPortal(
			<div className="confirm-popup" ref={ref => (this._div = ref)}>
				<div className={bodyClass}>
					{this.props.title && <div className="confirm-title">{this.props.title}</div>}
					{this.renderMessage()}
					<div className="button-group">
						{this.props.buttons.map(button => {
							const buttonClass = createClassString({
								"control-button": true,
								cancel: !button.action && !button.uri
							});

							const buttonComponent = (
								<Button
									className={buttonClass}
									onClick={async e => {
										if (button.action) {
											this.setState({ loading: button.label });
											try {
												const result = button.action(e);
												if (button.wait) await result;
											} catch (error) {
												if (button.wait) {
													/* TODO communicate error */
												}
											} finally {
												this.setState({ loading: false });
												this.closePopup();
											}
										} else this.closePopup();
									}}
									key={button.label}
									loading={this.state.loading === button.label}
								>
									{button.label}
								</Button>
							);

							return button.uri ? <a href={button.uri}>{buttonComponent}</a> : buttonComponent;
						})}
					</div>
				</div>
			</div>,
			this.el
		);
	}
}

export const confirmPopup = properties => {
	const root = document.getElementById("confirm-root");
	root.classList.add("active");
	ReactDOM.render(<Confirm {...properties} />, root);
};
