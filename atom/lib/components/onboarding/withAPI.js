import React, { Component } from "react";
import PropTypes from "prop-types";

class Connect extends Component {
	static contextTypes = {
		store: PropTypes.object.isRequired
	};

	state = this.createState();

	createState() {
		const { store } = this.context;
		const { actions } = this.props;
		const boundActions = {};
		for (let action in actions) {
			boundActions[action] = (...args) => actions[action](store, ...args);
		}
		return {
			actions: boundActions
		};
	}

	render() {
		return this.props.children({ ...this.state.actions, store: this.context.store });
	}
}

export default function withAPI(actions) {
	return Child => props => (
		<Connect actions={actions}>{apiProps => <Child {...props} {...apiProps} />}</Connect>
	);
}
