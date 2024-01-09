import { useLocation } from 'react-router-dom';

export const useMatchPath = () => {
  const location = useLocation();

  const matchPath = (pattern) => {
    const modifiedPattern = pattern
      .replace(/:([^/]+)/g, '([^/]+)(?:/.*)?')
      .replace(/\//g, '\\/');

    const regex = new RegExp(`^${modifiedPattern}$`);
    return regex.test(location.pathname);
  };

  return matchPath;
};
