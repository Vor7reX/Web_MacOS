/**
 * =========================================================
 * WEBOS CORE ENGINE - MAIN SCRIPT
 * =========================================================
 */

/**
 * =========================================================
 * 1. GLOBAL STATE & APP REGISTRY
 * Description: Core system state variables and app mapping.
 * Do not move or mutate variable types.
 * =========================================================
 */
let highestZIndex = 10;
let currentPath = ["Home"];
let currentOpenFileNode = null;
let currentOpenFileName = "";
let currentParentFolder = null;

/**
 * App Registry: Maps dock icon IDs to their corresponding window IDs.
 * Used for launching, tracking, and managing application windows.
 * @constant {Object}
 */
const apps = {
    "notes-icon": "notes-window",
    "reminders-icon": "reminders-window",
    "calc-icon": "calc-window",
    "term-icon": "term-window",
    "finder-icon": "finder-window",
    "settings-icon": "settings-window",
    "weather-icon": "weather-window",
    "calendar-icon": "calendar-window",
    "clock-icon": "clock-window",
    "music-icon": "music-window",
    "maps-icon": "maps-window",
    "screenshot-icon": "screenshot-window"
};

/**
 * =========================================================
 * 2. SECURITY & VALIDATION FILTERS
 * =========================================================
 */

/**
 * Map of characters to their HTML entities for XSS prevention.
 * Extracted to prevent object reallocation on every function call.
 * @constant {Object}
 */
const htmlEntitiesMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
};

/**
 * Escapes HTML characters to prevent Cross-Site Scripting (XSS) attacks.
 * @param {string} str - The raw string to escape.
 * @returns {string} - The safely escaped HTML string.
 */
window.escapeHTML = function(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/[&<>'"]/g, tag => htmlEntitiesMap[tag]);
};

/**
 * Set of forbidden system keywords to prevent Prototype Pollution.
 * Uses a Set structure for O(1) lookup performance.
 * @constant {Set<string>}
 */
const forbiddenFileNames = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Validates file and folder names.
 * Prevents UI layout breaks, Path Traversal, and Prototype Pollution.
 * @param {string} name - The requested file name.
 * @returns {boolean} - True if valid, false if rejected.
 */
window.isValidFileName = function(name) {
    if (!name) return false;
    
    const trimmedName = name.trim();
    if (trimmedName === '') return false;
    if (trimmedName.length > 50) return false; // Prevent UI break
    
    // Prevent Path Traversal (e.g., trying to name a file "../system")
    if (trimmedName.includes('/') || trimmedName.includes('\\')) return false; 
    
    // Prevent System JS Hijacking
    if (forbiddenFileNames.has(trimmedName.toLowerCase())) return false;
    
    return true;
};
/**
 * =========================================================
 * 2. VIRTUAL FILE SYSTEM (VFS) & INITIAL STATE
 * Description: Represents the simulated directory tree and file structure.
 * =========================================================
 */
const fileSystem = {
    Home: {
        type: "folder",
        contents: {
            Documenti: {
                type: "folder",
                contents: {
                    "progetto.txt": { type: "file", content: "Da fare: costruire WebOS." },
                    "password.txt": { type: "file", content: "admin123" },
                },
            },
            Immagini: {
                type: "folder",
                contents: {
                    "test1.jpg": { type: "file", content: "assets/img/test1.jpg" },
                    "test2.png": { type: "file", content: "assets/img/test2.png" },
                    "test3.jpg": { type: "file", content: "assets/img/test3.jpg" },
                },
            },
            "leggimi.txt": {
                type: "file",
                content: "Benvenuto in WebOS. Fai doppio click per aprirmi!",
            },
        },
    },
    Trash: {
        type: "folder",
        contents: {}, // Physical root of the Trash bin
    },
};

/**
 * =========================================================
 * 3. BOOT ENGINE & SYSTEM CLOCK
 * Description: UI initialization, TopBar clock, and Apple Menu logic.
 * =========================================================
 */

// --- Clock Module ---
const clockElement = document.getElementById("clock");
let lastTimeString = "";

/**
 * Updates the system clock in the top bar.
 * Optimized to only update the DOM when the minute actually changes.
 */
function updateClock() {
    if (!clockElement) return;
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const currentTimeString = `${hours}:${minutes}`;

    // Optimization: Prevent unnecessary DOM repaints every second
    if (lastTimeString !== currentTimeString) {
        clockElement.textContent = currentTimeString;
        lastTimeString = currentTimeString;
    }
}
updateClock();
setInterval(updateClock, 1000);

// --- User Profile Module ---
const profilePicNav = document.getElementById('nav-profile-pic');
const profileUploadInput = document.getElementById("profile-upload-input");

/**
 * Loads and synchronizes the user's profile picture across the UI.
 */
function initUserProfile() {
    const savedProfilePic = localStorage.getItem('webos_profile_pic');
    if (savedProfilePic && profilePicNav) {
        profilePicNav.src = savedProfilePic;
    }

    // Delay sync slightly to ensure all UI components (sidebar/settings) are rendered
    setTimeout(() => {
        const sidebarPic = document.getElementById('sidebar-profile-pic');
        if (sidebarPic && profilePicNav) sidebarPic.src = profilePicNav.src;
    }, 100);
}
initUserProfile();

// Setup Profile Picture Upload Event Listeners
if (profilePicNav && profileUploadInput) {
    profilePicNav.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        e.stopPropagation();
        profileUploadInput.click();
    });

    profileUploadInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(event) {
            const base64String = event.target.result;
            profilePicNav.src = base64String; 
            localStorage.setItem('webos_profile_pic', base64String); 
            
            const settingsPic = document.getElementById('settings-profile-pic');
            const sidebarPic = document.getElementById('sidebar-profile-pic');
            
            if (settingsPic) settingsPic.src = base64String;
            if (sidebarPic) sidebarPic.src = base64String;
        };
        reader.readAsDataURL(file);
    });
}

// --- Apple Menu Module ---
const appleMenu = document.getElementById("apple-menu");
const appleDropdown = document.getElementById("apple-dropdown");

if (appleMenu && appleDropdown) {
    appleMenu.addEventListener("click", (e) => {
        e.stopPropagation();
        const isVisible = appleDropdown.style.display === "block";
        appleDropdown.style.display = isVisible ? "none" : "block";
    });

    document.addEventListener("click", () => {
        appleDropdown.style.display = "none";
    });
}

// --- Boot Theme & Wallpaper Module ---
/**
 * Initializes the system theme and wallpaper on boot.
 * Volatile session: custom wallpapers are wiped on hard refresh (F5).
 */
function initThemeAndWallpaper() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    const root = document.documentElement;
    const desktop = document.getElementById('desktop');
    
    if (savedTheme === 'light') {
        root.setAttribute('data-theme', 'light');
        // Timeout used as a fallback to ensure Control Center DOM is ready
        setTimeout(() => {
            const themeBtn = document.querySelector('.cc-bottom-row .cc-quick-btn:nth-child(1)');
            if(themeBtn) themeBtn.classList.add('active');
        }, 500);
    } else {
        root.removeAttribute('data-theme');
    }

    // Always enforce the default theme wallpaper on boot
    if (desktop) {
        const defaultBg = savedTheme === 'light' ? 'assets/img/light.png' : 'assets/img/dark.png';
        desktop.style.backgroundImage = `url("${defaultBg}")`;
    }
    
    // Security cleanup: wipe old legacy settings
    localStorage.removeItem('isCustomWallpaper'); 
    localStorage.removeItem('userWallpaperUrl');
}
initThemeAndWallpaper();
/**
 * =========================================================
 * 4. TRASH MANAGEMENT & GLOBAL UTILITIES
 * Description: Core helper functions and Trash bin sensor.
 * =========================================================
 */

/**
 * Updates the visual state of the Trash icon based on its contents.
 */
function updateTrashIcon() {
    const trashImg = document.getElementById('trash-img');
    if (!trashImg) return;
    
    const itemsInTrash = Object.keys(fileSystem['Trash'].contents).length;

    if (itemsInTrash === 0) {
        trashImg.src = "assets/icon/general/trashempty.png";
    } else {
        trashImg.src = "assets/icon/general/trashfull.png";
    }
}

/**
 * Validates if a filename represents a supported image format.
 * @param {string} fileName - The name of the file to check.
 * @returns {boolean} - True if it's an image.
 */
function isImage(fileName) {
    return /\.(jpg|jpeg|png|svg|gif|webp)$/i.test(fileName);
}

/**
 * Opens the Quick Look image previewer.
 * @param {string} fileName - Display name of the file.
 * @param {string} src - The base64 or URL source of the image.
 */
function openImagePreview(fileName, src) {
    document.getElementById("preview-title").textContent = fileName;
    document.getElementById("preview-image").src = src;
    
    const win = document.getElementById("preview-window");
    if (!win.classList.contains("show")) {
        win.style.display = "flex";
        void win.offsetWidth; // Force CSS reflow for animation
        win.classList.add("show");
    }
    bringToFront(win);
}

/**
 * Brings a specific window to the foreground by updating its Z-Index.
 * @param {HTMLElement} windowElement - The DOM element of the window.
 */
function bringToFront(windowElement) {
    highestZIndex += 1;
    windowElement.style.zIndex = highestZIndex;
}

/**
 * =========================================================
 * 5. DESKTOP PHYSICS (Collision Engine)
 * Description: Calculates the first available grid slot to 
 * prevent desktop icons from overlapping.
 * =========================================================
 */

/**
 * Finds free coordinates for a new desktop icon.
 * @param {number} startX - Preferred starting X coordinate.
 * @param {number} startY - Preferred starting Y coordinate.
 * @returns {Object} - Object containing {x, y} coordinates.
 */
function getFreeDesktopPosition(startX, startY) {
    const homeFolder = fileSystem["Home"].contents;
    const iconW = 85;
    const iconH = 100;
    const screenWidth = window.innerWidth;
    
    let x = startX;
    let y = startY;
    let collision = true;
    let failsafe = 0;

    // Failsafe prevents infinite loops if the desktop is completely full
    while (collision && failsafe < 200) {
        collision = false;
        for (const key in homeFolder) {
            const item = homeFolder[key];
            if (item.x === undefined || item.y === undefined) continue;
            
            // AABB Collision Detection
            if (
                x < item.x + iconW &&
                x + iconW > item.x &&
                y < item.y + iconH &&
                y + iconH > item.y
            ) {
                collision = true;
                x += iconW;
                
                // Wrap to next row if extending beyond right screen edge
                if (x + iconW > screenWidth) {
                    x = 20;
                    y += iconH;
                }
                break;
            }
        }
        failsafe++;
    }
    return { x, y };
}

/**
 * =========================================================
 * 6. WINDOW MANAGER (Drag & Drop Engine)
 * Description: Handles window dragging with GPU acceleration
 * and standard macOS controls (Close, Minimize, Maximize).
 * =========================================================
 */
document.querySelectorAll(".window").forEach((win) => dragElement(win));

/**
 * Binds drag physics to a window element using requestAnimationFrame.
 * @param {HTMLElement} elmnt - The window container.
 */
function dragElement(elmnt) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    let reqAnimFrame = null;
    let targetTop = 0, targetLeft = 0;
    
    const header = document.getElementById(elmnt.id.replace("-window", "-header"));
    if (header) header.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
        // Prevent dragging if clicking controls or if maximized
        if (e.target.closest(".window-controls") || elmnt.classList.contains("maximized")) return;
        e.preventDefault();
        bringToFront(elmnt);
        
        // Anti-Jump logic: convert percentage/transforms to absolute pixels
        const rect = elmnt.getBoundingClientRect();
        const computedTransform = window.getComputedStyle(elmnt).transform;
        if (computedTransform !== 'none') {
            elmnt.style.left = rect.left + 'px';
            elmnt.style.top = rect.top + 'px';
            elmnt.style.transform = 'none';
        }

        pos3 = e.clientX;
        pos4 = e.clientY;
        
        document.body.classList.add('is-dragging-window');

        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
        e.preventDefault();
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        
        targetTop = elmnt.offsetTop - pos2;
        targetLeft = elmnt.offsetLeft - pos1;
        
        // Prevent window from hiding under the top bar
        if (targetTop < 25) targetTop = 25; 

        // Optimization: Throttle DOM updates to monitor refresh rate (60fps)
        if (!reqAnimFrame) {
            reqAnimFrame = requestAnimationFrame(updateWindowPosition);
        }
    }
    
    function updateWindowPosition() {
        elmnt.style.top = targetTop + "px";
        elmnt.style.left = targetLeft + "px";
        reqAnimFrame = null;
    }
    
    function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;
        document.body.classList.remove('is-dragging-window');
        if (reqAnimFrame) {
            cancelAnimationFrame(reqAnimFrame);
            reqAnimFrame = null;
        }
    }
}

/**
 * Handles window closure animation and process termination.
 * @param {HTMLElement} win - The window to close.
 * @param {boolean} isKillProcess - True if the app process should be fully terminated.
 */
function closeWindowAnim(win, isKillProcess = false) {
    win.classList.remove("show");
    
    setTimeout(() => {
        win.style.display = "none";
        
        if (isKillProcess) {
            if (typeof setAppRunningState === 'function') setAppRunningState(win.id, false);
            
            // App-specific Kill Switches
            if (win.id === 'music-window' && typeof audioPlayer !== 'undefined') {
                audioPlayer.pause();
                isMusicPlaying = false;
                currentTrackIndex = -1; // Instructs radar to hide mini-player
                
                const playBtn = document.getElementById("music-play-btn");
                if (playBtn) playBtn.innerHTML = "▶";
                const miniPlayBtn = document.getElementById("mini-play-btn");
                if (miniPlayBtn) miniPlayBtn.innerHTML = "▶";
            }
        }
    }, 250);
}

// --- Bind Window Traffic Light Controls ---
// Note: Node cloning is used to safely remove any pre-existing event listeners 
// if this script is re-evaluated, preventing double-fires.

document.querySelectorAll(".close-btn").forEach((btn) => {
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    newBtn.addEventListener("click", (e) => {
        closeWindowAnim(document.getElementById(e.target.getAttribute("data-target")), true);
    });
});

document.querySelectorAll(".minimize-btn").forEach((btn) => {
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    newBtn.addEventListener("click", (e) => {
        closeWindowAnim(document.getElementById(e.target.getAttribute("data-target")), false);
    });
});

document.querySelectorAll(".maximize-btn").forEach((btn) => {
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    newBtn.addEventListener("click", (e) => {
        document.getElementById(e.target.getAttribute("data-target")).classList.toggle("maximized");
    });
});
/**
 * =========================================================
 * 7. DOCK ENGINE (State, Wake-up, and Click Events)
 * Description: Manages application launch, window focus,
 * and visual indicators for running processes.
 * =========================================================
 */

// Inject running indicators (dots) under dock icons
document.querySelectorAll('.dock-icon').forEach(icon => {
    if (!icon.querySelector('.app-indicator') && icon.id !== 'trash-icon') {
        const dot = document.createElement('div');
        dot.className = 'app-indicator';
        icon.appendChild(dot);
    }
});

/**
 * Toggles the running indicator dot for a specific app.
 * @param {string} windowId - The ID of the application window.
 * @param {boolean} isRunning - True to show the indicator, false to hide.
 */
function setAppRunningState(windowId, isRunning) {
    for (const [iconId, winId] of Object.entries(apps)) {
        if (winId === windowId) {
            const icon = document.getElementById(iconId);
            if (icon) {
                if (isRunning) icon.classList.add('app-running');
                else icon.classList.remove('app-running');
            }
        }
    }
}

// Bind click events to default dock icons
for (const [iconId, windowId] of Object.entries(apps)) {
    const icon = document.getElementById(iconId);
    if (!icon) continue; 
    
    const win = document.getElementById(windowId);
    
    icon.addEventListener("click", () => {
        const isVisible = win.classList.contains("show");
        const isTopMost = parseInt(win.style.zIndex || 0) === highestZIndex;
        
        if (!isVisible) {
            // Pre-launch setup hooks
            if (windowId === "notes-window") {
                currentOpenFileNode = null;
                currentOpenFileName = "";
                currentParentFolder = null;
                const editorTitle = document.getElementById("editor-title");
                const notesTextarea = document.getElementById("notes-textarea");
                
                if (editorTitle) editorTitle.textContent = "Nuovo Documento";
                if (notesTextarea) {
                    notesTextarea.value = "";
                    notesTextarea.placeholder = "Inizia a scrivere...";
                }
            }
            
            // Standard Launch Sequence
            win.style.display = "flex";
            void win.offsetWidth; // Force CSS reflow
            win.classList.add("show");
            bringToFront(win);
            
            // Post-launch focus hooks
            if (windowId === "term-window") document.getElementById("term-input").focus();
            if (windowId === "notes-window") document.getElementById("notes-textarea").focus();
            
        } else if (isVisible && !isTopMost) {
            // App is open but behind another window; bring it forward
            bringToFront(win);
            if (windowId === "term-window") document.getElementById("term-input").focus();
        } else {
            // App is top-most; minimize it
            closeWindowAnim(win, false); 
        }
    });

    // Automatically bring window to front when clicked anywhere inside it
    win.addEventListener("mousedown", () => bringToFront(win));
}

/**
 * Global Window Observer
 * Acts as a wake-up trigger for heavy apps (Maps, Weather, Clock) 
 * only when their specific window becomes visible, saving CPU cycles.
 */
document.querySelectorAll('.window').forEach(win => {
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.attributeName === 'class' && win.classList.contains('show')) {
                setAppRunningState(win.id, true);
                
                // Wake-up Logic Hooks
                if (win.id === 'weather-window' && typeof fetchWeather === 'function') {
                    fetchWeather();
                }
                else if (win.id === 'clock-window' && typeof renderClockSidebar === 'function') {
                    renderClockSidebar();
                    const activeCityLabel = document.getElementById('clock-active-city');
                    if (activeCityLabel && typeof activeClockCity !== 'undefined') {
                        activeCityLabel.textContent = activeClockCity.name;
                    }
                    if (!clockFrameId && typeof updateAppClock === 'function') {
                        clockFrameId = requestAnimationFrame(updateAppClock);
                    }
                }
                else if (win.id === 'calendar-window' && typeof renderCalendar === 'function') {
                    renderCalendarSidebar(); 
                    renderCalendar();
                }
                else if (win.id === 'reminders-window' && typeof renderRemindersSidebar === 'function') {
                    renderRemindersSidebar(); 
                    renderRemindersTasks();
                }
                else if (win.id === 'maps-window' && !isMapLoaded && typeof goToMapLocation === 'function') {
                    goToMapLocation('Roma, Italia', 12);
                }
            }
        });
    });
    observer.observe(win, { attributes: true });
});

/**
 * =========================================================
 * 8. DOCK PHYSICS (Proximity Radar, Drag & Drop)
 * Description: Handles magnification effect, ordering, and extraction.
 * =========================================================
 */

/**
 * Applies a 60fps elastic bounce animation to a dock icon.
 * @param {HTMLElement} icon - The dock icon element.
 */
window.bindBounceAnimation = function(icon) {
    icon.addEventListener('click', function() {
        if (this.dataset.isBouncing === "true") return;
        this.dataset.isBouncing = "true";

        const duration = 450; 
        const startTime = performance.now();
        const element = this;

        function animateBounce(time) {
            let elapsed = time - startTime;
            let progress = elapsed / duration;

            if (progress >= 1) {
                element.style.transform = 'translateY(0px)';
                element.dataset.isBouncing = "false";
                return;
            }
            
            // Mathematical sine wave for natural elasticity
            const sineWave = Math.sin(progress * Math.PI);
            const eased = Math.pow(sineWave, 1.2); 
            const yOffset = -35 * eased;

            element.style.transform = `translateY(${yOffset}px)`;
            requestAnimationFrame(animateBounce);
        }
        requestAnimationFrame(animateBounce);
    });
}

// Bind bounce to all initial dock icons
document.querySelectorAll('.dock-icon').forEach(bindBounceAnimation);

// --- Dock Magnification Radar (Optimized) ---
const dockContainer = document.getElementById('dock');
const maxScale = 2.1; 
const baseSize = 45; 
const affectRangeX = 150; 
const proximityZone = 90;

if (dockContainer) {
    let dockIconsData = []; 
    let isDockActive = false;
    let animationFrameId = null;

    document.addEventListener('mousemove', (e) => {
        const dockTopEdge = window.innerHeight - 70;
        const triggerY = dockTopEdge - proximityZone;

        if (e.clientY > triggerY) {
            if (!isDockActive) {
                isDockActive = true;
                // Cache DOM positions once upon entry to prevent Layout Thrashing
                dockIconsData = Array.from(document.querySelectorAll('.dock-icon')).map(icon => {
                    icon.style.transition = 'none';
                    const rect = icon.getBoundingClientRect();
                    return {
                        el: icon,
                        centerX: rect.left + rect.width / 2
                    };
                });
            }

            let approachMultiplier = 1;
            if (e.clientY < dockTopEdge) {
                approachMultiplier = (e.clientY - triggerY) / proximityZone;
                approachMultiplier = Math.pow(approachMultiplier, 1.5); 
            }

            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            
            animationFrameId = requestAnimationFrame(() => {
                dockIconsData.forEach(item => {
                    const distanceX = Math.abs(e.clientX - item.centerX);
                    let scale = 1;
                    
                    if (distanceX < affectRangeX) {
                        const currentMaxScale = 1 + ((maxScale - 1) * approachMultiplier);
                        scale = 1 + (currentMaxScale - 1) * Math.cos((distanceX / affectRangeX) * (Math.PI / 2));
                    }
                    
                    item.el.style.width = `${baseSize * scale}px`;
                    item.el.style.height = `${baseSize * scale}px`;
                });
            });
        } else {
            // Mouse left the zone; reset dock
            if (isDockActive) {
                isDockActive = false;
                if (animationFrameId) cancelAnimationFrame(animationFrameId);
                
                requestAnimationFrame(() => {
                    dockIconsData.forEach(item => {
                        item.el.style.transition = 'width 0.25s cubic-bezier(0.25, 0.8, 0.25, 1), height 0.25s cubic-bezier(0.25, 0.8, 0.25, 1)';
                        item.el.style.width = `${baseSize}px`;
                        item.el.style.height = `${baseSize}px`;
                    });
                });
                
                setTimeout(() => {
                    if(!isDockActive) dockIconsData.forEach(item => item.el.style.transition = '');
                }, 300);
            }
        }
    });
}

// --- Dock Drag & Drop Engine ---

/**
 * Initializes drag events for dock icons.
 */
function bindDockDragPhysics() {
    document.querySelectorAll('.dock-icon').forEach(icon => {
        if(icon.id === 'trash-icon') return; 
        if(icon.dataset.dragBound) return; 
        
        icon.dataset.dragBound = "true";
        icon.setAttribute('draggable', 'true');
        
        icon.addEventListener('dragstart', (e) => {
            icon.classList.add('dragging-out');
            e.dataTransfer.setData('text/plain', JSON.stringify({ source: 'dock_shortcut', id: icon.id }));
            e.dataTransfer.effectAllowed = 'move';
        });
        
        icon.addEventListener('dragend', () => { 
            icon.classList.remove('dragging-out'); 
        });
    });
}
bindDockDragPhysics();

/**
 * Determines the insertion point during a dock reorder.
 */
