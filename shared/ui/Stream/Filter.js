import React, { Component } from "react";
import { connect } from "react-redux";
import Icon from "./Icon";
import Menu from "./Menu";
import { setUserPreference } from "./actions";

export class SimpleFilter extends Component {
	constructor(props) {
		super(props);
		this.state = { selected: props.selected };
	}

	render = () => {
		const { items, labels, selected } = this.props;
		const { menuOpen, menuTarget } = this.state;

		return (
			<span className="filter" onClick={this.toggleMenu}>
				{labels[selected]}
				<Icon name="triangle-down" className="triangle-down" />
				{menuOpen && (
					<Menu items={items} target={menuTarget} action={this.menuAction} align="center" />
				)}
			</span>
		);
	};

	menuAction = arg => {
		const { preferenceId, setUserPreference, onValue, action } = this.props;
		this.setState({ menuOpen: false });
		if (preferenceId && arg != null) setUserPreference([preferenceId], arg);
		if (onValue && arg && arg !== "") onValue(arg);
		if (action) action(arg);
	};

	toggleMenu = event => {
		this.setState({ menuOpen: !this.state.menuOpen, menuTarget: event.target });
	};
}

export default connect(
	null,
	{ setUserPreference }
)(SimpleFilter);
