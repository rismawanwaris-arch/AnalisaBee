import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { REQUIRED_MENU_HREFS } from "@/lib/sidebarMenus";

interface MenuVisibilityContextType {
  hiddenMenus: string[];
  loaded: boolean;
  isSaving: boolean;
  isHidden: (href: string) => boolean;
  toggleMenu: (href: string) => Promise<boolean>;
  setHiddenMenus: (menus: string[]) => Promise<boolean>;
  resetToDefault: () => Promise<boolean>;
  reload: () => Promise<void>;
}

const MenuVisibilityContext = createContext<MenuVisibilityContextType>({
  hiddenMenus: [],
  loaded: false,
  isSaving: false,
  isHidden: () => false,
  toggleMenu: async () => false,
  setHiddenMenus: async () => false,
  resetToDefault: async () => false,
  reload: async () => {},
});

export function MenuVisibilityProvider({ children }: { children: React.ReactNode }) {
  const [hiddenMenus, setHiddenMenusState] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const reload = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/menu-visibility");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.hidden)) {
          setHiddenMenusState(data.hidden);
        }
      }
    } catch {
      // ignore fetch errors
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const isHidden = useCallback(
    (href: string) => {
      if (REQUIRED_MENU_HREFS.has(href)) return false;
      return hiddenMenus.includes(href);
    },
    [hiddenMenus]
  );

  const toggleMenu = useCallback(
    async (href: string): Promise<boolean> => {
      if (REQUIRED_MENU_HREFS.has(href)) return false;

      const currentlyHidden = hiddenMenus.includes(href);
      const willBeHidden = !currentlyHidden;

      // Optimistic update
      const prev = hiddenMenus;
      const next = willBeHidden
        ? [...hiddenMenus, href]
        : hiddenMenus.filter((h) => h !== href);

      setHiddenMenusState(next);
      setIsSaving(true);

      try {
        const res = await fetch("/api/settings/menu-visibility", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ href, isHidden: willBeHidden }),
        });

        if (!res.ok) {
          throw new Error("Gagal menyimpan perubahan visibilitas menu.");
        }
        const data = await res.json();
        if (Array.isArray(data.hidden)) {
          setHiddenMenusState(data.hidden);
        }
        return true;
      } catch (err) {
        setHiddenMenusState(prev);
        throw err;
      } finally {
        setIsSaving(false);
      }
    },
    [hiddenMenus]
  );

  const setHiddenMenus = useCallback(
    async (menus: string[]): Promise<boolean> => {
      const cleaned = menus.filter((h) => !REQUIRED_MENU_HREFS.has(h));
      const prev = hiddenMenus;
      setHiddenMenusState(cleaned);
      setIsSaving(true);

      try {
        const res = await fetch("/api/settings/menu-visibility", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hidden: cleaned }),
        });

        if (!res.ok) {
          throw new Error("Gagal menyimpan pengaturan visibilitas menu.");
        }
        const data = await res.json();
        if (Array.isArray(data.hidden)) {
          setHiddenMenusState(data.hidden);
        }
        return true;
      } catch (err) {
        setHiddenMenusState(prev);
        throw err;
      } finally {
        setIsSaving(false);
      }
    },
    [hiddenMenus]
  );

  const resetToDefault = useCallback(async (): Promise<boolean> => {
    const prev = hiddenMenus;
    setHiddenMenusState([]);
    setIsSaving(true);

    try {
      const res = await fetch("/api/settings/menu-visibility/reset", {
        method: "POST",
      });

      if (!res.ok) {
        throw new Error("Gagal mereset visibilitas menu.");
      }
      return true;
    } catch (err) {
      setHiddenMenusState(prev);
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [hiddenMenus]);

  return (
    <MenuVisibilityContext.Provider
      value={{
        hiddenMenus,
        loaded,
        isSaving,
        isHidden,
        toggleMenu,
        setHiddenMenus,
        resetToDefault,
        reload,
      }}
    >
      {children}
    </MenuVisibilityContext.Provider>
  );
}

export function useMenuVisibility() {
  return useContext(MenuVisibilityContext);
}