function getDragAfterElement(container, x) {
    const draggableElements = [...container.querySelectorAll('.dock-icon:not(.dragging-out):not(#trash-icon)')];
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = x - box.left - box.width / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

if (dockContainer) {
    dockContainer.addEventListener('dragover', (e) => {
        e.preventDefault();
        dockContainer.classList.add('drag-over-active');
    });

    dockContainer.addEventListener('dragleave', () => {
        dockContainer.classList.remove('drag-over-active');
    });

    // Drop handler for reordering or importing new shortcuts into the dock
    dockContainer.addEventListener('drop', (e) => {
        e.preventDefault();
        dockContainer.classList.remove('drag-over-active');
        
        try {
            const data = JSON.parse(e.dataTransfer.getData('text/plain'));
            const afterElement = getDragAfterElement(dockContainer, e.clientX);
            const trash = document.getElementById('trash-icon');
            const insertReference = afterElement || trash;

            // Handle internal reordering
            if (data.source === 'dock_shortcut') {
                const draggedIcon = document.getElementById(data.id);
                if (draggedIcon && draggedIcon !== insertReference) {
                    dockContainer.insertBefore(draggedIcon, insertReference);
                }
                return; 
            }

            // Handle import from Desktop or Finder
            if (data.source === 'desktop' || data.source === 'finder') {
                const itemsToProcess = data.isMulti ? data.items : [{name: data.name}];
                
                itemsToProcess.forEach(item => {
                    const itemName = item.name;
                    const sourceFolder = data.source === 'desktop' ? fileSystem['Home'].contents : getFolderByPath(currentPath);
                    const itemData = sourceFolder[itemName];
                    if (!itemData) return;

                    const newIcon = document.createElement('div');
                    newIcon.className = 'dock-icon';
                    
                    if (itemData.type === 'shortcut') {
                        newIcon.id = itemData.content; 
                    } else {
                        newIcon.id = 'shortcut-' + Date.now() + Math.floor(Math.random() * 1000);
                    }
                    
                    newIcon.setAttribute('data-title', itemName);
                    
                    let imgSrc = 'assets/icon/general/file.png';
                    if (itemData.type === 'folder') imgSrc = `assets/icon/folders/${itemData.iconColor || 'blue'}.png`;
                    else if (itemData.type === 'shortcut') imgSrc = itemData.iconSrc; 
                    else if (isImage(itemName)) imgSrc = itemData.content; 
                    
                    newIcon.innerHTML = `<img src="${imgSrc}" onerror="this.src='assets/icon/general/file.png'">`;
                    newIcon.dataset.originalType = itemData.type;
                    
                    if (itemData.type === 'folder') {
                        newIcon.dataset.iconColor = itemData.iconColor || 'blue';
                        newIcon.dataset.folderContents = JSON.stringify(itemData.contents || {}); 
                    }
                    
                    const dot = document.createElement('div');
                    dot.className = 'app-indicator';
                    newIcon.appendChild(dot);
                    
                    dockContainer.insertBefore(newIcon, insertReference);
                    
                    bindDockDragPhysics();
                    bindBounceAnimation(newIcon);
                    
                    // Bind Execution Event
                    newIcon.addEventListener('click', () => {
                        if (itemData.type === 'folder') {
                             const finderWin = document.getElementById('finder-window');
                             finderWin.style.display = 'flex'; void finderWin.offsetWidth; finderWin.classList.add('show');
                             bringToFront(finderWin);
                             navigateTo(currentPath.concat([itemName]));
                        } else if (itemData.type === 'shortcut') {
                             const winId = apps[newIcon.id];
                             if (winId) {
                                 const win = document.getElementById(winId);
                                 const isVisible = win.classList.contains("show");
                                 const isTopMost = parseInt(win.style.zIndex || 0) === highestZIndex;
                                 
                                 if (!isVisible) {
                                     win.style.display = 'flex'; void win.offsetWidth; win.classList.add('show');
                                     bringToFront(win);
                                     setAppRunningState(win.id, true);
                                 } else if (isVisible && !isTopMost) {
                                     bringToFront(win);
                                 } else {
                                     closeWindowAnim(win, false);
                                 }
                             }
                        } else {
                             if (isImage(itemName)) openImagePreview(itemName, itemData.content);
                             else openFileInEditor(itemName, itemData, sourceFolder);
                        }
                    });
                    
                    // Remove original item since it has been consumed by the dock
                    delete sourceFolder[itemName];
                });

                if (data.source === 'desktop') renderDesktop();
                if (data.source === 'finder') renderFinder();
                
                document.querySelectorAll('.window.show').forEach(win => setAppRunningState(win.id, true));
            }
        } catch(err) {
            console.error("Dock Drop Error:", err);
        }
    });
}

// Extraction from Dock (Destruction Poof)
document.body.addEventListener('drop', (e) => {
    // Abort if dropping back into the dock or onto a window
    if (e.target.closest('#dock-container') || e.target.closest('.window')) return;

    try {
        const data = JSON.parse(e.dataTransfer.getData('text/plain'));
        
        if (data.source === 'dock_shortcut') {
            const iconToRemove = document.getElementById(data.id);
            
            if (iconToRemove && iconToRemove.id !== 'trash-icon') {
                const itemName = iconToRemove.getAttribute('data-title');
                const homeFolder = fileSystem['Home'].contents;
                
                let newName = itemName;
                let counter = 1;
                while(homeFolder[newName]) { 
                    newName = `${itemName} ${counter}`; 
                    counter++; 
                }

                const origType = iconToRemove.dataset.originalType || 'shortcut';
                let imgSrc = iconToRemove.querySelector('img').src;

                // Restore object payload back to filesystem
                if (origType === 'folder') {
                    homeFolder[newName] = {
                        type: "folder",
                        iconColor: iconToRemove.dataset.iconColor || 'blue',
                        contents: iconToRemove.dataset.folderContents ? JSON.parse(iconToRemove.dataset.folderContents) : {},
                        x: Math.max(0, e.clientX - 35),
                        y: Math.max(0, e.clientY - 35)
                    };
                } else {
                    homeFolder[newName] = {
                        type: "shortcut",
                        content: iconToRemove.id,
                        iconSrc: imgSrc,
                        x: Math.max(0, e.clientX - 35),
                        y: Math.max(0, e.clientY - 35)
                    };
                }

                // Trigger CSS poof animation
                iconToRemove.classList.add('poof-destroyed');
                setTimeout(() => {
                    iconToRemove.remove();
                    if (typeof renderDesktop === 'function') renderDesktop(); 
                }, 300); 
            }
        }
    } catch(err) { 
        console.warn("Body Drop Aborted (Not a valid JSON payload)."); 
    }
});

// Drop on Trash Bin (Predatory animation and deletion)
const trashIcon = document.getElementById('trash-icon');
if(trashIcon) {
    trashIcon.addEventListener('click', () => {
        const win = document.getElementById('finder-window');
        if (!win.classList.contains('show')) {
            win.style.display = 'flex'; void win.offsetWidth; win.classList.add('show');
        }
        bringToFront(win);
        navigateTo(['Trash']);
    });

    trashIcon.addEventListener('dragover', (e) => {
        e.preventDefault();
        trashIcon.style.transform = 'scale(1.4)'; 
        trashIcon.style.filter = 'drop-shadow(0 0 10px rgba(255, 59, 48, 0.8))';
    });
    
    trashIcon.addEventListener('dragleave', () => {
        trashIcon.style.transform = '';
        trashIcon.style.filter = '';
    });
    
    trashIcon.addEventListener('drop', (e) => {
        e.preventDefault();
        trashIcon.style.transform = '';
        trashIcon.style.filter = '';

        try {
            const data = JSON.parse(e.dataTransfer.getData('text/plain'));
            
            // Security: Prevent system apps from being trashed
            if (data.source === 'dock_shortcut' && apps[data.id]) {
                if (typeof showMacAlert === 'function') {
                    showMacAlert("Azione Non Consentita: Non puoi cestinare le applicazioni di sistema. Solo file e cartelle possono essere rimossi.");
                }
                return;
            }

            // Process shortcut trashing
            if (data.source === 'dock_shortcut') {
                const dockEl = document.getElementById(data.id);
                if (dockEl && dockEl.id !== 'trash-icon') {
                    const name = dockEl.getAttribute('data-title');
                    fileSystem['Trash'].contents[name] = {
                        type: dockEl.dataset.originalType || 'shortcut',
                        iconColor: dockEl.dataset.iconColor || 'blue',
                        contents: dockEl.dataset.folderContents ? JSON.parse(dockEl.dataset.folderContents) : {},
                        originalSource: 'dock'
                    };
                    
                    dockEl.classList.add('poof-destroyed');
                    setTimeout(() => dockEl.remove(), 300);
                    updateTrashIcon();
                }
                return;
            }

            // Delegate to mass delete handler for Desktop/Finder items
            if (typeof massDeleteItems === 'function') massDeleteItems(data);
        } catch(err) {
            console.error("Trash Drop Error:", err);
        }
    });
}
/**
 * =========================================================
 * 9. TEXT EDITOR (Notes App)
 * Description: Manages opening, editing, saving, and 
 * duplicating plain text files within the VFS.
 * =========================================================
 */
const editorTextarea = document.getElementById("notes-textarea");
const editorTitle = document.getElementById("editor-title");
const btnSave = document.getElementById("btn-save");

let saveFeedbackTimeout = null;
const originalSaveText = btnSave ? btnSave.textContent : "Salva";

/**
 * Opens a file in the Notes application.
 * @param {string} fileName - The name of the file to open.
 * @param {Object} fileNode - The VFS node reference of the file.
 * @param {Object} parentFolder - The VFS parent directory.
 */
function openFileInEditor(fileName, fileNode, parentFolder) {
    currentOpenFileNode = fileNode;
    currentOpenFileName = fileName;
    currentParentFolder = parentFolder;
    
    if (editorTitle) editorTitle.textContent = fileName + " — Editor";
    if (editorTextarea) {
        editorTextarea.value = fileNode.content || "";
        editorTextarea.placeholder = "";
    }
    
    const win = document.getElementById("notes-window");
    if (win && !win.classList.contains("show")) {
        win.style.display = "flex";
        void win.offsetWidth; // Force CSS reflow
        win.classList.add("show");
    }
    bringToFront(win);
}

/**
 * Provides visual feedback on the save button and prevents text corruption
 * if the user clicks multiple times rapidly (Debouncing).
 */
function showSaveFeedback() {
    if (!btnSave) return;
    
    btnSave.textContent = "✅ Salvato!";
    btnSave.style.color = "var(--system-green, #32d74b)";
    
    if (saveFeedbackTimeout) clearTimeout(saveFeedbackTimeout);
    
    saveFeedbackTimeout = setTimeout(() => {
        btnSave.textContent = originalSaveText;
        btnSave.style.color = "";
    }, 1500);
}

/**
 * Saves the current file or triggers a "Save As" dialog if it's a new file.
 */
async function saveCurrentFile() {
    if (currentOpenFileNode) {
        currentOpenFileNode.content = editorTextarea ? editorTextarea.value : "";
        showSaveFeedback();
    } else {
        // Saving a brand new, previously unsaved file
        const result = await showMacDialog({
            title: "Salva Documento",
            showInput: "Senza_Titolo.txt",
            showSelect: true,
            okText: "Salva",
        });
        
        if (!result || !result.name) return;
        
        const cleanName = result.name.trim();
        
        // Security check
        if (!isValidFileName(cleanName)) {
            await showMacAlert("Nome del file non valido. Rimuovi slash (/) o parole riservate.");
            return;
        }
        
        const targetFolder = getFolderByPath(result.pathArray);
        if (targetFolder[cleanName]) {
            await showMacAlert("Esiste già un file con questo nome in questa posizione.");
            return;
        }
        
        targetFolder[cleanName] = { type: "file", content: editorTextarea ? editorTextarea.value : "" };
        
        // Spawn on desktop if saved to Home
        if (result.pathArray.join("/") === "Home") {
            const startX = window.innerWidth / 2 - 40;
            const startY = window.innerHeight / 2 - 40;
            const freePos = getFreeDesktopPosition(startX, startY);
            targetFolder[cleanName].x = freePos.x;
            targetFolder[cleanName].y = freePos.y;
        }
        
        openFileInEditor(cleanName, targetFolder[cleanName], targetFolder);
        if (typeof renderDesktop === 'function') renderDesktop();
        if (typeof renderFinder === 'function') renderFinder();
        showSaveFeedback();
    }
}

/**
 * Duplicates the currently open file into a target directory.
 */
async function copyCurrentFile() {
    if (!currentOpenFileNode || !currentParentFolder) {
        await showMacAlert("Devi prima salvare il documento per crearne una copia.");
        return;
    }
    
    const result = await showMacDialog({
        title: "Crea una Copia",
        showInput: "Copia_di_" + currentOpenFileName,
        showSelect: true,
        okText: "Copia",
    });
    
    if (!result || !result.name) return;
    
    const newFileName = result.name.trim();
    if (!isValidFileName(newFileName)) {
        await showMacAlert("Nome del file non valido. Rimuovi slash (/) o parole riservate.");
        return;
    }

    const targetFolder = getFolderByPath(result.pathArray);
    
    if (targetFolder[newFileName]) {
        await showMacAlert("Esiste già un file con questo nome.");
        return;
    }
    
    // Update original before copying to ensure data parity
    currentOpenFileNode.content = editorTextarea ? editorTextarea.value : "";
    targetFolder[newFileName] = { type: "file", content: currentOpenFileNode.content };
    
    // Apply desktop physics if copied to Home
    if (result.pathArray.join("/") === "Home") {
        let startX = window.innerWidth / 2 - 40;
        let startY = window.innerHeight / 2 - 40;
        if (currentOpenFileNode.x !== undefined && currentParentFolder === fileSystem["Home"].contents) {
            startX = currentOpenFileNode.x + 35;
            startY = currentOpenFileNode.y + 35;
        }
        const freePos = getFreeDesktopPosition(startX, startY);
        targetFolder[newFileName].x = freePos.x;
        targetFolder[newFileName].y = freePos.y;
    }
    
    if (typeof renderFinder === 'function') renderFinder();
    if (typeof renderDesktop === 'function') renderDesktop();
    await showMacAlert("Copia creata in /" + result.pathArray.join("/"));
}

/**
 * =========================================================
 * 10. SYSTEM MODAL DIALOGS
 * Description: Promise-based UI for Alerts, Prompts, and Selects.
 * =========================================================
 */

/**
 * Recursively fetches all available directory paths in the VFS.
 * @param {Object} dir - The starting directory node.
 * @param {string} currentPathStr - The string representation of the current path.
 * @param {Array<string>} paths - Accumulator array for paths.
 * @returns {Array<string>} - Array of all folder paths.
 */
function getAllFolderPaths(dir = fileSystem["Home"].contents, currentPathStr = "Home", paths = ["Home"]) {
    for (const [name, item] of Object.entries(dir)) {
        if (item.type === "folder") {
            const newPathStr = `${currentPathStr}/${name}`;
            paths.push(newPathStr);
            getAllFolderPaths(item.contents, newPathStr, paths);
        }
    }
    return paths;
}

/**
 * Renders a Promise-based modal dialog with optional inputs.
 * @param {Object} options - Dialog configuration options.
 * @param {string} options.title - Dialog title.
 * @param {string} [options.text] - Dialog body text.
 * @param {boolean|string} [options.showInput] - False to hide, string for default value.
 * @param {boolean} [options.showSelect] - True to show the folder path selector.
 * @param {string} [options.okText] - Custom text for the OK button.
 * @returns {Promise<Object|null>} - Resolves with {name, pathArray} or null if canceled.
 */
function showMacDialog({ title, text, showInput, showSelect, okText }) {
    return new Promise((resolve) => {
        const overlay = document.getElementById("mac-dialog-overlay");
        const titleEl = document.getElementById("mac-dialog-title");
        const textEl = document.getElementById("mac-dialog-text");
        const rowInput = document.getElementById("mac-dialog-row-input");
        const input = document.getElementById("mac-dialog-input");
        const rowSelect = document.getElementById("mac-dialog-row-select");
        const select = document.getElementById("mac-dialog-select");
        const btnOk = document.getElementById("mac-btn-ok");
        const btnCancel = document.getElementById("mac-btn-cancel");

        if (titleEl) titleEl.textContent = title;
        
        if (textEl) {
            textEl.textContent = text || "";
            textEl.style.display = text ? "block" : "none";
        }
        
        if (rowInput && input) {
            if (showInput !== undefined && showInput !== false) {
                rowInput.style.display = "flex";
                input.value = showInput === true ? "" : showInput;
            } else {
                rowInput.style.display = "none";
            }
        }
        
        if (rowSelect && select) {
            if (showSelect) {
                rowSelect.style.display = "flex";
                select.innerHTML = "";
                const folders = getAllFolderPaths();
                folders.forEach((path) => {
                    const opt = document.createElement("option");
                    opt.value = path;
                    opt.textContent = path;
                    if (path === currentPath.join("/")) opt.selected = true;
                    select.appendChild(opt);
                });
            } else {
                rowSelect.style.display = "none";
            }
        }
        
        if (btnOk) btnOk.textContent = okText || "OK";
        if (btnCancel) btnCancel.style.display = "block";
        if (overlay) overlay.style.display = "flex";
        
        if (input && showInput !== undefined && showInput !== false) input.focus();
        
        // Clean up DOM and memory
        const cleanup = () => {
            if (overlay) overlay.style.display = "none";
            if (btnOk) btnOk.onclick = null;
            if (btnCancel) btnCancel.onclick = null;
            document.removeEventListener("keydown", handleKeydown);
        };
        
        // Keyboard Support: Enter to Confirm, Escape to Cancel
        const handleKeydown = (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                if (btnOk) btnOk.click();
            } else if (e.key === "Escape") {
                e.preventDefault();
                if (btnCancel) btnCancel.click();
            }
        };
        document.addEventListener("keydown", handleKeydown);
        
        if (btnCancel) {
            btnCancel.onclick = () => { cleanup(); resolve(null); };
        }
        
        if (btnOk) {
            btnOk.onclick = () => {
                cleanup();
                resolve({
                    name: (input && showInput !== undefined && showInput !== false) ? input.value.trim() : null,
                    pathArray: (select && showSelect) ? select.value.split("/") : null,
                });
            };
        }
    });
}

/**
 * Standard System Alert (OK only).
 * @param {string} message - The warning/info message to display.
 * @returns {Promise<void>} - Resolves when the user clicks OK.
 */
function showMacAlert(message) {
    return new Promise((resolve) => {
        showMacDialog({
            title: "Attenzione",
            text: message,
            showInput: false,
            showSelect: false,
            okText: "OK",
        }).then(() => resolve());
        
        const btnCancel = document.getElementById("mac-btn-cancel");
        if (btnCancel) btnCancel.style.display = "none";
    });
}
/**
 * =========================================================
 * 11. FILE SYSTEM ROUTING
 * Description: Navigates and resolves VFS paths.
 * =========================================================
 */

/**
 * Resolves an array of folder names to a specific VFS node.
 * @param {Array<string>} pathArray - e.g. ["Home", "Documenti"]
 * @returns {Object|null} - The folder object or null if not found.
 */
function getFolderByPath(pathArray) {
    let currentDir = fileSystem;
    for (let p of pathArray) {
        if (currentDir[p] && currentDir[p].type === "folder") {
            currentDir = currentDir[p].contents;
        } else if (currentDir[p] && currentDir[p].contents) {
            currentDir = currentDir[p].contents;
        } else {
            return null;
        }
    }
    return currentDir;
}

/**
 * Updates the current path state and triggers a Finder UI re-render.
 * @param {Array<string>} pathArray - The new destination path.
 */
function navigateTo(pathArray) {
    currentPath = pathArray;
    renderFinder();
}

/**
 * Navigates one directory level up in the VFS.
 */
function navigateUp() {
    if (currentPath.length > 1) {
        currentPath.pop();
        renderFinder();
    }
}

/**
 * =========================================================
 * 12. FINDER ENGINE (UI & Folder Drag/Drop)
 * Description: Renders the file manager and handles complex
 * multi-file drag and drop operations within folders.
 * =========================================================
 */
const finderContent = document.getElementById("finder-content");
const finderPathDisplay = document.getElementById("finder-path-display");
const finderTitle = document.getElementById("finder-title");

/**
 * Renders the left sidebar of the Finder window.
 * Includes drag & drop listeners for dropping items into sidebar folders.
 */
function renderSidebar() {
    const sidebar = document.querySelector('.finder-sidebar');
    if (!sidebar) return;
    sidebar.innerHTML = ''; 

    // --- 1. Home Link ---
    const isHomeActive = currentPath.length === 1 && currentPath[0] === 'Home' ? 'active' : '';
    const homeDiv = document.createElement('div');
    homeDiv.id = 'sidebar-home'; 
    homeDiv.className = `sidebar-item ${isHomeActive}`; 
    homeDiv.innerHTML = `<img src="assets/icon/general/home.png" style="width: 16px; height: 16px; object-fit: contain; vertical-align: middle; margin-right: 8px;"> Home`;
    
    // Home Drop Physics
    homeDiv.addEventListener('dragover', (e) => { 
        e.preventDefault(); e.stopPropagation(); 
        homeDiv.style.backgroundColor = "rgba(0, 122, 255, 0.3)"; 
    });
    
    homeDiv.addEventListener('dragleave', () => { 
        homeDiv.style.backgroundColor = ""; 
    });
    
    homeDiv.addEventListener('drop', (e) => {
        e.preventDefault(); e.stopPropagation(); 
        homeDiv.style.backgroundColor = "";
        try {
            const data = JSON.parse(e.dataTransfer.getData('text/plain'));
            const itemsToProcess = data.isMulti ? data.items : [{name: data.name}];
            let moved = false;
            
            itemsToProcess.forEach(item => {
                const dragName = item.name;
                const sourceFolder = (data.source === "desktop" || data.source === "sidebar") ? fileSystem['Home'].contents : getFolderByPath(currentPath);
                
                if (sourceFolder[dragName] && currentPath.join('/') !== 'Home') {
                    fileSystem['Home'].contents[dragName] = sourceFolder[dragName];
                    const freePos = getFreeDesktopPosition(window.innerWidth/2 - 40, window.innerHeight/2 - 40);
                    fileSystem['Home'].contents[dragName].x = freePos.x;
                    fileSystem['Home'].contents[dragName].y = freePos.y;
                    delete sourceFolder[dragName];
                    moved = true;
                }
            });
            if (moved) { 
                if (typeof renderDesktop === 'function') renderDesktop(); 
                renderFinder(); 
            }
        } catch(err) { console.warn("Drop to Home aborted"); }
    });
    homeDiv.onclick = () => navigateTo(['Home']); 
    sidebar.appendChild(homeDiv);

    // --- 2. Internal Folder Links ---
    const homeFolder = fileSystem['Home'].contents;
    for (const [itemName, itemData] of Object.entries(homeFolder)) {
        if (itemData.type === 'folder') {
            const isActive = currentPath.length === 2 && currentPath[1] === itemName ? 'active' : '';
            const folderDiv = document.createElement('div');
            
            folderDiv.className = `sidebar-item sidebar-folder ${isActive}`; 
            folderDiv.dataset.name = itemName; 
            folderDiv.innerHTML = `<img src="assets/icon/folders/${itemData.iconColor || 'blue'}.png" style="width: 16px; height: 16px; object-fit: contain; vertical-align: middle; margin-right: 8px;"> ${itemName}`;
            folderDiv.onclick = () => navigateTo(['Home', itemName]); 

            folderDiv.setAttribute('draggable', 'true');
            folderDiv.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', JSON.stringify({ source: 'sidebar', name: itemName }));
            });

            // Sidebar Folder Drop Physics
            folderDiv.addEventListener('dragover', (e) => {
                e.preventDefault(); e.stopPropagation();
                folderDiv.style.backgroundColor = "rgba(0, 122, 255, 0.3)";
            });
            
            folderDiv.addEventListener('dragleave', () => { 
                folderDiv.style.backgroundColor = ""; 
            });
            
            folderDiv.addEventListener('drop', (e) => {
                e.preventDefault(); e.stopPropagation();
                folderDiv.style.backgroundColor = "";
                try {
                    const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                    const itemsToProcess = data.isMulti ? data.items : [{name: data.name}];
                    let moved = false;
                    
                    itemsToProcess.forEach(item => {
                        const dragName = item.name;
                        if (!dragName || dragName === itemName) return;
                        
                        const sourceFolder = (data.source === "desktop" || data.source === "sidebar") ? fileSystem['Home'].contents : getFolderByPath(currentPath);
                        
                        if (sourceFolder[dragName]) {
                            if (!itemData.contents) itemData.contents = {};
                            itemData.contents[dragName] = sourceFolder[dragName];
                            
                            // Clean up physical desktop coordinates if moving into a VFS folder
                            if (itemData.contents[dragName]) {
                                delete itemData.contents[dragName].x;
                                delete itemData.contents[dragName].y;
                            }
                            
                            delete sourceFolder[dragName];
                            moved = true;
                        }
                    });
                    
                    if (moved) {
                        if (typeof renderDesktop === 'function') renderDesktop();
                        renderFinder();
                    }
                } catch(err) { console.warn("Drop to Sidebar Folder aborted"); }
            });

            sidebar.appendChild(folderDiv);
        }
    }

    // --- 3. Trash Link ---
    const isTrashActive = currentPath.length === 1 && currentPath[0] === 'Trash' ? 'active' : '';
    const trashDiv = document.createElement('div');
    trashDiv.id = 'sidebar-trash'; 
    trashDiv.className = `sidebar-item ${isTrashActive}`; 
    
    const isTrashEmpty = Object.keys(fileSystem['Trash'].contents).length === 0;
    const trashSrc = isTrashEmpty ? 'assets/icon/general/trashempty.png' : 'assets/icon/general/trashfull.png';
    
    trashDiv.innerHTML = `<img src="${trashSrc}" style="width: 16px; height: 16px; object-fit: contain; vertical-align: middle; margin-right: 8px; transition: transform 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);"> Cestino`;
    trashDiv.onclick = () => navigateTo(['Trash']); 
    
    trashDiv.addEventListener('dragover', (e) => {
        e.preventDefault();
        trashDiv.style.backgroundColor = 'rgba(255, 59, 48, 0.2)'; 
        trashDiv.style.color = '#ff3b30';
        const img = trashDiv.querySelector('img');
        if (img) img.style.transform = 'scale(1.6) rotate(-10deg)'; 
    });
    
    trashDiv.addEventListener('dragleave', () => {
        trashDiv.style.backgroundColor = '';
        trashDiv.style.color = '';
        const img = trashDiv.querySelector('img');
        if (img) img.style.transform = '';
    });
    
    trashDiv.addEventListener('drop', (e) => {
        e.preventDefault();
        trashDiv.style.backgroundColor = '';
        trashDiv.style.color = '';
        const img = trashDiv.querySelector('img');
        if (img) img.style.transform = '';
        
        try {
            const data = JSON.parse(e.dataTransfer.getData('text/plain'));
            if (data.source === 'dock_shortcut' && apps[data.id]) {
                showMacAlert("Azione Non Consentita: Non puoi cestinare le applicazioni di sistema.");
                return;
            }
            if (data.source === 'desktop' || data.source === 'finder') {
                if (typeof massDeleteItems === 'function') massDeleteItems(data);
            } else if (data.source === 'dock_shortcut') {
                const dockEl = document.getElementById(data.id);
                if (dockEl && dockEl.id !== 'trash-icon') {
                    const name = dockEl.getAttribute('data-title');
                    fileSystem['Trash'].contents[name] = {
                        type: dockEl.dataset.originalType || 'shortcut',
                        iconColor: dockEl.dataset.iconColor || 'blue',
                        contents: dockEl.dataset.folderContents ? JSON.parse(dockEl.dataset.folderContents) : {},
                        originalSource: 'dock'
                    };
                    dockEl.classList.add('poof-destroyed');
                    setTimeout(() => dockEl.remove(), 300);
                    updateTrashIcon();
                }
            }
        } catch(err) { console.warn("Drop to Trash aborted"); }
    });
    
    sidebar.appendChild(trashDiv);
}

/**
 * Renders the main content area of the Finder based on the currentPath.
 */
function renderFinder() {
    if (!finderContent || !finderPathDisplay || !finderTitle) return;
    
    finderContent.innerHTML = "";
    const currentFolder = getFolderByPath(currentPath);
    finderPathDisplay.textContent = "/" + currentPath.join("/");
    finderTitle.textContent = currentPath[currentPath.length - 1];

    if (!currentFolder) return;

    for (const [itemName, itemData] of Object.entries(currentFolder)) {
        const div = document.createElement("div");
        div.className = "fs-item";

        // Icon Resolution Engine
        let iconHtml;
        if (itemData.type === 'folder') {
            iconHtml = `<img src="assets/icon/folders/${itemData.iconColor || 'blue'}.png" class="fs-icon" style="width: 45px; height: 45px; object-fit: contain; pointer-events: none; margin-bottom: 5px;">`;
        } else if (itemData.type === 'shortcut') {
            iconHtml = `<img src="${itemData.iconSrc}" class="fs-icon" style="width: 45px; height: 45px; object-fit: contain; pointer-events: none; margin-bottom: 5px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));">`;
        } else if (isImage(itemName)) {
            if (itemData.content && itemData.content.includes('/')) {
                iconHtml = `<img src="${itemData.content}" class="fs-icon" style="width: 45px; height: 45px; object-fit: cover; border-radius: 4px; pointer-events: none; margin-bottom: 5px;" onerror="this.src='assets/icon/general/file.png'">`;
            } else {
                iconHtml = `<img src="assets/icon/general/file.png" class="fs-icon" style="width: 45px; height: 45px; object-fit: contain; pointer-events: none; margin-bottom: 5px;">`;
            }
        } else {
            iconHtml = `<img src="assets/icon/general/file.png" class="fs-icon" style="width: 45px; height: 45px; object-fit: contain; pointer-events: none; margin-bottom: 5px;">`;
        }

        div.innerHTML = `${iconHtml}<div class="fs-name">${escapeHTML(itemName)}</div>`;
        div.setAttribute("draggable", "true");
        
        // --- DRAG START: Multi-Selection & Ghost Hologram ---
        div.addEventListener("dragstart", (e) => {
            if (!div.classList.contains('selected')) {
                if (typeof window.clearSelection === 'function') window.clearSelection();
                div.classList.add('selected');
            }
            
            const selectedItems = [];
            const primaryRect = div.getBoundingClientRect();
            const selectedNodes = document.querySelectorAll('#finder-content .fs-item.selected');
            
            selectedNodes.forEach(el => {
                const elName = el.querySelector('.fs-name').textContent;
                const elRect = el.getBoundingClientRect();
                selectedItems.push({
                    name: elName,
                    relX: elRect.left - primaryRect.left, 
                    relY: elRect.top - primaryRect.top
                });
                el.style.opacity = '0.2'; // Dim dragged items
            });

            // Generate multi-item hologram
            if (selectedNodes.length > 1) {
                const itemSources = Array.from(selectedNodes).map(node => {
                    const img = node.querySelector('img');
                    return img ? img.src : 'assets/icon/general/file.png';
                });
                
                const ghost = window.createDragGhost(selectedNodes.length, itemSources);
                e.dataTransfer.setDragImage(ghost, 25, 25);
                setTimeout(() => { if (ghost && ghost.parentNode) ghost.remove(); }, 100);
            }

            e.dataTransfer.setData("text/plain", JSON.stringify({
                source: "finder",
                isMulti: true,
                items: selectedItems,
                offsetX: e.clientX - primaryRect.left,
                offsetY: e.clientY - primaryRect.top
            }));
        });

        div.addEventListener("dragend", () => {
            document.querySelectorAll('#finder-content .fs-item').forEach(el => el.style.opacity = '1');
        });

        // --- INTERNAL FOLDER DROP PHYSICS ---
        if (itemData.type === 'folder') {
            div.addEventListener("dragover", (e) => {
                e.preventDefault(); e.stopPropagation();
                div.style.backgroundColor = "rgba(0, 122, 255, 0.3)";
                div.style.borderRadius = "5px";
            });
            
            div.addEventListener("dragleave", () => { div.style.backgroundColor = ""; });
            
            div.addEventListener("drop", (e) => {
                e.preventDefault(); e.stopPropagation();
                div.style.backgroundColor = "";
                try {
                    const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                    const itemsToProcess = data.isMulti ? data.items : [{name: data.name}];
                    let moved = false;
                    
                    itemsToProcess.forEach(item => {
                        const dragName = item.name;
                        if (!dragName || dragName === itemName) return;
                        
                        const sourceFolder = (data.source === "desktop" || data.source === "sidebar") ? fileSystem['Home'].contents : getFolderByPath(currentPath);
                        
                        if (sourceFolder[dragName]) {
                            if (!itemData.contents) itemData.contents = {};
                            itemData.contents[dragName] = sourceFolder[dragName];
                            
                            // Remove absolute desktop coordinates when moved into a VFS folder
                            if (itemData.contents[dragName]) {
                                delete itemData.contents[dragName].x;
                                delete itemData.contents[dragName].y;
                            }
                            
                            delete sourceFolder[dragName];
                            moved = true;
                        }
                    });
                    
                    if (moved) {
                        if (typeof renderDesktop === 'function') renderDesktop();
                        renderFinder();
                    }
                } catch(err) { console.warn("Internal folder drop aborted"); }
            });
        }

        // --- DOUBLE CLICK ACTION HANDLER ---
        div.addEventListener("dblclick", (e) => {
            if (itemData.type === "folder") {
                currentPath.push(itemName);
                renderFinder();
            } else if (itemData.type === "shortcut") {
                e.stopPropagation();
                const originalAppIcon = document.getElementById(itemData.content);
                if (originalAppIcon) originalAppIcon.click();
            } else if (itemData.type === "file") {
                if (isImage(itemName)) openImagePreview(itemName, itemData.content);
                else openFileInEditor(itemName, itemData, currentFolder);
            }
        });
        
        finderContent.appendChild(div);
    }
    renderSidebar();
}

