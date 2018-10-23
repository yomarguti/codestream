import React, { Component } from "react";
import ReactDOM from "react-dom";
import createClassString from "classnames";

export default class Menu extends Component {
	constructor(props) {
		super(props);
		this.state = { selected: props.selected };
		this.el = document.createElement("div");
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
			this._div.style.top = rect.top + "px";

			if (this.props.align === "left") {
				// const left = rect.right - this._div.offsetWidth + 5;
				// this._div.style.left = left + "px";
			} else if (this.props.align === "center") {
				const targetMiddle = (rect.right + rect.left) / 2;
				const left = targetMiddle - this._div.offsetWidth / 2 + 5;
				this._div.style.left = left + "px";
				console.log("LEFT IS: ", left);
			} else {
				const left = rect.right - this._div.offsetWidth + 5;
				this._div.style.left = left + "px";
			}

			// check to make sure the menu doesn't display
			// off the bottom of the screen
			const tooFar = rect.top + this._div.offsetHeight + 35 - window.innerHeight;
			if (tooFar > 0) this._div.style.top = rect.top - tooFar + "px";
		}
	}

	componentWillUnmount() {
		const modalRoot = document.getElementById("modal-root");
		this.closeMenu();
		modalRoot.removeChild(this.el);
	}

	closeMenu() {
		const modalRoot = document.getElementById("modal-root");
		modalRoot.classList.remove("active");
	}

	componentDidUpdate(prevProps, prevState) {
		if (this.state.closed && !prevState.closed) {
			this.closeMenu();
			this.props.action();
			return null;
		}
	}

	render() {
		let count = 0;
		return ReactDOM.createPortal(
			<div className="menu-popup" ref={ref => (this._div = ref)}>
				<div className="menu-popup-body">
					<ul className="compact">
						{this.props.items.map(item => {
							if (item.label === "-") return <hr key={count++} />;
							if (item.fragment) return item.fragment;
							return (
								<li
									className={createClassString({
										"menu-item": true,
										disabled: item.disabled,
										hover: item.action === this.state.selected
									})}
									key={item.action}
									onMouseEnter={event => this.handleMouseEnter(item.action)}
									onClick={event => this.handleClickItem(event, item)}
								>
									{item.icon && <span className="icon">{item.icon}</span>}
									{item.label && <span className="label">{item.label}</span>}
									{item.shortcut && <span className="shortcut">{item.shortcut}</span>}
									{item.disabled && <span className="disabled">{item.disabled}</span>}
								</li>
							);
						})}
					</ul>
				</div>
			</div>,
			this.el
		);
	}

	handleMouseEnter = key => {
		this.setState({ selected: key });
	};

	handleClickItem = async (event, item) => {
		this.props.action(item.disabled ? null : item.action);
		event.stopPropagation();
	};
}
