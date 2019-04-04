import React, { Component } from "react";
import ReactDOM from "react-dom";
import createClassString from "classnames";
import Icon from "./Icon";

export default class Menu extends Component {
	constructor(props) {
		super(props);
		this.state = { selected: props.selected || "" };
		this.el = document.createElement("div");
		this.count = 0;
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
		this.repositionIfNecessary();
	}

	repositionIfNecessary() {
		if (this.props && this.props.target) {
			const rect = this.props.target.getBoundingClientRect();
			this._div.style.top = rect.top + "px";

			if (this.props.align === "left") {
				// const left = rect.right - this._div.offsetWidth + 5;
				// this._div.style.left = left + "px";
			} else if (this.props.align === "center") {
				const targetMiddle = (rect.right + rect.left) / 2;
				const left = targetMiddle - this._div.offsetWidth / 2 + 5;
				if (left < 10) this._div.style.left = "10px";
				else this._div.style.left = left + "px";
			} else {
				const left = rect.right - this._div.offsetWidth + 5;
				this._div.style.left = left + "px";
			}

			// check to make sure the menu doesn't display
			// off the bottom of the screen
			const tooFar = rect.top + this._div.offsetHeight + 35 - window.innerHeight;
			if (tooFar > 0) {
				const newTop = rect.top - tooFar;
				if (newTop > 10) this._div.style.top = newTop + "px";
				else this._div.style.top = "10px";
			}
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
		if (this.props.items.length !== prevProps.items.length) this.repositionIfNecessary();
	}

	renderItem = (item, parentItem) => {
		if (item.label === "-") return <hr key={this.count++} />;
		if (item.fragment) return item.fragment;
		const key = parentItem ? `${parentItem.action}/${item.action}` : item.action;
		const selected =
			key === this.state.selected || (this.state.selected || "").startsWith(key + "/");
		return (
			<li
				className={createClassString({
					"menu-item": true,
					disabled: item.disabled,
					hover: selected
				})}
				key={key}
				onMouseEnter={() => this.handleMouseEnter(key)}
				onClick={event => this.handleClickItem(event, item)}
			>
				{item.icon && <span className="icon">{item.icon}</span>}
				{item.label && <span className="label">{item.label}</span>}
				{item.shortcut && <span className="shortcut">{item.shortcut}</span>}
				{item.disabled && <span className="disabled">{item.disabled}</span>}
				{item.submenu && (
					<span className="submenu">
						<Icon name="triangle-right" />
						{selected && this.renderSubmenu(item)}
					</span>
				)}
			</li>
		);
	};

	renderSubmenu = item => {
		return <div className="menu-popup-submenu">{this.renderMenu(item.submenu, item)}</div>;
	};

	renderMenu = (items, parentItem) => {
		return (
			<div className="menu-popup-body">
				<ul className="compact">{items.map(item => this.renderItem(item, parentItem))}</ul>
			</div>
		);
	};

	render() {
		this.count = 0;
		const className = this.props.compact ? "menu-popup compact" : "menu-popup";
		return ReactDOM.createPortal(
			<div className={className} ref={ref => (this._div = ref)}>
				{this.renderMenu(this.props.items, null)}
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
