import React, { Component } from "react";
import ReactDOM from "react-dom";
import createClassString from "classnames";
import Icon from "./Icon";
import { filter as _filter } from "lodash-es";
import { ModalContext } from "./Modal";
import { shortUuid } from "../utils";

export default class Menu extends Component {
	constructor(props) {
		super(props);
		this.state = { selected: props.selected || "" };
		this.el = document.createElement("div");
		this.count = 0;
		this.programaticScrolling = 0;
	}

	componentDidMount() {
		const modalRoot = document.getElementById("modal-root");
		modalRoot.appendChild(this.el);
		modalRoot.classList.add("active");
		modalRoot.onclick = event => {
			if (event.target.id === "modal-root") {
				this.setState({ closed: true });
				return;
			}
			// bit of a hack for determining if the click was inside the modal area but outside of the menu
			const randomClassString = `__${shortUuid()}`;
			event.target.classList.add(randomClassString);
			const targetSelector = `.${randomClassString}`;
			const clickedInMenu = this.el.querySelector(targetSelector) != null;
			try {
				if (clickedInMenu) {
					return;
				}
				const clickedInModalRoot = modalRoot.querySelector(targetSelector) != null;
				if (clickedInModalRoot) this.setState({ closed: true });
			} catch {
			} finally {
				event.target.classList.remove(randomClassString);
			}
		};
		if (this.el) {
			const inputs = this.el.getElementsByTagName("input");
			if (inputs[0]) inputs[0].focus();
			else this.el.getElementsByClassName("focus-button")[0].focus();
		}
		this.repositionIfNecessary();
	}

