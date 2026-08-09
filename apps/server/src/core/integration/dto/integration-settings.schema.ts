import { z } from 'zod';

export const githubSettingsSchema = z.object({
  baseUrl: z.string().url().optional(),
});

export const gitlabSettingsSchema = z.object({
  baseUrl: z.string().url().optional(),
});

export const jiraSettingsSchema = z.object({
  baseUrl: z.string().url().optional(),
});

const integrationSettingsSchemas: Record<string, z.ZodType> = {
  github: githubSettingsSchema,
  gitlab: gitlabSettingsSchema,
  jira: jiraSettingsSchema,
};

export function validateIntegrationSettings(
  type: string,
  settings: unknown,
): { success: true; data: Record<string, any> } | { success: false; error: string } {
  const schema = integrationSettingsSchemas[type];
  if (!schema) {
    if (settings && typeof settings === 'object') {
      return { success: true, data: settings as Record<string, any> };
    }
    return { success: true, data: {} };
  }

  const result = schema.safeParse(settings);
  if (!result.success) {
    const messages = result.error.issues.map(
      (i) => `${i.path.join('.')}: ${i.message}`,
    );
    return { success: false, error: messages.join(', ') };
  }

  return { success: true, data: result.data };
}
