import React, { Component } from "react";
import Gravatar from "react-gravatar";

export default class Menu extends Component {
	constructor(props) {
		super(props);
		this.state = { selected: props.selected };
	}

	componentDidMount() {}

	render() {
		// if (!this.props.on) return null;

		const items = this.props.items;

		return (
			<div className="menu-popup" ref={ref => (this._div = ref)}>
				<div className="body">
					<ul className="compact">
						{this.props.items.map(item => {
							let className = item.key == this.state.selected ? "hover" : "none";
							return (
								<li
									className={className}
									key={item.key}
									onMouseEnter={event => this.handleMouseEnter(item.key)}
									onClick={event => this.handleClickItem(item.key)}
								>
									{item.icon && <span class="icon">{item.icon}</span>}
									{item.label && <span class="label">{item.label}</span>}
									{item.shortcut && <span class="shortcut">{item.shortcut}</span>}
								</li>
							);
						})}
					</ul>
				</div>
			</div>
		);
	}

	handleMouseEnter(key) {
		// let index = this.state.items.findIndex(x => x.key == key);

		this.setState({
			selected: key
		});
	}

	handleClickItem(key) {
		return this.props.handleSelectMenu(key);
	}

	handleClick = async event => {
		console.log("CLICK ON MENU: " + event.target.innerHTML);
	};
}
