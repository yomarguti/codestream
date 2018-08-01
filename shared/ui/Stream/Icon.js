import React from "react";
import createClassString from "classnames";
import octicons from "octicons";

export default class Icon extends React.PureComponent {
	render() {
		const octicon = octicons[this.props.name];
		if (!octicon) throw new Error(`No icon found for '${this.props.name}'`);

		return (
			<span
				className={createClassString("icon", this.props.className)}
				onClick={this.props.onClick}
				dangerouslySetInnerHTML={{ __html: octicon.toSVG() }}
			/>
		);
	}
}

Icon.defaultProps = {
	className: "",
	onClick: event => event.preventDefault()
};
