import React, { Component } from "react";
import createClassString from "classnames";

export default class ScrollBox extends Component {
	constructor(props) {
		super(props);
		this.state = {};
	}

	handleScroll = event => {
		if (!event || !event.target) return;
		const { offTop, offBottom } = this.state;
		const target = event.target;

		if (target.scrollTop > 1) {
			if (!offTop) this.setState({ offTop: true });
		} else if (offTop) this.setState({ offTop: false });
		if (target.scrollHeight - target.scrollTop > target.clientHeight + 2) {
			if (!offBottom) this.setState({ offBottom: true });
		} else if (offBottom) this.setState({ offBottom: false });
	};

	render() {
		const { offTop, offBottom } = this.state;
		return (
			<div
				className={createClassString("scrollbox", { "off-top": offTop, "off-bottom": offBottom })}
				style={{ overflow: "hidden", height: "100%" }}
				onScroll={this.handleScroll}
				data-scrollable="true"
			>
				{this.props.children}
			</div>
		);
	}
}