// Initial render sequence
renderFinder();
/**
 * =========================================================
 * 13. GLOBAL CONTEXT MENU (Right-Click Engine)
 * Description: Intercepts right-clicks across the OS (Desktop,
 * Finder, Dock, Trash, Music App) and renders contextual options.
 * =========================================================
 */
const contextMenu = document.getElementById("context-menu");
let lastRightClickX = 0;
let lastRightClickY = 0;

window.oncontextmenu = function(e) {
    e.preventDefault();
    if (!contextMenu) return;
    
    contextMenu.innerHTML = "";
    lastRightClickX = e.pageX;
    lastRightClickY = e.pageY;

    // Determine the target of the right-click
    const itemNode = e.target.closest(".fs-item") || e.target.closest(".desktop-item") || e.target.closest(".sidebar-folder") || e.target.closest(".dock-icon:not(#trash-icon)");
    const trashNode = e.target.closest("#trash-icon") || e.target.closest("#sidebar-trash");
    const musicNavNode = e.target.closest(".music-nav-item"); 

    // --- MENU A: MUSIC APP (Playlists & Favorites) ---
    if (musicNavNode) {
        const isCustomPlaylist = musicNavNode.classList.contains('custom-playlist-item');
        const isFavorites = musicNavNode.innerHTML.includes('Preferiti') || (musicNavNode.getAttribute('onclick') || '').includes('favorites');

        if (isCustomPlaylist) {
            const plName = musicNavNode.dataset.playlistName;
            contextMenu.innerHTML = `<div class="context-item" style="color: var(--danger-color, #ff5f56);" onclick="window.handleItemAction('delete_playlist', '${plName}', 'music')">🗑️ Cancella Playlist</div>`;
        } else if (isFavorites) {
            contextMenu.innerHTML = `<div class="context-item" style="color: var(--danger-color, #ff5f56);" onclick="window.handleItemAction('empty_favorites', '', 'music')">💔 Svuota Preferiti</div>`;
        } else {
            contextMenu.style.display = "none";
            return;
        }
    }
    // --- MENU B: FILES, FOLDERS, DOCK ICONS ---
    else if (itemNode) {
        let itemName = "";
        let source = "";
        let nodeId = "";

        // Identify the source container
        if (itemNode.classList.contains("desktop-item")) {
            source = "desktop";
            itemName = itemNode.querySelector(".fs-name").textContent;
        } else if (itemNode.classList.contains("fs-item")) {
            source = "finder";
            itemName = itemNode.querySelector(".fs-name").textContent;
        } else if (itemNode.classList.contains("sidebar-folder")) {
            source = "sidebar"; 
            itemName = itemNode.dataset.name;
        } else if (itemNode.classList.contains("dock-icon")) {
            source = "dock";
            itemName = itemNode.getAttribute("data-title");
            nodeId = itemNode.id;
        }

        const folder = (source === "desktop" || source === "sidebar") ? fileSystem["Home"].contents : getFolderByPath(currentPath);
        const itemData = folder ? folder[itemName] : null;

        let isFolder = false;
        let isSystemApp = false;
        let appWindowId = null;
        let isAppOpen = false;

        // Resolve item properties
        if (source === "dock") {
            isFolder = itemNode.dataset.originalType === "folder";
            if (apps[nodeId]) {
                isSystemApp = true;
                appWindowId = apps[nodeId];
            }
        } else {
            isFolder = itemData && itemData.type === "folder";
            if (itemData && itemData.type === "shortcut" && apps[itemData.content]) {
                isSystemApp = true;
                appWindowId = apps[itemData.content];
            }
        }

        // Check if a system app is currently running
        if (isSystemApp && appWindowId) {
            const winEl = document.getElementById(appWindowId);
            if (winEl && winEl.classList.contains('show')) isAppOpen = true;
        }

        // Generate Contextual Options
        if (isSystemApp) {
            if (isAppOpen) {
                contextMenu.innerHTML = `<div class="context-item" onclick="window.handleItemAction('close_app', '${itemName}', '${source}', '${nodeId}')">❌ Chiudi App</div>`;
            } else {
                contextMenu.innerHTML = `<div class="context-item" onclick="window.handleItemAction('open', '${itemName}', '${source}', '${nodeId}')">🚀 Apri App</div>`;
            }
        } 
        else if (currentPath[0] === "Trash" && source === "finder") {
            contextMenu.innerHTML = `
                <div class="context-item" onclick="window.handleItemAction('restore', '${itemName}', '${source}')">↩️ Recupera</div>
                <hr class="context-divider">
                <div class="context-item" style="color: var(--danger-color, #ff5f56);" onclick="window.handleItemAction('delete_permanent', '${itemName}', '${source}')">💥 Elimina Definitivamente</div>
            `;
        } 
        else {
            const customizeOption = isFolder ? `<div class="context-item" onclick="window.handleItemAction('customize', '${itemName}', '${source}', '${nodeId}')">🎨 Personalizza Colore...</div>` : "";
            contextMenu.innerHTML = `
                <div class="context-item" onclick="window.handleItemAction('open', '${itemName}', '${source}', '${nodeId}')">📂 Apri</div>
                <div class="context-item" onclick="window.handleItemAction('copy', '${itemName}', '${source}', '${nodeId}')">📄 Copia</div>
                ${customizeOption}
                <hr class="context-divider">
                <div class="context-item" style="color: var(--danger-color, #ff5f56);" onclick="window.handleItemAction('trash', '${itemName}', '${source}', '${nodeId}')">🗑️ Sposta nel Cestino</div>
            `;
        }
    } 
    // --- MENU C: EMPTY SPACE (Desktop, Finder bg, Trash icon) ---
    else if (trashNode) {
        contextMenu.innerHTML = `
            <div class="context-item" onclick="document.getElementById('trash-icon').click(); document.getElementById('context-menu').style.display='none';">📂 Apri Cestino</div>
            <hr class="context-divider">
            <div class="context-item" style="color: var(--danger-color, #ff5f56);" onclick="if(typeof emptyTrash === 'function') emptyTrash();">💥 Svuota Cestino</div>
        `;
    } else {
        const isInFinder = e.target.closest("#finder-content") !== null || e.target.closest(".finder-sidebar") !== null;
        const bgSource = isInFinder ? "finder" : "desktop";
        contextMenu.innerHTML = `
            <div class="context-item" onclick="window.handleBgAction('folder', '${bgSource}')">📁 Nuova Cartella</div>
            <div class="context-item" onclick="window.handleBgAction('file', '${bgSource}')">📄 Nuovo File di Testo</div>
            <hr class="context-divider">
            <div class="context-item" onclick="window.handleBgAction('bg')">🖼️ Cambia Sfondo Scrivania...</div>
            <hr class="context-divider">
            <div class="context-item" onclick="location.reload()">🔄 Riavvia WebOS</div>
        `;
    }

    // Viewport Boundary Correction (Prevents menu from spawning off-screen)
    let posX = e.pageX; 
    let posY = e.pageY;
    const menuWidth = 200; // Estimated max width
    const menuHeight = 150; // Estimated max height

    if (posX + menuWidth > window.innerWidth) posX = window.innerWidth - menuWidth - 10;
    if (posY + menuHeight > window.innerHeight) posY = window.innerHeight - menuHeight - 10;
    
    contextMenu.style.left = `${posX}px`; 
    contextMenu.style.top = `${posY}px`;
    contextMenu.style.display = "flex";
};

// Global click listener to close the context menu
window.addEventListener("click", (e) => {
    if (contextMenu && !e.target.closest("#context-menu")) {
        contextMenu.style.display = "none";
    }
});

/**
 * =========================================================
 * 14. CONTEXT MENU ACTION EXECUTOR (Multi-Process)
 * Description: Processes actions selected from the context menu,
 * handling single and multiple selected items intelligently.
 * =========================================================
 */
window.handleItemAction = async function(action, itemName, source, nodeId = "") {
    if (contextMenu) contextMenu.style.display = "none";

    // --- Isolated Music App Actions ---
    if (source === 'music') {
        if (action === 'delete_playlist') {
            const isConfirmed = await showMacDialog({
                title: "Elimina Playlist",
                text: `Sei sicuro di voler eliminare la playlist "${itemName}"?`,
                showInput: false, showSelect: false, okText: "Elimina"
            });
            if (isConfirmed) {
                customPlaylists = customPlaylists.filter(p => p.name !== itemName);
                if (typeof renderSidebarPlaylists === 'function') renderSidebarPlaylists();
                if (typeof currentMusicFilter !== 'undefined' && currentMusicFilter === 'playlist:' + itemName) {
                    if (typeof setMusicFilter === 'function') setMusicFilter('all');
                    document.querySelectorAll('.music-nav-item')[0].classList.add('active');
                }
            }
        } else if (action === 'empty_favorites') {
            const isConfirmed = await showMacDialog({
                title: "Svuota Preferiti",
                text: "Sei sicuro di voler rimuovere il cuore da tutti i brani?",
                showInput: false, showSelect: false, okText: "Svuota"
            });
            if (isConfirmed) {
                musicDatabase.forEach(track => track.favorite = false);
                if (typeof currentMusicFilter !== 'undefined' && currentMusicFilter === 'favorites') {
                    if (typeof setMusicFilter === 'function') setMusicFilter('all');
                } else if (typeof renderMusicLibrary === 'function') {
                    renderMusicLibrary(); 
                }
            }
        }
        return;
    }

    // --- Build Original Data Reference ---
    let folder, itemData;
    if (source === "dock") {
        const dockEl = document.getElementById(nodeId);
        itemData = {
            type: dockEl.dataset.originalType || 'shortcut',
            iconColor: dockEl.dataset.iconColor || 'blue',
            contents: dockEl.dataset.folderContents ? JSON.parse(dockEl.dataset.folderContents) : {},
            originalSource: 'dock'
        };
        folder = { [itemName]: itemData }; 
    } else {
        folder = (source === "desktop" || source === "sidebar") ? fileSystem["Home"].contents : getFolderByPath(currentPath);
        itemData = folder[itemName];
    }

    if (!itemData) return; // Safety fallback

    // --- GROUP INTELLIGENCE: Detect Multiple Selection ---
    let itemsToProcess = [itemName];
    if (source === "finder" || source === "desktop") {
        const selector = source === "finder" ? '#finder-content .fs-item.selected' : '.desktop-item.selected';
        const selectedElements = document.querySelectorAll(selector);
        const isPartOfSelection = Array.from(selectedElements).some(el => el.querySelector('.fs-name').textContent === itemName);
        
        if (selectedElements.length > 1 && isPartOfSelection) {
            itemsToProcess = Array.from(selectedElements).map(el => el.querySelector('.fs-name').textContent);
        }
    }

    // --- ACTION ROUTING ---
    switch (action) {
        
        case "open":
            if (source === "dock") {
                const dockNode = document.getElementById(nodeId);
                if (dockNode) dockNode.click(); 
            } else {
                itemsToProcess.forEach(name => {
                    const data = folder[name];
                    if (!data) return;
                    
                    if (data.type === "folder") {
                        // Protection: Only open folder if a single item is selected to avoid path history corruption
                        if (itemsToProcess.length === 1) {
                            if (source === "desktop" || source === "sidebar") {
                                const finderWin = document.getElementById("finder-window");
                                if (!finderWin.classList.contains("show")) {
                                    finderWin.style.display = "flex"; void finderWin.offsetWidth; finderWin.classList.add("show");
                                }
                                bringToFront(finderWin);
                                navigateTo(["Home", name]);
                            } else {
                                currentPath.push(name); renderFinder();
                            }
                        }
                    } else if (data.type === "shortcut") {
                        const originalAppIcon = document.getElementById(data.content);
                        if (originalAppIcon) originalAppIcon.click();
                    } else if (data.type === "file") {
                        if (isImage(name)) openImagePreview(name, data.content);
                        else openFileInEditor(name, data, folder);
                    }
                });
            }
            break;

        case "close_app":
            const iconId = source === "dock" ? nodeId : (itemData && itemData.type === "shortcut" ? itemData.content : "");
            if (iconId && apps[iconId]) {
                const win = document.getElementById(apps[iconId]);
                if (win) closeWindowAnim(win, true); 
            }
            break;

        case "customize":
            if (typeof openFolderCustomizer === 'function') openFolderCustomizer(itemName, folder, source, nodeId); 
            break;

        case "copy":
            const targetFolder = (source === "dock" || source === "desktop" || source === "sidebar") ? fileSystem["Home"].contents : folder;
            
            itemsToProcess.forEach(name => {
                const data = folder[name];
                if (!data) return;
                
                let baseName = name; let ext = "";
                if (name.includes(".")) {
                    ext = name.substring(name.lastIndexOf("."));
                    baseName = name.substring(0, name.lastIndexOf("."));
                }
                let newName = `${baseName}_copia${ext}`;
                let counter = 1;
                
                while (targetFolder[newName]) { 
                    newName = `${baseName}_copia_${counter}${ext}`; 
                    counter++; 
                }
                
                // Deep clone the object payload
                targetFolder[newName] = JSON.parse(JSON.stringify(data));

                if (source === "desktop" || source === "sidebar" || source === "dock") {
                    const startX = data.x !== undefined ? data.x + 85 : window.innerWidth / 2;
                    const startY = data.y !== undefined ? data.y : window.innerHeight / 2;
                    const freePos = getFreeDesktopPosition(startX, startY);
                    targetFolder[newName].x = freePos.x; 
                    targetFolder[newName].y = freePos.y;
                }
            });
            if (typeof renderDesktop === 'function') renderDesktop(); 
            if (typeof renderFinder === 'function') renderFinder();
            break;

        case "trash":
            const isTrashConfirmed = await showMacDialog({
                title: "Sposta nel Cestino", 
                text: itemsToProcess.length > 1 
                    ? `Sei sicuro di voler spostare questi ${itemsToProcess.length} elementi nel Cestino?`
                    : `Sei sicuro di voler spostare "${itemName}" nel Cestino?`,
                showInput: false, showSelect: false, okText: "Cestina",
            });

            if (isTrashConfirmed) {
                itemsToProcess.forEach(name => {
                    const data = folder[name];
                    if (!data) return;
                    
                    data.originalSource = source;
                    data.originalPath = source === "finder" ? currentPath.slice() : null;
                    fileSystem["Trash"].contents[name] = data;
                    
                    if (source === "dock" && name === itemName) {
                        const dockEl = document.getElementById(nodeId);
                        if (dockEl) {
                            dockEl.classList.add('poof-destroyed');
                            setTimeout(() => dockEl.remove(), 300);
                        }
                    } else {
                        delete folder[name];
                    }
                });
                
                updateTrashIcon(); 
                if (typeof renderDesktop === 'function') renderDesktop(); 
                if (typeof renderFinder === 'function') renderFinder();
            }
            break;

        case "restore":
            itemsToProcess.forEach(name => {
                const data = folder[name];
                if (!data) return;

                let destFolder = fileSystem["Home"].contents; 
                if (data.originalSource === "finder" && data.originalPath) {
                    const specificFolder = getFolderByPath(data.originalPath);
                    if (specificFolder) destFolder = specificFolder;
                }
                
                destFolder[name] = data;
                
                // If restoring to desktop, assign physics coordinates
                if (destFolder === fileSystem["Home"].contents) {
                    const freePos = getFreeDesktopPosition(window.innerWidth/2, window.innerHeight/2);
                    destFolder[name].x = freePos.x;
                    destFolder[name].y = freePos.y;
                }
                
                delete folder[name]; 
                delete destFolder[name].originalSource; 
                delete destFolder[name].originalPath;
            });
            
            updateTrashIcon(); 
            if (typeof renderDesktop === 'function') renderDesktop(); 
            if (typeof renderFinder === 'function') renderFinder();
            break;

        case "delete_permanent":
            const isPermConfirmed = await showMacDialog({
                title: "Elimina Definitivamente", 
                text: itemsToProcess.length > 1 
                    ? `Sei sicuro di voler eliminare per sempre questi ${itemsToProcess.length} elementi? L'operazione è irreversibile.`
                    : `Sei sicuro di voler eliminare per sempre "${itemName}"? L'operazione è irreversibile.`,
                showInput: false, showSelect: false, okText: "Elimina",
            });

            if (isPermConfirmed) {
                itemsToProcess.forEach(name => { delete folder[name]; });
                updateTrashIcon(); 
                if (currentPath[0] === "Trash") {
                    if (typeof renderFinder === 'function') renderFinder();
                }
                if (typeof renderDesktop === 'function') renderDesktop(); 
            }
            break;
    }
};

/**
 * =========================================================
 * 15. SYSTEM & HARDWARE ENGINE (Settings App)
 * Description: Reads device telemetry (CPU, RAM, Network) 
 * and handles the Settings UI rendering.
 * =========================================================
 */
let systemDataCache = {};

/**
 * Asynchronously fetches system telemetry data.
 * @returns {Promise<void>}
 */
async function fetchSystemData() {
    const ua = navigator.userAgent;
    let osHost = "Sconosciuto";
    if (ua.indexOf("Win") !== -1) osHost = "Windows";
    else if (ua.indexOf("Mac") !== -1) osHost = "macOS";
    else if (ua.indexOf("Linux") !== -1) osHost = "Linux";
    
    const cores = navigator.hardwareConcurrency ? navigator.hardwareConcurrency : "Accesso Protetto";
    const ram = navigator.deviceMemory ? navigator.deviceMemory + " GB+" : "N/D";
    const touch = navigator.maxTouchPoints > 0 ? `Sì (${navigator.maxTouchPoints} punti)` : "No";
    
    const w = window.screen.width;
    const h = window.screen.height;
    const ratio = window.devicePixelRatio || 1;
    const retina = ratio > 1 ? `Sì (@${ratio}x)` : "No";
    const depth = window.screen.colorDepth;
    
    let netType = "Non Rilevabile";
    let netSpeed = "N/D";
    if (navigator.connection) {
        netType = navigator.connection.effectiveType || "Sconosciuta";
        netSpeed = navigator.connection.downlink ? navigator.connection.downlink + " Mbps (Stimata)" : "N/D";
    }
    
    let batLevel = "Sensore non accessibile";
    let batCharging = "N/D";
    if (navigator.getBattery) {
        try {
            const bat = await navigator.getBattery();
            batLevel = Math.round(bat.level * 100) + "%";
            batCharging = bat.charging ? "In Carica ⚡" : "A Batteria";
        } catch (e) {
            console.warn("Battery API block or unsupported");
        }
    }
    
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    systemDataCache = {
        osHost, cores, ram, touch, w, h, ratio, retina, depth, netType, netSpeed, tz, batLevel, batCharging,
    };
}

/**
 * Switches the active tab within the Settings App and renders its HTML.
 * @param {string} tabId - The ID of the selected tab.
 */
