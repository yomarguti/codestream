import React from "react";
import _ from "underscore";
import RCTooltip from "rc-tooltip";

/* eslint-disable no-unused-vars */
const tooltipOptions = ({ children, ...options }) => options;
/* eslint-enable no-unused-vars */

export default class Tooltip extends React.Component {
	isInAtom = Boolean(global.atom);

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
		if (this.isInAtom) this.disposable = atom.tooltips.add(target || this.target, options);
	}

	tearDown() {
		this.disposable && this.disposable.dispose();
	}

	render() {
		if (!this.props.title) return this.props.children;

		try {
			if (this.isInAtom) {
				const child = React.Children.only(this.props.children);
				return React.cloneElement(child, { ref: element => (this.target = element) });
			} else {
				const content = this.props.content ? this.props.content : <span>{this.props.title}</span>;
				return (
					<RCTooltip
						placement={this.props.placement}
						overlay={content}
						mouseEnterDelay={this.props.delay || 0}
					>
						{this.props.children}
					</RCTooltip>
				);
			}
		} catch (e) {
			console.error("A Tooltip could not render", e);
			return false;
		}
	}
}
