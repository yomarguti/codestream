import React from "react";
import { render, unmountComponentAtNode } from "react-dom";
import { Container } from "codestream-components";
import translations from "codestream-components/translations/en.json";

export const CODESTREAM_VIEW_URI = "atom://codestream";

export default class CodestreamView {
	constructor(store) {
		this.alive = true;
		this.element = document.createElement("div");
		this.element.classList.add("codestream");

		render(
			<Container store={store} i18n={{ locale: "en", messages: translations }} />,
			this.element
		);
	}

	getTitle() {
		return "CodeStream";
	}

	getIconName() {
		return "comment-discussion";
	}

	getDefaultLocation() {
		return "right";
	}

	getAllowedLocations() {
		return ["right", "left"];
	}

	isPermanentDockItem() {
		return false;
	}

	getPreferredWidth() {
		// FIXME save this as a preference
		return 300;
	}

	getURI() {
		return CODESTREAM_VIEW_URI;
	}

	serialize() {
		return {
			deserializer: "codestream/CodestreamView"
		};
	}

	destroy() {
		unmountComponentAtNode(this.element);
		this.element.remove();
		this.alive = false;
	}
}
