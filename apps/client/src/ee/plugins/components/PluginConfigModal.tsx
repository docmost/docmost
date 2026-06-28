import { useEffect, useState } from "react";
import {
  getPlugin,
  getPluginConfig,
  updatePluginConfig,
  IPluginDetail,
} from "../services/plugin-service";

interface Props {
  pluginId: string;
  onClose: () => void;
  onSave: () => void;
}

export function PluginConfigModal({
  pluginId,
  onClose,
  onSave,
}: Readonly<Props>) {
  const [plugin, setPlugin] = useState<IPluginDetail | null>(null);
  const [config, setConfig] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPluginConfig();
  }, [pluginId]);

  const loadPluginConfig = async () => {
    try {
      setLoading(true);
      setError(null);

      const [pluginData, configData] = await Promise.all([
        getPlugin(pluginId),
        getPluginConfig(pluginId),
      ]);

      setPlugin(pluginData);
      setConfig(configData?.config || {});
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to load configuration",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      await updatePluginConfig(pluginId, { config });

      onSave();
      onClose();
    } catch (err: any) {
      setError(
        err?.response?.data?.message || err?.message || "Save failed",
      );
    } finally {
      setSaving(false);
    }
  };

  const renderConfigContent = () => {
    if (loading) {
      return (
        <div className="text-center py-6 text-gray-500">Loading...</div>
      );
    }

    if (plugin?.configSchema?.properties) {
      return (
        <div className="space-y-3">
          {Object.entries(plugin.configSchema.properties).map(
            ([key, prop]: [string, any]) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {prop.title || key}
                  {prop.required && <span className="text-red-500">*</span>}
                </label>

                {prop.description && (
                  <p className="text-xs text-gray-500 mb-2">
                    {prop.description}
                  </p>
                )}

                {prop.type === "string" && !prop.enum && (
                  <input
                    type={
                      key.includes("secret") || key.includes("password")
                        ? "password"
                        : "text"
                    }
                    value={config[key] || ""}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        [key]: e.target.value,
                      })
                    }
                    placeholder={prop.placeholder || ""}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}

                {prop.type === "number" && (
                  <input
                    type="number"
                    value={config[key] ?? ""}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        [key]: Number.parseFloat(e.target.value),
                      })
                    }
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}

                {prop.type === "boolean" && (
                  <input
                    type="checkbox"
                    checked={config[key] || false}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        [key]: e.target.checked,
                      })
                    }
                    className="w-4 h-4"
                  />
                )}

                {prop.enum && (
                  <select
                    value={config[key] || ""}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        [key]: e.target.value,
                      })
                    }
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select...</option>
                    {prop.enum.map((opt: string) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            ),
          )}
        </div>
      );
    }

    return (
      <p className="text-center text-gray-500 py-6">
        No configuration available
      </p>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-96 overflow-y-auto">
        <div className="p-4 border-b border-gray-200">
          <h2 className="font-semibold text-lg">
            {plugin?.name || "Configure Plugin"}
          </h2>
        </div>

        <div className="p-4">
          {error && (
            <div className="mb-3 p-2 bg-red-100 border border-red-400 text-red-700 text-sm rounded">
              {error}
            </div>
          )}

          {renderConfigContent()}
        </div>

        <div className="p-4 border-t border-gray-200 flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1 text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
