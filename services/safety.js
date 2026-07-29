// Lightweight defense-in-depth layer. The system prompt carries the primary
// safety instructions; this module is a fast pre/post filter.

const BLOCKED_PATTERNS = [
  /how to (make|build|synthesize) .*(bomb|explosive|nerve agent)/i,
  /child (sexual|porn|abuse)/i,
  /\b(credit card number|ssn|social security number)\b.*\bgenerate\b/i,
];

const SYSTEM_LEAK_PATTERNS = [/system prompt/i, /you are alheri.{0,20}assistant that helps/i];

export function preFilter(userMessage) {
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(userMessage)) {
      return {
        blocked: true,
        reason: "disallowed_content_request",
      };
    }
  }
  return { blocked: false };
}

export function postFilter(assistantResponse) {
  for (const pattern of SYSTEM_LEAK_PATTERNS) {
    if (pattern.test(assistantResponse)) {
      return {
        safe: false,
        replacement:
          "I can't share internal configuration details, but I'm happy to help with your question directly.",
      };
    }
  }
  return { safe: true };
}

export function fallbackMessage(lang) {
  return lang === "ha"
    ? "Yi hakuri, ba zan iya taimakawa da wannan ba."
    : "Sorry, I'm not able to help with that.";
}

