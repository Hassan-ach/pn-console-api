import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { PlatformUserMappingRepository } from 'src/repositories/platform-user-mapping.repository';

const resolveUsersSchema = z.object({
    users: z
        .array(
            z.object({
                id: z
                    .string()
                    .optional()
                    .describe('The platform user ID'),
                username: z
                    .string()
                    .optional()
                    .describe('The platform username'),
            }),
        )
        .describe(
            'Array of user identifiers to resolve. Each must have at least an id or username.',
        ),
    pluginName: z
        .string()
        .describe('The plugin name (e.g. telegram, slack)'),
});

export function createResolveUsersTool(
    repository: PlatformUserMappingRepository,
): DynamicStructuredTool {
    return new DynamicStructuredTool({
        name: 'resolve_users',
        description:
            'Resolves an array of external platform user identifiers (ID and/or username) to internal app user IDs. Returns an array of resolved app UUIDs in the same order as the input. Unresolvable entries result in null at that position.',
        schema: resolveUsersSchema,
        func: async (input) => {
            const { users, pluginName } = input;

            const results: (string | null)[] = [];

            for (const user of users) {
                let appUserId: string | null = null;

                if (user.id) {
                    const mapping = await repository.findByPlatformUser(
                        user.id,
                        pluginName,
                    );
                    if (mapping) {
                        appUserId = mapping.appUserId;
                    }
                }

                if (!appUserId && user.username) {
                    const allForPlugin =
                        await repository.findByPluginName(pluginName);
                    const match = allForPlugin.find(
                        (m) =>
                            m.platformUsername.toLowerCase() ===
                            user.username!.toLowerCase(),
                    );
                    if (match) {
                        appUserId = match.appUserId;
                    }
                }

                results.push(appUserId);
            }

            return JSON.stringify(results);
        },
    });
}
