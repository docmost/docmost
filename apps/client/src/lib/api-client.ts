import axios, { AxiosInstance } from "axios";
import Cookies from "js-cookie";
import Routes from "@/lib/app-route.ts";

const api: AxiosInstance = axios.create({
  baseURL: "/api",
  withCredentials: true,
});

api.interceptors.request.use(
  (config) => {
    const tokenData = Cookies.get("authTokens");

    let accessToken: string;
    try {
      accessToken = tokenData && JSON.parse(tokenData)?.accessToken;
    } catch (err) {
      console.log("invalid authTokens:", err.message);
      Cookies.remove("authTokens");
    }

    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => {
    // we need the response headers for these endpoints
    const exemptEndpoints = ["/api/pages/export", "/api/spaces/export"];
    if (response.request.responseURL) {
      const path = new URL(response.request.responseURL)?.pathname;
      if (path && exemptEndpoints.includes(path)) {
        return response;
      }
    }

    return response.data;
  },
  (error) => {
    if (error.response) {
      switch (error.response.status) {
        case 401:
          // Handle unauthorized error
          Cookies.remove("authTokens");
          redirectToLogin();
          break;
        case 403:
          // Handle forbidden error
          break;
        case 404:
          // Handle not found error
          if (
            error.response.data.message
              .toLowerCase()
              .includes("workspace not found")
          ) {
            console.log("workspace not found");
            Cookies.remove("authTokens");

            if (window.location.pathname != Routes.AUTH.SETUP) {
              window.location.href = Routes.AUTH.SETUP;
            }
          }
          break;
        case 500:
          // Handle internal server error
          break;
        default:
          break;
      }
    }
    return Promise.reject(error);
  }
);

function redirectToLogin() {
  if (
    window.location.pathname != Routes.AUTH.LOGIN &&
    window.location.pathname != Routes.AUTH.SIGNUP
  ) {
    window.location.href = Routes.AUTH.LOGIN;
  }
}

export default api;
