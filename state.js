// Application state management for pyRevit Extension Builder
const state = {
    activeTabId: 'tab1',
    tabs: {
        tab1: {
            name: 'TAB NAME',
            panels: ['panel1']
        }
    },
    panels: {
        panel1: {
            name: 'PANEL NAME',
            elements: ['button1'],
            tabId: 'tab1'
        }
    },
    elements: {
        button1: {
            type: 'pushbutton',
            name: 'Button 1',  // Changed from 'BUTTON NAME' to 'Button 1'
            title: '',
            tooltip: '',
            code: '',
            iconData: null,
            panelId: 'panel1'
        }
    },
    nextIds: {
        tab: 2,
        panel: 2,
        element: 2
    },
    activePulldown: null
};

// Export state to be used by other modules
window.appState = state;