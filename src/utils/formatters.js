/**
 * Utility module for truncating and joining text to fit Discord embed limits.
 */


const truncateText = (text, maxLength) => {
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength - 3)}...`;
};

const toInlineText = (text, maxLength) => {
    const cleaned = String(text ?? '').replace(/\s+/g, ' ').replace(/`/g, "'").trim();
    return truncateText(cleaned, maxLength);
};

const joinWithLimit = (items, { maxLength, separator = '\n', createSuffix }) => {
    let text = '';
    let shown = 0;

    for (const item of items) {
        const next = shown === 0 ? item : `${text}${separator}${item}`;
        if (next.length > maxLength) break;
        text = next;
        shown++;
    }

    const hidden = items.length - shown;
    return hidden > 0 ? `${text}${createSuffix(hidden)}` : text;
};

module.exports = { truncateText, toInlineText, joinWithLimit };
