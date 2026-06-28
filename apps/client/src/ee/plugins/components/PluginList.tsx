import { useState } from "react";
import { IPlugin, togglePlugin } from "../services/plugin-service";

interface Props {
  plugins: IPlugin[];
  loading: boolean;
  onRefresh: () => void;
  onConfigClick: (pluginId: string) => void;
}

export function PluginList({
  plugins,
  loading,
  onRefresh,
  onConfigClick,
}: Readonly<Props>) {
  const [toggling, setToggling] = useState<string | null>(null);

  const handleToggle = async (plugin: IPlugin) => {
    setToggling(plugin.id);
    try {
      await togglePlugin(plugin.id, !plugin.enabled);
      onRefresh();
    } catch (err: any) {
      alert(
        `Error: ${err?.response?.data?.message || err?.message || "Unknown error"}`,
      );
    } finally {
      setToggling(null);
    }
  };

  if (loading) {
    return <div className="p-4 text-center text-gray-500">Loading...</div>;
  }

  if (plugins.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        No plugins available
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {plugins.map((plugin) => (
        <div
          key={plugin.id}
          className="flex items-start justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
        >
          <div className="flex-1">
            <h3 className="font-semibold">{plugin.name}</h3>
            <p className="text-sm text-gray-600 mb-2">{plugin.description}</p>
            <div className="flex gap-2 text-xs">
              <span className="text-gray-500">v{plugin.version}</span>
              <span className="text-gray-500">by {plugin.author}</span>
              {plugin.enabled && (
                <span className="px-2 py-1 bg-green-100 text-green-800 rounded">
                  Enabled
                </span>
              )}
              {!plugin.enabled && (
                <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded">
                  Disabled
                </span>
              )}
              {plugin.configured && (
                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">
                  Configured
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 ml-4">
            <button
              onClick={() => handleToggle(plugin)}
              disabled={toggling === plugin.id}
              className={`relative w-10 h-6 rounded-full transition ${
                plugin.enabled ? "bg-green-600" : "bg-gray-300"
              } ${toggling === plugin.id ? "opacity-50" : ""}`}
            >
              <div
                className={`absolute top-1 w-4 h-4 bg-white rounded-full transition ${
                  plugin.enabled ? "right-1" : "left-1"
                }`}
              />
            </button>

            <button
              onClick={() => onConfigClick(plugin.id)}
              className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded"
            >
              Configure
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