function switchSettingsTab(tabId) {
    document.querySelectorAll(".settings-nav-item").forEach((el) => el.classList.remove("active"));
    const activeNav = document.querySelector(`.settings-nav-item[onclick="switchSettingsTab('${tabId}')"]`);
    if (activeNav) activeNav.classList.add("active");
    
    const d = systemDataCache;
    const container = document.getElementById("settings-content-area");
    if (!container) return;

    let html = "";

    if (tabId === "account") {
        const currentProfilePic = document.getElementById("nav-profile-pic").src;
        html = `
            <div style="display: flex; flex-direction: column; align-items: center; margin-bottom: 25px; margin-top: 10px;">
                <div style="position: relative; cursor: pointer; transition: transform 0.1s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'" onclick="document.getElementById('profile-upload-input').click()" title="Clicca per cambiare foto">
                    <img id="settings-profile-pic" src="${currentProfilePic}" style="width: 100px; height: 100px; border-radius: 50%; object-fit: cover; border: 2px solid rgba(255,255,255,0.1); box-shadow: 0 10px 25px rgba(0,0,0,0.5); margin-bottom: 10px;">
                    <div style="position: absolute; bottom: 12px; right: 0; background: rgba(255,255,255,0.15); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border-radius: 50%; width: 28px; height: 28px; display: flex; justify-content: center; align-items: center; box-shadow: 0 4px 10px rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.2);">
                        <span style="font-size: 12px;">✏️</span>
                    </div>
                </div>
                <h2 class="settings-title">Utente WebOS</h2>
                <p class="settings-subtitle">Amministratore di Sistema</p>
            </div>
            <div class="settings-card">
                <div class="settings-row"><span class="settings-label">ID Utente</span><span class="settings-value">admin_001</span></div>
                <div class="settings-row"><span class="settings-label">Privilegi</span><span class="settings-value">Root / Superuser</span></div>
                <div class="settings-row"><span class="settings-label">Stato Account</span><span class="settings-value" style="color: #32d74b;">Attivo</span></div>
            </div>
        `;
    } else if (tabId === "general") {
        html = `
            <h3 class="settings-section-title">Specifiche di Base</h3>
            <div class="settings-card">
                <div class="settings-row"><span class="settings-label">OS Macchina Fisica</span><span class="settings-value">${d.osHost}</span></div>
                <div class="settings-row"><span class="settings-label">Core Logici CPU</span><span class="settings-value">${d.cores}</span></div>
                <div class="settings-row"><span class="settings-label">Memoria Ram Stimata</span><span class="settings-value">${d.ram}</span></div>
                <div class="settings-row"><span class="settings-label">Fuso Orario</span><span class="settings-value">${d.tz}</span></div>
            </div>
            <h3 class="settings-section-title">Software</h3>
            <div class="settings-card">
                <div class="settings-row"><span class="settings-label">Versione Sistema</span><span class="settings-value">WebOS 3.0 (Build 2026)</span></div>
                <div class="settings-row"><span class="settings-label">Architettura</span><span class="settings-value">JS Serverless</span></div>
            </div>
        `;
    } else if (tabId === "display") {
        html = `
            <h3 class="settings-section-title">Display Integrato</h3>
            <div class="settings-card">
                <div class="settings-row"><span class="settings-label">Risoluzione Logica</span><span class="settings-value">${d.w} x ${d.h} px</span></div>
                <div class="settings-row"><span class="settings-label">Risoluzione Fisica</span><span class="settings-value">${d.w * d.ratio} x ${d.h * d.ratio} px</span></div>
                <div class="settings-row"><span class="settings-label">Schermo HD/Retina</span><span class="settings-value">${d.retina}</span></div>
                <div class="settings-row"><span class="settings-label">Profondità Colore</span><span class="settings-value">${d.depth}-bit</span></div>
                <div class="settings-row"><span class="settings-label">Supporto Multi-Touch</span><span class="settings-value">${d.touch}</span></div>
            </div>
        `;
    } else if (tabId === "network") {
        html = `
            <h3 class="settings-section-title">Stato Connessione</h3>
            <div class="settings-card">
                <div class="settings-row"><span class="settings-label">Protocollo (Cell/Wifi)</span><span class="settings-value">${d.netType.toUpperCase()}</span></div>
                <div class="settings-row"><span class="settings-label">Banda Stimata (Down)</span><span class="settings-value">${d.netSpeed}</span></div>
            </div>
        `;
    } else if (tabId === "battery") {
        html = `
            <h3 class="settings-section-title">Stato Alimentazione</h3>
            <div class="settings-card">
                <div class="settings-row"><span class="settings-label">Livello Attuale</span><span class="settings-value">${d.batLevel}</span></div>
                <div class="settings-row"><span class="settings-label">Alimentatore di Rete</span><span class="settings-value">${d.batCharging}</span></div>
            </div>
        `;
    } else if (tabId === "background") {
        
        let cleanUrl = "";
        if (window.customWallpaperSession) {
            cleanUrl = window.customWallpaperSession;
        } else {
            const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
            cleanUrl = currentTheme === 'light' ? 'assets/img/light.png' : 'assets/img/dark.png';
        }

        html = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding-top: 10px;">
                <div style="position: relative; width: 100%; max-width: 360px; aspect-ratio: 16/9; background: #0a0a0c; border-radius: 18px; padding: 8px; padding-bottom: 24px; box-shadow: 0 25px 50px rgba(0,0,0,0.8), inset 0 1px 1px rgba(255,255,255,0.15); margin-bottom: 25px;">
                    <div style="width: 100%; height: 100%; border-radius: 10px; overflow: hidden; position: relative; box-shadow: inset 0 0 10px rgba(0,0,0,0.8);">
                        <img id="settings-bg-preview" src="${cleanUrl}" style="width: 100%; height: 100%; object-fit: cover; filter: brightness(0.95);">
                        <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0) 45%); pointer-events: none;"></div>
                    </div>
                    <div style="position: absolute; bottom: 8px; left: 50%; transform: translateX(-50%); width: 8px; height: 8px; border-radius: 50%; background: rgba(255,255,255,0.1);"></div>
                </div>
                <h3 style="margin: 0 0 15px 0; font-size: 16px; font-weight: 600; color: #fff;">Sfondo Scrivania</h3>
                
                <div style="display: flex; gap: 10px;">
                    <button style="background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.15); color: #fff; padding: 8px 24px; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); box-shadow: 0 4px 10px rgba(0,0,0,0.3); transition: all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.2)'; this.style.transform='scale(1.05)';" onmouseout="this.style.background='rgba(255,255,255,0.1)'; this.style.transform='scale(1)';" onmousedown="this.style.transform='scale(0.95)';" onclick="document.getElementById('bg-upload-input').click()">
                        Scegli Immagine...
                    </button>
                    
                    ${window.customWallpaperSession ? `
                    <button style="background: rgba(255, 59, 48, 0.15); border: 1px solid rgba(255, 59, 48, 0.4); color: #ff3b30; padding: 8px 24px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='#ff3b30'; this.style.color='#fff';" onmouseout="this.style.background='rgba(255, 59, 48, 0.15)'; this.style.color='#ff3b30';" onclick="window.resetToDefaultWallpaper()">
                        Ripristina Originale
                    </button>
                    ` : ''}
                </div>
                <p style="font-size: 11px; color: #666; margin-top: 15px;">Sessione volatile: si resetta al riavvio (F5).</p>
            </div>
        `;
    }
    container.innerHTML = html;
}

/**
 * Initializes Settings App on launch.
 */
async function loadSystemInfo() {
    await fetchSystemData();
    switchSettingsTab("account");
}

function openSettings() {
    loadSystemInfo();
    const win = document.getElementById("settings-window");
    if (!win.classList.contains("show")) {
        win.style.display = "flex";
        void win.offsetWidth;
        win.classList.add("show");
    }
    if (typeof bringToFront === 'function') bringToFront(win);
}

document.getElementById("settings-icon").addEventListener("click", openSettings);


/**
 * =========================================================
 * 16. BACKGROUND MANAGEMENT & EMPTY DESKTOP ACTIONS
 * =========================================================
 */

/**
 * Generates an empty folder or text file via right-click contextual menu.
 * @param {string} action - 'folder', 'file', or 'bg'.
 * @param {string} source - Origin of the action ('desktop' or 'finder').
 */
window.handleBgAction = async function(action, source) {
    document.getElementById("context-menu").style.display = "none";
    
    if (action === 'bg') {
        openSettings();
        setTimeout(() => switchSettingsTab('background'), 50); 
    } 
    else if (action === 'folder' || action === 'file') {
        const folder = source === 'finder' ? getFolderByPath(currentPath) : fileSystem['Home'].contents;
        const defaultTitle = action === 'folder' ? "Nuova Cartella" : "Nuovo Documento.txt";
        
        const result = await showMacDialog({
            title: action === 'folder' ? "Nuova Cartella" : "Nuovo Documento",
            showInput: defaultTitle,
            showSelect: false,
            okText: "Crea"
        });
        
        if (!result || !result.name) return; 
        
        const name = result.name.trim();
        if (!isValidFileName(name)) {
            await showMacAlert("Il nome inserito contiene caratteri non validi (es. / o \\) o parole di sistema riservate.");
            return;
        }

        if (folder[name]) {
            await showMacAlert(`Esiste già un elemento chiamato "${name}" in questa posizione.`);
            return;
        }
        
        if (action === 'folder') {
            folder[name] = { type: 'folder', contents: {} };
        } else {
            folder[name] = { type: 'file', content: "" };
        }
        
        if (source === 'desktop') {
            const freePos = getFreeDesktopPosition(lastRightClickX, lastRightClickY - 28);
            folder[name].x = freePos.x; 
            folder[name].y = freePos.y;
            if (typeof renderDesktop === 'function') renderDesktop();
        } else {
            if (typeof renderFinder === 'function') renderFinder();
        }
    }
};

// --- Wallpaper Upload Listener (Settings App) ---
setTimeout(() => {
    const bgUploadInput = document.getElementById("bg-upload-input");
    if (bgUploadInput) {
        bgUploadInput.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = function(event) {
                const base64String = event.target.result;
                
                // Store in RAM (Volatile Session)
                window.customWallpaperSession = base64String;
                
                // Trigger Smooth Crossfade
                if (typeof setSmoothBackground === 'function') {
                    setSmoothBackground(base64String);
                } else {
                    document.getElementById('desktop').style.backgroundImage = `url('${base64String}')`;
                }
                
                const preview = document.getElementById('settings-bg-preview');
                if (preview) preview.src = base64String;

                switchSettingsTab('background'); 
            };
            reader.readAsDataURL(file);
        });
    }
}, 1000);

/**
 * Manually restores the default system wallpaper based on current theme.
 * Destroys the volatile custom session.
 */
window.resetToDefaultWallpaper = function() {
    window.customWallpaperSession = null; 
    
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const defaultBg = currentTheme === 'light' ? 'assets/img/light.png' : 'assets/img/dark.png';
    
    if (typeof setSmoothBackground === 'function') {
        setSmoothBackground(defaultBg);
    } else {
        document.getElementById('desktop').style.backgroundImage = `url("${defaultBg}")`;
    }
    
    const preview = document.getElementById('settings-bg-preview');
    if (preview) preview.src = defaultBg;
    
    switchSettingsTab('background');
};


/**
 * =========================================================
 * 16.5 RADIAL MENU ENGINE (Folder Customizer)
 * Description: Generates a 3D animated ring menu to change
 * folder colors on the Desktop, Finder, or Dock.
 * =========================================================
 */

/**
 * Opens the radial color picker for folders.
 * @param {string} itemName - Target folder name.
 * @param {Object} folderObj - VFS parent folder object.
 * @param {string} source - UI Source ('dock', 'finder', 'desktop').
 * @param {string} [nodeId] - HTML Node ID (Required for Dock icons).
 */
window.openFolderCustomizer = function(itemName, folderObj, source = "", nodeId = "") {
    const itemData = folderObj[itemName];
    if (!itemData) return;
    
    const currentColor = itemData.iconColor || 'blue';
    const overlay = document.getElementById('folder-customizer-overlay');
    const container = document.getElementById('radial-picker-container');
    const wrapper = document.getElementById('radial-items-wrapper');
    const centerIcon = document.getElementById('radial-center-icon');
    
    if (!overlay || !container || !wrapper || !centerIcon) return;

    // Inject initial data
    document.getElementById('folder-customizer-target').textContent = itemName;
    centerIcon.src = `assets/icon/folders/${currentColor}.png`; 
    
    wrapper.innerHTML = '';
    
    const allColors = ['blue', 'coral', 'Gray', 'Green', 'Orange', 'Pink', 'Red', 'Teal', 'Violet', 'Yellow', 'S1', 'S2', 'S3', 'S4', 'S5'];
    const total = allColors.length;
    const radius = 150; 

    // DOM Fragment for performance: prevents 15 reflows
    const fragment = document.createDocumentFragment();

    allColors.forEach((color, index) => {
        const angle = (index / total) * (2 * Math.PI) - (Math.PI / 2);
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;

        const div = document.createElement('div');
        div.className = `radial-color-option ${color === currentColor ? 'selected' : ''}`;
        div.style.left = '50%';
        div.style.top = '50%';
        div.style.transform = `translate(${x}px, ${y}px) scale(1)`;
        
        div.innerHTML = `<img src="assets/icon/folders/${color}.png" title="${color}">`;

        div.onmouseenter = () => div.style.transform = `translate(${x}px, ${y}px) scale(1.5)`;
        div.onmouseleave = () => div.style.transform = `translate(${x}px, ${y}px) scale(1)`;

        // Double Click applies and saves
        div.ondblclick = (e) => {
            e.stopPropagation();
            
            if (source === "dock") {
                const dockEl = document.getElementById(nodeId);
                if (dockEl) {
                    dockEl.dataset.iconColor = color;
                    const imgEl = dockEl.querySelector('img');
                    if (imgEl) imgEl.src = `assets/icon/folders/${color}.png`;
                }
            } else {
                itemData.iconColor = color;
                if (typeof renderSidebar === 'function') renderSidebar(); 
                if (typeof renderFinder === 'function') renderFinder(); 
                if (typeof renderDesktop === 'function') renderDesktop();
            }
            
            window.closeFolderCustomizer();
        };

        // Single Click previews in the center
        div.onclick = (e) => {
            e.stopPropagation();
            document.querySelectorAll('.radial-color-option').forEach(el => el.classList.remove('selected'));
            div.classList.add('selected');
            centerIcon.src = `assets/icon/folders/${color}.png`; 
        };

        fragment.appendChild(div);
    });

    wrapper.appendChild(fragment);

    // Spring entrance animation
    overlay.style.display = 'flex';
    void overlay.offsetWidth; 
    overlay.style.opacity = '1';
    container.style.transform = 'scale(1)';
}

/**
 * Closes the radial color picker with a retreat animation.
 */
window.closeFolderCustomizer = function() {
    const overlay = document.getElementById('folder-customizer-overlay');
    const container = document.getElementById('radial-picker-container');
    if (!overlay || !container) return;
    
    overlay.style.opacity = '0';
    container.style.transform = 'scale(0.7)';
    
    setTimeout(() => {
        overlay.style.display = 'none';
    }, 250); 
}
/**
 * =========================================================
 * 17A. WORLD CLOCK APP
 * Description: 60fps analog clock rendering engine and timezone manager.
 * =========================================================
 */
const clockZones = [
    { id: 'cupertino', name: 'Cupertino', tz: 'America/Los_Angeles' },
    { id: 'roma', name: 'Roma', tz: 'Europe/Rome' },
    { id: 'londra', name: 'Londra', tz: 'Europe/London' },
    { id: 'tokyo', name: 'Tokyo', tz: 'Asia/Tokyo' },
    { id: 'parigi', name: 'Parigi', tz: 'Europe/Paris' }
];

let activeClockCity = clockZones[1]; // Roma as default

/**
 * Renders the sidebar list of available timezones.
 */
function renderClockSidebar() {
    const list = document.getElementById('clock-city-list');
    if (!list) return;
    
    // Use DocumentFragment to batch DOM inserts
    const fragment = document.createDocumentFragment();
    
    clockZones.forEach(city => {
        const item = document.createElement('div');
        item.className = `clock-sidebar-item ${city.id === activeClockCity.id ? 'active' : ''}`;
        
        const now = new Date();
        const tzTime = new Date(now.toLocaleString('en-US', { timeZone: city.tz }));
        const miniTime = `${String(tzTime.getHours()).padStart(2, '0')}:${String(tzTime.getMinutes()).padStart(2, '0')}`;
        
        item.innerHTML = `<span>${city.name}</span><span style="opacity: 0.7;">${miniTime}</span>`;
        
        item.onclick = () => {
            activeClockCity = city;
            const activeCityLabel = document.getElementById('clock-active-city');
            if (activeCityLabel) activeCityLabel.textContent = city.name;
            renderClockSidebar(); 
        };
        fragment.appendChild(item);
    });
    
    list.innerHTML = '';
    list.appendChild(fragment);
}

let clockFrameId = null;

/**
 * 60fps render loop for the analog and digital clock faces.
 * Automatically halts when the window is closed to save CPU.
 */
function updateAppClock() {
    const win = document.getElementById('clock-window');
    
    // CPU Saver: Halt loop if window is not visible
    if (!win || !win.classList.contains('show')) {
        clockFrameId = null;
        return; 
    }

    const now = new Date();
    const tzString = now.toLocaleString('en-US', { timeZone: activeClockCity.tz });
    const tzTime = new Date(tzString);

    const h = tzTime.getHours();
    const m = tzTime.getMinutes();
    const s = tzTime.getSeconds();
    const ms = now.getMilliseconds(); 

    // Smooth analog math
    const hrAngle = (h % 12) * 30 + (m * 0.5);
    const minAngle = m * 6 + (s * 0.1);
    const secAngle = s * 6 + (ms * 0.006); 

    const hHand = document.getElementById('hour-hand');
    const mHand = document.getElementById('minute-hand');
    const sHand = document.getElementById('second-hand');
    const digital = document.getElementById('digital-time');
    const dateLabel = document.getElementById('clock-date');

    if (hHand) hHand.style.transform = `rotate(${hrAngle}deg)`;
    if (mHand) mHand.style.transform = `rotate(${minAngle}deg)`;
    if (sHand) sHand.style.transform = `rotate(${secAngle}deg)`;

    if (digital) {
        const hh = String(h).padStart(2, '0');
        const mm = String(m).padStart(2, '0');
        const ss = String(s).padStart(2, '0');
        digital.textContent = `${hh}:${mm}:${ss}`;
    }

    if (dateLabel) {
        const dateOpts = { weekday: 'long', day: 'numeric', month: 'long' };
        let dateStr = tzTime.toLocaleDateString('it-IT', dateOpts);
        dateLabel.textContent = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
    }
    
    // Only update the sidebar list when a new minute starts to prevent layout thrashing
    if (s === 0 && ms < 30) renderClockSidebar();
    
    clockFrameId = requestAnimationFrame(updateAppClock); 
}

// Initial boot
if (!clockFrameId) requestAnimationFrame(updateAppClock);


/**
 * =========================================================
 * 17B. CALENDAR PRO APP
 * Description: Dynamic grid rendering, event collision lanes,
 * and multi-day event management.
 * =========================================================
 */
let calendarDate = new Date();
let calendarEvents = JSON.parse(localStorage.getItem('webos_calendar')) || {}; 
let currentCalendarCategory = 'tutti'; 

const applePalette = ['#ff3b30', '#007aff', '#34c759', '#ff9f0a', '#af52de', '#ff2d55', '#5ac8fa', '#ffcc00', '#5856d6', '#a2845e'];
let calendarCategories = JSON.parse(localStorage.getItem('webos_cal_categories')) || {
    'personale': { name: 'Personale', color: '#ff3b30' },
    'lavoro': { name: 'Lavoro', color: '#007aff' }  
};

/**
 * Renders the calendar sidebar (Categories/Calendars).
 */
function renderCalendarSidebar() {
    const sidebar = document.querySelector('.calendar-sidebar');
    if (!sidebar) return;

    let html = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
            <h4 style="margin:0; font-size: 13px; opacity: 0.6; color: #fff; letter-spacing: 1px;">CALENDARI</h4>
            <span style="cursor: pointer; color: #fff; opacity: 0.6; font-size: 18px; line-height: 1; font-weight: bold; transition: 0.2s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.6" onclick="createNewCalendarCategory()" title="Nuovo Calendario">+</span>
        </div>
        <div class="sidebar-item ${currentCalendarCategory === 'tutti' ? 'active' : ''}" id="cal-cat-tutti" onclick="switchCalendarCategory('tutti')">
            <span style="color: #fff; margin-right: 8px; text-shadow: 0 0 5px rgba(255,255,255,0.5);">●</span> Tutti
        </div>
    `;

    for (const [catId, catData] of Object.entries(calendarCategories)) {
        const isActive = currentCalendarCategory === catId ? 'active' : '';
        html += `
            <div class="sidebar-item ${isActive}" id="cal-cat-${catId}" onclick="switchCalendarCategory('${catId}')" oncontextmenu="window.showCalendarContextMenu(event, '${catId}')">
                <span style="color: ${catData.color}; margin-right: 8px; text-shadow: 0 0 5px ${catData.color}80;">●</span> ${catData.name}
            </div>
        `;
    }
    sidebar.innerHTML = html;
}

window.createNewCalendarCategory = async function() {
    const result = await showMacDialog({ title: "Nuovo Calendario", showInput: "Nuovo Calendario", showSelect: false, okText: "Crea" });
    if (!result || !result.name) return;
    
    const catId = 'cal_' + Date.now();
    const randomColor = applePalette[Math.floor(Math.random() * applePalette.length)];
    
    calendarCategories[catId] = { name: result.name, color: randomColor };
    localStorage.setItem('webos_cal_categories', JSON.stringify(calendarCategories));
    renderCalendarSidebar();
}

window.showCalendarContextMenu = function(e, catId) {
    e.preventDefault(); e.stopPropagation();
    const contextMenu = document.getElementById("context-menu");
    if (!contextMenu) return;
    
    contextMenu.innerHTML = `<div class="context-item" style="color: var(--danger-color, #ff5f56);" onclick="window.deleteCalendarCategory('${catId}')">🗑️ Cancella Calendario</div>`;
    
    contextMenu.style.left = `${e.pageX}px`; 
    contextMenu.style.top = `${e.pageY}px`;
    contextMenu.style.display = "flex";
}

window.deleteCalendarCategory = async function(catId) {
    const contextMenu = document.getElementById("context-menu");
    if (contextMenu) contextMenu.style.display = "none";
    
    const catName = calendarCategories[catId].name;
    const isConfirmed = await showMacDialog({ 
        title: "Elimina Calendario", 
        text: `Vuoi eliminare "${catName}" e TUTTI i suoi eventi?`, 
        showInput: false, 
        showSelect: false, 
        okText: "Elimina" 
    });
    
    if (isConfirmed) {
        delete calendarCategories[catId];
        localStorage.setItem('webos_cal_categories', JSON.stringify(calendarCategories));
        
        // Cascade delete all events attached to this category
        for (let dKey in calendarEvents) {
            calendarEvents[dKey] = calendarEvents[dKey].filter(e => e.category !== catId);
            if (calendarEvents[dKey].length === 0) delete calendarEvents[dKey];
        }
        localStorage.setItem('webos_calendar', JSON.stringify(calendarEvents));
        
        if (currentCalendarCategory === catId) currentCalendarCategory = 'tutti';
        renderCalendarSidebar(); 
        renderCalendar();
    }
}

window.switchCalendarCategory = function(category) {
    currentCalendarCategory = category;
    renderCalendarSidebar(); 
    renderCalendar();
}

/**
 * Main grid renderer. Calculates multi-day event lanes to prevent 
 * visual collisions (e.g., overlapping UI tags).
 */
window.renderCalendar = function() {
    const grid = document.getElementById('calendar-grid');
    const monthYearLabel = document.getElementById('current-month-year');
    if (!grid || !monthYearLabel) return;
    
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const monthNames = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
    monthYearLabel.textContent = `${monthNames[month]} ${year}`;

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let startingDay = firstDay === 0 ? 6 : firstDay - 1;

    const prevMonthDays = new Date(year, month, 0).getDate();
    
    // Use DocumentFragment for massive performance boost during grid injection
    const fragment = document.createDocumentFragment();

    // Render previous month overflow
    for (let i = startingDay; i > 0; i--) {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'calendar-day other-month';
        dayDiv.innerHTML = `<div class="day-number">${prevMonthDays - i + 1}</div>`;
        fragment.appendChild(dayDiv);
    }

    let activeLanes = [];
    const today = new Date();

    // Render current month days
    for (let day = 1; day <= daysInMonth; day++) {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'calendar-day';
        
        const mm = String(month + 1).padStart(2, '0');
        const dd = String(day).padStart(2, '0');
        const dateKey = `${year}-${mm}-${dd}`;
        
        dayDiv.innerHTML = `<div class="day-number">${day}</div><div class="day-events"></div>`;

        if (day === today.getDate() && month === today.getMonth() && year === today.getFullYear()) {
            dayDiv.classList.add('today');
        }

        // --- Event Collision Engine ---
        if (calendarEvents[dateKey]) {
            const evCont = dayDiv.querySelector('.day-events');
            const multiDayEvents = calendarEvents[dateKey].filter(e => e.pos && e.pos !== 'single');
            const singleEvents = calendarEvents[dateKey].filter(e => !e.pos || e.pos === 'single');

            // Free up lanes whose events have ended
            for (let i = 0; i < activeLanes.length; i++) {
                if (activeLanes[i] && !multiDayEvents.some(e => e.id === activeLanes[i])) {
                    activeLanes[i] = null; 
                }
            }

            // Assign lanes to new multi-day events
            multiDayEvents.forEach(ev => {
                if (ev.category === currentCalendarCategory || currentCalendarCategory === 'tutti') {
                    if (!activeLanes.includes(ev.id)) {
                        let freeIndex = activeLanes.indexOf(null);
                        if (freeIndex === -1) activeLanes.push(ev.id); 
                        else activeLanes[freeIndex] = ev.id; 
                    }
                }
            });

            // Trim empty trailing lanes
            while(activeLanes.length > 0 && activeLanes[activeLanes.length - 1] === null) {
                activeLanes.pop();
            }

            // Render Multi-day tags preserving lane architecture
            activeLanes.forEach(laneEventId => {
                if (!laneEventId) {
                    evCont.innerHTML += `<div class="event-tag" style="visibility: hidden; pointer-events: none;">&nbsp;</div>`;
                } else {
                    let ev = multiDayEvents.find(e => e.id === laneEventId);
                    if (ev && (ev.category === currentCalendarCategory || currentCalendarCategory === 'tutti')) {
                        const catData = calendarCategories[ev.category] || { color: '#888' };
                        const displayTitle = (ev.pos === 'start') ? `${ev.time} - ${ev.title}` : '&nbsp;';
                        const tag = document.createElement('div');
                        
                        tag.className = `event-tag event-${ev.pos}`;
                        tag.style.cssText = `background: ${catData.color}; box-shadow: 0 2px 6px ${catData.color}66; border: 1px solid rgba(255,255,255,0.2); color: white;`;
                        tag.innerHTML = displayTitle;
                        tag.onclick = (e) => { e.stopPropagation(); window.openEditEvent(ev.id); };
                        
                        evCont.appendChild(tag);
                    } else {
                        evCont.innerHTML += `<div class="event-tag" style="visibility: hidden; pointer-events: none;">&nbsp;</div>`;
                    }
                }
            });

            // Render Single-day events below
            singleEvents.sort((a,b) => a.time.localeCompare(b.time)).forEach(ev => {
                if (ev.category === currentCalendarCategory || currentCalendarCategory === 'tutti') {
                    const catData = calendarCategories[ev.category] || { color: '#888' };
                    const tag = document.createElement('div');
                    
                    tag.className = `event-tag event-single`;
                    tag.style.cssText = `background: ${catData.color}; box-shadow: 0 2px 6px ${catData.color}66; border: 1px solid rgba(255,255,255,0.2); color: white;`;
                    tag.innerHTML = `${ev.time} - ${ev.title}`;
                    tag.onclick = (e) => { e.stopPropagation(); window.openEditEvent(ev.id); };
                    
                    evCont.appendChild(tag);
                }
            });
        }
        
        dayDiv.onclick = () => window.openCalendarPopup(dateKey);
        fragment.appendChild(dayDiv);
    }
    
    grid.innerHTML = '';
    grid.appendChild(fragment);
}

/**
 * Pre-populates the popup select input with active categories.
 */
function populateCategorySelect() {
    const select = document.getElementById('pop-ev-cat');
    if (!select) return;
    
    select.innerHTML = '';
    for (const [cId, cData] of Object.entries(calendarCategories)) {
        select.innerHTML += `<option value="${cId}">${cData.name}</option>`;
    }
}

/**
 * Initializes the hours dropdown for the new event popup.
 */
function initHourSelect() {
    const h = document.getElementById('pop-ev-hour');
    if (h && h.children.length === 0) {
        for(let i=0; i<24; i++) {
            let v = i.toString().padStart(2, '0');
            h.innerHTML += `<option value="${v}">${v}</option>`;
        }
    }
}

window.openCalendarPopup = function(dateKey) {
    const popup = document.getElementById('calendar-popup');
    if (!popup) return;
    
    initHourSelect(); 
    populateCategorySelect();
    
    document.getElementById('pop-ev-main-title').textContent = "Nuovo Evento";
    document.getElementById('pop-ev-id').value = "";
    document.getElementById('pop-btn-save').textContent = "Aggiungi Evento";
    document.getElementById('pop-btn-delete').style.display = "none";
    
    document.getElementById('pop-ev-start').value = dateKey;
    const dateParts = dateKey.split('-');
    document.getElementById('pop-ev-start-display').textContent = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
    document.getElementById('pop-ev-title').value = "";
    document.getElementById('pop-ev-hour').value = "09";
    document.getElementById('pop-ev-minute').value = "00";
    document.getElementById('pop-ev-duration').value = "0";
    document.getElementById('pop-ev-repeat').value = "mai";

    popup.style.display = 'flex';
    popup.style.top = '50%'; popup.style.left = '50%';
    popup.style.transform = 'translate(-50%, -50%)';
}

window.openEditEvent = function(eventId) {
    const popup = document.getElementById('calendar-popup');
    if (!popup) return;
    
    initHourSelect(); 
    populateCategorySelect();
    
    let foundEv = null; let startDate = "";
    for (let dKey in calendarEvents) {
        let ev = calendarEvents[dKey].find(e => e.id === eventId);
        if (ev) { 
            foundEv = ev; 
            if (ev.pos === 'start' || ev.pos === 'single' || !startDate) startDate = dKey; 
        }
    }
    if (!foundEv) return;

    let count = 0;
    for (let dKey in calendarEvents) {
        if (calendarEvents[dKey].some(e => e.id === eventId)) count++;
    }

    document.getElementById('pop-ev-main-title').textContent = "Modifica Evento";
    document.getElementById('pop-ev-id').value = eventId;
    document.getElementById('pop-btn-save').textContent = "Salva Modifiche";
    document.getElementById('pop-btn-delete').style.display = "block";

    document.getElementById('pop-ev-title').value = foundEv.title;
    document.getElementById('pop-ev-start').value = startDate;
    const dateParts = startDate.split('-');
    document.getElementById('pop-ev-start-display').textContent = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
    document.getElementById('pop-ev-hour').value = foundEv.time.split(':')[0];
    document.getElementById('pop-ev-minute').value = foundEv.time.split(':')[1];
    document.getElementById('pop-ev-duration').value = (count - 1).toString();
    document.getElementById('pop-ev-repeat').value = foundEv.repeat || "mai"; 
    document.getElementById('pop-ev-cat').value = calendarCategories[foundEv.category] ? foundEv.category : Object.keys(calendarCategories)[0];

    popup.style.display = 'flex';
    popup.style.top = '50%'; popup.style.left = '50%';
    popup.style.transform = 'translate(-50%, -50%)';
}

window.saveCalendarPopupEvent = async function() {
    const title = document.getElementById('pop-ev-title').value.trim();
    const idExist = document.getElementById('pop-ev-id').value;
    const startStr = document.getElementById('pop-ev-start').value;
    const dur = parseInt(document.getElementById('pop-ev-duration').value);
    const time = document.getElementById('pop-ev-hour').value + ":" + document.getElementById('pop-ev-minute').value;
    const cat = document.getElementById('pop-ev-cat').value;
    const repeat = document.getElementById('pop-ev-repeat').value;
    
    if(!title) { 
        await showMacDialog({ title: "Errore", text: "Il sistema richiede un titolo.", showInput: false, okText: "OK" }); 
        return; 
    }

    // Purge old event data before saving modified one
    if (idExist) {
        for (let dKey in calendarEvents) {
            calendarEvents[dKey] = calendarEvents[dKey].filter(e => e.id !== idExist);
            if (calendarEvents[dKey].length === 0) delete calendarEvents[dKey];
        }
    }

    const eventId = idExist || Date.now().toString();
    const startDateObj = new Date(startStr + 'T12:00:00');
    
    let maxIterations = 1;
    if (repeat === 'giorno') maxIterations = 365;
    if (repeat === 'settimana') maxIterations = 52;
    if (repeat === 'mese') maxIterations = 24;

    for (let j = 0; j < maxIterations; j++) {
        let baseDate = new Date(startDateObj);
        if (repeat === 'giorno') baseDate.setDate(baseDate.getDate() + j);
        if (repeat === 'settimana') baseDate.setDate(baseDate.getDate() + (j * 7));
        if (repeat === 'mese') baseDate.setMonth(baseDate.getMonth() + j);

        let occurrenceDates = [];
        for(let i = 0; i <= dur; i++) {
            let d = new Date(baseDate);
            d.setDate(d.getDate() + i);
            const yyyy = d.getFullYear();
            const mm = (d.getMonth() + 1).toString().padStart(2, '0');
            const dd = d.getDate().toString().padStart(2, '0');
            occurrenceDates.push(`${yyyy}-${mm}-${dd}`);
        }

        occurrenceDates.forEach((dKey, index) => {
            let pos = 'single';
            if (occurrenceDates.length > 1) {
                if (index === 0) pos = 'start';
                else if (index === occurrenceDates.length - 1) pos = 'end';
                else pos = 'middle';
            }
            if(!calendarEvents[dKey]) calendarEvents[dKey] = [];
            calendarEvents[dKey].push({ id: eventId, title: title, category: cat, time: time, pos: pos, repeat: repeat });
        });
    }

    localStorage.setItem('webos_calendar', JSON.stringify(calendarEvents));
    window.closeCalendarPopup(); 
    window.renderCalendar();
}

window.confirmDeleteFromPopup = async function() {
    const id = document.getElementById('pop-ev-id').value;
    if (id) {
        const userConfirmed = await showMacDialog({ title: "Elimina Evento", text: "Eliminare definitivamente questo evento?", showInput: false, okText: "Elimina" });
        if (userConfirmed) {
            for (let dKey in calendarEvents) {
                calendarEvents[dKey] = calendarEvents[dKey].filter(e => e.id !== id);
                if (calendarEvents[dKey].length === 0) delete calendarEvents[dKey]; 
            }
            localStorage.setItem('webos_calendar', JSON.stringify(calendarEvents));
            window.closeCalendarPopup(); 
            window.renderCalendar();
        }
    }
}

window.closeCalendarPopup = function() { 
    const popup = document.getElementById('calendar-popup');
    if (popup) popup.style.display = 'none'; 
}

window.changeMonth = function(offset) { 
    calendarDate.setMonth(calendarDate.getMonth() + offset); 
    window.renderCalendar(); 
}

window.jumpToToday = function() { 
    calendarDate = new Date(); 
    window.renderCalendar(); 
}

// Bind popup close action to window controls
document.querySelectorAll('#calendar-window .control').forEach(btn => {
    btn.addEventListener('click', () => { window.closeCalendarPopup(); });
});

setTimeout(renderCalendarSidebar, 200);

/**
 * =========================================================
 * 18. WEATHER APP (Satellite Radar & API Forecast)
 * Description: Fetches real-time weather data via Open-Meteo API
 * and handles the interactive forecast UI.
 * =========================================================
 */

/**
 * Registry of available weather locations with coordinates and timezones.
 * @constant {Object}
 */
const weatherCities = {
    cupertino: { lat: 37.3230, lon: -122.0322, tz: "America/Los_Angeles", name: "Cupertino" },
    roma: { lat: 41.8919, lon: 12.5113, tz: "Europe/Rome", name: "Roma" },
    londra: { lat: 51.5085, lon: -0.1257, tz: "Europe/London", name: "Londra" },
    tokyo: { lat: 35.6895, lon: 139.6917, tz: "Asia/Tokyo", name: "Tokyo" },
    parigi: { lat: 48.8534, lon: 2.3488, tz: "Europe/Paris", name: "Parigi" }
};

let currentCityKey = "cupertino";
let weatherDataCache = null;
let selectedDayIndex = 0;

