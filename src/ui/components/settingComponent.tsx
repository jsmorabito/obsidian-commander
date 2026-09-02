import { h } from "preact";
import { useState } from "preact/hooks";
import t from "src/l10n";
import { ObsidianIcon } from "src/util";
import ChangeableText from "./ChangeableText";

interface BaseComponentProps {
	children: h.JSX.Element;
	name: string;
	description: string;
	className?: string;
}
function BaseComponent({
	name,
	description,
	children,
	className,
}: BaseComponentProps): h.JSX.Element {
	return (
		<div className={`setting-item ${className}`}>
			<div className="setting-item-info">
				<div className="setting-item-name">{name}</div>
				<div className="setting-item-description">{description}</div>
			</div>
			<div className="setting-item-control">{children}</div>
		</div>
	);
}

interface SettingProps<T> {
	name: string;
	description: string;
	changeHandler: (value: T) => void;
	value: T;
	min?: number;
	max?: number;
	step?: number;
}
export function ToggleComponent(props: SettingProps<boolean>): h.JSX.Element {
	const [state, setState] = useState(props.value);

	return (
		<BaseComponent
			name={props.name}
			description={props.description}
			className="mod-toggle"
		>
			<div
				className={`checkbox-container ${state ? "is-enabled" : ""}`}
				onClick={(): void => {
					setState(!state);
					props.changeHandler(state);
				}}
			/>
		</BaseComponent>
	);
}

interface EyeToggleSettingProps extends SettingProps<boolean> {
	hideLabel: string;
	showLabel: string;
}
export function EyeToggleComponent({
	name,
	description,
	changeHandler,
	value,
	hideLabel,
	showLabel,
}: EyeToggleSettingProps): h.JSX.Element {
	const [state, setState] = useState(value);

	return (
		<BaseComponent
			name={name}
			description={description}
			className="mod-toggle"
		>
			<ObsidianIcon
				aria-label={state ? showLabel : hideLabel}
				icon={state ? "eye-off" : "eye"}
				size={20}
				className="clickable-icon"
				onClick={(): void => {
					setState(!state);
					changeHandler(state);
				}}
			/>
		</BaseComponent>
	);
}

interface SliderProps extends SettingProps<number> {
	defaultValue?: number;
}
export function SliderComponent({
	defaultValue,
	...props
}: SliderProps): h.JSX.Element {
	const [val, setVal] = useState(props.value);

	return (
		<BaseComponent
			description={props.description}
			name={props.name}
			className="cmdr-slider"
		>
			<div class="cmdr-slider-control">
				{defaultValue !== undefined && (
					<ObsidianIcon
						aria-label={t("Restore default")}
						icon="reset"
						size={16}
						className={`clickable-icon${
							val === defaultValue ? " is-disabled" : ""
						}`}
						aria-disabled={val === defaultValue}
						onClick={
							val === defaultValue
								? undefined
								: (): void => {
										setVal(defaultValue);
										props.changeHandler(defaultValue);
									}
						}
					/>
				)}
				<ChangeableText
					ariaLabel={t("Double click to enter custom value")}
					value={val.toString()}
					handleChange={({ target }): void => {
						//@ts-expect-error
						const n = Number(target.value);
						if (!isNaN(n) && val !== n) {
							setVal(n);
							props.changeHandler(n);
						}
					}}
				/>
				<input
					class="slider"
					type="range"
					min={props.min ?? "0"}
					max={props.max ?? "32"}
					step={props.step ?? "1"}
					value={val}
					onInput={({ target }): void => {
						const value = Number((target as HTMLInputElement).value);
						if (!isNaN(value) && val !== value) {
							setVal(value);
							props.changeHandler(value);
						}
					}}
				/>
			</div>
		</BaseComponent>
	);
}
