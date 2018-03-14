const OPERATIONS = {
	" ": "SYNC",
	"+": "ADD",
	"-": "DEL"
};

export default class DeltaBuilder {
	constructor(patch) {
		this._oldFile = patch.oldFileName;
		this._newFile = patch.newFileName;
		this._hunks = patch.hunks;
		this._edits = [];
		this._state = "sync";
		this._oldLine = 0;
		this._newLine = 0;
	}

	build() {
		this._processHunks();
		this._setState("sync");
		return {
			oldFile: this._oldFile,
			newFile: this._newFile,
			edits: this._edits
		};
	}

	_processHunks() {
		for (const hunk of this._hunks) {
			const { oldStart, newStart, lines } = hunk;
			let oldLine = oldStart;
			let newLine = newStart;
			for (const rawLine of lines) {
				const operation = OPERATIONS[rawLine.charAt(0)];
				const content = rawLine.substr(1);

				this._processLine({
					operation,
					content,
					oldLine,
					newLine
				});

				if (operation === "SYNC" || operation === "ADD") {
					newLine++;
				}
				if (operation === "SYNC" || operation === "DEL") {
					oldLine++;
				}
			}
		}
	}

	_processLine(line) {
		const operation = line.operation;
		switch (operation) {
			case "SYNC":
				return this._ctx(line);
			case "ADD":
				return this._add(line);
			case "DEL":
				return this._del(line);
		}
	}

	_ctx(line) {
		this._setState("sync");
		this._oldLine = line.oldLine;
		this._newLine = line.newLine;
	}

	_add(line) {
		this._setState("edit");
		this._adds.push(line.content);
	}

	_del(line) {
		this._setState("edit");
		this._dels.push(line.content);
	}

	_setState(state) {
		if (state !== this._state) {
			this._state = state;
			this["_" + state]();
		}
	}

	_sync() {
		const dels = this._dels;
		const adds = this._adds;
		const delStart = this._delStart;
		const addStart = this._addStart;
		const delLength = dels.length;
		const addLength = adds.length;

		this._edits.push({
			delStart: delStart,
			addStart: addStart,
			delLength: delLength,
			addLength: addLength,
			dels: dels,
			adds: adds
		});
	}

	_edit() {
		this._delStart = this._oldLine + 1;
		this._addStart = this._newLine + 1;
		this._adds = [];
		this._dels = [];
	}
}
