import { useEffect, useState } from "react";
import { type DefaultIcons, fetchDataUrl } from "../domain/zip";

// Tiny black square, used until the bundled icons arrive or if they fail to load.
export const FALLBACK_ICON =
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3QgeD0iMiIgeT0iMiIgd2lkdGg9IjYwIiBoZWlnaHQ9IjYwIiBmaWxsPSIjMDAwIiBzdHJva2U9IiMwMDAiIHN0cm9rZS13aWR0aD0iMiIvPjwvc3ZnPg==";

const base = import.meta.env.BASE_URL;
let pending: Promise<DefaultIcons> | null = null;

export function loadDefaultIcons(): Promise<DefaultIcons> {
  pending ??= Promise.all([
    fetchDataUrl(`${base}icon.png`),
    fetchDataUrl(`${base}icon.dark.png`),
  ]).then(([light, dark]) => ({ light, dark }));
  return pending;
}

export function useDefaultIcons(): DefaultIcons {
  const [icons, setIcons] = useState<DefaultIcons>({ light: null, dark: null });
  useEffect(() => {
    let live = true;
    loadDefaultIcons().then((loaded) => {
      if (live) setIcons(loaded);
    });
    return () => {
      live = false;
    };
  }, []);
  return icons;
}
