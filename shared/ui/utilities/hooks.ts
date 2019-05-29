import { useEffect, useRef } from "react";

type Fn = () => void;

export function useInterval(callback: Fn, delaySeconds = 1) {
	const savedCallback = useRef<Fn>(callback);

	// Remember the latest callback.
	useEffect(() => {
		savedCallback.current = callback;
	}, [callback]);

	// Set up the interval.
	useEffect(() => {
		function tick() {
			savedCallback.current!();
		}
		let id = setInterval(tick, delaySeconds * 1000);
		return () => clearInterval(id);
	}, [delaySeconds]);
}

export function useTimeout(callback: Fn, seconds: number) {
	useEffect(() => {
		let id = setTimeout(function() {
			callback();
		}, seconds);

		return () => clearTimeout(id);
	}, [callback, seconds]);
}

export function useRetryingCallback(fn: () => Promise<any>) {
	const canRun = useRef(true);
	useInterval(async () => {
		if (!canRun.current) {
			return;
		}
		try {
			canRun.current = false;
			await fn();
		} catch (error) {}
		canRun.current = true;
	}, 5);
}