// Cached DOM Nodes for performance
const weatherDescEl = document.getElementById('weather-desc');
const weatherTempEl = document.getElementById('weather-temp');
const weatherHeroImg = document.getElementById('weather-hero-img');

/**
 * Triggers a city change and initiates a new API fetch.
 * @param {string} cityKey - The key of the new city (e.g., 'roma').
 */
window.changeWeatherCity = function(cityKey) { 
    currentCityKey = cityKey; 
    fetchWeather(); 
}

/**
 * Fetches data from the Open-Meteo API and updates the cache.
 * @returns {Promise<void>}
 */
async function fetchWeather() {
    const loading = document.getElementById('weather-loading');
    const content = document.getElementById('weather-app-content');
    if (!loading || !content) return;
    
    loading.style.display = 'flex'; 
    content.style.display = 'none';
    const city = weatherCities[currentCityKey];

    try {
        const apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}&current_weather=true&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=${encodeURIComponent(city.tz)}`;
        const res = await fetch(apiUrl);
        weatherDataCache = await res.json();
        
        buildForecastPanel(); 
        renderWeatherHero(0); 
        
        loading.style.display = 'none'; 
        content.style.display = 'flex';
    } catch(e) {
        console.error("Weather API Fetch Error:", e);
        loading.innerHTML = `<span style="color: var(--danger-color, #ff5f56)">Errore di connessione API.<br>Riprova più tardi.</span>`;
    }
}

/**
 * Builds the horizontal scrollable forecast panel.
 * Optimized to use a single string builder to prevent layout thrashing.
 */
function buildForecastPanel() {
    const fcContainer = document.getElementById('weather-forecast-container');
    if (!fcContainer || !weatherDataCache) return;
    
    let htmlBuffer = "";
    
    for(let i = 1; i < weatherDataCache.daily.time.length; i++) {
        const date = new Date(weatherDataCache.daily.time[i]);
        const dayName = date.toLocaleDateString('it-IT', {weekday: 'short'}).toUpperCase();
        const maxT = Math.round(weatherDataCache.daily.temperature_2m_max[i]);
        const minT = Math.round(weatherDataCache.daily.temperature_2m_min[i]);
        const dCode = weatherDataCache.daily.weathercode[i];
        const iconName = getWeatherIconName(dCode, 1);
        
        htmlBuffer += `
            <div class="weather-day-vibe" id="weather-day-btn-${i}" onclick="window.handleWeatherClick(${i})">
                <span class="weather-day-name">${dayName}</span>
                <img src="assets/icon/weather/${iconName}.png" class="weather-icon-small" alt="${iconName}">
                <div class="weather-temp-range"><span class="max-t">${maxT}°</span><span class="min-t">${minT}°</span></div>
            </div>
        `;
    }
    
    fcContainer.innerHTML = htmlBuffer;
}

/**
 * Handles clicks on the forecast day buttons.
 * @param {number} dayIndex - The index of the selected day.
 */
window.handleWeatherClick = function(dayIndex) {
    if (selectedDayIndex === dayIndex) {
        // Toggle back to today if clicking the already active day
        renderWeatherHero(0);
    } else {
        renderWeatherHero(dayIndex);
    }
}

/**
 * Renders the main central "Hero" section of the weather app.
 * @param {number} dayIndex - 0 for current weather, >0 for forecast days.
 */
function renderWeatherHero(dayIndex) {
    if (!weatherDataCache || !weatherTempEl || !weatherDescEl || !weatherHeroImg) return;
    
    selectedDayIndex = dayIndex;

    // Update active state of forecast buttons
    for(let i = 1; i < weatherDataCache.daily.time.length; i++) {
        const btn = document.getElementById(`weather-day-btn-${i}`);
        if(btn) {
            if (i === dayIndex) btn.classList.add('active');
            else btn.classList.remove('active');
        }
    }

    if (dayIndex === 0) {
        // Render Today (Current Weather)
        const currentTemp = Math.round(weatherDataCache.current_weather.temperature);
        const code = weatherDataCache.current_weather.weathercode;
        const isDay = weatherDataCache.current_weather.is_day;
        
        weatherTempEl.textContent = currentTemp + '°';
        weatherDescEl.textContent = "Oggi • " + getWeatherDesc(code);
        weatherHeroImg.src = `assets/icon/weather/${getWeatherIconName(code, isDay)}.png`;
    } else {
        // Render Forecast Day
        const maxT = Math.round(weatherDataCache.daily.temperature_2m_max[dayIndex]);
        const minT = Math.round(weatherDataCache.daily.temperature_2m_min[dayIndex]);
        const code = weatherDataCache.daily.weathercode[dayIndex];
        const date = new Date(weatherDataCache.daily.time[dayIndex]);
        
        const dayName = date.toLocaleDateString('it-IT', {weekday: 'long'});
        const capitalizedDay = dayName.charAt(0).toUpperCase() + dayName.slice(1);

        weatherTempEl.textContent = maxT + '°'; 
        weatherDescEl.textContent = `${capitalizedDay} • ${getWeatherDesc(code)} (Min: ${minT}°)`;
        weatherHeroImg.src = `assets/icon/weather/${getWeatherIconName(code, 1)}.png`; 
    }
}

/**
 * Maps WMO Weather codes to local icon filenames.
 * @param {number} code - WMO weather code.
 * @param {number|boolean} isDay - 1/true if day, 0/false if night.
 * @returns {string} - The name of the icon file (without extension).
 */
function getWeatherIconName(code, isDay) {
    if(code === 0) return isDay ? "sereno" : "serenonotte";
    if(code === 1 || code === 2) return isDay ? "solecoperto" : "parzialmentenuvolosonotte";
    if(code === 3) return "nuvoloso";
    if(code === 45 || code === 48) return "nebbia";
    if(code >= 51 && code <= 55) return isDay ? "pioviggine" : "piovigginenotte";
    if(code === 61 || code === 63 || code === 80 || code === 81) return "pioggia";
    if(code === 65 || code === 82) return "fortepioggia";
    if(code === 71 || code === 73 || code === 77 || code === 85) return "neve";
    if(code === 75 || code === 86) return "fortinevicate";
    if(code >= 95) return "temporale";
    return "sereno";
}

/**
 * Maps WMO Weather codes to readable descriptions.
 * @param {number} code - WMO weather code.
 * @returns {string} - Italian textual description.
 */
function getWeatherDesc(code) {
    if(code <= 3) return "Sereno / Nuvoloso";
    if(code <= 48) return "Nebbia";
    if(code <= 67) return "Pioggia";
    if(code <= 77) return "Neve";
    if(code <= 82) return "Acquazzone";
    if(code >= 95) return "Temporale";
    return "Variabile";
}

// --- Custom City Dropdown Logic ---

window.toggleCityDropdown = function(e) {
    e.stopPropagation(); 
    const opts = document.getElementById('city-custom-options');
    if (opts) opts.classList.toggle('show');
}

window.selectCustomCity = function(cityKey, cityName) {
    const dropText = document.getElementById('custom-dropdown-text');
    const opts = document.getElementById('city-custom-options');
    
    if (dropText) dropText.textContent = cityName;
    if (opts) opts.classList.remove('show');
    
    window.changeWeatherCity(cityKey);
}

// Close custom dropdown when clicking outside
document.addEventListener('click', (e) => {
    const opts = document.getElementById('city-custom-options');
    if (opts && !e.target.closest('.custom-dropdown')) {
        opts.classList.remove('show');
    }
});
/**
 * =========================================================
 * 19. MUSIC APP ENGINE (Library, Player, 3D Playlist)
 * Description: Handles HTML5 Audio playback, grid rendering,
 * FLIP animations for drag&drop, and 3D radial interfaces.
 * =========================================================
 */

// --- 19.1. DATABASE & STATE ---
const musicDatabase = [
    // Album 1: Render Pipeline
    { id: 1, title: "Cybernetic Horizon", artist: "System Architect", album: "Render Pipeline", src: "assets/audio/1.mp3", cover: "assets/img/covers/1.png", fakeDur: "2:40" },
    { id: 4, title: "Array Out Of Bounds", artist: "System Architect", album: "Render Pipeline", src: "assets/audio/7.mp3", cover: "assets/img/covers/1.png", fakeDur: "2:47" },
    
    // Album 2: Memory Leak
    { id: 2, title: "Null Pointer", artist: "Core Dump", album: "Memory Leak", src: "assets/audio/4.mp3", cover: "assets/img/covers/2.png", fakeDur: "2:55" },
    
    // Album 3: Await
    { id: 3, title: "Asynchronous Love", artist: "The Promises", album: "Await", src: "assets/audio/8.mp3", cover: "assets/img/covers/3.png", fakeDur: "2:32" },
    { id: 7, title: "Event Loop", artist: "The Promises", album: "Await", src: "assets/audio/9.mp3", cover: "assets/img/covers/3.png", fakeDur: "2:40" },
    
    // Album 4: Runtime
    { id: 5, title: "Garbage Collection", artist: "V8 Engine", album: "Runtime", src: "assets/audio/5.mp3", cover: "assets/img/covers/4.png", fakeDur: "2:37" },
    { id: 8, title: "DOM Thrashing", artist: "V8 Engine", album: "Runtime", src: "assets/audio/6.mp3", cover: "assets/img/covers/4.png", fakeDur: "2:32" },
    
    // Album 5: Legacy
    { id: 9, title: "Callback Hell", artist: "Vanilla Scripters", album: "Legacy", src: "assets/audio/2.mp3", cover: "assets/img/covers/5.png", fakeDur: "2:31" },
    { id: 10, title: "Framework Fatigue", artist: "Vanilla Scripters", album: "Legacy", src: "assets/audio/10.mp3", cover: "assets/img/covers/5.png", fakeDur: "3:00" },
    
    // Album 6: Stack Overflow
    { id: 6, title: "Recursive Thoughts", artist: "Core Dump", album: "Stack Overflow", src: "assets/audio/3.mp3", cover: "assets/img/covers/6.png", fakeDur: "2:38" }
];

let currentMusicFilter = 'all'; 
let currentTrackIndex = -1;
let isMusicPlaying = false;
let lastVolume = 0.5;

const audioPlayer = new Audio();
audioPlayer.volume = 0.5;

// --- 19.2. AUDIO CONTROLS & LOGIC ---

/**
 * Toggles favorite status for a specific track.
 * @param {number} originalIndex - DB index of the track.
 * @param {Event} event - The click event to stop propagation.
 */
window.toggleFavorite = function(originalIndex, event) {
    event.stopPropagation(); 
    const track = musicDatabase[originalIndex];
    track.favorite = !track.favorite;
    
    const btn = event.currentTarget;
    if (track.favorite) {
        btn.innerHTML = `<img src="assets/icon/music/favoriteyes.png" class="is-fav" alt="Fav">`;
    } else {
        btn.innerHTML = `<img src="assets/icon/music/favoriteno.png" class="" alt="Fav">`;
        if (currentMusicFilter === 'favorites') {
            btn.closest('.music-track-row').style.display = 'none';
        }
    }
};

window.setMusicFilter = function(filterType) {
    if (currentMusicFilter === filterType) return;
    currentMusicFilter = filterType;
    
    try {
        if (window.event && window.event.currentTarget && window.event.currentTarget.classList.contains('music-nav-item')) {
            document.querySelectorAll('.music-nav-item').forEach(el => el.classList.remove('active'));
            window.event.currentTarget.classList.add('active');
        }
    } catch(e) {}

    if (filterType === 'albums') renderAlbumsView();
    else if (filterType === 'artists') renderArtistsView(); 
    else renderMusicLibrary();
};

window.musicTogglePlay = function() {
    if (currentTrackIndex === -1) {
        if (musicDatabase.length > 0) playMusicTrack(0);
        return;
    }
    if (isMusicPlaying) {
        audioPlayer.pause();
        isMusicPlaying = false;
    } else {
        audioPlayer.play().catch(e => console.error("Playback Error:", e));
        isMusicPlaying = true;
    }
    updateMusicPlayerUI();
}

window.musicNext = function() {
    if (currentTrackIndex < musicDatabase.length - 1) playMusicTrack(currentTrackIndex + 1);
    else playMusicTrack(0); 
}

window.musicPrev = function() {
    if (audioPlayer.currentTime > 3) {
        audioPlayer.currentTime = 0;
    } else {
        if (currentTrackIndex > 0) playMusicTrack(currentTrackIndex - 1);
        else playMusicTrack(musicDatabase.length - 1);
    }
}

/**
 * Initiates playback for a specific track.
 * @param {number} index - Database index of the track.
 */
function playMusicTrack(index) {
    if (currentTrackIndex === index && isMusicPlaying) return; 
    currentTrackIndex = index;
    const track = musicDatabase[index];
    
    audioPlayer.src = track.src;
    audioPlayer.play().catch(e => console.error("Failed to load audio:", e));
    isMusicPlaying = true;
    
    updateMusicPlayerUI();
    
    document.querySelectorAll('.music-track-row').forEach(row => {
        if (parseInt(row.dataset.trackIndex) === index) row.classList.add('playing');
        else row.classList.remove('playing');
    });
}

// --- 19.3. SEEKING & PROGRESS BAR ---
let isDraggingProgress = false;

window.startSeekMusic = function(e) {
    if (currentTrackIndex === -1 || isNaN(audioPlayer.duration)) return;
    isDraggingProgress = true;
    document.querySelector('.music-progress-bar-bg').classList.add('dragging');
    updateSeekMusic(e); 
    document.addEventListener('mousemove', updateSeekMusic);
    document.addEventListener('mouseup', endSeekMusic);
};

function updateSeekMusic(e) {
    if (!isDraggingProgress) return;
    const bar = document.querySelector('.music-progress-bar-bg');
    const rect = bar.getBoundingClientRect();
    let clickX = e.clientX - rect.left;
    
    if (clickX < 0) clickX = 0; 
    if (clickX > rect.width) clickX = rect.width;
    
    const percentage = clickX / rect.width;
    const fill = document.getElementById("music-progress-fill");
    fill.style.transition = 'none';
    fill.style.width = `${percentage * 100}%`;

    const previewTime = audioPlayer.duration * percentage;
    const currM = Math.floor(previewTime / 60);
    const currS = String(Math.floor(previewTime % 60)).padStart(2, '0');
    document.getElementById("music-time-curr").textContent = `${currM}:${currS}`;
}

function endSeekMusic(e) {
    if (!isDraggingProgress) return;
    isDraggingProgress = false;
    document.removeEventListener('mousemove', updateSeekMusic);
    document.removeEventListener('mouseup', endSeekMusic);
    document.querySelector('.music-progress-bar-bg').classList.remove('dragging');

    const bar = document.querySelector('.music-progress-bar-bg');
    const rect = bar.getBoundingClientRect();
    let clickX = e.clientX - rect.left;
    if (clickX < 0) clickX = 0; 
    if (clickX > rect.width) clickX = rect.width;
    
    const percentage = clickX / rect.width;
    document.getElementById("music-progress-fill").style.transition = 'width 0.1s linear';
    audioPlayer.currentTime = audioPlayer.duration * percentage;
}

audioPlayer.addEventListener('timeupdate', updateMusicTimeUI);
audioPlayer.addEventListener('ended', window.musicNext);
audioPlayer.addEventListener('loadedmetadata', updateMusicTimeUI);

// --- 19.4. UI RENDERERS (Library, Artists, Albums) ---

function renderArtistsView() {
    const listContainer = document.getElementById("music-track-list");
    if (!listContainer) return;
    listContainer.innerHTML = ""; 

    const uniqueArtists = [];
    musicDatabase.forEach(track => {
        if (!uniqueArtists.find(a => a.name === track.artist)) {
            uniqueArtists.push({ name: track.artist, cover: track.cover });
        }
    });

    const grid = document.createElement("div");
    grid.className = "artist-grid fade-in";
    
    const fragment = document.createDocumentFragment();
    
    uniqueArtists.forEach((artist, index) => {
        const card = document.createElement("div");
        let tetrisClass = "artist-square"; 
        
        // Distribuzione dinamica delle classi CSS della griglia
        if (index === 0) tetrisClass = "artist-hero"; 
        else if (index % 3 === 0) tetrisClass = "artist-horizontal"; 
        else if (index % 4 === 0) tetrisClass = "artist-vertical"; 

        card.className = `artist-card ${tetrisClass}`;
        card.onclick = () => {
            window.setMusicFilter('artist:' + artist.name);
            document.querySelectorAll('.music-nav-item').forEach(el => el.classList.remove('active'));
            document.querySelectorAll('.music-nav-item')[0].classList.add('active'); 
        };

        // Uso il cover SVG generato come background dell'artista
        card.innerHTML = `
            <div class="artist-card-bg" style="background-image: url(\"${artist.cover}\")"></div>
            <div class="artist-card-name">${artist.name}</div>
        `;
        fragment.appendChild(card);
    });
    
    grid.appendChild(fragment);
    listContainer.appendChild(grid);
}

function renderAlbumsView() {
    const listContainer = document.getElementById("music-track-list");
    if (!listContainer) return;
    listContainer.innerHTML = ""; 

    const uniqueAlbums = [];
    musicDatabase.forEach(track => {
        if (!uniqueAlbums.find(a => a.name === track.album)) {
            uniqueAlbums.push({ name: track.album, artist: track.artist, cover: track.cover });
        }
    });

    const grid = document.createElement("div");
    grid.className = "album-grid fade-in";
    const fragment = document.createDocumentFragment();
    
    uniqueAlbums.forEach(album => {
        const card = document.createElement("div");
        card.className = "album-card";
        card.onclick = () => {
            window.setMusicFilter('album:' + album.name);
            document.querySelectorAll('.music-nav-item').forEach(el => el.classList.remove('active'));
            document.querySelectorAll('.music-nav-item')[0].classList.add('active'); 
        };
        card.innerHTML = `
            <div class="album-card-cover" style="background-image: url('${album.cover}')"></div>
            <div class="album-card-title">${album.name}</div>
            <div class="album-card-artist">${album.artist}</div>
        `;
        fragment.appendChild(card);
    });
    
    grid.appendChild(fragment);
    listContainer.appendChild(grid);
}

function renderMusicLibrary() {
    const listContainer = document.getElementById("music-track-list");
    if (!listContainer) return;
    listContainer.innerHTML = ""; 

    const headerRow = document.createElement("div");
    headerRow.className = "music-track-header";
    headerRow.innerHTML = `
        <div class="music-track-num">#</div>
        <div style="width: 36px; margin-right: 12px; flex-shrink: 0;"></div> 
        <div class="music-track-info-list">Titolo</div>
        <div class="music-track-album">Album</div>
        <div class="music-track-favorite"></div>
        <div class="music-track-time">⏱</div>
    `;
    listContainer.appendChild(headerRow);

    const rowsContainer = document.createElement("div");
    rowsContainer.className = "fade-in-up"; 

    let tracksToRender = [];

    if (currentMusicFilter.startsWith('playlist:')) {
        const plName = currentMusicFilter.split(':')[1];
        const targetPl = customPlaylists.find(p => p.name === plName);
        if (targetPl) {
            tracksToRender = targetPl.tracks.map(id => ({ track: musicDatabase[id], originalIndex: id }));
        }
    } else {
        tracksToRender = musicDatabase.map((track, id) => ({ track: track, originalIndex: id })).filter(item => {
            if (currentMusicFilter === 'favorites' && !item.track.favorite) return false;
            if (currentMusicFilter.startsWith('album:') && item.track.album !== currentMusicFilter.split(':')[1]) return false;
            if (currentMusicFilter.startsWith('artist:') && item.track.artist !== currentMusicFilter.split(':')[1]) return false;
            return true;
        });
    }

    const fragment = document.createDocumentFragment();

    tracksToRender.forEach((item, displayIndex) => {
        const track = item.track;
        const originalIndex = item.originalIndex;
        const isFav = track.favorite ? true : false;
        const iconSrc = isFav ? 'assets/icon/music/favoriteyes.png' : 'assets/icon/music/favoriteno.png';
        const favClass = isFav ? 'is-fav' : '';

        const row = document.createElement("div");
        row.className = "music-track-row";
        row.dataset.trackIndex = originalIndex;
        if (originalIndex === currentTrackIndex) row.classList.add("playing");
        row.onclick = () => playMusicTrack(originalIndex);

        row.innerHTML = `
            <div class="music-track-num">${displayIndex + 1}</div>
            <div class="music-track-list-cover" style="background-image: url('${track.cover}')"></div>
            <div class="music-track-info-list">
                <div class="music-track-title-list">${track.title}</div>
                <div class="music-track-artist-list">${track.artist}</div>
            </div>
            <div class="music-track-album">${track.album || "Singolo"}</div>
            <div class="music-track-favorite" onclick="window.toggleFavorite(${originalIndex}, event)">
                <img src="${iconSrc}" class="${favClass}" alt="Fav">
            </div>
            <div class="music-track-time">${track.fakeDur || track.duration || "3:00"}</div>
        `;
        fragment.appendChild(row);
    });
    
    rowsContainer.appendChild(fragment);
    listContainer.appendChild(rowsContainer);
}

/**
 * Updates UI elements across all player instances (Main, Mid, Mini).
 */
function updateMusicPlayerUI() {
    if (currentTrackIndex === -1) return;
    const track = musicDatabase[currentTrackIndex];

    // Main Player
    const titleEl = document.getElementById("player-title");
    if (titleEl) {
        titleEl.textContent = track.title;
        titleEl.classList.remove("marquee-scroll"); 
        void titleEl.offsetWidth; 
        if (titleEl.scrollWidth > titleEl.parentElement.clientWidth) titleEl.classList.add("marquee-scroll"); 
    }

    const artistEl = document.getElementById("player-artist");
    if (artistEl) artistEl.textContent = track.artist;
    
    const coverEl = document.getElementById("player-cover");
    if (coverEl) coverEl.style.backgroundImage = `url('${track.cover}')`;
    
    const playBtn = document.getElementById("music-play-btn");
    if (playBtn) playBtn.innerHTML = isMusicPlaying ? "⏸" : "▶";

    // Mini Player
    const miniTitle = document.getElementById("mini-music-title");
    const miniCover = document.getElementById("mini-music-cover");
    const miniPlayBtn = document.getElementById("mini-play-btn");
    
    if (miniTitle) { miniTitle.textContent = track.title; miniTitle.classList.remove("marquee-scroll"); }
    if (miniCover) miniCover.style.backgroundImage = `url('${track.cover}')`;
    if (miniPlayBtn) miniPlayBtn.innerHTML = isMusicPlaying ? "⏸" : "▶";

    // Mid Player
    const midBg = document.getElementById("mid-player-bg");
    const midTitle = document.getElementById("mid-player-title");
    const midArtist = document.getElementById("mid-player-artist");
    const midPlayBtn = document.getElementById("mid-play-btn");

    if (midBg && track) midBg.style.backgroundImage = `url('${track.cover}')`;
    if (midTitle && track) midTitle.textContent = track.title;
    if (midArtist && track) midArtist.textContent = track.artist;
    if (midPlayBtn) midPlayBtn.innerHTML = isMusicPlaying ? "⏸" : "▶";

    const midVolSlider = document.getElementById('mid-volume-slider');
    if (midVolSlider) {
        const val = audioPlayer.volume * 100;
        midVolSlider.value = val;
        updateMidVolumeUI(val); 
    }
}

function updateMusicTimeUI() {
    if (currentTrackIndex === -1 || isNaN(audioPlayer.duration)) return;
    if (isDraggingProgress || isDraggingMidProgress) return;
    
    const currM = Math.floor(audioPlayer.currentTime / 60);
    const currS = String(Math.floor(audioPlayer.currentTime % 60)).padStart(2, '0');
    
    const currEl = document.getElementById("music-time-curr");
    if (currEl) currEl.textContent = `${currM}:${currS}`;

    const totM = Math.floor(audioPlayer.duration / 60);
    const totS = String(Math.floor(audioPlayer.duration % 60)).padStart(2, '0');
    
    const totEl = document.getElementById("music-time-tot");
    if (totEl) totEl.textContent = `${totM}:${totS}`;

    const percent = (audioPlayer.currentTime / audioPlayer.duration) * 100;
    const progFill = document.getElementById("music-progress-fill");
    if (progFill) progFill.style.width = `${percent}%`;

    // Mid Player Sync
    const midCurr = document.getElementById("mid-time-curr");
    const midTot = document.getElementById("mid-time-tot");
    const midFill = document.getElementById("mid-progress-fill");
    
    if (midCurr) midCurr.textContent = `${currM}:${currS}`;
    if (midTot) midTot.textContent = `${totM}:${totS}`;
    if (midFill) midFill.style.width = `${percent}%`;
}

// --- 19.5. VOLUME MANAGEMENT ---
window.toggleMute = function() {
    const volIcon = document.getElementById("volume-icon");
    const volSlider = document.getElementById("music-volume-slider");
    
    if (audioPlayer.volume > 0) {
        lastVolume = audioPlayer.volume;
        audioPlayer.volume = 0;
        if (volIcon) volIcon.textContent = "🔇";
        if (volSlider) { volSlider.value = 0; updateVolumeUI(0); }
    } else {
        audioPlayer.volume = lastVolume > 0 ? lastVolume : 0.5; 
        if (volIcon) volIcon.textContent = audioPlayer.volume > 0.5 ? "🔊" : "🔉";
        if (volSlider) { volSlider.value = audioPlayer.volume * 100; updateVolumeUI(volSlider.value); }
    }
};

function updateVolumeUI(val) {
    const volSlider = document.getElementById("music-volume-slider");
    if (volSlider) volSlider.style.background = `linear-gradient(to right, var(--accent-color, #0a84ff) ${val}%, var(--border-strong) ${val}%)`;
}

setTimeout(() => {
    const volSlider = document.getElementById("music-volume-slider");
    if (volSlider) {
        updateVolumeUI(volSlider.value); 
        volSlider.addEventListener('input', (e) => {
            const val = e.target.value;
            audioPlayer.volume = val / 100;
            updateVolumeUI(val);
            const volIcon = document.getElementById("volume-icon");
            if (volIcon) {
                if (val == 0) volIcon.textContent = "🔇";
                else if (val < 50) volIcon.textContent = "🔉";
                else volIcon.textContent = "🔊";
            }
        });
    }
}, 500);

window.restoreMusicApp = function() {
    const win = document.getElementById("music-window");
    if (win) {
        win.style.display = "flex"; 
        win.classList.add("show");
        if(typeof bringToFront === 'function') bringToFront(win);
    }
};

// --- TOP BAR RADAR (Optimized) ---
// Caches DOM elements to prevent thrashing in the interval
let radarMini, radarWin, radarMid;
setTimeout(() => {
    radarMini = document.getElementById("top-bar-music-controls");
    radarWin = document.getElementById("music-window");
    radarMid = document.getElementById("mid-music-player");
}, 1000);

setInterval(() => {
    if (currentTrackIndex === -1 || !radarMini || !radarWin) return;
    const isMidActive = radarMid && radarMid.classList.contains('show');

    if (radarWin.style.display === "none" && !isMidActive) {
        radarMini.classList.add("show-widget");
    } else {
        radarMini.classList.remove("show-widget");
    }
}, 500);

// --- 19.6. 3D PLAYLIST CREATOR (Radial Engine & FLIP Drag/Drop) ---
let customPlaylists = []; 
let tempPlaylistName = "";
let tempSelectedTracks = [];

let isPlaylistDOMReady = false;
let playlistOrbitFrame;
let playlistScrollTarget = 0;
let playlistScrollCurrent = -15; 
let playlistTracks = [];
let isDraggingCircle = false;
let dragStartX = 0;
let dragStartTarget = 0;

function buildPlaylistDOMOnce() {
    if (isPlaylistDOMReady) return;
    const container = document.getElementById('playlist-circle-container');
    const overlay = document.getElementById('playlist-creator-overlay');
    if (!container || !overlay) return;
    
    container.innerHTML = '';
    playlistTracks = [];

    const btn = document.querySelector('.liquid-glass-btn');
    if(btn) btn.style.zIndex = '50';

    const fragment = document.createDocumentFragment();

    musicDatabase.forEach((track, index) => {
        const cover = document.createElement('div');
        cover.className = 'circle-track-cover';
        cover.style.backgroundImage = `url('${track.cover}')`;
        cover.innerHTML = `<div class="circle-track-title">${track.title}</div>`;
        
        cover.onclick = function() {
            if (tempSelectedTracks.includes(index)) {
                tempSelectedTracks = tempSelectedTracks.filter(id => id !== index);
                this.classList.remove('selected');
            } else {
                tempSelectedTracks.push(index);
                this.classList.add('selected');
            }
            updateSelectionListUI(); 
        };

        fragment.appendChild(cover);
        playlistTracks.push({ el: cover, index: index });
    });
    container.appendChild(fragment);

    // Physics Engine Events
    container.onwheel = (e) => { 
        e.preventDefault(); 
        playlistScrollTarget += e.deltaY * 0.015; 
        clampPlaylistScroll(); 
        let hint = document.getElementById('playlist-scroll-hint');
        if(hint) hint.style.opacity = '0';
    };
    
    container.onmousedown = (e) => {
        if(e.target.closest('.liquid-glass-btn')) return;
        isDraggingCircle = true; 
        dragStartX = e.clientX; 
        dragStartTarget = playlistScrollTarget; 
        container.style.cursor = 'grabbing';
        let hint = document.getElementById('playlist-scroll-hint');
        if(hint) hint.style.opacity = '0';
    };
    
    window.onmousemove = (e) => {
        if (!isDraggingCircle) return;
        const deltaX = e.clientX - dragStartX; 
        playlistScrollTarget = dragStartTarget - (deltaX * 0.03); 
        clampPlaylistScroll();
    };
    
    window.onmouseup = () => { 
        isDraggingCircle = false; 
        container.style.cursor = 'default'; 
    };

    // Pre-calculate CSS positions silently
    overlay.style.transition = 'none'; 
    overlay.style.opacity = '0.001'; 
    overlay.style.display = 'flex'; 
    overlay.style.zIndex = '-9999';

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            overlay.style.display = 'none'; 
            overlay.style.zIndex = '9999'; 
            overlay.style.opacity = '0';
            overlay.style.transition = "opacity 0.6s ease, backdrop-filter 0.6s ease"; 
            isPlaylistDOMReady = true;
        });
    });
}
setTimeout(buildPlaylistDOMOnce, 1000);

