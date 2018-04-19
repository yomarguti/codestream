import React from "react";
import PropTypes from "prop-types";

export default function withConfigs(Child) {
	return props => (
		<ConfigProvider>
			{configs => {
				return <Child {...props} configs={configs} />;
			}}
		</ConfigProvider>
	);
}

const getConfigs = () => {
	try {
		return atom.config.get("CodeStream");
	} catch (e) {
		return {
			// default configs for vscode
			showHeadshots: true
		};
	}
};

class ConfigProvider extends React.Component {
	static contextTypes = {
		platform: PropTypes.object
	};

	state = getConfigs();

	componentDidMount() {
		if (this.context.platform.isAtom)
			this.disposable = atom.config.onDidChange("CodeStream", event => {
				this.setState(getConfigs());
			});
	}

	componentWillUnmount() {
		this.disposable && this.disposable.dispose();
	}

	render() {
		return this.props.children({ ...this.state });
	}
}
