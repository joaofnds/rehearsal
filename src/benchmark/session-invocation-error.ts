import type { SessionAttempt } from "./session-attempt";

export class SessionInvocationError extends Error {
	public override name = "SessionInvocationError";

	public constructor(
		message: string,
		public readonly attempt: SessionAttempt,
	) {
		super(message);
	}
}
