import React from "react";

export default function withConfigs(Child) {
	return props => (
		<ConfigProvider>
			{configs => {
				return <Child {...props} configs={configs} />;
			}}
		</ConfigProvider>
	);
}

const getConfigs = () => atom.config.get("CodeStream") || {};

class ConfigProvider extends React.Component {
	state = getConfigs();

	componentDidMount() {
		this.disposable = atom.config.onDidChange("CodeStream", event => {
			this.setState(getConfigs());
		});
	}

	componentWillUnmount() {
		this.disposable.dispose();
	}

	render() {
		return this.props.children({ ...this.state });
	}
}
