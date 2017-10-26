import React from "react"
import { render, unmountComponentAtNode } from "react-dom"
import Onboarding from "./components/Onboarding"

export default class CodestreamView {
	constructor(serializedState) {
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
		return "atom://codestream"
	}

	// Returns an object that can be retrieved when package is activated
	serialize() {}

	// Tear down any state and detach
	destroy() {
		unmountComponentAtNode(this.element)
		this.element.remove()
	}
}
