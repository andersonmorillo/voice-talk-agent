export type SpeechLanguage = "english" | "spanish";
export type SpeechLanguageMode = "auto" | SpeechLanguage;

const SPANISH_CHARS = /[áéíóúñü¿¡]/i;
const SPANISH_WORDS =
  /\b(el|la|los|las|un|una|unos|unas|de|del|al|que|por|para|con|su|se|lo|le|me|te|nos|está|están|estoy|estás|voy|vamos|hola|gracias|listo|ahora|también|muy|más|pero|como|este|esta|esto|aquí|archivo|proyecto|código|configuración|habla|voz|español|puedo|puede|hacer)\b/gi;
const ENGLISH_WORDS =
  /\b(the|and|is|are|to|for|with|you|your|this|that|was|were|will|from|have|has|been|it's|i'll|we're|hello|please|using|done|ready|file|project|build|config|working)\b/gi;

export function normalizeSpeechLanguage(value: unknown): SpeechLanguageMode {
  if (typeof value !== "string") {
    return "auto";
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "auto") {
    return "auto";
  }
  if (["en", "eng", "english", "english_2026-04", "english_2026-01"].includes(normalized)) {
    return "english";
  }
  if (["es", "spa", "spanish", "español", "espanol", "spanish_24l"].includes(normalized)) {
    return "spanish";
  }
  return "auto";
}

export function detectSpeechLanguage(text: string): SpeechLanguage {
  const trimmed = text.trim();
  if (!trimmed) {
    return "english";
  }
  if (SPANISH_CHARS.test(trimmed)) {
    return "spanish";
  }

  const spanishHits = trimmed.match(SPANISH_WORDS)?.length ?? 0;
  const englishHits = trimmed.match(ENGLISH_WORDS)?.length ?? 0;
  if (spanishHits > englishHits) {
    return "spanish";
  }
  if (englishHits > spanishHits) {
    return "english";
  }
  return "english";
}

export function resolveSpeechLanguage(
  text: string,
  mode: SpeechLanguageMode | string | undefined
): SpeechLanguage {
  const normalized = normalizeSpeechLanguage(mode);
  if (normalized !== "auto") {
    return normalized;
  }
  return detectSpeechLanguage(text);
}
