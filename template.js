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
    }
};

// Export templates to be used by other modules
window.templates = templates;