import { useEffect, useRef, useState, useCallback, useLayoutEffect, EffectCallback } from "react";

type Fn = () => void;

export function useDidMount(callback: EffectCallback) {
	useEffect(callback, []);
}

export function useUpdates(callback: Fn, dependencies: any[] = []) {
	const onMount = useCallback(() => {
		isMountedRef.current = true;
	}, []);
	const isMountedRef = useRef(false);
	useEffect(isMountedRef.current ? callback : onMount, dependencies);
}

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

type RectResult = {
	bottom: number;
	height: number;
	left: number;
	right: number;
	top: number;
	width: number;
};

function getRect<T extends HTMLElement>(element?: T): RectResult {
	let rect: RectResult = {
		bottom: 0,
		height: 0,
		left: 0,
		right: 0,
		top: 0,
		width: 0
	};
	if (element) rect = element.getBoundingClientRect();
	return rect;
}

export function useRect<T extends HTMLElement>(
	ref: React.RefObject<T>,
	dependencies: any[] = []
): RectResult {
	const [rect, setRect] = useState<RectResult>(
		ref && ref.current ? getRect(ref.current) : getRect()
	);

	const handleResize = useCallback(() => {
		if (!ref.current) return;
		setRect(getRect(ref.current)); // Update client rect
	}, [ref]);

	useLayoutEffect(() => {
		const element = ref.current;
		if (!element) return;

		handleResize();

		// @ts-ignore
		if (typeof ResizeObserver === "function") {
			// @ts-ignore
			let resizeObserver = new ResizeObserver(() => handleResize());
			resizeObserver.observe(element);
			return () => {
				if (!resizeObserver) return;
				resizeObserver.disconnect();
				resizeObserver = null;
			};
		} else {
			window.addEventListener("resize", handleResize); // Browser support, remove freely
			return () => window.removeEventListener("resize", handleResize);
		}
	}, dependencies);

	return rect;
}
