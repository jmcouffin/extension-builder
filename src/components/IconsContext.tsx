import { createContext, useContext } from "react";
import type { DefaultIcons } from "../domain/zip";

export const IconsContext = createContext<DefaultIcons>({ light: null, dark: null });

export function useIcons(): DefaultIcons {
  return useContext(IconsContext);
}
