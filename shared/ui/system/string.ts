"use strict";
const TokenSanitizeRegex = /\$\{(?:\W*)?(\w*?)(?:[\W\d]*)\}/g;

export function interpolate(template: string, context: object | undefined): string {
	if (!template) return template;
	if (context === undefined) return template.replace(TokenSanitizeRegex, "");

	template = template.replace(TokenSanitizeRegex, "$${this.$1}");
	return new Function(`return \`${template}\`;`).call(context);
}