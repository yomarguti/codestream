import React from "react"
import { render, unmountComponentAtNode } from "react-dom"
import getSystemUser from "username"
import Onboarding from "./components/Onboarding"
import NoGit from "./components/NoGit"

export const CODESTREAM_VIEW_URI = "atom://codestream"

export default class CodestreamView {
	constructor() {
		this.element = document.createElement("div")
		this.element.classList.add("codestream")

		const repositories = atom.project.getRepositories().filter(Boolean)
		if (repositories.length === 0) {
			render(<NoGit />, this.element)
		} else {
			const repository = repositories[0]
			const email = repository.getConfigValue("user.email", repository.getWorkingDirectory())
			const name = repository.getConfigValue("user.name", repository.getWorkingDirectory())
			render(<Onboarding email={email} username={getSystemUser.sync()} name={name} />, this.element)
		}
	}

	getTitle() {
		return "CodeStream"
	}

	getIconName() {
		return "comment-discussion"
	}

	getDefaultLocation() {
		return "right"
	}

	getAllowedLocations() {
		return ["right", "left"]
	}

	isPermanentDockItem() {
		return false
	}

	getPreferredWidth() {
		return 300
	}

	getURI() {
		return CODESTREAM_VIEW_URI
	}

	serialize() {
		return {
			deserializer: "codestream/CodestreamView"
		}
	}

	destroy() {
		unmountComponentAtNode(this.element)
		this.element.remove()
	}
}
