import { ColorComponent } from "obsidian";
import { h } from "preact";
import { useEffect, useRef } from "preact/hooks";

interface ColorPickerProps {
	initialColor: string;
	// eslint-disable-next-line no-unused-vars
	onChange: (_color: string) => void;
}

export const ColorPicker = ({
	initialColor,
	onChange,
}: ColorPickerProps): h.JSX.Element => {
	const ref = useRef<HTMLDivElement>(null);
	useEffect(() => {
		if (ref.current) {
			new ColorComponent(ref.current)
				.setValue(initialColor)
				.onChange(onChange);
		}

		return () => ref.current?.empty?.();
	}, [onChange, initialColor]);

	return <div ref={ref} className="cmdr-flex cmdr-items-center" />;
};
