// Folder structure management for pyRevit Extension Builder
const FolderStructure = {
  /**
   * Updates the folder preview based on current state
   */
  updateFolderPreview() {
    const extensionName = document.getElementById("extensionName").value;
    const structure = this.buildFolderStructure(extensionName);
    document.getElementById("folderPreview").textContent =
      this.formatFolderStructure(structure);
  },

  /**
   * Builds a folder structure object from the current state
   */
  buildFolderStructure(extensionName) {
    // Create extension folder
    const extension = window.templates.extensionStructure(extensionName);

    // Add tabs
    Object.keys(window.appState.tabs).forEach((tabId) => {
      const tab = window.appState.tabs[tabId];
      const tabFolder = window.templates.tab(tab.name);

      // Add panels
      tab.panels.forEach((panelId) => {
        const panel = window.appState.panels[panelId];
        const panelFolder = window.templates.panel(panel.name);

        // Add elements
        panel.elements.forEach((elementId) => {
          const element = window.appState.elements[elementId];
          let elementFolder;

          switch (element.type) {
            case "pushbutton":
              elementFolder = window.templates.pushbutton(
                element.name,
                element.title,
                element.tooltip,
                element.code
              );
              break;
            case "smartbutton":
              elementFolder = window.templates.smartbutton(
                element.name,
                element.title,
                element.tooltip,
                element.code
              );
              break;
            case "splitbutton":
              elementFolder = window.templates.splitbutton(
                element.name,
                element.title,
                element.tooltip,
                element.code
              );
              break;
            case "togglebutton":
              elementFolder = window.templates.togglebutton(
                element.name,
                element.title,
                element.tooltip,
                element.code
              );
              break;
            case "linkbutton":
              elementFolder = window.templates.linkbutton(
                element.name,
                element.title,
                element.tooltip,
                element.url
              );
              break;
            case "invokebutton":
              elementFolder = window.templates.invokebutton(
                element.name,
                element.title,
                element.tooltip,
                element.command
              );
              break;
            case "pulldown":
              elementFolder = window.templates.pulldown(
                element.name,
                element.title,
                element.tooltip,
                element.code
              );

              // Add pulldown children
              if (element.children) {
                element.children.forEach((childId) => {
                  const child = window.appState.elements[childId];
                  let childFolder;
                  
                  switch (child.type) {
                    case "pushbutton":
                      childFolder = window.templates.pushbutton(
                        child.name,
                        child.title,
                        child.tooltip,
                        child.code
                      );
                      break;
                    case "smartbutton":
                      childFolder = window.templates.smartbutton(
                        child.name,
                        child.title,
                        child.tooltip,
                        child.code
                      );
                      break;
                    case "splitbutton":
                      childFolder = window.templates.splitbutton(
                        child.name,
                        child.title,
                        child.tooltip,
                        child.code
                      );
                      break;
                    case "togglebutton":
                      childFolder = window.templates.togglebutton(
                        child.name,
                        child.title,
                        child.tooltip,
                        child.code
                      );
                      break;
                    case "linkbutton":
                      childFolder = window.templates.linkbutton(
                        child.name,
                        child.title,
                        child.tooltip,
                        child.url
                      );
                      break;
                    case "invokebutton":
                      childFolder = window.templates.invokebutton(
                        child.name,
                        child.title,
                        child.tooltip,
                        child.command
                      );
                      break;
                  }
                  
                  if (childFolder) {
                    elementFolder.children.push(childFolder);
                  }
                });
              }
              break;
            case "stack":
              elementFolder = window.templates.stack(element.name);

              // Add stack children
              if (element.children) {
                element.children.forEach((childId) => {
                  const child = window.appState.elements[childId];
                  let childFolder;
                  
                  switch (child.type) {
                    case "pushbutton":
                      childFolder = window.templates.pushbutton(
                        child.name,
                        child.title,
                        child.tooltip,
                        child.code
                      );
                      break;
                    case "smartbutton":
                      childFolder = window.templates.smartbutton(
                        child.name,
                        child.title,
                        child.tooltip,
                        child.code
                      );
                      break;
                    case "splitbutton":
                      childFolder = window.templates.splitbutton(
                        child.name,
                        child.title,
                        child.tooltip,
                        child.code
                      );
                      break;
                    case "togglebutton":
                      childFolder = window.templates.togglebutton(
                        child.name,
                        child.title,
                        child.tooltip,
                        child.code
                      );
                      break;
                    case "linkbutton":
                      childFolder = window.templates.linkbutton(
                        child.name,
                        child.title,
                        child.tooltip,
                        child.url
                      );
                      break;
                    case "invokebutton":
                      childFolder = window.templates.invokebutton(
                        child.name,
                        child.title,
                        child.tooltip,
                        child.command
                      );
                      break;
                    case "pulldown":
                      // Handle pulldowns within stacks
                      childFolder = window.templates.pulldown(
                        child.name,
                        child.title,
                        child.tooltip,
                        child.code
                      );

                      // Add pulldown's children
                      if (child.children) {
                        child.children.forEach((pulldownChildId) => {
                          const pulldownChild =
                            window.appState.elements[pulldownChildId];
                          let pulldownChildFolder;
                          
                          switch (pulldownChild.type) {
                            case "pushbutton":
                              pulldownChildFolder = window.templates.pushbutton(
                                pulldownChild.name,
                                pulldownChild.title,
                                pulldownChild.tooltip,
                                pulldownChild.code
                              );
                              break;
                            case "smartbutton":
                              pulldownChildFolder = window.templates.smartbutton(
                                pulldownChild.name,
                                pulldownChild.title,
                                pulldownChild.tooltip,
                                pulldownChild.code
                              );
                              break;
                            case "splitbutton":
                              pulldownChildFolder = window.templates.splitbutton(
                                pulldownChild.name,
                                pulldownChild.title,
                                pulldownChild.tooltip,
                                pulldownChild.code
                              );
                              break;
                            case "togglebutton":
                              pulldownChildFolder = window.templates.togglebutton(
                                pulldownChild.name,
                                pulldownChild.title,
                                pulldownChild.tooltip,
                                pulldownChild.code
                              );
                              break;
                            case "linkbutton":
                              pulldownChildFolder = window.templates.linkbutton(
                                pulldownChild.name,
                                pulldownChild.title,
                                pulldownChild.tooltip,
                                pulldownChild.url
                              );
                              break;
                            case "invokebutton":
                              pulldownChildFolder = window.templates.invokebutton(
                                pulldownChild.name,
                                pulldownChild.title,
                                pulldownChild.tooltip,
                                pulldownChild.command
                              );
                              break;
                          }
                          
                          if (pulldownChildFolder) {
                            childFolder.children.push(pulldownChildFolder);
                          }
                        });
                      }
                      break;
                  }

                  if (childFolder) {
                    elementFolder.children.push(childFolder);
                  }
                });
              }
              break;
          }

          if (elementFolder) {
            panelFolder.children.push(elementFolder);
          }
        });

        tabFolder.children.push(panelFolder);
      });

      extension.children.push(tabFolder);
    });

    return extension;
  },

  /**
   * Formats a folder structure object as text with tree-like visualization
   * using ASCII characters to show the relationships
   */
  formatFolderStructure(structure, prefix = "", isLast = true) {
    // Characters for tree visualization
    const line = "│   ";
    const corner = "└── ";
    const tee = "├── ";
    const blank = "    ";

    // Current line prefix and item
    const connector = isLast ? corner : tee;
    let output = `${prefix}${connector}${structure.name}\n`;

    // Prepare prefix for children
    const childPrefix = prefix + (isLast ? blank : line);

    // Process children
    if (structure.children && structure.children.length > 0) {
      structure.children.forEach((child, index) => {
        const isLastChild = index === structure.children.length - 1;
        output += this.formatFolderStructure(child, childPrefix, isLastChild);
      });
    }

    return output;
  },

  /**
   * Generates a ZIP file with the extension structure
   */
  generateZipFile() {
    console.log("Starting ZIP file generation...");

    // Check if JSZip is available
    if (typeof JSZip === "undefined") {
      console.error("JSZip library not loaded");
      alert("Error: JSZip library not found. Cannot create ZIP file.");
      return;
    }

    const extensionName = document.getElementById("extensionName").value;
    const structure = this.buildFolderStructure(extensionName);

    // Create loading indicator
    const downloadBtn = document.getElementById("downloadZip");
    const originalText = downloadBtn.innerHTML;
    downloadBtn.innerHTML = "CREATING ZIP FILE...";
    downloadBtn.disabled = true;

    try {
      // Create new JSZip instance
      const zip = new JSZip();
      console.log("JSZip instance created");

      // First, load the root icon files
      Promise.all([
        this.loadIconFile("icon.png"),
        this.loadIconFile("icon.dark.png"),
      ])
        .then(([iconData, darkIconData]) => {
          // Set the icon data to be used by all buttons
          this.iconData = iconData || null;
          this.darkIconData = darkIconData || null;

          // Now proceed with adding files to ZIP
          this.addFolderToZip(zip, structure);
          console.log("Files added to ZIP");

          // Generate and download ZIP
          return zip.generateAsync({ type: "blob" });
        })
        .then(function (content) {
          console.log("ZIP file generated successfully");

          // Create download link
          const link = document.createElement("a");
          link.href = URL.createObjectURL(content);
          link.download = `${structure.name}.zip`;
          link.style.display = "none";
          document.body.appendChild(link);
          console.log("Triggering download...");
          link.click();

          // Cleanup
          setTimeout(function () {
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
          }, 100);

          // Restore button
          downloadBtn.innerHTML = originalText;
          downloadBtn.disabled = false;
        })
        .catch(function (error) {
          console.error("Error creating ZIP:", error);
          alert("Failed to create ZIP file: " + error.message);

          // Restore button
          downloadBtn.innerHTML = originalText;
          downloadBtn.disabled = false;
        });
    } catch (error) {
      console.error("Error in ZIP creation process:", error);
      alert("Error creating ZIP file: " + error.message);

      // Restore button
      downloadBtn.innerHTML = originalText;
      downloadBtn.disabled = false;
    }
  },

  /**
   * Loads an icon file from the root of the codebase
   */
  loadIconFile(filename) {
    return new Promise((resolve, reject) => {
      // Create a fetch request to load the icon
      fetch(filename)
        .then((response) => {
          // Check if the file was found
          if (!response.ok) {
            console.warn(`Icon file ${filename} not found, using placeholder`);
            resolve(null);
            return;
          }
          // Get the file data as blob
          return response.blob();
        })
        .then((blob) => {
          if (!blob) return;

          // Convert blob to base64
          const reader = new FileReader();
          reader.onload = function () {
            resolve(reader.result);
          };
          reader.onerror = function () {
            console.error(`Error reading ${filename}`);
            resolve(null);
          };
          reader.readAsDataURL(blob);
        })
        .catch((error) => {
          console.error(`Error loading ${filename}:`, error);
          resolve(null);
        });
    });
  },

  /**
   * Simplified method to add folders and files to ZIP
   * This is a more direct approach that should be more reliable
   */
  addFolderToZip(zip, folder, path = "") {
    const folderPath = path ? path + "/" + folder.name : folder.name;
    console.log("Adding folder to ZIP:", folderPath);

    // Add current folder
    if (folder.type === "folder") {
      // Create the folder
      zip.folder(folderPath);

      // Add children
      if (folder.children && folder.children.length > 0) {
        folder.children.forEach((child) => {
          if (child.type === "folder") {
            this.addFolderToZip(zip, child, folderPath);
          } else if (child.type === "file") {
            this.addFileToZip(zip, child, folderPath);
          }
        });
      }
    }
  },

  /**
   * Add a file to the ZIP archive
   */
  addFileToZip(zip, file, folderPath) {
    const filePath = `${folderPath}/${file.name}`;
    console.log("Adding file to ZIP:", filePath);

    if (file.name === "icon.png") {
      // Use the loaded icon or fallback to placeholder
      if (this.iconData) {
        zip.file(filePath, this.iconData.split(",")[1], { base64: true });
      } else {
        // Fallback to transparent pixel
        const transparentPixel =
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
        zip.file(filePath, transparentPixel, { base64: true });
      }
    } else if (file.name === "icon.dark.png") {
      // Use the loaded dark icon or fallback to placeholder
      if (this.darkIconData) {
        zip.file(filePath, this.darkIconData.split(",")[1], { base64: true });
      } else {
        // Fallback to transparent pixel
        const transparentPixel =
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
        zip.file(filePath, transparentPixel, { base64: true });
      }
    } else {
      // Add text file
      zip.file(filePath, file.content || "");
    }
  },
};

// Export FolderStructure to be used by other modules
window.FolderStructure = FolderStructure;