const useCollaborationURL = (): string => {
  const PATH = "/collaboration";

  if (process.env.NEXT_PUBLIC_COLLABORATION_URL) {
    return process.env.NEXT_PUBLIC_COLLABORATION_URL + PATH;
  }

  const API_URL = process.env.NEXT_PUBLIC_BACKEND_API_URL;
  if (!API_URL) {
    throw new Error("Backend API URL is not defined");
  }

  const wsProtocol = API_URL.startsWith('https') ? 'wss' : 'ws';
  return `${wsProtocol}://${API_URL.split('://')[1]}${PATH}`;
};

export default useCollaborationURL;
