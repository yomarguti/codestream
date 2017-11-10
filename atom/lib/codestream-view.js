import React from "react"
import { render, unmountComponentAtNode } from "react-dom"
import CodeStreamRoot from "./components/CodeStreamRoot"

export const CODESTREAM_VIEW_URI = "atom://codestream"

export default class CodestreamView {
	constructor() {
		this.element = document.createElement("div")
		this.element.classList.add("codestream")

		const repositories = atom.project.getRepositories().filter(Boolean)
		render(<CodeStreamRoot repositories={repositories} />, this.element)
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
