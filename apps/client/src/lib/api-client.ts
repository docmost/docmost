import axios, { AxiosInstance } from "axios";
import Cookies from "js-cookie";
import Routes from "@/lib/routes";

const api: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_API_URL + "/api",
});

api.interceptors.request.use(
  (config) => {
    const tokenData = Cookies.get("authTokens");
    const accessToken = tokenData && JSON.parse(tokenData)?.accessToken;

    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

api.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    if (error.response) {
      switch (error.response.status) {
        case 401:
          // Handle unauthorized error
          if (window.location.pathname != Routes.AUTH.LOGIN) {
            window.location.href = Routes.AUTH.LOGIN;
          }
          break;
        case 403:
          // Handle forbidden error
          break;
        case 404:
          // Handle not found error
          break;
        case 500:
          // Handle internal server error
          break;
        default:
          break;
      }
    }
    return Promise.reject(error);
  },
);

export default api;
