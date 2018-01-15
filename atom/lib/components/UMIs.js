import React, { Component } from "react";
import { connect } from "react-redux";
import createClassString from "classnames";

const remote = require("electron").remote;
var app = remote.app;

export class SimpleUMIs extends Component {
	constructor(props) {
		super(props);
		this.state = {};
		// if (atom.packages.isPackageLoaded("tree-view"))
		let treeView = atom.packages.getLoadedPackage("tree-view");
		if (treeView) this.treeView = treeView.mainModule.getTreeViewInstance();

		// console.log("hitting async ");
		let f = async () => {
			const directories = atom.project.getDirectories();
			const repoPromises = directories.map(repo => atom.project.repositoryForDirectory(repo));
			const allRepos = await Promise.all(repoPromises);
			const repos = allRepos.filter(Boolean);

			if (repos.length > 0) {
				const repo = repos[0];
				this.cwd = repo.getWorkingDirectory();
				this.repo = repo;
			}
		};
		f();
	}

	render() {
		const umis = this.props.umis;

		this.addUnreadsIndicatorDivs();
		// console.log("TREE TRACKER IS: ", this.treeView);
		// console.log("THE STREAMS ARE: ", this.props.streams);
		// console.log("RENDERING UMIS", umis);
		this.handleScroll();
		// console.log(this.cwd + "/marker_pseudo_code.js");
		// console.log(this.treeView.entryForPath(this.cwd + "/marker_pseudo_code.js"));

		function swapHash(json) {
			var ret = {};
			Object.keys(json).map(key => {
				ret[json[key].id] = key;
			});
			return ret;
		}

		let streamMap = swapHash(this.props.streams.byFile);

		// FIXME -- shouldn't need this if we initialize properly
		if (!umis.mentions) umis.mentions = {};
		if (!umis.unread) umis.unread = {};
		this.clearTreatments();

		let totalUMICount = 0;
		Object.keys(umis.unread).map(key => {
			let path = streamMap[key] || "";
			let count = umis.unread[key];
			let mentions = umis.mentions[key];
			totalUMICount += this.calculateTreatment(path, count, mentions);
		});
		app.setBadgeCount(Math.floor(totalUMICount));
		Object.keys(umis.unread).map(key => {
			let path = streamMap[key] || "";
			this.treatPath(path);
		});
		return null;
	}

	clearTreatments() {
		this.treatments = {};

		let elements = document.getElementsByClassName("cs-has-umi");
		let index = elements.length;
		while (index--) {
			let element = elements[index];

			element.setAttribute("cs-umi-mention", 0);
			element.setAttribute("cs-umi-badge", 0);
			element.setAttribute("cs-umi-count", 0);
			element.setAttribute("cs-umi-bold", 0);
			element.classList.remove("cs-has-umi");
		}
	}

	calculateTreatment(path, count, mentions) {
		let treatment = this.getTreatment(path);

		let parts = path.split("/");
		while (parts.length) {
			let pathPart = parts.join("/");
			if (!this.treatments[pathPart]) this.treatments[pathPart] = {};
			if (mentions) {
				this.treatments[pathPart]["mentions"] =
					(this.treatments[pathPart]["mentions"] || 0) + mentions;
			}
			if (treatment !== "mute") {
				this.treatments[pathPart]["count"] = (this.treatments[pathPart]["count"] || 0) + count;
			}
			// if (treatment !== "mute") this.treatments[pathPart]["treatment"] += treatment;
			parts.pop();
		}

		let totalUMICount = 0;
		if (mentions || treatment === "badge") {
			totalUMICount += count;
		} else if (treatment === "mute") {
			// do nothing if the user wants to mute
		} else {
			// this is bold; don't add to the app badge count
			totalUMICount += 0.000001;
		}

		return totalUMICount;
	}

