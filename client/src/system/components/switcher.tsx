import "./switcher.css";

export function Switcher<Option extends string>({
	label,
	options,
	selected,
	onSelect,
}: {
	readonly label: string;
	readonly options: readonly Option[];
	readonly selected: Option;
	readonly onSelect: (option: Option) => void;
}): React.JSX.Element {
	return (
		<div className="rh-switcher" role="group" aria-label={label}>
			{options.map((option) => (
				<button
					key={option}
					type="button"
					className={`rh-switcher__option ${option === selected ? "rh-switcher__option--pressed" : ""}`}
					aria-pressed={option === selected}
					onClick={() => {
						onSelect(option);
					}}
				>
					{option}
				</button>
			))}
		</div>
	);
}
