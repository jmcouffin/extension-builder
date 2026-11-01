/**
 * PyRevit Pushbutton Collection Script
 * 
 * This script crawls the pyRevitTools.extension repository and collects 
 * all .pushbutton folders and their contents into a structured dictionary.
 */

// Configuration
const config = {
    owner: "pyrevitlabs",
    repo: "pyRevit",
    path: "extensions/pyRevitTools.extension",
    ref: "develop",
    apiBaseUrl: "https://api.github.com",
    headers: {
      // Add your GitHub token here if you have one
      // "Authorization": "token YOUR_GITHUB_TOKEN"
    }
  };
  
  // Utility for fetching with retries and rate limit handling
  async function fetchWithRetry(url, retries = 3, delay = 1000) {
    let lastError;
    for (let i = 0; i < retries; i++) {
      try {
        console.log(`Fetching ${url}`);
        const response = await fetch(url, { 
          headers: config.headers 
        });
        
        // Check GitHub API rate limit
        const rateLimit = {
          limit: response.headers.get('X-RateLimit-Limit'),
          remaining: response.headers.get('X-RateLimit-Remaining'),
          reset: response.headers.get('X-RateLimit-Reset')
        };
        
        console.log(`Rate limit: ${rateLimit.remaining}/${rateLimit.limit}`);
        
        if (response.status === 403 && rateLimit.remaining === '0') {
          const resetTime = new Date(rateLimit.reset * 1000);
          const waitTime = Math.max(resetTime - new Date(), 0) + 1000;
          console.log(`Rate limit exceeded. Waiting until ${resetTime.toISOString()} (${waitTime/1000}s)`);
          
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
        
        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
        }
        
        return await response.json();
      } catch (error) {
        console.log(`Attempt ${i+1} failed: ${error.message}`);
        lastError = error;
        
        if (i < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
        }
      }
    }
    throw lastError;
  }
  
  // Fetch file content as text or base64 for binary files
  async function fetchFileContent(fileUrl) {
    try {
      const response = await fetch(fileUrl, { 
        headers: config.headers 
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      
      const contentType = response.headers.get('content-type');
      
      // Handle binary files (images)
      if (contentType && contentType.includes('image/')) {
        // For images, we return a base64 representation
        const arrayBuffer = await response.arrayBuffer();
        const base64 = btoa(
          new Uint8Array(arrayBuffer)
            .reduce((data, byte) => data + String.fromCharCode(byte), '')
        );
        return {
          content: base64,
          encoding: 'base64',
          contentType
        };
      } 
      
      // Handle text files
      return {
        content: await response.text(),
        encoding: 'utf8',
        contentType
      };
    } catch (error) {
      console.error(`Error fetching file: ${error.message}`);
      return {
        content: `Error: ${error.message}`,
        encoding: 'error',
        contentType: null
      };
    }
  }
  
  // Main function to collect all pushbuttons
  async function collectAllPushbuttons() {
    try {
      const pushbuttonDictionary = {};
      
      // 1. Get all tab folders in the extension
      const extensionUrl = `${config.apiBaseUrl}/repos/${config.owner}/${config.repo}/contents/${config.path}?ref=${config.ref}`;
      const extensionContents = await fetchWithRetry(extensionUrl);
      const tabFolders = extensionContents.filter(item => item.type === "dir");
      
      console.log(`Found ${tabFolders.length} tab folders`);
      
      // 2. For each tab folder, find all pushbutton folders
      for (const tab of tabFolders) {
        console.log(`Processing tab: ${tab.name}`);
        
        const tabContents = await fetchWithRetry(tab.url);
        const pushbuttons = tabContents.filter(item => 
          item.type === "dir" && item.name.endsWith(".pushbutton")
        );
        
        console.log(`  Found ${pushbuttons.length} pushbuttons in ${tab.name}`);
        
        // 3. For each pushbutton, collect all files and their contents
        for (const button of pushbuttons) {
          const buttonName = button.name.replace(".pushbutton", "");
          console.log(`    Processing pushbutton: ${buttonName}`);
          
          const buttonContents = await fetchWithRetry(button.url);
          pushbuttonDictionary[buttonName] = [];
          
          // 4. For each file in the pushbutton folder, get its content
          for (const file of buttonContents) {
            console.log(`      Processing file: ${file.name}`);
            
            if (file.download_url) {
              const fileContent = await fetchFileContent(file.download_url);
              
              pushbuttonDictionary[buttonName].push({
                name: file.name,
                path: file.path,
                url: file.html_url,
                size: file.size,
                contentType: fileContent.contentType,
                encoding: fileContent.encoding,
                content: fileContent.content
              });
            } else {
              pushbuttonDictionary[buttonName].push({
                name: file.name,
                path: file.path,
                url: file.html_url,
                content: "Directory or no downloadable content",
                encoding: null
              });
            }
          }
        }
      }
      
      console.log(`Collection complete. Found ${Object.keys(pushbuttonDictionary).length} pushbuttons.`);
      return pushbuttonDictionary;
    } catch (error) {
      console.error(`Fatal error: ${error.message}`);
      throw error;
    }
  }
  
  // Function to save the dictionary to local storage or export to a file
  function savePushbuttonDictionary(dictionary) {
    // Convert to string for storage or export
    const jsonString = JSON.stringify(dictionary, null, 2);
    
    // Option 1: Store in localStorage (limited size)
    try {
      localStorage.setItem('pyRevitPushbuttons', jsonString);
      console.log('Saved to localStorage');
    } catch (e) {
      console.error('Error saving to localStorage (likely size exceeded)', e);
    }
    
    // Option 2: Create a Blob for download
    const blob = new Blob([jsonString], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    
    // Create download link
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pyRevitPushbuttons.json';
    document.body.appendChild(a);
    a.click();
    
    // Cleanup
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 0);
  }
  
  // Run the collector
  async function main() {
    console.log("Starting PyRevit pushbutton collection...");
    
    try {
      const pushbuttonDict = await collectAllPushbuttons();
      console.log("Collection complete!");
      
      // Save the results
      savePushbuttonDictionary(pushbuttonDict);
      
      // Return a sample of what we found
      const sampleKeys = Object.keys(pushbuttonDict).slice(0, 3);
      return {
        totalPushbuttons: Object.keys(pushbuttonDict).length,
        sampleButtonNames: sampleKeys,
        sampleData: sampleKeys.reduce((sample, key) => {
          sample[key] = pushbuttonDict[key].map(file => ({
            name: file.name,
            size: file.size,
            encoding: file.encoding
          }));
          return sample;
        }, {})
      };
    } catch (error) {
      console.error("Failed to collect pushbuttons:", error);
      return { error: error.message };
    }
  }
  
  // Function usage example:
//   main().then(result => console.log(result));