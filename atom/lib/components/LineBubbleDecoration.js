import { CompositeDisposable } from "atom";
import React, { Component } from "react";
import ReactDOM from "react-dom";
import ReferenceBubble from "./ReferenceBubble";

export default class LineBubbleDecoration extends Component {
	subscriptions = new CompositeDisposable();

	constructor(props) {
		super(props);
		this.item = document.createElement("div");
		this.item.classList.add("codestream-comment-popup");
		atom.tooltips.add(this.item, { title: "View comments" });

		// if (reference.location[2] > maxLine) maxLine = reference.location[2] * 1;
		this.maxLine = props.references.reduce(
			(max, { location }) => (location[2] > max ? location[2] * 1 : max),
			props.line * 1
		);
	}

	componentDidMount() {
		this.decorate(this.props);
	}

	componentWillReceiveProps(nextProps) {
		if (nextProps.editor.id !== this.props.editor.id) {
			this.tearDown();
			this.decorate(nextProps);
		}
	}

	componentWillUnmount() {
		this.tearDown();
		this.subscriptions.dispose();
	}

	tearDown() {
		this.decoration && this.decoration.destroy();
		this.marker && this.marker.destroy();
	}

	decorate(props) {
		const options = {
			type: "overlay",
			position: props.position,
			class: props.className,
			item: this.item
		};

		const range = [[props.line * 1, 0], [this.maxLine + 1, 0]];
		this.marker = props.editor.markBufferRange(range, { invalidate: "never" });

		this.decoration = this.props.editor.decorateMarker(this.marker, options);
		this.subscriptions.add(
			this.props.editor.onDidDestroy(() => this.marker.destroy()),
			this.decoration.onDidDestroy(() => {
				this.tearDown();
				this.subscriptions.dispose();
				this.subscriptions = new CompositeDisposable();
			}),
			this.marker.onDidDestroy(() => {
				this.tearDown();
				this.subscriptions.dispose();
				this.subscriptions = new CompositeDisposable();
			})
		);
	}

	render() {
		return ReactDOM.createPortal(
			this.props.references.map((reference, index, group) => (
				<ReferenceBubble
					key={reference.id}
					editor={this.props.editor}
					onSelect={this.props.onSelect}
					count={group.length - index - 1}
					{...reference}
				/>
			)),
			this.item
		);
	}
}
