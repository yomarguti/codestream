class LocalStore {
	set(key: string, value: any) {
		localStorage.setItem(key, JSON.stringify(value));
	}

	get(key: string) {
		const item = localStorage.getItem(key);
		if (item == undefined) {
			return undefined;
		}

		return JSON.parse(item);
	}

	delete(key: string) {
		localStorage.removeItem(key);
	}
}

export const localStore = new LocalStore();
