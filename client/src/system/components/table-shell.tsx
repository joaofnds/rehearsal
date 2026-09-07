import "./table-shell.css";

export function TableShell({
	caption,
	columns,
	rows,
}: {
	readonly caption: string;
	readonly columns: readonly string[];
	readonly rows: readonly (readonly string[])[];
}): React.JSX.Element {
	return (
		<table className="rh-table-shell">
			<caption className="rh-table-shell__caption">{caption}</caption>
			<thead>
				<tr>
					{columns.map((column) => (
						<th key={column} scope="col">
							{column}
						</th>
					))}
				</tr>
			</thead>
			<tbody>
				{rows.map((row, rowIndex) => (
					<tr key={rowIndex} className="rh-row">
						{row.map((cell, index) => {
							const column = columns[index];
							return column === undefined ? null : <td key={column}>{cell}</td>;
						})}
					</tr>
				))}
			</tbody>
		</table>
	);
}
