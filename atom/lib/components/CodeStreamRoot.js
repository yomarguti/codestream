import React, { Component } from "react";
import { createStore, applyMiddleware } from "redux";
import thunkMiddleware from "redux-thunk";
import { Provider } from "react-redux";
import getSystemUser from "username";
import PropTypes from "prop-types";
import NoGit from "./NoGit";
import Onboarding from "./onboarding/Onboarding";
import Stream from "./Stream";
import withAPI from "./onboarding/withAPI";
import reducer from "./reducer";

const store = createStore(reducer, applyMiddleware(thunkMiddleware));

class CodeStreamRoot extends Component {
	static defaultProps = {
		repositories: [],
		user: {}
	};

	static childContextTypes = {
		repositories: PropTypes.array
	};

	constructor(props) {
		super(props);
		this.state = {};
	}

	componentDidMount() {
		atom.workspace.observeActiveTextEditor(editor => {
			store.dispatch({
				type: "ACTIVE_FILE_CHANGED",
				payload: editor ? this.props.repositories[0].relativize(editor.getPath()) : ""
			});
		});
	}

	getChildContext() {
		return {
			repositories: this.props.repositories
		};
	}

	render() {
		const { accessToken, user, repositories, team, onboarding, repos, repoMetadata } = this.props;

		if (repositories.length === 0) return <NoGit />;
		else if (onboarding.complete && accessToken) {
			store.dispatch({
				type: "addDataFromOnboarding",
				payload: { accessToken, repos, repoMetadata }
			});
			return (
				<Provider store={store}>
					<Stream />
				</Provider>
			);
		} else {
			const repository = repositories[0];
			const gitDirectory = repository.getWorkingDirectory();
			const email = repository.getConfigValue("user.email", gitDirectory);
			const name = repository.getConfigValue("user.name", gitDirectory);
			return <Onboarding team={team} email={email} username={getSystemUser.sync()} name={name} />;
		}
	}
}

const mapStateToProps = ({ accessToken, user, team, onboarding, repos, repoMetadata }) => ({
	accessToken,
	user,
	team,
	onboarding,
	repos,
	repoMetadata
});
export default withAPI(mapStateToProps)(CodeStreamRoot);
