// Drag and drop functionality for pyRevit Extension Builder
const DragDrop = {
    /**
     * Sets up drag and drop functionality for the whole application
     */
    setupDragAndDrop() {
        // Make panel contents droppable
        document.addEventListener('dragover', function(e) {
            e.preventDefault();
            const dropTarget = DragDrop.findDropTarget(e.target);
            
            if (dropTarget) {
                document.querySelectorAll('.drag-over').forEach(el => {
                    el.classList.remove('drag-over');
                });
                dropTarget.classList.add('drag-over');
            }
        });
        
        document.addEventListener('dragleave', function(e) {
            const dropTarget = DragDrop.findDropTarget(e.target);
            if (dropTarget) {
                dropTarget.classList.remove('drag-over');
            }
        });
        
        document.addEventListener('drop', function(e) {
            e.preventDefault();
            
            document.querySelectorAll('.drag-over').forEach(el => {
                el.classList.remove('drag-over');
            });
            
            const draggedElement = document.querySelector('.dragging');
            if (!draggedElement) return;
            
            const dropTarget = DragDrop.findDropTarget(e.target);
            if (!dropTarget) {
                draggedElement.classList.remove('dragging');
                return;
            }
            
            // Get element ID and type
            const elementId = draggedElement.dataset.buttonId;
            const element = window.appState.elements[elementId];
            
            // Check limits for stacks (max 3 buttons)
            if (dropTarget.classList.contains('stack')) {
                const stackId = dropTarget.dataset.buttonId;
                const stack = window.appState.elements[stackId];
                
                if (stack.children && stack.children.length >= 3) {
                    alert("Maximum 3 buttons allowed in a stack");
                    draggedElement.classList.remove('dragging');
                    return;
                }
            }
            
            // Remove from old container
            if (element.panelId) {
                const panel = window.appState.panels[element.panelId];
                panel.elements = panel.elements.filter(id => id !== elementId);
            } else if (element.parentId) {
                const parent = window.appState.elements[element.parentId];
                parent.children = parent.children.filter(id => id !== elementId);
            }
            
            // Add to new container
            if (dropTarget.classList.contains('panel-content')) {
                const panelId = dropTarget.closest('.panel').dataset.panelId;
                window.appState.panels[panelId].elements.push(elementId);
                element.panelId = panelId;
                delete element.parentId;
            } else if (dropTarget.classList.contains('stack')) {
                const stackId = dropTarget.dataset.buttonId;
                if (!window.appState.elements[stackId].children) {
                    window.appState.elements[stackId].children = [];
                }
                window.appState.elements[stackId].children.push(elementId);
                element.parentId = stackId;
                delete element.panelId;
            }
            
            // Refresh UI
            window.UIElements.renderPanels();
            
            // Update folder preview
            window.FolderStructure.updateFolderPreview();
        });
    },
    
    /**
     * Sets up drag events for an element
     */
    setupElementDragEvents(element) {
        element.addEventListener('dragstart', function(e) {
            this.classList.add('dragging', 'no-select');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', this.dataset.buttonId);
        });
        
        element.addEventListener('dragend', function() {
            this.classList.remove('dragging', 'no-select');
            document.querySelectorAll('.drag-over').forEach(el => {
                el.classList.remove('drag-over');
            });
        });
    },
    
    /**
     * Finds a valid drop target from an event target
     */
    findDropTarget(target) {
        // Check if target is a panel content
        if (target.classList && target.classList.contains('panel-content')) {
            return target;
        }
        
        // Check if target is a stack
        if (target.classList && target.classList.contains('stack')) {
            return target;
        }
        
        // Check if parent is a valid target
        if (target.parentElement) {
            return this.findDropTarget(target.parentElement);
        }
        
        return null;
    }
};

// Export DragDrop to be used by other modules
window.DragDrop = DragDrop;