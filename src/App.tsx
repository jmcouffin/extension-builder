import { useEffect } from "react";
import { openSpecFromLocation } from "./api/openSpec";
import { DialogHost } from "./components/DialogHost";
import { DrawingArea } from "./components/DrawingArea";
import { ExtensionName } from "./components/ExtensionName";
import { FolderPreview } from "./components/FolderPreview";
import { Header } from "./components/Header";
import { IconsContext } from "./components/IconsContext";
import { PropertiesPalette } from "./components/PropertiesPalette";
import { Ribbon } from "./components/Ribbon";
import { GroupEditor } from "./components/RibbonItems";
import { SavedLayouts } from "./components/SavedLayouts";
import { StatusBar } from "./components/StatusBar";
import { useThemeShortcut } from "./components/ThemeSwitcher";
import { ThemeTransition } from "./components/ThemeTransition";
import { DndProvider } from "./dnd/DndProvider";
import { useDefaultIcons } from "./state/defaultIcons";
import { useStore } from "./state/store";

function useCloseGroupEditorOnOutsideClick() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!useStore.getState().openGroup) return;
      const target = e.target as HTMLElement;
      if (target.closest(".pulldown-content-container") || target.closest(".group")) return;
      if (target.closest(".modal") || target.closest(".dialog-backdrop")) return;
      useStore.getState().closeGroupEditor();
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
}

/** Open the extension an import link carries, on load and when the link changes. */
function useImportLink() {
  useEffect(() => {
    void openSpecFromLocation();
    const onHashChange = () => void openSpecFromLocation();
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);
}

/**
 * The builder is laid out as Revit's own window: title bar with the quick
 * access toolbar, options bar, ribbon, then the Properties palette and Project
 * Browser docked left of the drawing area, and a status bar. Every theme
 * paints this same frame.
 */
export function App() {
  const icons = useDefaultIcons();
  useCloseGroupEditorOnOutsideClick();
  useThemeShortcut();
  useImportLink();

  return (
    <IconsContext.Provider value={icons}>
      <DndProvider>
        <Header />
        <ExtensionName />
        <main>
          <div className="workspace">
            <Ribbon />
            <div className="frame-body">
              <aside className="side-palettes" aria-label="Palettes">
                <PropertiesPalette />
                <FolderPreview />
              </aside>
              <DrawingArea />
            </div>
          </div>
        </main>
        <StatusBar />
        <GroupEditor />
      </DndProvider>
      <SavedLayouts />
      <DialogHost />
      <ThemeTransition />
    </IconsContext.Provider>
  );
}
