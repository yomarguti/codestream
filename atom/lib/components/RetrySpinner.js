import React from "react";

export default class RetrySpinner extends React.Component {
	state = { loading: false };
	mounted = false;

	componentDidMount() {
		this.mounted = true;
		this.tooltip = atom.tooltips.add(this.span, { title: "Retry" });
	}

	componentWillUnmount() {
		this.mounted = false;
		this.tooltip.dispose();
	}

	onClick = async event => {
		event.stopPropagation();
		if (this.state.loading === false) {
			this.setState({ loading: true });
			await this.props.callback();
			if (this.mounted) this.setState({ loading: false });
		}
	};

	render() {
		return (
			<div className="retry-spinner" onClick={this.onClick}>
				{this.state.loading ? (
					<span className="loading loading-spinner-tiny inline-block" />
				) : (
					<span ref={element => (this.span = element)} className="icon icon-sync text-error" />
				)}
			</div>
		);
	}
}
