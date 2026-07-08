export interface ResolvedEntity {
    type: string;
    value: string | number | null;
    raw: Record<string, unknown>;
}

export function resolveEntities(
    text: string,
    rawEntities: any[],
): ResolvedEntity[] {
    return rawEntities.map((rawEntity) => {
        const type = Object.keys(rawEntity)[0];
        const data = rawEntity[type];
        let value: string | number | null = null;

        if (type === 'MentionName') {
            value = data.user_id;
        } else if (data && typeof data.offset === 'number' && typeof data.length === 'number') {
            value = text.substring(data.offset, data.offset + data.length);
        }

        return { type, value, raw: rawEntity };
    });
}
