import React from "react";
import _ from "underscore-plus";
import PropTypes from "prop-types";

const tooltipOptions = ({ children, ...options }) => options;

// TODO: make this a PureComponent or implement componentShouldUpdate
export default class Tooltip extends React.Component {
	static contextTypes = {
		platform: PropTypes.object
	};

	componentDidMount() {
		const { children, ...options } = this.props;
		this.configure(options);
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

	configure(options) {
		const { platform } = this.context;
		if (platform.tooltips) this.disposable = platform.tooltips.add(this.target, options);
	}

	tearDown() {
		this.disposable && this.disposable.dispose();
	}

	render() {
		const child = React.Children.only(this.props.children);
		return React.cloneElement(child, { ref: element => (this.target = element) });
	}
}
