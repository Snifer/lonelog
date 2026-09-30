import en from "./en";
import es from "./es";
import fr from "./fr";

const locales: Record<string, Record<string, unknown>> = {
	en,
	es,
	fr,
};

let currentLocale = "en";

export function setLocale(locale: string) {
	if (locales[locale]) {
		currentLocale = locale;
	}
}

export function t(key: string): string {
	const parts = key.split(".");
	let res: unknown = locales[currentLocale] || locales["en"];

	for (const part of parts) {
		res = (res as Record<string, unknown>)[part];
		if (!res) {
			// Fallback to English if key missing in current locale
			let fallback: unknown = locales["en"];
			for (const fp of parts) {
				fallback = (fallback as Record<string, unknown>)[fp];
				if (!fallback) return key;
			}
			return fallback as string;
		}
	}

	return res as string;
}
