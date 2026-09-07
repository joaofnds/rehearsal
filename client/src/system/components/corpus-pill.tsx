import "./corpus-pill.css";

export function CorpusPill({
	hash,
}: {
	readonly hash: string;
}): React.JSX.Element {
	return <span className="rh-corpus-pill">corpus@{hash}</span>;
}
