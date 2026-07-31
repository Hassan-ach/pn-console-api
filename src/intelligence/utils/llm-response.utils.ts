/**
 * Helper to safely extract a JSON string from an LLM response.
 * Handles string responses, message content objects, and markdown code blocks.
 */
export function extractJsonString(raw: unknown): string {
    let str = '';
    if (typeof raw === 'string') {
        str = raw;
    } else if (Array.isArray(raw)) {
        str = raw
            .map((item) =>
                typeof item === 'string' ? item : JSON.stringify(item),
            )
            .join('\n');
    } else if (raw && typeof raw === 'object') {
        const obj = raw as Record<string, unknown>;
        if (typeof obj.output === 'string') {
            str = obj.output;
        } else if (typeof obj.content === 'string') {
            str = obj.content;
        } else {
            str = JSON.stringify(raw);
        }
    }

    const codeBlockMatch = str.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (codeBlockMatch && codeBlockMatch[1].trim()) {
        const blockContent = codeBlockMatch[1].trim();
        const start = blockContent.indexOf('{');
        const end = blockContent.lastIndexOf('}');
        if (start !== -1 && end > start) {
            return blockContent.substring(start, end + 1).trim();
        }
        return blockContent;
    }

    const firstBrace = str.indexOf('{');
    const lastBrace = str.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
        return str.substring(firstBrace, lastBrace + 1).trim();
    }

    return str.trim();
}
