export class WebviewIpc {
	private channel: MessageChannel;

	constructor() {
		this.channel = new MessageChannel();
	}

	get host() {
		return this.channel.port1;
	}

	get webview() {
		return this.channel.port2;
	}
}
