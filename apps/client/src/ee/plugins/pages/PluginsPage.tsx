import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { getAppName } from "@/lib/config";
import SettingsTitle from "@/components/settings/settings-title";
import { PluginList } from "../components/PluginList";
import { PluginConfigModal } from "../components/PluginConfigModal";
import { getPlugins, IPlugin } from "../services/plugin-service";

export default function PluginsPage() {
  const [plugins, setPlugins] = useState<IPlugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPluginId, setSelectedPluginId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    loadPlugins();
  }, []);

  const loadPlugins = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getPlugins();
      setPlugins(data || []);
    } catch (err: any) {
      setError(
        err?.response?.data?.message || err?.message || "Failed to load plugins",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Plugins - {getAppName()}</title>
      </Helmet>

      <SettingsTitle title="Plugins" />

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      <PluginList
        plugins={plugins}
        loading={loading}
        onRefresh={loadPlugins}
        onConfigClick={setSelectedPluginId}
      />

      {selectedPluginId && (
        <PluginConfigModal
          pluginId={selectedPluginId}
          onClose={() => setSelectedPluginId(null)}
          onSave={loadPlugins}
        />
      )}
    </>
  );
}
