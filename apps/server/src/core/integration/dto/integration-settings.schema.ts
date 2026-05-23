import { z } from 'zod';

export const githubSettingsSchema = z.object({
  baseUrl: z.string().url().optional(),
  org: z.string().optional(),
  defaultRepo: z.string().optional(),
});

export const gitlabSettingsSchema = z.object({
  baseUrl: z.string().url().optional(),
  group: z.string().optional(),
  defaultProject: z.string().optional(),
});

export const jiraSettingsSchema = z.object({
  baseUrl: z.string().url().optional(),
  cloudId: z.string().optional(),
  siteName: z.string().optional(),
});

export const linearSettingsSchema = z.object({
  teamId: z.string().optional(),
});

const integrationSettingsSchemas: Record<string, z.ZodType> = {
  github: githubSettingsSchema,
  gitlab: gitlabSettingsSchema,
  jira: jiraSettingsSchema,
  linear: linearSettingsSchema,
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

export type GithubSettings = z.infer<typeof githubSettingsSchema>;
export type GitlabSettings = z.infer<typeof gitlabSettingsSchema>;
export type JiraSettings = z.infer<typeof jiraSettingsSchema>;
export type LinearSettings = z.infer<typeof linearSettingsSchema>;
