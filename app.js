// Main application entry point for pyRevit Extension Builder
document.addEventListener('DOMContentLoaded', function() {
    // Make sure all modules are loaded and available
    if (
        window.templates && 
        window.appState && 
        window.UIElements && 
        window.EventHandlers && 
        window.ModalHandlers && 
        window.DragDrop && 
        window.FolderStructure &&
        window.SaveLoad  // Add SaveLoad module check
    ) {
        // Initialize UI Elements first to load default icons
        if (typeof window.UIElements.initialize === 'function') {
            window.UIElements.initialize();
        }
        
        // Initialize Save/Load functionality
        if (typeof window.SaveLoad.initialize === 'function') {
            window.SaveLoad.initialize();
        }
        
        // Initialize the application
        window.EventHandlers.initializeApp();
        
        console.log('pyRevit Extension Builder initialized successfully');
    } else {
        console.error('Failed to initialize pyRevit Extension Builder: Missing modules');
        
        // Check which modules are missing
        const modules = {
            'templates': window.templates,
            'appState': window.appState,
            'UIElements': window.UIElements,
            'EventHandlers': window.EventHandlers,
            'ModalHandlers': window.ModalHandlers,
            'DragDrop': window.DragDrop,
            'FolderStructure': window.FolderStructure,
            'SaveLoad': window.SaveLoad
        };
        
        const missingModules = [];
        for (const [name, module] of Object.entries(modules)) {
            if (!module) {
                missingModules.push(name);
            }
        }
        
        console.error('Missing modules:', missingModules.join(', '));
    }
});