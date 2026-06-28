import api from "@/lib/api-client";

export interface IPlugin {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  enabled: boolean;
  configured: boolean;
  hooks: string[];
}

export interface IPluginDetail extends IPlugin {
  configSchema?: Record<string, any>;
  config?: Record<string, any>;
}

export interface IPluginConfig {
  id: string | null;
  workspaceId: string;
  pluginId: string;
  enabled: boolean;
  config: Record<string, any>;
  version: number;
}

export async function getPlugins(): Promise<IPlugin[]> {
  const res: any = await api.get("/plugins");
  return res.data;
}

export async function getPlugin(pluginId: string): Promise<IPluginDetail> {
  const res: any = await api.get(`/plugins/${pluginId}`);
  return res.data;
}

export async function getPluginConfig(
  pluginId: string,
): Promise<IPluginConfig> {
  const res: any = await api.get(`/plugins/${pluginId}/config`);
  return res.data;
}

export async function updatePluginConfig(
  pluginId: string,
  payload: { config?: Record<string, any>; enabled?: boolean },
): Promise<IPluginConfig> {
  const res: any = await api.put(`/plugins/${pluginId}/config`, payload);
  return res.data;
}

export async function togglePlugin(
  pluginId: string,
  enabled: boolean,
): Promise<{ success: boolean; enabled: boolean }> {
  const res: any = await api.post(`/plugins/${pluginId}/toggle`, { enabled });
  return res.data;
}
