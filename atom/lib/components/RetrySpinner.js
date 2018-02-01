import React from "react";

export default class RetrySpinner extends React.Component {
	componentDidMount() {
		this.tooltip = atom.tooltips.add(this.span, { title: "Retry" });
	}

	componentWillUnmount() {
		this.tooltip.dispose();
	}

	onClick = event => {
		this.props.callback();
		event.stopPropagation();
	};

	render() {
		return (
			<div className="retry-spinner" onClick={this.onClick}>
				<span ref={element => (this.span = element)} className="icon icon-sync text-error" />
			</div>
		);
	}
}