	repositionIfNecessary() {
		if (this.props && this.props.target) {
			const align = this.props.align;
			const rect = this.props.target.getBoundingClientRect();
			this._div.style.top = rect.top + "px";

			if (align === "left") {
				// const left = rect.right - this._div.offsetWidth + 5;
				// this._div.style.left = left + "px";
			} else if (align === "center") {
				const targetMiddle = (rect.right + rect.left) / 2;
				const left = targetMiddle - this._div.offsetWidth / 2 + 5;
				// if it's too far off the right of the window
				if (left + this._div.offsetWidth + 10 > window.innerWidth) this._div.style.right = "10px";
				// if it's too far to the left
				else if (left < 10) this._div.style.left = "10px";
				// normal case: reposition centrally
				else this._div.style.left = left + "px";
			} else {
				// right
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

		if (this.state.q !== prevState.q) {
			// if, after performing the search, there is only one item left, then select it
			const filteredItems = this.filterItems(this.props.items, true);
			if (filteredItems.length === 1)
				this.setState({ selected: this.calculateKey(filteredItems[0]) });
		}
	}

	calculateKey(item, parentItem) {
		const itemKey = item.key || item.action;
		return parentItem ? `${parentItem.key || parentItem.action}/${itemKey}` : itemKey;
	}

	renderItem = (item, parentItem, index) => {
		if (item.label === "-") return <hr key={this.count++} />;
		if (item.fragment) return item.fragment;
		const key = this.calculateKey(item, parentItem);
		let selected = key === this.state.selected || (this.state.selected + "").startsWith(key + "/");
		if (item.type === "search") {
			selected = false;
		}

		return (
			<li
				className={createClassString({
					"menu-item": true,
					disabled: item.disabled,
					hover: selected && !item.noHover && !item.customHover,
					"custom-hover": selected && item.customHover
				})}
				id={`li-item-${key}`}
				key={key}
				onMouseEnter={() => this.handleMouseEnter(key)}
				onClick={event => this.handleClickItem(event, item)}
			>
				{item.floatRight && <span className="float-right">{item.floatRight.label}</span>}
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
						className="input-text control"
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

	filterItems = (items, skipDisabled) => {
		let count = 0;
		const q = (this.state.q || "").toLowerCase();

		const filteredItems = _filter(items, item => {
			if (skipDisabled && item.disabled) {
				return false;
			} else if (skipDisabled && item.label === "-") {
				return false;
			} else if (skipDisabled && item.type === "search") {
				return false;
			} else if (skipDisabled && item.noHover) {
				return false;
			} else if (q.length && item.skipSearch) {
				return false;
			} else if (item.searchLabel !== undefined && !item.searchLabel.toLowerCase().includes(q)) {
				return false;
				// maxitems doesn't work yet....
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
				{this.props.title && !parentItem && (
					<h3>
						{this.props.title}
						<span className="icons">
							{this.props.titleIcon}
							<Icon
								title="Close Menu"
								placement="top"
								onClick={e => this.props.action()}
								name="x"
							/>
						</span>
					</h3>
				)}
				<ul className="compact">
					{itemsToRender.map((item, index) => this.renderItem(item, parentItem, index))}
				</ul>
				<button
					className="focus-button"
					style={{ position: "absolute", left: "-1000px" }}
					onKeyDown={this.handleKeyDown}
				></button>
			</div>
		);
	};

	render() {
		this.count = 0;
		const className = this.props.compact ? "menu-popup compact" : "menu-popup";

		/*
			Using the ModalContext z-index as an override in case this is being rendered from inside a Modal,
			where it needs a z index equivalent to the modal
		*/
		return ReactDOM.createPortal(
			<ModalContext.Consumer>
				{({ zIndex }) => (
					<div
						style={{ zIndex }}
						className={className}
						ref={ref => (this._div = ref)}
						onKeyDown={this.handleKeyDown}
					>
						{this.renderMenu(this.props.items, null)}
					</div>
				)}
			</ModalContext.Consumer>,
			this.el
		);
	}

	findIndex(key, items) {
		let index = -1;
		items.map((item, counter) => {
			if (key === this.calculateKey(item)) index = counter;
		});
		return index;
	}

	// the keypress handler for tracking up and down arrow and enter
	handleMenuKeyPress = (event, eventType) => {
		const { selected } = this.state;
		event.preventDefault();
		if (eventType == "escape") {
			this.closeMenu();
		} else {
			let newIndex = 0;
			const filteredItems = this.filterItems(this.props.items, true);
			const selectedIndex = this.findIndex(selected, filteredItems);
			if (eventType == "down") {
				if (selectedIndex < filteredItems.length - 1) {
					newIndex = selectedIndex + 1;
				} else {
					newIndex = 0;
				}
			} else if (eventType == "up") {
				if (selectedIndex == 0) {
					newIndex = filteredItems.length - 1;
				} else {
					newIndex = selectedIndex - 1;
				}
			} else if (eventType == "tab") {
				// this.handleSelectAtMention();
			} else if (eventType === "enter") {
				const item = filteredItems[selectedIndex];
				this.handleClickItem(event, item);
			}
			const selectedItem = filteredItems[newIndex];
			const key = this.calculateKey(selectedItem);

			this.setState({ selected: key });

			// while we manually scroll the viewport, we do not want
			// the mouseEnter events to fire, which would select
			// the "wrong" menu item. So we set a value and a timer
			// to clear it.
			this.programaticScrolling++;
			document
				.getElementById("li-item-" + key)
				.scrollIntoView({ behavior: "smooth", block: "nearest" });
			setTimeout(() => {
				this.programaticScrolling--;
			}, 750);
		}
	};

	handleKeyDown = event => {
		if (event.key === "ArrowUp") {
			event.stopPropagation();
			this.handleMenuKeyPress(event, "up");
		}
		if (event.key === "ArrowDown") {
			event.stopPropagation();
			this.handleMenuKeyPress(event, "down");
		}
		if (event.key === "Tab") this.handleMenuKeyPress(event, "tab");
		if (event.key === "Escape") {
			this.props.action(null); // invoke the action callback for entire menu so it can removed
			event.preventDefault();
			if (this.props.focusOnSelect) this.props.focusOnSelect.focus();
		}
		if (event.key === "Enter") {
			event.preventDefault();
			this.handleMenuKeyPress(event, "enter");
		}
	};

	handleMouseEnter = key => {
		if (!this.programaticScrolling) this.setState({ selected: key });
	};

	handleClickItem = async (event, item) => {
		event.stopPropagation();
		if (item.type === "search") return;
		// support functions as item actions
		if (typeof item.action === "function" && !item.disabled) {
			item.action();
			this.props.action(null); // invoke the action callback for entire menu so it can removed
		} else this.props.action(item.disabled ? null : item.action);
		if (this.props.focusOnSelect) this.props.focusOnSelect.focus();
	};
}