window.openPlaylistCreator = function() {
    const dialogOverlay = document.getElementById('mac-dialog-overlay');
    const titleEl = document.getElementById('mac-dialog-title');
    const inputEl = document.getElementById('mac-dialog-input');
    const btnOk = document.getElementById('mac-btn-ok');

    if (titleEl) titleEl.textContent = "Nuova Playlist";
    document.getElementById('mac-dialog-text').style.display = 'none';
    document.getElementById('mac-dialog-row-input').style.display = 'flex';
    document.getElementById('mac-dialog-row-select').style.display = 'none'; 
    
    if (inputEl) {
        inputEl.value = ""; 
        inputEl.placeholder = "Es. Gym Mode...";
    }
    
    if (btnOk) btnOk.textContent = "Crea Playlist";
    document.getElementById('mac-btn-cancel').style.display = "block";

    if (dialogOverlay) dialogOverlay.style.display = 'flex';
    if (inputEl) inputEl.focus();

    if (btnOk) {
        btnOk.onclick = function() {
            const val = inputEl.value.trim();
            if (val === "") { inputEl.style.border = "1px solid var(--system-red, #ff3b30)"; return; }
            inputEl.style.border = ""; 
            dialogOverlay.style.display = 'none';
            startPlaylistSelection(val); 
        };
    }
    
    document.getElementById('mac-btn-cancel').onclick = function() { 
        if (inputEl) inputEl.style.border = ""; 
        if (dialogOverlay) dialogOverlay.style.display = 'none'; 
    };
};

function startPlaylistSelection(name) {
    tempPlaylistName = name; 
    tempSelectedTracks = [];
    
    playlistTracks.forEach(item => {
        item.el.classList.remove('selected'); 
        item.el.style.transition = 'none'; 
        item.el.style.opacity = '0';
    });
    
    const titleEl = document.getElementById('playlist-creator-title');
    if (titleEl) {
        titleEl.textContent = tempPlaylistName; 
        titleEl.style.color = "var(--text-main)";    
    }
    
    const overlay = document.getElementById('playlist-creator-overlay');
    if (overlay) {
        overlay.style.display = 'flex'; 
        void overlay.offsetWidth; 
        overlay.style.opacity = '1';
    }
    
    const btn = document.querySelector('.liquid-glass-btn');
    if(btn) {
        btn.style.transition = "none"; 
        btn.style.transform = 'translate(-50%, -50%) scale(1)';
        btn.style.opacity = '1'; 
        btn.textContent = "CREA PLAYLIST"; 
        btn.onclick = window.saveCustomPlaylist; 
    }

    let scrollHint = document.getElementById('playlist-scroll-hint');
    if (!scrollHint && overlay) {
        scrollHint = document.createElement('div');
        scrollHint.id = 'playlist-scroll-hint';
        scrollHint.style.cssText = 'position: absolute; top: calc(50% + 40px); left: 50%; transform: translateX(-50%); color: rgba(255,255,255,0.4); font-size: 20px; z-index: 49; pointer-events: none; transition: opacity 0.3s;';
        scrollHint.innerHTML = `<style>@keyframes bounceHint { 0%, 100% { transform: translate(-50%, 0); } 50% { transform: translate(-50%, 5px); } }</style><div style="animation: bounceHint 2s infinite ease-in-out;">↕</div>`;
        overlay.appendChild(scrollHint);
    }
    if (scrollHint) scrollHint.style.opacity = '1';

    updateSelectionListUI(); 
    playlistScrollTarget = -15; 
    playlistScrollCurrent = -15; 
    if (playlistOrbitFrame) cancelAnimationFrame(playlistOrbitFrame);
    updatePlaylistOrbit(); 

    setTimeout(() => {
        playlistTracks.forEach(item => item.el.style.transition = ""); 
        playlistScrollTarget = 0; 
    }, 50);
}

window.closePlaylistCreator = function() {
    const overlay = document.getElementById('playlist-creator-overlay');
    if (!overlay) return;
    
    overlay.style.transition = "opacity 0.6s ease, backdrop-filter 0.6s ease"; 
    overlay.style.opacity = "0"; 
    overlay.style.backdropFilter = "blur(0px)";
    
    if (playlistOrbitFrame) cancelAnimationFrame(playlistOrbitFrame);
    
    const list = document.getElementById('playlist-selection-list');
    const hint = document.getElementById('playlist-scroll-hint');
    if (list) list.style.opacity = '0'; 
    if (hint) hint.style.opacity = '0';
    
    setTimeout(() => {
        overlay.style.display = 'none'; 
        overlay.style.transition = ""; 
        overlay.style.backdropFilter = ""; 
        if (list) list.innerHTML = ''; 
    }, 600);
};

function clampPlaylistScroll() {
    const maxScroll = Math.max(0, musicDatabase.length - 1);
    if (playlistScrollTarget < -0.5) playlistScrollTarget = -0.5;
    if (playlistScrollTarget > maxScroll + 0.5) playlistScrollTarget = maxScroll + 0.5;
}

function updatePlaylistOrbit() {
    playlistScrollCurrent += (playlistScrollTarget - playlistScrollCurrent) * 0.08;

    if (!isDraggingCircle) {
        const maxScroll = Math.max(0, musicDatabase.length - 1);
        if (playlistScrollCurrent < 0) playlistScrollTarget = 0;
        if (playlistScrollCurrent > maxScroll) playlistScrollTarget = maxScroll;
    }

    const radiusX = 260; 
    const radiusY = 200; 

    playlistTracks.forEach(item => {
        const offset = item.index - playlistScrollCurrent;

        if (Math.abs(offset) > 7) { 
            item.el.style.opacity = 0; 
            item.el.style.pointerEvents = 'none'; 
        } else { 
            item.el.style.pointerEvents = 'auto'; 
        }

        const angleRad = offset * (Math.PI / 6);
        const sinA = Math.sin(angleRad); 
        const cosA = Math.cos(angleRad); 

        const x = sinA * radiusX; 
        const y = cosA * radiusY; 
        const zDepth = cosA; 

        let op = 1 - Math.pow(Math.abs(offset) / 6.5, 2.5);
        if (zDepth < -0.2) op *= Math.max(0, (zDepth + 1) * 1.5); 

        const scale3D = 0.6 + 0.4 * ((zDepth + 1) / 2);
        item.el.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(${scale3D})`;
        
        if (Math.abs(offset) <= 7) item.el.style.opacity = Math.max(0, Math.min(1, op));
        item.el.style.zIndex = Math.round(zDepth * 100) + 50; 
    });

    playlistOrbitFrame = requestAnimationFrame(updatePlaylistOrbit);
}

window.saveCustomPlaylist = function() {
    if (tempSelectedTracks.length === 0) {
        const title = document.getElementById('playlist-creator-title');
        if (title) {
            title.style.color = "var(--danger-color, #ff0436)"; 
            setTimeout(() => title.style.color = "var(--text-main)", 500);
        }
        return;
    }
    
    playlistScrollTarget = playlistScrollCurrent; 
    isDraggingCircle = false;
    
    if (playlistOrbitFrame) cancelAnimationFrame(playlistOrbitFrame);
    
    const btn = document.querySelector('.liquid-glass-btn');
    if(btn) { 
        btn.style.transition = "all 0.4s cubic-bezier(0.5, 0, 0, 1)"; 
        btn.style.transform = 'translate(-50%, -50%) scale(0)'; 
        btn.style.opacity = '0'; 
    }
    
    const hint = document.getElementById('playlist-scroll-hint');
    if (hint) hint.style.opacity = '0';

    playlistTracks.forEach((item) => {
        item.el.style.transition = "all 0.5s cubic-bezier(0.25, 1, 0.5, 1)"; 
        item.el.style.opacity = '0'; 
        item.el.style.transform += " scale(0.3) translateY(-80px)";
    });
    
    setTimeout(() => {
        customPlaylists.push({ name: tempPlaylistName, tracks: [...tempSelectedTracks] });
        renderSidebarPlaylists(); 
        window.closePlaylistCreator(); 
    }, 400); 
};

function renderSidebarPlaylists() {
    const container = document.getElementById('custom-playlists-container');
    if (!container) return;
    
    const fragment = document.createDocumentFragment();
    
    customPlaylists.forEach(pl => {
        const item = document.createElement('div');
        item.className = 'music-nav-item custom-playlist-item fade-in'; 
        item.dataset.playlistName = pl.name; 
        item.innerHTML = `<span style="margin-right:12px; font-size: 16px; color: var(--accent-color, #0a84ff);">▶</span> ${pl.name}`;
        
        item.onclick = (e) => {
            window.setMusicFilter('playlist:' + pl.name);
            document.querySelectorAll('.music-nav-item').forEach(el => el.classList.remove('active'));
            e.currentTarget.classList.add('active');
        };
        fragment.appendChild(item);
    });
    
    container.innerHTML = '';
    container.appendChild(fragment);
}

// --- FLIP Animation Drag & Drop List ---
let draggedPlaylistIndex = null; 
let flipPositions = {}; 

function updateSelectionListUI() {
    let listContainer = document.getElementById('playlist-selection-list');
    
    if (!listContainer) {
        listContainer = document.createElement('div');
        listContainer.id = 'playlist-selection-list';
        listContainer.style.cssText = `position: absolute; top: 80px; left: 30px; display: flex; flex-direction: column; gap: 8px; width: 250px; max-height: calc(100vh - 160px); overflow-y: auto; z-index: 100; pointer-events: auto; background: var(--bg-window); backdrop-filter: blur(25px); -webkit-backdrop-filter: blur(25px); border: 1px solid var(--border-subtle); border-radius: 16px; padding: 15px; box-shadow: var(--shadow-window); transition: background 0.3s, border-color 0.3s;`;
        listContainer.classList.add('music-main-area'); 
        const overlay = document.getElementById('playlist-creator-overlay');
        if (overlay) overlay.appendChild(listContainer);
        listContainer.addEventListener('wheel', (e) => e.stopPropagation());
        listContainer.addEventListener('mousedown', (e) => e.stopPropagation());
    }

    const currentItems = listContainer.querySelectorAll('.playlist-drag-item');
    currentItems.forEach(el => flipPositions[el.dataset.trackId] = el.getBoundingClientRect().top );
    
    listContainer.style.opacity = '1'; 
    listContainer.innerHTML = ''; 

    if (tempSelectedTracks.length === 0) {
        listContainer.innerHTML = '<span style="display: block; font-size: 11px; color: var(--text-muted); font-weight: 700; letter-spacing: 1px; text-align: center; margin-top: 5px;">NESSUN BRANO SELEZIONATO</span>';
        return;
    }

    const titleObj = document.createElement('div');
    titleObj.style.cssText = `position: sticky; top: -15px; margin: -15px -15px 8px -15px; padding: 15px 15px 10px 15px; background: var(--bg-window); backdrop-filter: blur(15px); -webkit-backdrop-filter: blur(15px); z-index: 10; font-size: 11px; color: var(--drag-line); font-weight: 700; letter-spacing: 1px; text-align: center; text-transform: uppercase; border-bottom: 1px solid var(--border-subtle); border-radius: 16px 16px 0 0; transition: background 0.3s, color 0.3s;`;
    titleObj.textContent = `Brani Selezionati (${tempSelectedTracks.length})`;
    listContainer.appendChild(titleObj);
    
    tempSelectedTracks.forEach((trackIndex, arrayIndex) => {
        const track = musicDatabase[trackIndex];
        const item = document.createElement('div');
        
        item.className = "fade-in playlist-drag-item";
        item.dataset.trackId = trackIndex; 
        item.style.cssText = 'display: flex; align-items: center; gap: 12px; padding: 8px 10px; border-radius: 10px; cursor: grab;';
        item.draggable = true;
        
        item.innerHTML = `
            <div style="width: 32px; height: 32px; border-radius: 6px; background-image: url('${track.cover}'); background-size: cover; flex-shrink: 0; box-shadow: 0 2px 8px rgba(0,0,0,0.5); pointer-events: none;"></div>
            <div style="overflow: hidden; display: flex; flex-direction: column; justify-content: center; pointer-events: none; flex-grow: 1;">
                <div style="font-size: 13px; font-weight: 600; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.2;">${track.title}</div>
                <div style="font-size: 11px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px;">${track.artist}</div>
            </div>
            <div style="color: var(--text-subtle); font-size: 18px; line-height: 1; padding: 0 5px; pointer-events: none;">≡</div>
        `;

        item.addEventListener('dragstart', function(e) { 
            draggedPlaylistIndex = arrayIndex; 
            this.style.opacity = '0.4'; 
            e.dataTransfer.effectAllowed = 'move'; 
            e.dataTransfer.setData('text/plain', arrayIndex); 
        });
        
        item.addEventListener('dragover', function(e) { 
            e.preventDefault(); 
            e.dataTransfer.dropEffect = 'move'; 
            const bounding = this.getBoundingClientRect(); 
            if (e.clientY - bounding.top > bounding.height / 2) { 
                this.style.setProperty('border-bottom', '2px solid var(--drag-line)', 'important');
                this.style.setProperty('border-top', '1px solid var(--drag-border)', 'important');
            } else { 
                this.style.setProperty('border-top', '2px solid var(--drag-line)', 'important');
                this.style.setProperty('border-bottom', '1px solid var(--drag-border)', 'important');
            } 
        });
        
        item.addEventListener('dragleave', function() { 
            this.style.setProperty('border-top', '1px solid var(--drag-border)', 'important');
            this.style.setProperty('border-bottom', '1px solid var(--drag-border)', 'important');
        });
        
        item.addEventListener('drop', function(e) {
            e.preventDefault(); e.stopPropagation(); 
            this.style.setProperty('border-top', '1px solid var(--drag-border)', 'important');
            this.style.setProperty('border-bottom', '1px solid var(--drag-border)', 'important');
            
            if (draggedPlaylistIndex === null) return;
            
            let targetIndex = arrayIndex;
            if (e.clientY - this.getBoundingClientRect().top > this.getBoundingClientRect().height / 2) targetIndex++; 
            if (draggedPlaylistIndex < targetIndex) targetIndex--; 
            
            if (draggedPlaylistIndex !== targetIndex) { 
                const trackId = tempSelectedTracks.splice(draggedPlaylistIndex, 1)[0]; 
                tempSelectedTracks.splice(targetIndex, 0, trackId); 
                updateSelectionListUI(); 
            }
        });
        
        item.addEventListener('dragend', function() { 
            this.style.opacity = '1'; 
            draggedPlaylistIndex = null; 
            document.querySelectorAll('#playlist-selection-list > div').forEach(el => { 
                el.style.setProperty('border-top', '1px solid var(--drag-border)', 'important');
                el.style.setProperty('border-bottom', '1px solid var(--drag-border)', 'important');
            }); 
        });
        
        listContainer.appendChild(item);
    });

    // FLIP Animation Execution
    const newItems = listContainer.querySelectorAll('.playlist-drag-item');
    newItems.forEach(el => {
        const oldTop = flipPositions[el.dataset.trackId];
        if (oldTop !== undefined) {
            const deltaY = oldTop - el.getBoundingClientRect().top;
            if (deltaY !== 0) { 
                el.style.transform = `translateY(${deltaY}px)`; 
                el.style.transition = 'none'; 
                void el.offsetHeight; 
                el.style.transition = 'transform 0.4s cubic-bezier(0.39, 0.575, 0.565, 1), opacity 0.2s'; 
                el.style.transform = 'translateY(0)'; 
            }
        }
    });
    flipPositions = {}; 
}

// --- 19.7. MID PLAYER DRAGGABLE ---
let isDraggingMid = false; 
let startX, startY, initialLeft, initialTop;

window.toggleMidPlayer = function() {
    const midPlayer = document.getElementById('mid-music-player');
    const mainPlayer = document.getElementById('music-window');
    const miniPlayer = document.getElementById('top-bar-music-controls');
    const mainCover = document.getElementById('player-cover'); 

    if (!midPlayer) return;
    
    if (midPlayer.classList.contains('show')) {
        if(mainPlayer) { mainPlayer.style.display = 'flex'; mainPlayer.classList.add('show'); }
        if(mainCover) mainCover.classList.remove('cover-active-glow'); 
        midPlayer.classList.remove('show'); 
        midPlayer.style.opacity = '0'; 
        midPlayer.style.transform = 'translateY(30px) scale(0.95)';
        setTimeout(() => { midPlayer.style.display = 'none'; }, 400);
    } else {
        if(mainPlayer) { mainPlayer.style.display = 'none'; mainPlayer.classList.remove('show'); }
        if(miniPlayer) miniPlayer.classList.remove('show-widget');
        if(mainCover) mainCover.classList.add('cover-active-glow'); 
        midPlayer.style.display = 'flex'; 
        void midPlayer.offsetWidth; 
        midPlayer.classList.add('show'); 
        midPlayer.style.opacity = '1'; 
        midPlayer.style.transform = 'translateY(0) scale(1)';
    }
};

const midPlayerEl = document.getElementById('mid-music-player');
if (midPlayerEl) {
    midPlayerEl.addEventListener('mousedown', function(e) {
        if (e.target.closest('.mid-btn') || e.target.id === 'mid-close-btn' || e.target.id === 'mid-volume-slider' || e.target.id === 'mid-progress-bg') return;
        isDraggingMid = true; 
        this.style.transition = 'none'; 
        startX = e.clientX; 
        startY = e.clientY;
        const rect = this.getBoundingClientRect(); 
        initialLeft = rect.left; 
        initialTop = rect.top;
        document.addEventListener('mousemove', dragMoveMid); 
        document.addEventListener('mouseup', dragStopMid);
    });
}

function dragMoveMid(e) {
    if (!isDraggingMid) return;
    const midPlayer = document.getElementById('mid-music-player');
    if (!midPlayer) return;
    const dx = e.clientX - startX; 
    const dy = e.clientY - startY;
    midPlayer.style.left = (initialLeft + dx) + 'px'; 
    midPlayer.style.top = (initialTop + dy) + 'px';
}

function dragStopMid() {
    isDraggingMid = false; 
    const midPlayer = document.getElementById('mid-music-player');
    if(midPlayer) { 
        midPlayer.style.transition = "opacity 0.3s ease, transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)"; 
    }
    document.removeEventListener('mousemove', dragMoveMid); 
    document.removeEventListener('mouseup', dragStopMid);
}

function attachMidPlayerTriggers() {
    const mainCover = document.getElementById('player-cover');
    const miniCover = document.getElementById('mini-music-cover');
    if (mainCover) { 
        mainCover.style.cursor = 'pointer'; 
        mainCover.onclick = (e) => { e.stopPropagation(); window.toggleMidPlayer(); }; 
    }
    if (miniCover) { 
        miniCover.onclick = (e) => { e.stopPropagation(); window.toggleMidPlayer(); }; 
    }
}
setTimeout(attachMidPlayerTriggers, 1000);

setTimeout(() => {
    const midVolSlider = document.getElementById('mid-volume-slider');
    if (midVolSlider) {
        midVolSlider.value = audioPlayer.volume * 100;
        midVolSlider.addEventListener('input', (e) => {
            const val = e.target.value; 
            const vol = val / 100; 
            audioPlayer.volume = vol; 
            updateMidVolumeUI(val);
            
            const mainVolSlider = document.getElementById('music-volume-slider');
            if (mainVolSlider) { mainVolSlider.value = val; updateVolumeUI(val); }
            
            const icon = document.getElementById('mid-volume-icon');
            if (icon) { 
                if (val == 0) icon.textContent = "🔇"; 
                else if (val < 50) icon.textContent = "🔉"; 
                else icon.textContent = "🔊"; 
            }
        });
    }
}, 1000);

function updateMidVolumeUI(val) {
    const midSlider = document.getElementById('mid-volume-slider');
    if (midSlider) midSlider.style.background = `linear-gradient(to right, var(--accent-color, #0a84ff) ${val}%, rgba(255,255,255,0.2) ${val}%)`;
}

let isDraggingMidProgress = false;

window.startSeekMid = function(e) {
    if (currentTrackIndex === -1 || isNaN(audioPlayer.duration)) return;
    isDraggingMidProgress = true; 
    updateSeekMid(e); 
    document.addEventListener('mousemove', updateSeekMid); 
    document.addEventListener('mouseup', endSeekMid);
};

function updateSeekMid(e) {
    if (!isDraggingMidProgress) return;
    const bar = document.getElementById('mid-progress-bg');
    if (!bar) return;
    const rect = bar.getBoundingClientRect(); 
    let clickX = e.clientX - rect.left;
    if (clickX < 0) clickX = 0; 
    if (clickX > rect.width) clickX = rect.width;
    
    const percentage = clickX / rect.width;
    const fill = document.getElementById("mid-progress-fill");
    if (fill) {
        fill.style.transition = 'none'; 
        fill.style.width = `${percentage * 100}%`;
    }
}

function endSeekMid(e) {
    if (!isDraggingMidProgress) return;
    isDraggingMidProgress = false; 
    document.removeEventListener('mousemove', updateSeekMid); 
    document.removeEventListener('mouseup', endSeekMid);
    
    const bar = document.getElementById('mid-progress-bg'); 
    if (!bar) return;
    const rect = bar.getBoundingClientRect(); 
    let clickX = e.clientX - rect.left;
    
    if (clickX < 0) clickX = 0; 
    if (clickX > rect.width) clickX = rect.width;
    const percentage = clickX / rect.width;
    
    const fill = document.getElementById("mid-progress-fill"); 
    if (fill) fill.style.transition = 'width 0.1s linear';
    
    audioPlayer.currentTime = audioPlayer.duration * percentage;
}

// Initialize Library
setTimeout(() => { 
    const list = document.getElementById("music-track-list"); 
    if (list) renderMusicLibrary(); 
}, 500);
/**
 * =========================================================
 * 20. REMINDERS APP (Advanced Task Manager)
 * Description: Manages tasks, filtering, custom lists, and
 * the Inspector modal for detailed task editing.
 * =========================================================
 */
let remindersData = [
    { id: 1, text: "Presentare WebOS alla WWDC 2026", completed: false, list: 'lavoro' },
    { id: 2, text: "Aggiornare CSS del Mid Player", completed: true, list: 'personale' }
];

let remindersLists = {
    'personale': { name: 'Personale', color: '#ff3b30' },
    'lavoro': { name: 'Lavoro', color: '#0a84ff' }
};

let currentRemFilter = 'tutti'; 

/**
 * Renders the sidebar containing system and custom reminder lists.
 */
window.renderRemindersSidebar = function() {
    const todayStr = new Date().toISOString().split('T')[0];
    
    // Calculate counters
    let countTutti = 0;
    let countOggi = 0;
    
    remindersData.forEach(t => {
        if (!t.completed) {
            countTutti++;
            if (t.date === todayStr) countOggi++;
        }
    });

    const elCountTutti = document.getElementById('rem-count-tutti');
    const elCountOggi = document.getElementById('rem-count-oggi');
    if (elCountTutti) elCountTutti.textContent = countTutti;
    if (elCountOggi) elCountOggi.textContent = countOggi;
    
    const listCont = document.getElementById('rem-custom-lists');
    if (!listCont) return;
    
    const fragment = document.createDocumentFragment();
    
    for (let id in remindersLists) {
        const list = remindersLists[id];
        const count = remindersData.filter(t => t.list === id && !t.completed).length;
        const isActive = currentRemFilter === id ? 'active' : '';
        
        const div = document.createElement('div');
        div.className = `rem-list-item ${isActive}`;
        div.onclick = () => window.setRemindersFilter(id);
        div.oncontextmenu = (e) => window.showRemListContextMenu(e, id);
        
        div.innerHTML = `
            <span style="color: ${list.color}; margin-right: 12px; font-size: 14px; text-shadow: 0 0 8px ${list.color}cc;">●</span>
            <span style="flex:1;">${escapeHTML(list.name)}</span>
            <span style="color: rgba(255,255,255,0.4); font-weight: 600; font-size: 12px;">${count}</span>
        `;
        fragment.appendChild(div);
    }
    
    listCont.innerHTML = '';
    listCont.appendChild(fragment);
}

/**
 * Creates a new custom reminder list.
 */
window.createNewReminderList = async function() {
    const result = await showMacDialog({ 
        title: "Nuovo Elenco", 
        showInput: "Nuovo Elenco", 
        showSelect: false, 
        okText: "Crea" 
    });
    
    if (!result || !result.name) return;
    
    const listName = result.name.trim();
    if (!listName) return;

    const listId = 'list_' + Date.now();
    const colors = ['#ff3b30', '#007aff', '#34c759', '#ff9f0a', '#af52de', '#ff2d55', '#5ac8fa', '#ffcc00', '#5856d6'];
    
    remindersLists[listId] = { 
        name: listName, 
        color: colors[Math.floor(Math.random() * colors.length)] 
    };
    
    window.renderRemindersSidebar();
}

/**
 * Shows the context menu for deleting a reminder list.
 */
window.showRemListContextMenu = function(e, listId) {
    e.preventDefault(); e.stopPropagation();
    const contextMenu = document.getElementById("context-menu");
    if (!contextMenu) return;

    contextMenu.innerHTML = `<div class="context-item" style="color: var(--danger-color, #ff5f56);" onclick="window.deleteReminderList('${listId}')">🗑️ Elimina Elenco</div>`;
    contextMenu.style.left = `${e.pageX}px`; 
    contextMenu.style.top = `${e.pageY}px`; 
    contextMenu.style.display = "flex";
}

/**
 * Deletes a reminder list and all its associated tasks.
 */
window.deleteReminderList = async function(listId) {
    const contextMenu = document.getElementById("context-menu");
    if (contextMenu) contextMenu.style.display = "none";
    
    const listData = remindersLists[listId];
    if (!listData) return;

    const isConfirmed = await showMacDialog({ 
        title: "Elimina Elenco", 
        text: `Vuoi eliminare "${listData.name}" e tutti i suoi promemoria?`, 
        showInput: false, 
        okText: "Elimina" 
    });
    
    if (isConfirmed) {
        delete remindersLists[listId];
        remindersData = remindersData.filter(t => t.list !== listId);
        
        if (currentRemFilter === listId) {
            window.setRemindersFilter('tutti');
        } else {
            window.renderRemindersSidebar(); 
            window.renderRemindersTasks();
        }
    }
}

/**
 * Changes the current filter view for tasks.
 */
window.setRemindersFilter = function(filter) {
    currentRemFilter = filter;
    let titleColor = 'var(--accent-color, #0a84ff)'; 
    let titleText = 'Tutti';
    
    if (filter === 'oggi') { 
        titleText = 'Oggi'; 
    } else if (remindersLists[filter]) { 
        titleText = remindersLists[filter].name; 
        titleColor = remindersLists[filter].color; 
    }

    const titleEl = document.getElementById('rem-current-list-title');
    if (titleEl) {
        titleEl.textContent = titleText; 
        titleEl.style.color = titleColor;
    }
    
    window.renderRemindersSidebar(); 
    window.renderRemindersTasks();
}

/**
 * Renders the tasks based on the active filter.
 * Uses a DocumentFragment to minimize DOM reflows.
 */
window.renderRemindersTasks = function() {
    const container = document.getElementById('rem-tasks-container');
    if (!container) return;
    
    const todayStr = new Date().toISOString().split('T')[0];
    let filteredTasks = [];
    
    // Filter logic
    if (currentRemFilter === 'tutti') {
        filteredTasks = [...remindersData];
    } else if (currentRemFilter === 'oggi') {
        filteredTasks = remindersData.filter(t => t.date === todayStr);
    } else {
        filteredTasks = remindersData.filter(t => t.list === currentRemFilter);
    }
    
    // Sort: incomplete first
    filteredTasks.sort((a,b) => (a.completed === b.completed ? 0 : a.completed ? 1 : -1));
    
    const fragment = document.createDocumentFragment();

    filteredTasks.forEach(task => {
        const row = document.createElement('div');
        row.className = 'rem-task-row fade-in';
        let badgesHtml = '';
        
        if (currentRemFilter === 'tutti' || currentRemFilter === 'oggi') {
            const listData = remindersLists[task.list];
            if (listData) {
                badgesHtml += `<span class="rem-badge" style="color: ${listData.color}; border-color: ${listData.color}40; background: ${listData.color}15;">● ${escapeHTML(listData.name)}</span>`;
            }
        }

        if (task.date) {
            const isOverdue = task.date < todayStr && !task.completed;
            const displayDate = task.date.split('-').reverse().join('/');
            badgesHtml += `<span class="rem-badge ${isOverdue ? 'overdue' : ''}">📅 ${displayDate}</span>`;
        }
        
        if (task.location) badgesHtml += `<span class="rem-badge">📍 ${escapeHTML(task.location)}</span>`;
        if (task.notes) badgesHtml += `<span class="rem-badge">📝 Note</span>`;

        row.innerHTML = `
            <div class="rem-checkbox ${task.completed ? 'checked' : ''}" onclick="window.toggleReminder(${task.id})"></div>
            <div class="rem-task-content">
                <input type="text" class="rem-task-text ${task.completed ? 'completed' : ''}" value="${escapeHTML(task.text)}" onchange="window.updateReminderText(${task.id}, this.value)">
                ${badgesHtml ? `<div class="rem-badges-container">${badgesHtml}</div>` : ''}
            </div>
            <div class="rem-info-btn" onclick="window.openRemInspector(${task.id})" title="Dettagli">i</div>
        `;
        fragment.appendChild(row);
    });
    
    container.innerHTML = '';
    container.appendChild(fragment);
}

/**
 * Toggles a task's completed state.
 */
window.toggleReminder = function(id) {
    const task = remindersData.find(t => t.id === id);
    if (task) task.completed = !task.completed;
    window.renderRemindersSidebar(); 
    window.renderRemindersTasks();
}

/**
 * Updates a task's text directly from the list input.
 */
window.updateReminderText = function(id, newText) {
    const task = remindersData.find(t => t.id === id);
    if (task && newText.trim()) task.text = newText.trim();
}

/**
 * Adds a new task to the currently selected list.
 */
window.addNewReminder = function() {
    const remInput = document.getElementById('rem-new-task-input');
    if (!remInput || !remInput.value.trim()) return;
    
    const text = remInput.value.trim();
    // Default to first list if viewing "All" or "Today"
    const listId = (currentRemFilter === 'tutti' || currentRemFilter === 'oggi') ? Object.keys(remindersLists)[0] : currentRemFilter;
    const newId = Date.now();
    
    remindersData.push({ id: newId, text: text, completed: false, list: listId });
    remInput.value = ''; 
    
    window.renderRemindersSidebar(); 
    window.renderRemindersTasks();
    window.openRemInspector(newId);
};

// --- Inspector Modal Logic ---

window.openRemInspector = function(id) {
    const task = remindersData.find(t => t.id === id);
    if (!task) return;
    
    document.getElementById('rem-insp-id').value = task.id;
    document.getElementById('rem-insp-title').value = task.text || "";
    document.getElementById('rem-insp-notes').value = task.notes || "";
    document.getElementById('rem-insp-date').value = task.date || "";
    document.getElementById('rem-insp-location').value = task.location || "";

    const listSelect = document.getElementById('rem-insp-list');
    if (listSelect) {
        listSelect.innerHTML = '';
        for (let listId in remindersLists) {
            const opt = document.createElement('option');
            opt.value = listId; 
            opt.textContent = remindersLists[listId].name; 
            opt.style.background = 'var(--bg-menu, #1e1e1e)'; 
            opt.style.color = 'var(--text-main, #fff)';
            listSelect.appendChild(opt);
        }
        listSelect.value = task.list || Object.keys(remindersLists)[0];
    }

    const overlay = document.getElementById('rem-inspector-overlay');
    const modal = document.getElementById('rem-inspector');
    if (overlay && modal) {
        overlay.style.display = 'flex'; 
        void overlay.offsetWidth; 
        overlay.style.opacity = '1'; 
        modal.style.transform = 'scale(1)';
    }
}

window.closeRemInspector = function() {
    const overlay = document.getElementById('rem-inspector-overlay');
    const modal = document.getElementById('rem-inspector');
    if (!overlay || !modal) return;

    overlay.style.opacity = '0'; 
    modal.style.transform = 'scale(0.9)';
    setTimeout(() => { overlay.style.display = 'none'; }, 200);
}

window.saveRemInspector = function() {
    const idInput = document.getElementById('rem-insp-id');
    if (!idInput) return;
    
    const id = parseInt(idInput.value);
    const task = remindersData.find(t => t.id === id);
    if (!task) return;
    
    task.text = document.getElementById('rem-insp-title').value.trim();
    task.notes = document.getElementById('rem-insp-notes').value.trim();
    task.date = document.getElementById('rem-insp-date').value;
    task.location = document.getElementById('rem-insp-location').value.trim();
    task.list = document.getElementById('rem-insp-list').value;
    
    window.closeRemInspector(); 
    window.renderRemindersSidebar(); 
    window.renderRemindersTasks();
}

window.deleteReminderFromInspector = function() {
    const idInput = document.getElementById('rem-insp-id');
    if (!idInput) return;
    
    const id = parseInt(idInput.value);
    remindersData = remindersData.filter(t => t.id !== id);
    
    window.closeRemInspector(); 
    window.renderRemindersSidebar(); 
    window.renderRemindersTasks();
}

// Initialize Reminders App inputs
setTimeout(() => {
    const remInput = document.getElementById('rem-new-task-input');
    const remAddBtnGlass = document.getElementById('rem-add-btn-glass'); 
    
    if (remInput) {
        remInput.addEventListener('keypress', (e) => { 
            if(e.key === 'Enter') window.addNewReminder(); 
        });
    }
    if (remAddBtnGlass) {
        remAddBtnGlass.addEventListener('click', window.addNewReminder);
    }
}, 500);

/**
 * =========================================================
 * 21. MAPS APP (Leaflet / CartoDB Voyager)
 * Description: Renders interactive maps and handles geocoding
 * queries via OpenStreetMap Nominatim.
 * =========================================================
 */
let currentMapLat = 41.8902; 
let currentMapLon = 12.4922;
let currentMapZoom = 12;
let isMapLoaded = false;
let mapInstance = null;
let mapMarker = null;

/**
 * Queries OSM Nominatim API to convert a location name into coordinates.
 * @param {string} query - The location to search for.
 * @param {number} zoom - Target zoom level upon successful fetch.
 */
window.goToMapLocation = async function(query, zoom = 14) {
    const inputEl = document.getElementById('maps-search-input');
    if (inputEl) inputEl.value = query;
    
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
        const data = await response.json();
        
        if (data && data.length > 0) {
            currentMapLat = parseFloat(data[0].lat);
            currentMapLon = parseFloat(data[0].lon);
            currentMapZoom = zoom;
            updateMapRender();
        } else {
            showMacAlert("Località non trovata.");
        }
    } catch(e) { 
        console.error("Geocoding Error:", e); 
        showMacAlert("Errore di connessione al server delle mappe.");
    }
}

/**
 * Adjusts the map zoom level.
 * @param {number} delta - Positive integer to zoom in, negative to zoom out.
 */
window.zoomMap = function(delta) {
    if (!mapInstance) return;
    currentMapZoom += delta;
    currentMapZoom = Math.max(2, Math.min(19, currentMapZoom));
    mapInstance.setZoom(currentMapZoom);
}

/**
 * Initializes or updates the Leaflet map instance and marker.
 */
function updateMapRender() {
    // Ensure Leaflet library is loaded before attempting to render
    if (typeof L === 'undefined') {
        console.error("Leaflet library not loaded. Cannot render map.");
        return;
    }

    if (!mapInstance) {
        // Initialize Map
        mapInstance = L.map('maps-view', { zoomControl: false }).setView([currentMapLat, currentMapLon], currentMapZoom);
        
        // Add Tiles (CartoDB Voyager)
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; OSM contributors &copy; CARTO',
            subdomains: 'abcd',
            maxZoom: 19
        }).addTo(mapInstance);
    } else {
        // Smoothly fly to new coordinates
        mapInstance.flyTo([currentMapLat, currentMapLon], currentMapZoom, { animate: true, duration: 1.5 });
    }

    // Handle Marker
    if (mapMarker) mapInstance.removeLayer(mapMarker);

    const customIcon = L.icon({
        iconUrl: 'assets/icon/general/marker.svg',
        iconSize: [38, 38], 
        iconAnchor: [19, 38], 
        popupAnchor: [0, -38], 
        shadowUrl: '' 
    });

    mapMarker = L.marker([currentMapLat, currentMapLon], {icon: customIcon}).addTo(mapInstance);
    isMapLoaded = true;
    
    // Critical: Tell Leaflet the container size might have changed (e.g. window opened)
    setTimeout(() => { if (mapInstance) mapInstance.invalidateSize(); }, 400);
}

// Setup Maps Search Event Listener
setTimeout(() => {
    const searchInput = document.getElementById('maps-search-input');
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const val = searchInput.value.trim();
                if (val) window.goToMapLocation(val, 14);
            }
        });
    }
}, 1000);
/**
 * =========================================================
 * 22. DESKTOP ENGINE & MULTI-SELECTION (Marquee Tool)
 * Description: Renders desktop icons, handles cross-environment
 * drag & drop (Desktop <-> Finder), and the selection box.
 * =========================================================
 */

