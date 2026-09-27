// Initial application state. A single tab, panel and command.
const state = {
  activeTabId: "tab1",
  tabs: {
    tab1: {
      name: "My Tab",
      panels: ["panel1"],
    },
  },
  panels: {
    panel1: {
      name: "My Panel",
      elements: ["element1"],
      tabId: "tab1",
    },
  },
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
  nextIds: {
    tab: 2,
    panel: 2,
    element: 2,
  },
  activePulldown: null,
};

window.appState = state;
