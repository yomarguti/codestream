interface ConfigSchema {
	team: string;
}

export function ofPackage<T extends keyof ConfigSchema>(name: T): ConfigSchema[T] {
	return atom.config.get(`codestream.${name}`);
}