const desktopIconsContainer = document.getElementById("desktop-icons-container");

/**
 * Generates a 3D hologram for multi-file drag operations.
 * Renders off-screen to force GPU rasterization before setting as drag image.
 * @param {number} count - Number of items being dragged.
 * @param {Array<string>} itemSources - Array of image source URLs for the stack.
 * @returns {HTMLElement} - The generated ghost DOM node.
 */
window.createDragGhost = function(count, itemSources) {
    const ghost = document.createElement('div');
    ghost.id = 'drag-ghost';
    
    // Positioned off-screen to prevent layout flashes while forcing GPU render
    ghost.style.position = 'absolute';
    ghost.style.top = '0px'; 
    ghost.style.left = '-2000px';
    ghost.style.pointerEvents = 'none';
    ghost.style.zIndex = '999999';

    let stackHtml = '';
    const stackCount = Math.min(count, 3); // Max 3 items in the visual stack
    
    for(let i = 0; i < stackCount; i++) {
        const src = itemSources[i] || itemSources[0];
        stackHtml += `<img src="${src}" style="position:absolute; top:${i*6}px; left:${i*6}px; width:45px; height:45px; object-fit:contain; border-radius:4px; filter:drop-shadow(0 4px 8px rgba(0,0,0,0.5));">`;
    }

    // Red notification badge
    stackHtml += `<div style="position:absolute; top:-8px; right:-15px; background:var(--danger-color, #ff3b30); color:white; font-size:13px; font-weight:bold; padding:2px 8px; border-radius:12px; border:2px solid rgba(255,255,255,0.9); box-shadow: 0 2px 5px rgba(0,0,0,0.4); z-index:10;">${count}</div>`;

    ghost.innerHTML = `<div style="position:relative; width:65px; height:65px;">${stackHtml}</div>`;
    document.body.appendChild(ghost);
    return ghost;
};

/**
 * Renders the desktop environment, computing grid physics for new icons.
 */
window.renderDesktop = function() {
    if (!desktopIconsContainer) return;
    desktopIconsContainer.innerHTML = "";
    
    const homeFolder = fileSystem["Home"].contents;
    let defaultX = window.innerWidth - 100;
    let defaultY = 40;
    
    // Batch DOM mutations
    const fragment = document.createDocumentFragment();

    for (const [itemName, itemData] of Object.entries(homeFolder)) {
        const div = document.createElement("div");
        div.className = "desktop-item";
        div.setAttribute("draggable", "true");

        // Calculate physical placement if missing
        if (itemData.x === undefined || itemData.y === undefined) {
            const freePos = getFreeDesktopPosition(defaultX, defaultY);
            itemData.x = freePos.x;
            itemData.y = freePos.y;
            defaultY += 100;
        }

        div.style.left = itemData.x + "px";
        div.style.top = itemData.y + "px";

        // Icon Resolution Engine
        let iconHtml;
        if (itemData.type === 'folder') {
            iconHtml = `<img src="assets/icon/folders/${itemData.iconColor || 'blue'}.png" class="fs-icon" style="width: 45px; height: 45px; object-fit: contain; pointer-events: none; margin-bottom: 5px;">`;
        } else if (itemData.type === 'shortcut') {
            iconHtml = `<img src="${itemData.iconSrc}" class="fs-icon" style="width: 45px; height: 45px; object-fit: contain; pointer-events: none; margin-bottom: 5px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));">`;
        } else if (isImage(itemName)) {
            if (itemData.content && itemData.content.includes('/')) {
                iconHtml = `<img src="${itemData.content}" class="fs-icon" style="width: 45px; height: 45px; object-fit: cover; border-radius: 4px; pointer-events: none; margin-bottom: 5px;" onerror="this.src='assets/icon/general/file.png'">`;
            } else {
                iconHtml = `<img src="assets/icon/general/file.png" class="fs-icon" style="width: 45px; height: 45px; object-fit: contain; pointer-events: none; margin-bottom: 5px;">`;
            }
        } else {
            iconHtml = `<img src="assets/icon/general/file.png" class="fs-icon" style="width: 45px; height: 45px; object-fit: contain; pointer-events: none; margin-bottom: 5px;">`;
        }

        div.innerHTML = `${iconHtml}<div class="fs-name" style="color: white; text-shadow: 0 1px 3px black, 0 1px 3px black; text-align: center; font-size: 12px; margin-top: 5px;">${escapeHTML(itemName)}</div>`;

        // --- 1. DRAG START: Multi-Selection & Ghost ---
        div.addEventListener("dragstart", (e) => {
            if (!div.classList.contains('selected')) {
                if (typeof window.clearSelection === 'function') window.clearSelection();
                div.classList.add('selected');
            }
            
            const selectedItems = [];
            const primaryRect = div.getBoundingClientRect();
            const selectedNodes = document.querySelectorAll('.desktop-item.selected');
            
            selectedNodes.forEach(el => {
                const elName = el.querySelector('.fs-name').textContent;
                const elRect = el.getBoundingClientRect();
                selectedItems.push({
                    name: elName,
                    relX: elRect.left - primaryRect.left, 
                    relY: elRect.top - primaryRect.top
                });
                el.style.opacity = '0.2'; // Dim physical icons
            });

            // Generate multi-item hologram
            if (selectedNodes.length > 1) {
                const itemSources = Array.from(selectedNodes).map(node => node.querySelector('img').src);
                const ghost = window.createDragGhost(selectedNodes.length, itemSources);
                e.dataTransfer.setDragImage(ghost, 25, 25);
                setTimeout(() => { if (ghost && ghost.parentNode) ghost.remove(); }, 100);
            }

            e.dataTransfer.setData("text/plain", JSON.stringify({
                source: "desktop",
                isMulti: true,
                items: selectedItems,
                offsetX: e.clientX - primaryRect.left,
                offsetY: e.clientY - primaryRect.top
            }));
        });

        div.addEventListener("dragend", () => {
            document.querySelectorAll('.desktop-item').forEach(el => el.style.opacity = '1');
        });

        // --- 2. DOUBLE CLICK EXECUTION ---
        div.addEventListener("dblclick", (e) => {
            e.stopPropagation();
            if (itemData.type === "folder") {
                const finderWin = document.getElementById("finder-window");
                if (finderWin && !finderWin.classList.contains("show")) {
                    finderWin.style.display = "flex"; void finderWin.offsetWidth; finderWin.classList.add("show");
                }
                if(finderWin) bringToFront(finderWin);
                navigateTo(["Home", itemName]);
            } else if (itemData.type === "shortcut") {
                const winId = apps[itemData.content];
                if (winId) {
                    const win = document.getElementById(winId);
                    if (win) {
                        win.style.display = 'flex'; void win.offsetWidth; win.classList.add('show');
                        bringToFront(win);
                        setAppRunningState(win.id, true);
                    }
                }
            } else if (itemData.type === "file") {
                if (isImage(itemName)) openImagePreview(itemName, itemData.content);
                else openFileInEditor(itemName, itemData, homeFolder);
            }
        });

        // --- 3. DROP ON FOLDERS ---
        if (itemData.type === "folder") {
            div.addEventListener("dragover", (e) => {
                e.preventDefault(); e.stopPropagation();
                div.style.backgroundColor = "rgba(0, 122, 255, 0.3)"; div.style.borderRadius = "5px";
            });
            
            div.addEventListener("dragleave", () => { div.style.backgroundColor = ""; });
            
            div.addEventListener("drop", (e) => {
                e.preventDefault(); e.stopPropagation(); div.style.backgroundColor = "";
                try {
                    const data = JSON.parse(e.dataTransfer.getData("text/plain"));
                    if (!data || !data.name || data.name === itemName) return;
                    
                    const sourceFolder = data.source === "desktop" ? homeFolder : getFolderByPath(currentPath);
                    if (sourceFolder && sourceFolder[data.name]) {
                        if (!homeFolder[itemName].contents) homeFolder[itemName].contents = {};
                        homeFolder[itemName].contents[data.name] = sourceFolder[data.name];
                        
                        delete homeFolder[itemName].contents[data.name].x;
                        delete homeFolder[itemName].contents[data.name].y;
                        delete sourceFolder[data.name];
                        
                        window.renderDesktop(); 
                        if (typeof renderFinder === 'function') renderFinder();
                    }
                } catch (err) { console.warn("Desktop Folder Drop Error"); }
            });
        }
        fragment.appendChild(div);   
    }
    
    desktopIconsContainer.appendChild(fragment);
    if (typeof renderSidebar === 'function') renderSidebar();
};

window.renderDesktop(); // Initial boot render


/**
 * =========================================================
 * 22.5 CROSS-ENVIRONMENT DRAG & DROP & MARQUEE TOOL
 * =========================================================
 */
const desktopZone = document.getElementById("desktop");
const finderContentZone = document.getElementById("finder-content");

if (desktopZone) {
    desktopZone.addEventListener("dragover", (e) => { e.preventDefault(); });

    desktopZone.addEventListener('drop', (e) => {
        e.preventDefault(); 
        if (e.target.closest('.window') || e.target.closest('#dock-container')) return; 
        
        try {
            const data = JSON.parse(e.dataTransfer.getData('text/plain'));
            const homeFolder = fileSystem['Home'].contents; 
            const currentFolder = getFolderByPath(currentPath);
            const itemsToProcess = data.isMulti ? data.items : [{name: data.name, relX: 0, relY: 0}];
            
            let baseDropX = e.clientX - (data.offsetX || 0); 
            let baseDropY = e.clientY - 28 - (data.offsetY || 0);
            
            itemsToProcess.forEach(item => {
                const itemName = item.name;
                if (data.source === 'desktop') {
                    let finalX = baseDropX + (item.relX || 0); 
                    let finalY = baseDropY + (item.relY || 0);
                    if (finalX < 0) finalX = 0; 
                    if (finalY < 0) finalY = 0;
                    if (homeFolder[itemName]) {
                        homeFolder[itemName].x = finalX; 
                        homeFolder[itemName].y = finalY; 
                    }
                } else if (data.source === 'finder') {
                    if (currentFolder && currentFolder[itemName] && currentPath.join('/') !== 'Home') {
                        homeFolder[itemName] = currentFolder[itemName];
                        const freePos = getFreeDesktopPosition(e.clientX - 37, e.clientY - 28 - 37);
                        homeFolder[itemName].x = freePos.x; 
                        homeFolder[itemName].y = freePos.y;
                        delete currentFolder[itemName]; 
                    }
                }
            });
            
            if (data.source === 'finder' && typeof updateTrashIcon === 'function') updateTrashIcon(); 
            window.renderDesktop(); 
            if (typeof renderFinder === 'function') renderFinder();
        } catch(err) { console.warn("Desktop Space Drop Error"); }
    });
}

if(finderContentZone) {
    finderContentZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        finderContentZone.style.boxShadow = "inset 0 0 0 3px rgba(0, 122, 255, 0.5)";
    });
    
    finderContentZone.addEventListener("dragleave", () => { 
        finderContentZone.style.boxShadow = "none"; 
    });

    finderContentZone.addEventListener('drop', (e) => {
        e.preventDefault(); 
        finderContentZone.style.boxShadow = 'none';
        
        try {
            const data = JSON.parse(e.dataTransfer.getData('text/plain'));
            if (data.source !== 'desktop') return; 
            
            const homeFolder = fileSystem['Home'].contents; 
            const currentFolder = getFolderByPath(currentPath);
            const itemsToProcess = data.isMulti ? data.items : [{name: data.name}];
            
            itemsToProcess.forEach(item => {
                const itemName = item.name;
                if (homeFolder[itemName] && currentPath.join('/') !== 'Home') {
                    if (currentPath[0] === 'Trash') {
                        homeFolder[itemName].originalSource = 'desktop';
                        homeFolder[itemName].originalPath = null;
                    }
                    if (currentFolder) currentFolder[itemName] = homeFolder[itemName]; 
                    delete homeFolder[itemName]; 
                }
            });
            
            if (typeof updateTrashIcon === 'function') updateTrashIcon(); 
            window.renderDesktop(); 
            if (typeof renderFinder === 'function') renderFinder();
        } catch(err) { console.warn("Finder Space Drop Error"); }
    });
}

// --- MARQUEE SELECTION TOOL (Optimized Dynamics) ---
const selectionBox = document.getElementById('selection-box') || document.createElement('div');
selectionBox.id = 'selection-box';
if (!document.getElementById('selection-box') && desktopZone) {
    desktopZone.appendChild(selectionBox);
}

let isMarqueeSelecting = false;
let startMarqueeX = 0, startMarqueeY = 0;
let cachedItems = []; 
let marqueeFrameId = null;
let selectionSelector = '.desktop-item';

/**
 * Universal selection clearing utility.
 */
window.clearSelection = function() {
    document.querySelectorAll('.desktop-item.selected, .fs-item.selected').forEach(item => item.classList.remove('selected'));
};
window.clearDesktopSelection = window.clearSelection; // Backwards compatibility hook

// 1. DYNAMIC EVENT BINDING (CPU/Memory Optimization)
function onMarqueeMove(e) {
    if (!isMarqueeSelecting) return;
    
    if (!marqueeFrameId) {
        marqueeFrameId = requestAnimationFrame(() => {
            const currentX = e.clientX; 
            const currentY = e.clientY;
            const left = Math.min(startMarqueeX, currentX);
            const top = Math.min(startMarqueeY, currentY);
            const width = Math.abs(startMarqueeX - currentX);
            const height = Math.abs(startMarqueeY - currentY);

            selectionBox.style.left = left + 'px'; 
            selectionBox.style.top = top + 'px';
            selectionBox.style.width = width + 'px'; 
            selectionBox.style.height = height + 'px';

            const rectSel = { left, top, right: left + width, bottom: top + height };

            cachedItems.forEach(item => {
                const isOverlapping = !(rectSel.right < item.left || rectSel.left > item.right || rectSel.bottom < item.top || rectSel.top > item.bottom);
                if (isOverlapping) item.el.classList.add('selected'); 
                else item.el.classList.remove('selected');
            });
            
            marqueeFrameId = null;
        });
    }
}

function onMarqueeUp() {
    if (isMarqueeSelecting) {
        isMarqueeSelecting = false;
        selectionBox.style.display = 'none';
        cachedItems = []; // Flush RAM cache
    }
    // Detach listeners to prevent passive CPU drain
    document.removeEventListener('mousemove', onMarqueeMove);
    document.removeEventListener('mouseup', onMarqueeUp);
}

