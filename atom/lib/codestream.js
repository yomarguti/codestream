import { CompositeDisposable } from "atom"
import CodestreamView, { CODESTREAM_VIEW_URI } from "./codestream-view"

module.exports = {
	subscriptions: null,

	activate(state) {
		this.subscriptions = new CompositeDisposable()
		this.subscriptions.add(
			atom.workspace.addOpener(uri => {
				if (uri === CODESTREAM_VIEW_URI) {
					return new CodestreamView()
				}
			}),
			atom.commands.add("atom-workspace", {
				"codestream:toggle": () => atom.workspace.toggle(CODESTREAM_VIEW_URI)
			})
		)
	},

	deactivate() {
		this.subscriptions.dispose()
		if (this.statusBarTile) this.statusBarTile.destroy()
	},

	serialize() {
		return {}
	},

	deserializeCodestreamView(serialized) {
		return new CodestreamView()
	},

	consumeStatusBar(statusBar) {
		const div = document.createElement("div")
		div.classList.add("inline-block")
		const icon = document.createElement("span")
		icon.classList.add("icon", "icon-comment-discussion")
		icon.onclick = event =>
			atom.commands.dispatch(document.querySelector("atom-workspace"), "codestream:toggle")
		atom.tooltips.add(div, { title: "Toggle CodeStream" })
		div.appendChild(icon)
		this.statusBarTile = statusBar.addRightTile({ item: div, priority: 400 })
	}
}
