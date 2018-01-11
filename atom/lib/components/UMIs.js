import React, { Component } from "react";
import { connect } from "react-redux";
import createClassString from "classnames";

export class SimpleUMIs extends Component {
	constructor(props) {
		super(props);
		this.state = {};
	}

	render() {
		const umis = this.props.umis;

		console.log("RENDERING UMIS", umis);
		return null;
		// Object.keys(umis).map(key => {

		// });
		//{umi.map(indicator => {
		//}
		// );
	}
}

const mapStateToProps = ({ context, streams, users, umis }) => {
	const currentUser = users[context.currentUserId];
	return {
		users: users,
		streams: streams,
		currentUser: currentUser,
		umis: umis
	};
};

export default connect(mapStateToProps)(SimpleUMIs);