// Attach starting trigger
document.addEventListener('mousedown', (e) => {
    // Ignore invalid triggers (right click, UI elements, etc)
    if (e.button !== 0 || e.target.closest('.window-header') || e.target.closest('.window-controls') || e.target.closest('.finder-sidebar') || e.target.closest('#dock-container') || e.target.closest('#top-bar') || e.target.closest('#context-menu')) {
        return;
    }

    if (e.target.closest('.desktop-item.selected') || e.target.closest('.fs-item.selected')) return;

    if (e.target.closest('.desktop-item') || e.target.closest('.fs-item')) {
        window.clearSelection();
        return;
    }

    const isDesktop = e.target.id === 'desktop' || e.target.id === 'desktop-icons-container';
    const isFinder = e.target.id === 'finder-content' || e.target.classList.contains('finder-grid');

    if (isDesktop || isFinder) {
        isMarqueeSelecting = true;
        startMarqueeX = e.clientX; 
        startMarqueeY = e.clientY;
        
        selectionSelector = isDesktop ? '.desktop-item' : '#finder-content .fs-item';

        selectionBox.style.left = startMarqueeX + 'px'; 
        selectionBox.style.top = startMarqueeY + 'px';
        selectionBox.style.width = '0px'; 
        selectionBox.style.height = '0px';
        selectionBox.style.display = 'block';

        window.clearSelection();

        // Spatially cache targeted items
        cachedItems = Array.from(document.querySelectorAll(selectionSelector)).map(item => {
            const rect = item.getBoundingClientRect();
            return { el: item, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
        });

        // Attach physics listeners dynamically
        document.addEventListener('mousemove', onMarqueeMove);
        document.addEventListener('mouseup', onMarqueeUp);
        
    } else {
        window.clearSelection();
    }
});

/**
 * =========================================================
 * 23. MASS DELETION PROCESSOR
 * Description: Processes batch deletion requests from UI drops.
 * =========================================================
 */
window.massDeleteItems = function(data) {
    if (!data) return;
    
    const itemsToProcess = data.isMulti ? data.items : [{name: data.name}];
    let deletedSomething = false;

    itemsToProcess.forEach(item => {
        const itemName = item.name;
        // Protect items already in trash from being re-trashed from Finder
        if (itemName && !(currentPath[0] === 'Trash' && data.source === 'finder')) {
            const sourceFolder = (data.source === 'desktop' || data.source === 'sidebar') ? fileSystem['Home'].contents : getFolderByPath(currentPath);
            const itemData = sourceFolder ? sourceFolder[itemName] : null;

            if (itemData) {
                itemData.originalSource = data.source;
                itemData.originalPath = data.source === 'finder' ? currentPath.slice() : null;
                
                fileSystem['Trash'].contents[itemName] = itemData; 
                delete sourceFolder[itemName]; 
                deletedSomething = true;
            }
        }
    });

    if (deletedSomething) {
        if (typeof updateTrashIcon === 'function') updateTrashIcon(); 
        window.renderDesktop(); 
        if (typeof renderFinder === 'function') renderFinder();
    }
};
/**
 * =========================================================
 * 23. CALCULATOR APP
 * Description: Secure mathematical engine. Uses a custom 
 * tokenizer/parser to avoid dangerous eval() calls (CSP safe).
 * =========================================================
 */
const calcDisplay = document.getElementById('calc-display');
let currentCalcInput = "";

/**
 * Handles numeric and operator inputs from the calculator UI.
 * @param {string} val - The button value pressed.
 */
window.calcInput = function(val) {
    if (!calcDisplay) return;
    if (val === '+/-' || val === '%') return; // Not yet implemented
    
    if (calcDisplay.value === "Errore" || calcDisplay.value === "NaN") {
        window.calcClear();
    }

    // Limit input length to prevent Regex DoS (ReDoS) or UI overflow
    if (currentCalcInput.length > 50) return;

    let apiVal = val;
    if (val === '÷') apiVal = '/';
    if (val === '×') apiVal = '*';
    if (val === '−') apiVal = '-';

    calcDisplay.value += val; 
    currentCalcInput += apiVal; 
}

/**
 * Clears the calculator display and memory buffer.
 */
window.calcClear = function() {
    if (calcDisplay) calcDisplay.value = '';
    currentCalcInput = '';
}

/**
 * Parses and computes the current mathematical expression using BODMAS.
 */
window.calcCompute = function() {
    if (!calcDisplay) return;
    
    try {
        if (currentCalcInput.trim() !== '') {
            // Extreme Security Filter: Strip everything except numbers and operators
            let sanitized = currentCalcInput.replace(/[^0-9\+\-\*\/\.]/g, '');
            let tokens = sanitized.match(/(\d+\.?\d*)|([\+\-\*\/])/g);
            
            if (!tokens) throw new Error("Invalid tokens");

            // Handle leading negative numbers
            if (tokens[0] === '-') {
                tokens.shift();
                tokens[0] = '-' + tokens[0];
            }

            // Pass 1: Multiplication and Division
            for (let i = 1; i < tokens.length; i += 2) {
                if (tokens[i] === '*' || tokens[i] === '/') {
                    let a = parseFloat(tokens[i - 1]);
                    let b = parseFloat(tokens[i + 1]);
                    if (tokens[i] === '/' && b === 0) throw new Error("Division by zero");
                    
                    let res = tokens[i] === '*' ? a * b : a / b;
                    tokens.splice(i - 1, 3, res);
                    i -= 2;
                }
            }

            // Pass 2: Addition and Subtraction
            let result = parseFloat(tokens[0]);
            for (let i = 1; i < tokens.length; i += 2) {
                let op = tokens[i];
                let val = parseFloat(tokens[i + 1]);
                if (op === '+') result += val;
                if (op === '-') result -= val;
            }

            // Fix floating point precision artifacts (e.g. 0.1 + 0.2)
            calcDisplay.value = Math.round(result * 100000000) / 100000000;
            currentCalcInput = calcDisplay.value.toString();
        }
    } catch (error) {
        calcDisplay.value = 'Errore';
        currentCalcInput = "";
    }
}

/**
 * =========================================================
 * 24. TERMINAL APP (Simulated UNIX Shell)
 * Description: Handles CLI commands, directory traversal,
 * and file manipulation via VFS bindings.
 * =========================================================
 */
const termInput = document.getElementById("term-input");
const termOutput = document.getElementById("term-output");
const loginTimeEl = document.getElementById("login-time");

if (loginTimeEl) {
    loginTimeEl.textContent = new Date().toLocaleString();
}

if (termInput && termOutput) {
    termInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
            const rawCmd = this.value.trim();
            this.value = ""; 
            
            let currentFolder = getFolderByPath(currentPath);
            let pathStr = "/" + currentPath.join("/");
            
            // XSS Prevention: Escape the command before reflecting it in the DOM
            const safeCmd = typeof escapeHTML === 'function' ? escapeHTML(rawCmd) : rawCmd;

            // Handle empty enter press
            if (rawCmd === "") {
                termOutput.innerHTML += `<br><br><span class="prompt">user@WebOS ${pathStr} %</span> `;
                termOutput.scrollTop = termOutput.scrollHeight;
                return;
            }

            let response = "";
            const args = rawCmd.split(" ");
            const cmd = args[0].toLowerCase();

            // --- COMMAND ROUTER ---
            if (cmd === "help") {
                response = "Comandi di Sistema WebOS:<br>- help: Mostra manuale<br>- date: Mostra data/ora<br>- clear: Pulisce buffer<br>- pwd: Print Working Directory<br>- ls: Lista contenuti cartella<br>- cd [dir]: Cambia directory<br>- mkdir [nome]: Crea una directory<br>- touch [nome]: Crea un file vuoto";
            } 
            else if (cmd === "date") {
                response = new Date().toString();
            } 
            else if (cmd === "clear") {
                termOutput.innerHTML = "";
                return; 
            } 
            else if (cmd === "pwd") {
                response = pathStr;
            } 
            else if (cmd === "ls") {
                if (currentFolder && Object.keys(currentFolder).length > 0) {
                    let items = [];
                    for (let item in currentFolder) {
                        // Skip system coordinates and metadata
                        if(item === 'x' || item === 'y' || item === 'originalSource' || item === 'originalPath') continue;
                        
                        const safeItemName = typeof escapeHTML === 'function' ? escapeHTML(item) : item;
                        
                        let typeStr = currentFolder[item].type === 'folder' 
                            ? `<span style="color:var(--accent-color, #0a84ff); font-weight:bold;">${safeItemName}/</span>` 
                            : safeItemName;
                        items.push(typeStr);
                    }
                    response = `<div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap:8px; margin-top:5px; margin-bottom:5px;">` 
                             + items.map(i => `<div>${i}</div>`).join("") 
                             + `</div>`;
                } else {
                    response = "Cartella vuota.";
                }
            }
            else if (cmd === "cd") {
                const target = args[1];
                if (!target || target === "~" || target === "/") {
                    currentPath = ["Home"];
                } else if (target === "..") {
                    if (currentPath.length > 1) currentPath.pop();
                } else {
                    if (currentFolder[target] && currentFolder[target].type === "folder") {
                        currentPath.push(target);
                    } else if (currentFolder[target]) {
                        response = `bash: cd: ${escapeHTML(target)}: Non è una directory`;
                    } else {
                        response = `bash: cd: ${escapeHTML(target)}: File o directory inesistente`;
                    }
                }
                pathStr = "/" + currentPath.join("/");
                if (typeof renderFinder === 'function') renderFinder(); 
            }
            else if (cmd === "mkdir" || cmd === "touch") {
                const nameArg = args[1];
                const isFolder = cmd === "mkdir";
                const typeStr = isFolder ? "directory" : "file";
                
                if (!nameArg) {
                    response = `Errore: specificare il nome. Uso: ${cmd} [nome]`;
                } else if (typeof isValidFileName === 'function' && !isValidFileName(nameArg)) {
                    response = `Errore: Nome non valido. Caratteri speciali o parole di sistema non ammessi.`;
                } else if (currentFolder[nameArg]) {
                    response = `Errore: un elemento chiamato '${escapeHTML(nameArg)}' esiste già.`;
                } else {
                    if (isFolder) {
                        currentFolder[nameArg] = { type: "folder", contents: {} };
                    } else {
                        currentFolder[nameArg] = { type: "file", content: "" };
                    }

                    if (pathStr === "/Home") {
                        const freePos = getFreeDesktopPosition(20, 150); 
                        currentFolder[nameArg].x = freePos.x;
                        currentFolder[nameArg].y = freePos.y;
                        if (typeof renderDesktop === 'function') renderDesktop();
                    }
                    if (typeof renderFinder === 'function') renderFinder();
                }
            } 
            else {
                response = `bash: command not found: ${safeCmd}`;
            }

            // Reflect command and response to terminal DOM
            termOutput.innerHTML += `<br><br><span class="prompt">user@WebOS ${pathStr} %</span> ${safeCmd}<br>${response}`;
            termOutput.scrollTop = termOutput.scrollHeight;
        }
    });
}
/**
 * =========================================================
 * 25. HARDWARE-ACCELERATED WINDOW RESIZE ENGINE
 * Description: 60FPS throttled engine for window resizing.
 * Decouples DOM layout calculations from mouse movement.
 * =========================================================
 */

/**
 * Injects resize handles and binds physics to a window container.
 * @param {HTMLElement} elmnt - The window element to make resizable.
 */
function makeResizable(elmnt) {
    // Inject hitboxes (Sensors)
    const resizerR = document.createElement('div'); 
    resizerR.className = 'resizer resizer-r';
    
    const resizerB = document.createElement('div'); 
    resizerB.className = 'resizer resizer-b';
    
    const resizerBR = document.createElement('div'); 
    resizerBR.className = 'resizer resizer-br';
    
    elmnt.appendChild(resizerR);
    elmnt.appendChild(resizerB);
    elmnt.appendChild(resizerBR);

    let startX, startY, startWidth, startHeight;
    let minW, minH;
    
    let animationFrameId = null;
    let targetWidth = 0;
    let targetHeight = 0;
    let isResizing = false;

    // The physical update loop (Runs at monitor refresh rate)
    function updateDOM() {
        if (!isResizing) return;
        const mode = elmnt.dataset.resizing;
        
        if (mode === 'r' || mode === 'br') {
            if (targetWidth >= minW) elmnt.style.width = targetWidth + 'px';
        }
        if (mode === 'b' || mode === 'br') {
            if (targetHeight >= minH) elmnt.style.height = targetHeight + 'px';
        }
        
        // Trigger specific app redraws if needed (e.g., Leaflet Maps)
        if (elmnt.id === 'maps-window' && typeof mapInstance !== 'undefined' && mapInstance) {
            mapInstance.invalidateSize();
        }
        
        animationFrameId = null;
    }

    // Handles rapid mouse movement, queueing DOM updates
    function handleMouseMove(e) {
        if (!isResizing) return;
        const mode = elmnt.dataset.resizing;
        
        if (mode === 'r' || mode === 'br') targetWidth = startWidth + (e.clientX - startX);
        if (mode === 'b' || mode === 'br') targetHeight = startHeight + (e.clientY - startY);
        
        if (!animationFrameId) {
            animationFrameId = requestAnimationFrame(updateDOM);
        }
    }

    // Terminates the resize operation and cleans up listeners
    function stopResize() {
        if (!isResizing) return;
        isResizing = false;
        
        document.body.classList.remove('is-resizing-r', 'is-resizing-b', 'is-resizing-br');
        delete elmnt.dataset.resizing;
        
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', stopResize);
    }

    // Initialization trigger
    function initResize(e, mode) {
        e.preventDefault(); 
        e.stopPropagation();
        if (elmnt.classList.contains("maximized")) return;
        
        // Anti-Jump logic: Lock current absolute position
        const rect = elmnt.getBoundingClientRect();
        const computedTransform = window.getComputedStyle(elmnt).transform;
        if (computedTransform !== 'none') {
            elmnt.style.left = rect.left + 'px';
            elmnt.style.top = rect.top + 'px';
            elmnt.style.transform = 'none';
        }

        startX = e.clientX; 
        startY = e.clientY;
        startWidth = rect.width; 
        startHeight = rect.height;
        
        const computedStyle = window.getComputedStyle(elmnt);
        minW = parseInt(computedStyle.minWidth) || 320;
        minH = parseInt(computedStyle.minHeight) || 250;
        
        if (typeof bringToFront === 'function') bringToFront(elmnt);
        isResizing = true;
        elmnt.dataset.resizing = mode;

        document.body.classList.add('is-resizing-' + mode);

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', stopResize);
    }

    // Bind triggers to hitboxes
    resizerR.addEventListener('mousedown', (e) => initResize(e, 'r'));
    resizerB.addEventListener('mousedown', (e) => initResize(e, 'b'));
    resizerBR.addEventListener('mousedown', (e) => initResize(e, 'br'));
}

// Initialize resize physics on all standard windows
document.querySelectorAll('.window:not(#calc-window):not(#weather-window)').forEach(win => {
    makeResizable(win);
});


/**
 * =========================================================
 * 26. CONTROL CENTER MODULE
 * Description: Manages quick toggles, brightness dimming, 
 * and global audio volume synchronization.
 * =========================================================
 */
const ccTrigger = document.getElementById("cc-trigger");
const ccPanel = document.getElementById("control-center");

// --- Screen Dimmer (Brightness Engine) ---
// Injected securely to guarantee top-level z-index
let screenDimmer = document.getElementById("screen-dimmer");
if (!screenDimmer) {
    screenDimmer = document.createElement("div");
    screenDimmer.id = "screen-dimmer";
    screenDimmer.style.cssText = "position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: #000; opacity: 0; pointer-events: none; z-index: 999900; transition: opacity 0.15s;";
    document.body.appendChild(screenDimmer);
}

// --- 1. Panel Visibility Toggle ---
if (ccTrigger && ccPanel) {
    ccTrigger.addEventListener("click", (e) => {
        e.stopPropagation(); 
        const appleMenu = document.getElementById("apple-dropdown");
        if (appleMenu) appleMenu.style.display = "none"; 
        ccPanel.classList.toggle("show");
    });

    document.addEventListener("click", (e) => {
        if (ccPanel.classList.contains("show") && !ccPanel.contains(e.target) && !ccTrigger.contains(e.target)) {
            ccPanel.classList.remove("show");
        }
    });
}

// --- 2. Network & Focus Toggles ---
window.toggleCcFeature = function(element, feature) {
    if (feature === 'focus') {
        element.classList.toggle('active');
        return;
    }

    const icon = element.querySelector('.cc-icon-bg');
    const statusText = element.querySelector('.cc-subtitle');
    if (!icon || !statusText) return;

    const isActive = icon.classList.contains('active');

    if (isActive) {
        icon.classList.remove('active');
        if (feature === 'wifi') statusText.textContent = "Non connesso";
        if (feature === 'bluetooth') statusText.textContent = "Spento";
        if (feature === 'airdrop') statusText.textContent = "Ricezione spenta";
    } else {
        icon.classList.add('active');
        if (feature === 'wifi') statusText.textContent = "Home";
        if (feature === 'bluetooth') statusText.textContent = "Attivo";
        if (feature === 'airdrop') statusText.textContent = "Solo Contatti";
    }
};

// --- 3. Dynamic Slider Engine (Colors track up to thumb position) ---
/**
 * Updates the CSS background gradient of a slider to show fill progress.
 * @param {HTMLElement} slider - The range input element.
 * @param {number} val - The current numeric value.
 */
function updateCcSliderUI(slider, val) {
    if (!slider) return;
    const min = slider.min ? parseFloat(slider.min) : 0;
    const max = slider.max ? parseFloat(slider.max) : 100;
    const percentage = ((val - min) / (max - min)) * 100;
    
    slider.style.background = `linear-gradient(to right, rgba(255,255,255,0.9) ${percentage}%, rgba(255,255,255,0.1) ${percentage}%)`;
}

// Bind Brightness Slider
const brightnessSlider = document.getElementById("cc-brightness-slider");
if (brightnessSlider && screenDimmer) {
    updateCcSliderUI(brightnessSlider, brightnessSlider.value);

    brightnessSlider.addEventListener("input", (e) => {
        const val = e.target.value;
        // Formula: 100 slider = 0 opacity (brightest), 20 slider = 0.8 opacity (dimmest)
        const opacity = 1 - (val / 100);
        screenDimmer.style.opacity = opacity;
        updateCcSliderUI(brightnessSlider, val);
    });
}

// --- 4. Global Audio Sync Engine ---
// Binds the Control Center volume slider to the master audioPlayer and UI elements
const ccVolSlider = document.getElementById("cc-volume-slider");
if (ccVolSlider && typeof audioPlayer !== 'undefined') {
    ccVolSlider.value = audioPlayer.volume * 100;
    updateCcSliderUI(ccVolSlider, ccVolSlider.value);

    ccVolSlider.addEventListener("input", (e) => {
        const val = e.target.value;
        audioPlayer.volume = val / 100; 
        updateCcSliderUI(ccVolSlider, val);

        // Sync Music App Main Slider
        const mainVolSlider = document.getElementById('music-volume-slider');
        if (mainVolSlider && typeof updateVolumeUI === 'function') {
            mainVolSlider.value = val; 
            updateVolumeUI(val);
        }
        
        // Sync Music App Mid Player Slider
        const midVolSlider = document.getElementById('mid-volume-slider');
        if (midVolSlider && typeof updateMidVolumeUI === 'function') {
            midVolSlider.value = val; 
            updateMidVolumeUI(val);
        }
    });
}

// --- 5. Quick Buttons Visual Toggles ---
document.querySelectorAll('.cc-quick-btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
        // Prevent toggle if it's the theme button (handled specifically in toggleTheme)
        if (this.getAttribute('onclick') && this.getAttribute('onclick').includes('toggleTheme')) return;
        this.classList.toggle('active');
    });
});
/**
 * =========================================================
 * 27. SCREENSHOT ENGINE (Render & Quick Look)
 * Description: Captures the DOM via html2canvas, generates 
 * a thumbnail, and manages the Quick Look image editor.
 * =========================================================
 */

/**
 * Triggers a full desktop capture, creates a Base64 image,
 * and triggers the visual flash and thumbnail lifecycle.
 */
window.takeScreenshot = async function() {
    const ccPanel = document.getElementById("control-center");
    if (ccPanel) ccPanel.classList.remove("show");

    if (typeof html2canvas === 'undefined') {
        if (typeof showMacAlert === 'function') showMacAlert("Errore: html2canvas non caricato.");
        return;
    }

    const desktopEl = document.getElementById('desktop');
    if (!desktopEl) return;
    
    try {
        // REAL DOM CAPTURE
        desktopEl.style.cursor = 'none';
        const canvas = await html2canvas(desktopEl, {
            backgroundColor: null, 
            scale: 1, 
            logging: false,
            useCORS: true 
        });
        desktopEl.style.cursor = ''; 
        
        const imgDataUrl = canvas.toDataURL("image/png");

        // Filename Generation
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const timeStr = `${String(now.getHours()).padStart(2, '0')}.${String(now.getMinutes()).padStart(2, '0')}.${String(now.getSeconds()).padStart(2, '0')}`;
        const fileName = `Schermata ${dateStr} alle ${timeStr}.png`;

        // Create and trigger camera flash effect
        let flash = document.getElementById("screen-flash");
        if (!flash) {
            flash = document.createElement("div");
            flash.id = "screen-flash";
            flash.style.cssText = "position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: white; opacity: 0; pointer-events: none; z-index: 9999999;";
            document.body.appendChild(flash);
        }

        flash.style.transition = "none";
        flash.style.opacity = "1"; 

        setTimeout(() => {
            flash.style.transition = "opacity 0.4s ease-out";
            flash.style.opacity = "0"; 
            
            showScreenshotThumbnail(imgDataUrl, fileName);
        }, 50);

    } catch (err) {
        console.error("Screenshot Error:", err);
        desktopEl.style.cursor = '';
    }
};

/**
 * Displays the captured screenshot thumbnail in the bottom right.
 * @param {string} imgDataUrl - Base64 image string.
 * @param {string} fileName - Generated filename.
 */
function showScreenshotThumbnail(imgDataUrl, fileName) {
    let thumb = document.getElementById("screenshot-thumb");
    if (!thumb) {
        thumb = document.createElement("div");
        thumb.id = "screenshot-thumb";
        thumb.className = "screenshot-thumb";
        thumb.title = "Clicca per visualizzare";
        document.body.appendChild(thumb);
    }

    thumb.style.backgroundImage = `url('${imgDataUrl}')`;
    
    // Animation reset
    thumb.style.transition = 'none';
    thumb.classList.remove("show");
    void thumb.offsetWidth; 
    thumb.style.transition = 'right 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.1), opacity 0.5s';
    thumb.classList.add("show");

    // Action: Open Quick Look Editor
    thumb.onclick = () => {
        thumb.classList.remove("show");
        openScreenshotEditor(imgDataUrl, fileName);
    };

    setTimeout(() => {
        if (thumb.classList.contains("show")) {
            thumb.classList.remove("show");
        }
    }, 4000);
}

/**
 * Opens the Quick Look full-screen preview overlay for the screenshot.
 * @param {string} imgDataUrl - Base64 image string.
 * @param {string} fileName - File name for downloading.
 */
function openScreenshotEditor(imgDataUrl, fileName) {
    let editor = document.getElementById('screenshot-editor-overlay');
    
    // Lazy load the editor DOM if it doesn't exist
    if (!editor) {
        editor = document.createElement('div');
        editor.id = 'screenshot-editor-overlay';
        editor.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.75); backdrop-filter: blur(25px); -webkit-backdrop-filter: blur(25px); z-index: 9999999; display: none; flex-direction: column; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.3s ease;';

        editor.innerHTML = `
            <div style="position: absolute; top: 30px; text-align: center; color: white; font-weight: 600; font-size: 15px; letter-spacing: 0.5px;">Anteprima Schermata</div>
            <img id="sc-editor-img" src="" style="max-width: 85%; max-height: 75vh; border-radius: 12px; box-shadow: 0 25px 60px rgba(0,0,0,0.6); border: 1px solid rgba(255,255,255,0.15);">
            
            <div style="margin-top: 35px; display: flex; gap: 20px;">
                <button id="sc-btn-delete" style="background: rgba(255,59,48,0.15); color: var(--danger-color, #ff3b30); border: 1px solid rgba(255,59,48,0.4); padding: 10px 24px; border-radius: 10px; cursor: pointer; font-weight: 600; font-size: 14px; transition: 0.2s;">Cestina</button>
                <button id="sc-btn-save" style="background: var(--accent-color, #0a84ff); color: white; border: none; padding: 10px 28px; border-radius: 10px; cursor: pointer; font-weight: 600; font-size: 14px; transition: 0.2s; box-shadow: 0 4px 15px rgba(10,132,255,0.4);">Salva sul PC</button>
            </div>
        `;
        document.body.appendChild(editor);

        // Hover Effects
        const btnDel = document.getElementById('sc-btn-delete');
        const btnSav = document.getElementById('sc-btn-save');
        btnDel.onmouseover = () => btnDel.style.background = 'rgba(255,59,48,0.3)';
        btnDel.onmouseout = () => btnDel.style.background = 'rgba(255,59,48,0.15)';
        btnSav.onmouseover = () => btnSav.style.transform = 'scale(1.05)';
        btnSav.onmouseout = () => btnSav.style.transform = 'scale(1)';
    }

    const editorImg = document.getElementById('sc-editor-img');
    if (editorImg) editorImg.src = imgDataUrl;
    
    editor.style.display = 'flex';
    void editor.offsetWidth;
    editor.style.opacity = '1';

    // ACTION: Trash (Closes overlay and flushes RAM)
    document.getElementById('sc-btn-delete').onclick = () => {
        editor.style.opacity = '0';
        setTimeout(() => {
            editor.style.display = 'none';
            if (editorImg) editorImg.src = ""; // Free Base64 memory
        }, 300);
    };

    // ACTION: Save (Downloads to physical PC and flushes RAM)
    document.getElementById('sc-btn-save').onclick = () => {
        const a = document.createElement('a');
        a.href = imgDataUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        editor.style.opacity = '0';
        setTimeout(() => {
            editor.style.display = 'none';
            if (editorImg) editorImg.src = ""; // Free Base64 memory
        }, 300);
    };
}

/**
 * Floating toolbar execution logic for timed screenshots.
 */
window.executeScreenshotApp = function() {
    const win = document.getElementById('screenshot-window');
    const timerSelect = document.getElementById('sc-timer-select');
    const timer = timerSelect ? parseInt(timerSelect.value) : 0;
    const btn = document.querySelector('.sc-capture-btn');
    
    if (timer > 0 && btn) btn.textContent = `Scatto in ${timer}...`;
    else if (btn) btn.textContent = "Cattura...";

    setTimeout(() => {
        if (win) {
            win.classList.remove('show');
            win.style.display = 'none';
        }
        if (btn) btn.textContent = "Acquisisci"; 

        if (typeof setAppRunningState === 'function') {
            setAppRunningState('screenshot-window', false);
        }

        window.takeScreenshot();

    }, timer > 0 ? timer * 1000 : 200); 
};

/**
 * =========================================================
 * 28. THEME & WALLPAPER ENGINE (Dark / Light Mode)
 * Description: Manages OS-level themes, prevents layout 
 * thrashing during switches, and handles smooth GPU 
 * accelerated wallpaper transitions.
 * =========================================================
 */

/**
 * Global lock to prevent race conditions and layout thrashing 
 * caused by rapid spam-clicking of the theme toggle button.
 * @type {boolean}
 */
let isThemeToggling = false;

/**
 * Toggles the system theme between Dark and Light mode.
 * Uses a double requestAnimationFrame strategy to synchronize
 * DOM updates with the monitor's refresh rate, eliminating UI flicker.
 */
window.toggleTheme = function() {
    // Abort if a theme transition is already in progress
    if (isThemeToggling) return; 
    
    // Engage the execution lock
    isThemeToggling = true;

    const root = document.documentElement;
    
    // 1. Disable standard UI animations to prevent layout thrashing
    // Note: Ensure your CSS .no-transitions class uses :not(.bg-fade-layer) 
    // to keep the background transition active.
    root.classList.add('no-transitions');

    const currentTheme = root.getAttribute('data-theme') || 'dark';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    const themeBtn = document.querySelector('.cc-bottom-row .cc-quick-btn:nth-child(1)');

    // 2. Apply new theme attributes and update control center UI
    if (newTheme === 'light') {
        root.setAttribute('data-theme', 'light');
        if (themeBtn) themeBtn.classList.add('active');
    } else {
        root.removeAttribute('data-theme');
        if (themeBtn) themeBtn.classList.remove('active');
    }

    localStorage.setItem('theme', newTheme);

    // 3. Handle the wallpaper crossfade transition
    // Only apply the default theme wallpaper if no custom session is active
    if (!window.customWallpaperSession) {
        const defaultBg = newTheme === 'light' ? 'assets/img/light.png' : 'assets/img/dark.png';
        
        if (typeof setSmoothBackground === 'function') {
            setSmoothBackground(defaultBg);
        } else {
            // Fallback if the crossfade engine is missing
            const desktop = document.getElementById('desktop');
            if (desktop) desktop.style.backgroundImage = `url("${defaultBg}")`;
        }
        
        // Update Settings App preview monitor if it is currently open
        const preview = document.getElementById('settings-bg-preview');
        if (preview) preview.src = defaultBg;
    }

    // 4. Hardware/GPU Synchronization
    // Wait for the browser to calculate the new styles (Frame 1),
    // then wait for the monitor to physically paint them (Frame 2).
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            // Re-enable standard UI animations only after a successful screen paint
            root.classList.remove('no-transitions');
            
            // Release the lock after a short buffer to absorb frantic clicks
            setTimeout(() => {
                isThemeToggling = false;
            }, 250);
        });
    });
};
/**
 * =========================================================
 * CROSSFADE WALLPAPER ENGINE
 * Description: Performs a smooth image transition without UI lag.
 * =========================================================
 */
window.customWallpaperSession = null; 

/**
 * Applies a new background to the desktop using an overlapping fade layer.
 * @param {string} newUrl - The URL or Base64 string of the new wallpaper.
 */
window.setSmoothBackground = function(newUrl) {
    const desktop = document.getElementById('desktop');
    if (!desktop) return;

    // DOM Cleanup: Destroy any stuck layers from rapid clicking
    document.querySelectorAll('.bg-fade-layer').forEach(el => el.remove());

    const fadeLayer = document.createElement('div');
    fadeLayer.className = 'bg-fade-layer';
    
    fadeLayer.style.cssText = `
        position: absolute; top: 0; left: 0; width: 100%; height: 100%;
        background-image: url('${newUrl}');
        background-size: cover; background-position: center;
        opacity: 0; z-index: 0; pointer-events: none;
        transition: opacity 0.8s cubic-bezier(0.25, 1, 0.5, 1);
        will-change: opacity;
    `;
    
    // Insert behind desktop icons but above current background
    desktop.insertBefore(fadeLayer, desktop.firstChild);
    
    // Trigger GPU reflow
    void fadeLayer.offsetWidth; 
    fadeLayer.style.opacity = '1';
    
    setTimeout(() => {
        desktop.style.backgroundImage = `url('${newUrl}')`;
        fadeLayer.remove();
    }, 850);
};