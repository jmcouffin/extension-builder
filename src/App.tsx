import { useEffect } from "react";
import { DialogHost } from "./components/DialogHost";
import { ElementModal } from "./components/ElementModal";
import { ExtensionName } from "./components/ExtensionName";
import { FolderPreview } from "./components/FolderPreview";
import { Header } from "./components/Header";
import { IconsContext } from "./components/IconsContext";
import { Ribbon } from "./components/Ribbon";
import { GroupEditor } from "./components/RibbonItems";
import { SavedLayouts } from "./components/SavedLayouts";
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

export function App() {
  const icons = useDefaultIcons();
  useCloseGroupEditorOnOutsideClick();

  return (
    <IconsContext.Provider value={icons}>
      <DndProvider>
        <Header />
        <ExtensionName />
        <main>
          <div className="workspace">
            <Ribbon />
            <FolderPreview />
          </div>
        </main>
        <GroupEditor />
      </DndProvider>
      <ElementModal />
      <SavedLayouts />
      <DialogHost />
    </IconsContext.Provider>
  );
}
