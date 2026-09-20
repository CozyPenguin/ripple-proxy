"use strict";

/**
 * Turns user input into a navigable URL: a full URL passes through, a
 * domain gets http:// added, anything else is fed to the search engine.
 */
function search(input, template) {
	input = input.trim();
	if (!input) return "";

	try {
		return new URL(input).toString();
	} catch {
		// not a full URL
	}

	try {
		const url = new URL(`http://${input}`);
		if (url.hostname.includes(".")) return url.toString();
	} catch {
		// not a domain either
	}

	return template.replace("%s", encodeURIComponent(input));
}
