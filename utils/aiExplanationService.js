function normalizeGeneratedText(text) {
    if (typeof text !== 'string') return '';

    return text
        .replace(/\*\*/g, '')
        .replace(/(?:^|\n)\s*(?:[-*•]|\d+[.)])\s*/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function getCompleteSentencePrefix(text) {
    const normalized = normalizeGeneratedText(text);
    if (!normalized) return '';

    const sentenceEndPattern = /[.!?](?:["')\]]+)?(?=\s|$)/g;
    const endings = [...normalized.matchAll(sentenceEndPattern)];
    if (endings.length === 0) return '';

    const lastEnding = endings[endings.length - 1];
    return normalized.slice(0, lastEnding.index + lastEnding[0].length).trim();
}

function countCompleteSentences(text) {
    if (!text) return 0;
    return (text.match(/[.!?](?:["')\]]+)?(?=\s|$)/g) || []).length;
}

function extractCandidateText(candidate) {
    const parts = candidate?.content?.parts;
    if (!Array.isArray(parts)) return '';

    return parts
        .map(part => typeof part?.text === 'string' ? part.text : '')
        .filter(Boolean)
        .join(' ');
}

function finalizeExplanation(candidate, fallback, minimumSentences = 3) {
    const completePrefix = getCompleteSentencePrefix(extractCandidateText(candidate));

    if (countCompleteSentences(completePrefix) >= minimumSentences) {
        return completePrefix;
    }

    return fallback;
}

module.exports = {
    normalizeGeneratedText,
    getCompleteSentencePrefix,
    countCompleteSentences,
    extractCandidateText,
    finalizeExplanation
};
