import React, { Component } from "react";
import PropTypes from "prop-types";

class Connect extends Component {
	static contextTypes = {
		store: PropTypes.object.isRequired
	};

	state = this.createState();
	actions = this.createActions();

	componentWillMount() {
		this.unsubscribe = this.context.store.subscribe(this.update);
	}

	componentWillUnmount() {
		this.unsubscribe(this.update);
	}

	update = () => {
		const mapped = this.createState();
		// if (!shallowEqual(mapped, this.state)) {
		this.setState(mapped);
		// }
	};

	createState() {
		const { mapToProps } = this.props;
		const state = (this.context.store && this.context.store.getViewData()) || {};
		return mapToProps ? mapToProps(state, this.props) : state;
	}

	createActions() {
		const { store } = this.context;
		const { actions } = this.props;
		const boundActions = {};
		if (typeof actions === "function") {
			const instantiatedActions = actions(store);
			for (let action in instantiatedActions) {
				boundActions[action] = (...args) => instantiatedActions[action](...args);
			}
		} else {
			for (let action in actions) {
				boundActions[action] = (...args) => actions[action](store, ...args);
			}
		}
		return boundActions;
	}

	render() {
		return this.props.children({ ...this.state, ...this.actions, store: this.context.store });
	}
}

export default function withAPI(mapToProps, actions = {}) {
	return Child => props => {
		return (
			<Connect mapToProps={mapToProps} actions={actions}>
				{mappedProps => <Child {...props} {...mappedProps} />}
			</Connect>
		);
	};
}
