import { createContext, useCallback, useRef, useState } from "react";
import User from "types/User";
import { apiClient } from "config/Axios";
import Dashboard from "types/Dashboard";

interface AuthContextProps {
  authUser?: User;
  profileType?: "ADMIN" | "INVITADO";
  accessKeynames: string[];
  loginUser: (newUser: User) => Promise<void>;
  validateUser: () => User | undefined;
  logoutUser: () => Promise<void>;
  sessionExpired: boolean;
  setSessionExpired: (expired: boolean) => void;
  refreshAccessKeynames: () => Promise<void>;
  accessSections: Record<string, string[]>;
  accessDashboards: { keyname: string; name?: string; icon?: string }[];
  dashboards: Dashboard[];
  catalogReady: boolean;
  catalogError: boolean;
}

const AuthContext = createContext<AuthContextProps>({
  authUser: undefined,
  profileType: undefined,
  accessKeynames: [],
  loginUser: async () => {},
  validateUser: () => undefined,
  logoutUser: async () => {},
  sessionExpired: false,
  setSessionExpired: () => {},
  refreshAccessKeynames: async () => {},
  accessSections: {},
  accessDashboards: [], dashboards: [], catalogReady: false, catalogError: false,
});

export const AuthContextProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [authUser, setAuthUser] = useState<User | undefined>();
  const [accessKeynames, setAccessKeynames] = useState<string[]>([]);
  const [accessSections, setAccessSections] = useState<Record<string, string[]>>({});
  const [sessionExpired, setSessionExpired] = useState(false);
  const [accessDashboards, setAccessDashboards] = useState<{ keyname: string; name?: string; icon?: string }[]>([]);
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [catalogReady, setCatalogReady] = useState(false);
  const [catalogError, setCatalogError] = useState(false);
  const catalogRequest = useRef(0);

  const refreshAccessKeynames = useCallback(async () => {
    const request = ++catalogRequest.current;
    try {
      const [res, catalog] = await Promise.all([apiClient.get('/user/my-dashboards'), apiClient.get('/dashboard/get-all')]);
      if (request !== catalogRequest.current) return;
      setDashboards(catalog.data?.data ?? []);
      setCatalogError(false);
      const data = res.data?.data ?? [];
      setAccessKeynames(data.map((d: any) => d.keyname));
      setAccessDashboards(data.map((d: any) => ({ keyname: d.keyname, name: d.name, icon: d.icon })));
      const sections: Record<string, string[]> = {};
      data.forEach((d: any) => {
        sections[d.keyname] = d.sections;
      });
      setAccessSections(sections);
    } catch (error) {
      if (request !== catalogRequest.current) return;
      console.error('Error al cargar dashboards:', error);
      setAccessKeynames([]);
      setAccessDashboards([]);
      setAccessSections({});
      setCatalogError(true);
      throw error;
    } finally {
      if (request === catalogRequest.current) setCatalogReady(true);
    }
  }, []);

  const loginUser = async (newUser: User) => {
    setAuthUser(newUser);
    await refreshAccessKeynames();
  };

  const validateUser = () => {
    const storageUser = localStorage.getItem("user");
    const user = authUser || (storageUser ? JSON.parse(storageUser) : undefined);
    return user;
  };

  const logoutUser = async () => {
    catalogRequest.current++;
    try {
      await apiClient.post('/auth/logout', {});
    } finally {
      localStorage.removeItem("user");
      delete apiClient.defaults.headers.common.Authorization;
      delete apiClient.defaults.headers.Authorization;
      setAuthUser(undefined);
      setAccessKeynames([]);
      setAccessSections({});
      setAccessDashboards([]);
      setDashboards([]); setCatalogReady(false); setCatalogError(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        authUser,
        profileType: authUser?.profileType,
        accessKeynames,
        loginUser,
        validateUser,
        logoutUser,
        sessionExpired,
        setSessionExpired,
        refreshAccessKeynames,
        accessSections,
        accessDashboards, dashboards, catalogReady, catalogError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContextProvider;
export { AuthContext };
