import { PluginManifest } from "obsidian";
import { h } from "preact";
import t from "src/l10n";
import { showConfetti } from "src/util";
import Credits from "./Credits";
import Logo from "./Logo";

export default function About({
	manifest,
}: {
	manifest: PluginManifest;
}): h.JSX.Element {
	const openWithConfetti =
		(url: string) =>
		(e: h.JSX.TargetedMouseEvent<HTMLAnchorElement>): void => {
			e.preventDefault();
			void showConfetti(e);
			window.setTimeout(
				() => location.replace(url),
				Math.random() * 800 + 500
			);
		};

	return (
		<div className="cmdr-about">
			<Logo />
			<b>{manifest.name}</b>
			<Credits />
			<div className="cmdr-about-links">
				<a
					href="https://forms.gle/hPjn61G9bqqFb3256"
					onClick={openWithConfetti(
						"https://forms.gle/hPjn61G9bqqFb3256"
					)}
				>
					{t("Send feedback")}
				</a>
				<a
					href="https://buymeacoffee.com/johnny1093"
					onClick={openWithConfetti(
						"https://buymeacoffee.com/johnny1093"
					)}
				>
					{t("Donate")}
				</a>
			</div>
			<a
				className="cmdr-version"
				href={
					"https://github.com/phibr0/obsidian-commander/releases/tag/" +
					manifest.version
				}
			>
				{manifest.version}
			</a>
		</div>
	);
}
