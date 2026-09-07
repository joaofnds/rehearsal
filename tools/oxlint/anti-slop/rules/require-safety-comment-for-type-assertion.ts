import { defineRule } from "@oxlint/plugins";

import type { ESTree, SourceCode } from "@oxlint/plugins";

type TypeAssertion = ESTree.TSAsExpression | ESTree.TSTypeAssertion;

const commentOwnerKinds = new Set([
	"ExpressionStatement",
	"PropertyDefinition",
	"ReturnStatement",
	"ThrowStatement",
	"VariableDeclaration",
]);

function isConstAssertion(node: TypeAssertion): boolean {
	return (
		node.typeAnnotation.type === "TSTypeReference" &&
		node.typeAnnotation.typeName.type === "Identifier" &&
		node.typeAnnotation.typeName.name === "const"
	);
}

function hasSafetyComment(
	sourceCode: SourceCode,
	node: TypeAssertion,
): boolean {
	let current: ESTree.Node = node;
	while (true) {
		if (
			sourceCode
				.getCommentsBefore(current)
				.some(
					(comment) =>
						comment.end <= node.start && /\bSAFETY\s*:/u.test(comment.value),
				)
		) {
			return true;
		}
		if (current.parent.type === "Program") return false;
		// A comment directly before `export const x = ...` attaches to the
		// ExportNamedDeclaration, not the VariableDeclaration it wraps: keep
		// climbing through the export wrapper before stopping at an owner kind.
		if (
			commentOwnerKinds.has(current.type) &&
			current.parent.type !== "ExportNamedDeclaration" &&
			current.parent.type !== "ExportDefaultDeclaration"
		)
			return false;
		current = current.parent;
	}
}

/** Require every non-const type assertion to state the invariant TypeScript cannot express. */
export const requireSafetyCommentForTypeAssertionRule = defineRule({
	meta: {
		type: "problem",
		docs: {
			description:
				"Require a nearby SAFETY comment for every TypeScript type assertion except const assertions.",
		},
		messages: {
			missingSafetyComment:
				"This type assertion has no `SAFETY:` justification. State the checked invariant immediately before the assertion or its containing statement.",
		},
	},
	createOnce(context) {
		const checkAssertion = (node: TypeAssertion) => {
			if (isConstAssertion(node) || hasSafetyComment(context.sourceCode, node))
				return;
			context.report({ node, messageId: "missingSafetyComment" });
		};

		return {
			TSAsExpression: checkAssertion,
			TSTypeAssertion: checkAssertion,
		};
	},
});
