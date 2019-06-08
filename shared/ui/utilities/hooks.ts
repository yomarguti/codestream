import { useEffect, useRef } from "react";

type Fn = () => void;

export function useInterval(callback: Fn, delay = 1000) {
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
		let id = setInterval(tick, delay);
		return () => clearInterval(id);
	}, [delay]);
}

export function useTimeout(callback: Fn, delay: number) {
	useEffect(() => {
		let id = setTimeout(function() {
			callback();
		}, delay);

		return () => clearTimeout(id);
	}, [callback, delay]);
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
	}, 5000);
}
