import React from "react";
import { Capabilities, CodemarkPlus } from "@codestream/protocols/agent";
import { injectIntl, InjectedIntl } from "react-intl";
import { CodeStreamState } from "../store";
import { connect } from "react-redux";
import MarkerActions from "./MarkerActions";

interface State {}

interface IntlProps {
	intl: InjectedIntl;
}

interface InheritedProps {
	codemark: CodemarkPlus;
	capabilities: Capabilities;
	isAuthor: boolean;
	alwaysRenderCode?: boolean;
	toggleCodeHighlightInTextEditor?: Function;
	jumpToMarkerId?: string;
}

type Props = InheritedProps & IntlProps;

class CodemarkActions extends React.Component<Props, State> {
	render() {
		const { codemark, capabilities, isAuthor, jumpToMarkerId } = this.props;
		if (codemark == null) return null;
		if (!codemark.markers || !codemark.markers.length) return null;

		const numMarkers = codemark.markers.length;

		return codemark.markers.map((marker, index) => {
			return (
				<div>
					<MarkerActions
						key={marker.id}
						codemark={codemark}
						marker={marker}
						capabilities={capabilities}
						isAuthor={isAuthor}
						alwaysRenderCode={true /* alwaysRenderCode || numMarkers > 1 */}
						markerIndex={index}
						numMarkers={numMarkers}
						jumpToMarker={jumpToMarkerId ? jumpToMarkerId === marker.id : index === 0}
					/>
				</div>
			);
		});
	}
}

const mapStateToProps = (state: CodeStreamState) => {
	return {
		jumpToMarkerId: state.context.currentMarkerId
	};
};

export default connect(mapStateToProps)(injectIntl(CodemarkActions));