	treatPath(path) {
		let element = this.treeView.entryForPath(this.cwd + "/" + path);
		if (!element) return;

		// don't treat directories that are expanded
		if (element.classList.contains("directory") && element.classList.contains("expanded")) return;

		let liPath = element.getElementsByTagName("span")[0].getAttribute("data-path");
		liPath = this.repo.relativize(liPath);

		// if the user wants a badge... set the appropriate class
		let treatmentData = this.treatments[liPath];
		if (!treatmentData) return;
		let count = treatmentData["count"];
		let mentions = treatmentData["mentions"];
		let treatment = this.getTreatment(liPath);

		if (mentions) {
			element.setAttribute("cs-umi-mention", count > 0 ? 1 : 0);
			element.setAttribute("cs-umi-badge", count > 0 ? 1 : 0);
			element.setAttribute("cs-umi-count", count > 99 ? "99+" : count);
		} else if (treatment === "badge") {
			element.setAttribute("cs-umi-badge", count > 0 ? 1 : 0);
			element.setAttribute("cs-umi-count", count > 99 ? "99+" : count);
		} else if (treatment !== "mute") {
			// default is to bold
			element.setAttribute("cs-umi-bold", count > 0 ? 1 : 0);
		}

		// if we actually have a UMI that hasn't been muted....
		if (count > 0 && treatment !== "mute") {
			element.classList.add("cs-has-umi");
		} else {
			element.classList.remove("cs-has-umi");
		}
	}

	getTreatment(path) {
		let parts = path.split("/");
		let index = parts.length;
		while (parts.length) {
			let path = parts.join("/");
			let treatment = atom.config.get("CodeStream.showUnread-" + path);
			if (treatment) return treatment;
			parts.pop();
		}
		return atom.config.get("CodeStream.showUnread") || "badge";
	}

	componentDidMount() {
		this.scrollDiv = document.getElementsByClassName("tree-view")[0];
		this.scrollDiv.addEventListener("scroll", this.handleScroll.bind(this));
		this.scrollDiv.addEventListener("click", this.handleClick.bind(this));
		let that = this;
		new ResizeObserver(function() {
			that.handleScroll();
		}).observe(this.scrollDiv);
	}

	handleClick(event) {
		// rerender because there may be a directory open/close
		this.render();
	}

	handleScroll(event) {
		// let elements = scrollDiv.getElementsByClassName("");
		let scrollDiv = event
			? event.target
			: document.getElementsByClassName("tool-panel tree-view")[0];
		let scrollTop = scrollDiv.scrollTop;
		let containerHeight = scrollDiv.parentNode.offsetHeight;

		let unreadsAbove = false;
		let unreadsBelow = false;
		let mentionsAbove = false;
		let mentionsBelow = false;

		let umiDivs = document.getElementsByClassName("cs-has-umi");
		let index = umiDivs.length;
		while (index--) {
			let umi = umiDivs[index];
			let top = umi.offsetTop;
			if (top - scrollTop + 10 < 0) {
				unreadsAbove = true;
				if (umi.getAttribute("cs-umi-mention") == "1") mentionsAbove = true;
			}
			if (top - scrollTop + 10 > containerHeight) {
				unreadsBelow = true;
				if (umi.getAttribute("cs-umi-mention") == "1") mentionsBelow = true;
			}
		}
		this.setUnreadsAttributes(
			document.getElementById("cs-unreads-above"),
			unreadsAbove,
			mentionsAbove
		);
		this.setUnreadsAttributes(
			document.getElementById("cs-unreads-below"),
			unreadsBelow,
			mentionsBelow
		);
	}

	setUnreadsAttributes(element, active, mentions) {
		if (active) element.classList.add("active");
		else element.classList.remove("active");
		if (mentions) element.classList.add("mention");
		else element.classList.remove("mention");
	}

	addUnreadsIndicatorDivs() {
		this.addUnreadsIndicatorDiv("above");
		this.addUnreadsIndicatorDiv("below");
	}

	addUnreadsIndicatorDiv(type) {
		let element = document.getElementById("cs-unreads-" + type);
		if (!element) {
			// assume there is only one of these
			let scrollDiv = document.getElementsByClassName("tool-panel tree-view")[0];
			let scrollParent = scrollDiv.parentNode;
			element = document.createElement("div");
			element.id = "cs-unreads-" + type;
			element.classList.add("cs-unreads");
			let indicator = type === "above" ? "&uarr;" : "&darr;";
			element.innerHTML = indicator + " Unread Messages " + indicator;
			element.onclick = function(event) {
				if (type === "below") scrollDiv.scrollTop += scrollDiv.offsetHeight;
				else scrollDiv.scrollTop -= scrollDiv.offsetHeight;
			};
			scrollParent.prepend(element);
		}
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
