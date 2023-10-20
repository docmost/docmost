const useCollaborationURL = (): string => {
  const PATH = "/collaboration";

  if (import.meta.env.VITE_COLLABORATION_URL) {
    return import.meta.env.VITE_COLLABORATION_URL + PATH;
  }

  const API_URL = import.meta.env.VITE_BACKEND_API_URL;
  if (!API_URL) {
    throw new Error("Backend API URL is not defined");
  }

  const wsProtocol = API_URL.startsWith('https') ? 'wss' : 'ws';
  return `${wsProtocol}://${API_URL.split('://')[1]}${PATH}`;
};

export default useCollaborationURL;
