import React, { Component } from "react";
import { connect } from "react-redux";
import createClassString from "classnames";

export class SimpleUMIs extends Component {
	constructor(props) {
		super(props);
		this.state = {};
		// if (atom.packages.isPackageLoaded("tree-view"))
		let treeView = atom.packages.getLoadedPackage("tree-view");
		if (treeView) this.treeView = treeView.mainModule.getTreeViewInstance();

		console.log("hitting async ");
		let f = async () => {
			const directories = atom.project.getDirectories();
			const repoPromises = directories.map(repo => atom.project.repositoryForDirectory(repo));
			const allRepos = await Promise.all(repoPromises);
			const repos = allRepos.filter(Boolean);

			if (repos.length > 0) {
				const repo = repos[0];
				this.cwd = repo.getWorkingDirectory();
			}
		};
		f();
	}

	render() {
		const umis = this.props.umis;

		// console.log("TREE TRACKER IS: ", this.treeView);
		console.log("THE STREAMS ARE: ", this.props.streams);
		// console.log("RENDERING UMIS", umis);
		// console.log(this.cwd + "/marker_pseudo_code.js");
		// console.log(this.treeView.entryForPath(this.cwd + "/marker_pseudo_code.js"));

		function swap(json) {
			var ret = {};
			Object.keys(json).map(key => {
				ret[json[key].id] = key;
			});
			return ret;
		}

		let streamMap = swap(this.props.streams.byFile);

		let totalUMICount = 0;
		Object.keys(umis).map(key => {
			let element = this.treeView.entryForPath(this.cwd + "/" + streamMap[key]);
			let count = umis[key];
			// reset has UMI to 0

			element.setAttribute("cs-has-umi", 0);
			// if the user wants a badge... perhaps set cs-has-umi
			if (atom.config.get("CodeStream.badge-" + key)) {
				element.setAttribute("cs-has-umi", count > 0 ? 1 : 0);
				element.setAttribute("cs-umi-count", count > 99 ? "99+" : count);
				totalUMICount += count;
			} else if (atom.config.get("CodeStream.mute-" + key)) {
				// do nothing if the user wants to mute
			} else {
				// default is to bold
				element.setAttribute("cs-umi-bold", count > 0 ? 1 : 0);
				totalUMICount += 0.000001;
			}
		});
		return null;
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
