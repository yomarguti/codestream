import React from "react"
import { render, unmountComponentAtNode } from "react-dom"
import Onboarding from "./components/Onboarding"

export const CODESTREAM_VIEW_URI = "atom://codestream"

export default class CodestreamView {
	constructor() {
		this.element = document.createElement("div")
		this.element.classList.add("codestream")
		render(<Onboarding />, this.element)
	}

	getTitle() {
		return "CodeStream"
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
