import React, { Component } from "react";
import ReactDOM from "react-dom";
import createClassString from "classnames";
import Icon from "./Icon";
import { filter as _filter } from "lodash-es";

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
		if (this.el) {
			const inputs = this.el.getElementsByTagName("input");
			if (inputs[0]) inputs[0].focus();
		}
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

	repositionSubmenuIfNecessary() {
		if (!this._div) return;
		const $submenu = this._div.querySelector("#active-submenu");
		if ($submenu) {
			const rect = $submenu.getBoundingClientRect();
			const tooFar = rect.top + $submenu.offsetHeight + 35 - window.innerHeight;
			if (tooFar > 0) $submenu.style.bottom = "10px";
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
		if (this.state.selected !== prevState.selected) this.repositionSubmenuIfNecessary();
	}

	renderItem = (item, parentItem) => {
		if (item.label === "-") return <hr key={this.count++} />;
		if (item.fragment) return item.fragment;
		const itemKey = item.key || item.action;
		const key = parentItem ? `${parentItem.key || parentItem.action}/${itemKey}` : itemKey;
		let selected = key === this.state.selected || (this.state.selected + "").startsWith(key + "/");
		if (item.type === "search" || item.noHover) {
			selected = false;
		}

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
				{item.type === "search" && (
					<input
						style={{ width: "100%" }}
						type="text"
						placeholder={item.placeholder}
						onChange={this.changeSearch}
					/>
				)}
			</li>
		);
	};

	changeSearch = e => {
		this.setState({ q: e.target.value });
		if (this.props.onChangeSearch) this.props.onChangeSearch(e.target.value);
	};

	renderSubmenu = item => {
		return (
			<div id="active-submenu" className="menu-popup-submenu">
				{this.renderMenu(item.submenu, item)}
			</div>
		);
	};

	filterItems = items => {
		let count = 0;
		const q = (this.state.q || "").toLowerCase();

		const filteredItems = _filter(items, item => {
			if (item.searchLabel !== undefined && !item.searchLabel.toLowerCase().includes(q)) {
				return false;
			} else if (count < this.props.startItem || count > this.props.maxItems) {
				return false;
			} else {
				count++;
				return true;
			}
		});

		return filteredItems;
	};

	renderMenu = (items, parentItem) => {
		let itemsToRender = this.filterItems(items);

		return (
			<div className="menu-popup-body">
				{this.props.title && (
					<h3>
						{this.props.title} <Icon onClick={e => this.props.action()} name="x" />
					</h3>
				)}
				<ul className="compact">{itemsToRender.map(item => this.renderItem(item, parentItem))}</ul>
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
		event.stopPropagation();
		// support functions as item actions
		if (typeof item.action === "function" && !item.disabled) {
			item.action();
			this.props.action(null); // invoke the action callback for entire menu so it can removed
		} else this.props.action(item.disabled ? null : item.action);
	};
}
