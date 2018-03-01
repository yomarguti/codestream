class Remote {
	constructor(descriptor) {
		this.name = descriptor[0];
		this.url = descriptor[1];
		this.type = descriptor[2].replace(/[()]/g, "");
	}
}

export default function makeRemote(descriptor) {
	return new Remote(descriptor);
}
