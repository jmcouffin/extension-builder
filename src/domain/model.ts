import type { TypeId } from "./bundleTypes";

export interface Tab {
  name: string;
  panels: string[];
}

export interface Panel {
  name: string;
  elements: string[];
  tabId: string;
}

export interface Element {
  type: TypeId;
  name: string;
  title?: string;
  tooltip?: string;
  code?: string;
  iconData?: string | null;
  iconDarkData?: string | null;
  iconOnData?: string | null;
  children?: string[];
  panelId?: string;
  parentId?: string;
  context?: string;
  hyperlink?: string;
  assembly?: string;
  command_class?: string;
  availability_class?: string;
  members?: string;
  author?: string;
}

export interface NextIds {
  tab: number;
  panel: number;
  element: number;
}

export interface Layout {
  extensionName: string;
  tabs: Record<string, Tab>;
  panels: Record<string, Panel>;
  elements: Record<string, Element>;
  activeTabId: string;
  nextIds: NextIds;
}

export function initialLayout(): Layout {
  return {
    extensionName: "My Extension",
    activeTabId: "tab1",
    tabs: { tab1: { name: "My Tab", panels: ["panel1"] } },
    panels: { panel1: { name: "My Panel", elements: ["element1"], tabId: "tab1" } },
    elements: {
      element1: {
        type: "pushbutton",
        name: "Button 1",
        title: "",
        tooltip: "",
        code: "",
        iconData: null,
        iconDarkData: null,
        iconOnData: null,
        panelId: "panel1",
      },
    },
    nextIds: { tab: 2, panel: 2, element: 2 },
  };
}
