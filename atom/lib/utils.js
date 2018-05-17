// @flow
export const accessSafely = <T>(f: () => T): T | void => {
	try {
		return f();
	} catch (e) {
		return undefined;
	}
};
