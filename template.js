// Template generator for pyRevit extension files
const templates = {
    // Main extension folder structure
    extensionStructure(extensionName) {
        return {
            name: `${extensionName}.extension`,
            type: 'folder',
            children: []
        };
    },

    // Tab (tab folder)
    tab(tabName) {
        return {
            name: `${this.sanitizeFileName(tabName)}.tab`,
            type: 'folder',
            children: []
        };
    },

    // Panel (panel folder)
    panel(panelName) {
        return {
            name: `${this.sanitizeFileName(panelName)}.panel`,
            type: 'folder',
            children: []
        };
    },

    // Push button bundle
    pushbutton(name, title = '', tooltip = '', script = '') {
        return {
            name: `${this.sanitizeFileName(name)}.pushbutton`,
            type: 'folder',
            children: [
                {
                    name: 'bundle.yaml',
                    type: 'file',
                    content: this.generateBundleYaml('pushbutton', name, title, tooltip)
                },
                {
                    name: 'script.py',
                    type: 'file',
                    content: script || this.defaultPythonScript(name)
                },
                {
                    name: 'icon.png',
                    type: 'file',
                    content: 'Binary file'
                },
                {
                    name: 'icon.dark.png',
                    type: 'file',
                    content: 'Binary file'
                }
            ]
        };
    },

    // Smart button bundle
    smartbutton(name, title = '', tooltip = '', script = '') {
        return {
            name: `${this.sanitizeFileName(name)}.smartbutton`,
            type: 'folder',
            children: [
                {
                    name: 'bundle.yaml',
                    type: 'file',
                    content: this.generateBundleYaml('smartbutton', name, title, tooltip)
                },
                {
                    name: 'script.py',
                    type: 'file',
                    content: script || this.defaultSmartButtonScript(name)
                },
                {
                    name: 'icon.png',
                    type: 'file',
                    content: 'Binary file'
                },
                {
                    name: 'icon.dark.png',
                    type: 'file',
                    content: 'Binary file'
                }
            ]
        };
    },

    // Split button bundle
    splitbutton(name, title = '', tooltip = '', script = '') {
        return {
            name: `${this.sanitizeFileName(name)}.splitbutton`,
            type: 'folder',
            children: [
                {
                    name: 'bundle.yaml',
                    type: 'file',
                    content: this.generateBundleYaml('splitbutton', name, title, tooltip)
                },
                {
                    name: 'script.py',
                    type: 'file',
                    content: script || this.defaultPythonScript(name)
                },
                {
                    name: 'icon.png',
                    type: 'file',
                    content: 'Binary file'
                },
                {
                    name: 'icon.dark.png',
                    type: 'file',
                    content: 'Binary file'
                }
            ]
        };
    },

    // Toggle button bundle
    togglebutton(name, title = '', tooltip = '', script = '') {
        return {
            name: `${this.sanitizeFileName(name)}.togglebutton`,
            type: 'folder',
            children: [
                {
                    name: 'bundle.yaml',
                    type: 'file',
                    content: this.generateBundleYaml('togglebutton', name, title, tooltip)
                },
                {
                    name: 'script.py',
                    type: 'file',
                    content: script || this.defaultToggleButtonScript(name)
                },
                {
                    name: 'icon.png',
                    type: 'file',
                    content: 'Binary file'
                },
                {
                    name: 'icon.dark.png',
                    type: 'file',
                    content: 'Binary file'
                }
            ]
        };
    },

    // Link button bundle
    linkbutton(name, title = '', tooltip = '', url = '') {
        return {
            name: `${this.sanitizeFileName(name)}.linkbutton`,
            type: 'folder',
            children: [
                {
                    name: 'bundle.yaml',
                    type: 'file',
                    content: this.generateLinkButtonYaml(name, title, tooltip, url)
                },
                {
                    name: 'icon.png',
                    type: 'file',
                    content: 'Binary file'
                },
                {
                    name: 'icon.dark.png',
                    type: 'file',
                    content: 'Binary file'
                }
            ]
        };
    },

    // Invoke button bundle
    invokebutton(name, title = '', tooltip = '', command = '') {
        return {
            name: `${this.sanitizeFileName(name)}.invokebutton`,
            type: 'folder',
            children: [
                {
                    name: 'bundle.yaml',
                    type: 'file',
                    content: this.generateInvokeButtonYaml(name, title, tooltip, command)
                },
                {
                    name: 'icon.png',
                    type: 'file',
                    content: 'Binary file'
                },
                {
                    name: 'icon.dark.png',
                    type: 'file',
                    content: 'Binary file'
                }
            ]
        };
    },

    // Pulldown bundle
    pulldown(name, title = '', tooltip = '', script = '') {
        return {
            name: `${this.sanitizeFileName(name)}.pulldown`,
            type: 'folder',
            children: [
                {
                    name: 'bundle.yaml',
                    type: 'file',
                    content: this.generateBundleYaml('pulldown', name, title, tooltip)
                },
                {
                    name: 'script.py',
                    type: 'file',
                    content: script || this.defaultPythonScript(name)
                },
                {
                    name: 'icon.png',
                    type: 'file',
                    content: 'Binary file'
                },
                {
                    name: 'icon.dark.png',
                    type: 'file',
                    content: 'Binary file'
                }
            ]
        };
    },

    // Stack bundle
    stack(name) {
        return {
            name: `${this.sanitizeFileName(name)}.stack`,
            type: 'folder',
            children: [
                {
                    name: 'bundle.yaml',
                    type: 'file',
                    content: this.generateBundleYaml('stack', name)
                }
            ]
        };
    },

    // Helper methods
    sanitizeFileName(name) {
        // Replace spaces with underscores and remove special characters
        return name.toLowerCase().replace(/\s+/g, '_').replace(/[^\w-]/g, '');
    },

    generateBundleYaml(type, name, title = '', tooltip = '') {
        let yaml = `title: ${title || name}\n`;
        
        if (tooltip) {
            yaml += `tooltip: ${tooltip}\n`;
        }
        
        if (type === 'pulldown') {
            yaml += `pulldown: true\n`;
        }
        
        return yaml;
    },

    generateLinkButtonYaml(name, title = '', tooltip = '', url = '') {
        let yaml = `title: ${title || name}\n`;
        
        if (tooltip) {
            yaml += `tooltip: ${tooltip}\n`;
        }
        
        if (url) {
            yaml += `hyperlink: ${url}\n`;
        }
        
        return yaml;
    },

    generateInvokeButtonYaml(name, title = '', tooltip = '', command = '') {
        let yaml = `title: ${title || name}\n`;
        
        if (tooltip) {
            yaml += `tooltip: ${tooltip}\n`;
        }
        
        if (command) {
            yaml += `invoke: ${command}\n`;
        }
        
        return yaml;
    },

    defaultPythonScript(name) {
        return `# -*- coding: utf-8 -*-
"""${name} button script.

This script demonstrates a simple pyRevit command.
"""
__title__ = "${name}"
__author__ = "pyRevit Extension Builder"

from pyrevit import revit, DB, UI
from pyrevit import forms, script

# Main code
output = script.get_output()
output.print_md("# ${name} Command")
output.print_md("This is a sample command created with pyRevit Extension Builder.")

# Get current document
doc = revit.doc

# Example: Show some basic document information
if doc:
    output.print_md("## Current Document Info")
    output.print_md("- **Document Title**: {}".format(doc.Title))
    output.print_md("- **File Path**: {}".format(doc.PathName))
    output.print_md("- **Active View**: {}".format(doc.ActiveView.Name))
`;
    },

    defaultSmartButtonScript(name) {
        return `# -*- coding: utf-8 -*-
"""${name} smart button script.

This script demonstrates a smart button that can change its appearance.
"""
__title__ = "${name}"
__author__ = "pyRevit Extension Builder"

from pyrevit import revit, DB, UI
from pyrevit import forms, script

# Smart button functionality
def __selfinit__(script_cmp, ui_button_cmp, __rvt__):
    # This function is called when the button is loaded
    # You can modify the button appearance here
    return True

# Main code
output = script.get_output()
output.print_md("# ${name} Smart Button")
output.print_md("This is a smart button that can adapt its behavior.")

# Get current document
doc = revit.doc

if doc:
    output.print_md("## Current Document Info")
    output.print_md("- **Document Title**: {}".format(doc.Title))
    output.print_md("- **File Path**: {}".format(doc.PathName))
    output.print_md("- **Active View**: {}".format(doc.ActiveView.Name))
`;
    },

    defaultToggleButtonScript(name) {
        return `# -*- coding: utf-8 -*-
"""${name} toggle button script.

This script demonstrates a toggle button with on/off states.
"""
__title__ = "${name}"
__author__ = "pyRevit Extension Builder"

from pyrevit import revit, DB, UI
from pyrevit import forms, script

# Toggle button state management
__persistentengine__ = True

# Initialize toggle state
if 'toggle_state' not in globals():
    toggle_state = False

# Main code
output = script.get_output()

# Toggle the state
toggle_state = not toggle_state

if toggle_state:
    output.print_md("# ${name} - ON")
    output.print_md("Toggle button is now **ON**")
else:
    output.print_md("# ${name} - OFF")
    output.print_md("Toggle button is now **OFF**")

# Get current document
doc = revit.doc

if doc:
    output.print_md("## Current Document Info")
    output.print_md("- **Document Title**: {}".format(doc.Title))
    output.print_md("- **Active View**: {}".format(doc.ActiveView.Name))
`;
    }
};

// Export templates to be used by other modules
window.templates = templates;