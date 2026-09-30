import {
	ExtraButtonComponent,
	SettingGroupItem,
	SliderComponent,
} from "obsidian";
import t from "../l10n";

interface ResettableSliderOptions {
	name: string;
	desc: string;
	min: number;
	max: number;
	/** Current stored value; `undefined` falls back to `defaultValue`. */
	value: () => number | undefined;
	defaultValue: number;
	onChange: (value: number) => void | Promise<void>;
}

/** A slider with a reset button; the native slider has none, so it's a `render` row. */
export function resettableSlider(
	opts: ResettableSliderOptions
): SettingGroupItem {
	const { name, desc, min, max, defaultValue, onChange } = opts;
	return {
		name,
		desc,
		render: (setting): void => {
			const current = opts.value() ?? defaultValue;
			let slider: SliderComponent;
			let resetBtn: ExtraButtonComponent;

			setting.addSlider((cb) => {
				slider = cb;
				cb.setLimits(min, max, 1)
					.setValue(current)
					.onChange(async (value) => {
						await onChange(value);
						resetBtn.setDisabled(value === defaultValue);
					});
			});
			setting.addExtraButton((bt) => {
				resetBtn = bt;
				bt.setIcon("reset")
					.setTooltip(t("Restore default"))
					.setDisabled(current === defaultValue)
					.onClick(async () => {
						slider.setValue(defaultValue);
						await onChange(defaultValue);
						resetBtn.setDisabled(true);
					});
			});
		},
	};
}
