import * as React from "react";
import { connect } from "react-redux";
import Tooltip from "../Stream/Tooltip";

interface Props {
	children: any;
	enabled: boolean;
	text?: string;
	object?: { [key: string]: any };
}

const renderObject = (object: object) => {
	return (
		<div style={{ maxHeight: "100px", overflowY: "scroll" }}>
			{Object.entries(object).map(([key, value]) => (
				<div key={key}>
					{key}: {JSON.stringify(value)}
				</div>
			))}
		</div>
	);
};

function Debug(props: Props) {
	if (props.enabled) {
		const title = props.object ? renderObject(props.object) : props.text;

		return (
			<Tooltip placement="right" title={title} delay={0.5}>
				<span>{props.children}</span>
			</Tooltip>
		);
	} else return props.children;
}

const mapStateToProps = (state: any) => ({ enabled: state.configs.debug });
export default connect(mapStateToProps)(Debug);
