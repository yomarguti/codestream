import React from "react";
import _ from "underscore-plus";

/* eslint-disable no-unused-vars */
const tooltipOptions = ({ children, ...options }) => options;
/* eslint-enable no-unused-vars */

export default class Tooltip extends React.Component {
	componentDidMount() {
		this.configure(this.props);
	}

	componentDidUpdate(previousProps) {
		const currentOptions = tooltipOptions(this.props);
		if (!_.isEqual(tooltipOptions(previousProps), currentOptions)) {
			this.tearDown();
			this.configure(currentOptions);
		}
	}

	componentWillUnmount() {
		this.tearDown();
	}

	configure(props) {
		/* eslint-disable no-unused-vars */
		const { children, target, ...options } = props;
		/* eslint-enable no-unused-vars */
		if (global.atom) this.disposable = atom.tooltips.add(target || this.target, options);
	}

	tearDown() {
		this.disposable && this.disposable.dispose();
	}

	render() {
		try {
			const child = React.Children.only(this.props.children);
			return React.cloneElement(child, { ref: element => (this.target = element) });
		} catch (e) {
			/* nothing to render */
			return false;
		}
	}
}
