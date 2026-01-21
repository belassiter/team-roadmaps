import { createApp, ref, reactive, computed } from 'vue';

const app = createApp({
    setup() {
        // --- Configuration ---
        const CELL_SIZE = 50; // Fixed cell size
        
        const gridConfig = reactive({
            cols: 20,
            rows: 5
        });

        // Computed grid dimensions
        const gridWidth = computed(() => gridConfig.cols * CELL_SIZE);
        const gridHeight = computed(() => gridConfig.rows * CELL_SIZE);

        
        // --- Axis Settings ---
        const axisConfig = reactive({
            mode: 'number', // number, day, week
            startDate: new Date().toISOString().substring(0, 10), // string YYYY-MM-DD
            weekdaysOnly: false
        });

        // Helper to format date
        const formatDate = (date, mode) => {
            if (mode === 'day') {
                return date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', weekday: 'short' });
            } else if (mode === 'week') {
                // Display X/YY (Month/Day)
                return `${date.getMonth() + 1}/${date.getDate()}`;
            }
            return '';
        };

        // Helper to parse "YYYY-MM-DD" as local date to avoid UTC offsets
        const parseLocalYMD = (str) => {
            if (!str) return new Date();
            const parts = str.split('-');
            // new Date(y, mIndex, d) handles local time
            return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        };

        const getWeekNumber = (d) => {
            // Copy date so we don't modify the original
            d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
            d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
            var yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
            var weekNo = Math.ceil(( ( (d - yearStart) / 86400000) + 1)/7);
            return weekNo;
        };

        const axisLabels = computed(() => {
            const labels = [];
            // Parse local date from the input string
            let currentDate = parseLocalYMD(axisConfig.startDate);
            
            // If mode is 'week', snap start date to the preceding Monday
            if (axisConfig.mode === 'week') {
                const day = currentDate.getDay();
                // If Sunday(0), back 6 days. Else back (day-1) days. Mon(1) - 1 = 0 diff.
                const diff = day === 0 ? 6 : day - 1; 
                currentDate.setDate(currentDate.getDate() - diff);
            }

            // Loop for 'cols' count, but handling 'weekdaysOnly' skip
            for (let i = 0; i < gridConfig.cols; i++) {
                if (axisConfig.mode === 'number') {
                    labels.push(i + 1);
                } else if (axisConfig.mode === 'day') {
                    if (axisConfig.weekdaysOnly) {
                        // Skip Sat(6) and Sun(0)
                        while (currentDate.getDay() === 0 || currentDate.getDay() === 6) {
                            currentDate.setDate(currentDate.getDate() + 1);
                        }
                    }
                    labels.push(formatDate(new Date(currentDate), 'day'));
                    currentDate.setDate(currentDate.getDate() + 1);
                } else if (axisConfig.mode === 'week') {
                     labels.push(formatDate(new Date(currentDate), 'week'));
                     currentDate.setDate(currentDate.getDate() + 7);
                }
            }
            return labels;
        });

        
        // --- Grid Editor State ---
        const isEditingGrid = ref(false);
        const pendingGrid = reactive({ cols: 20, rows: 5 });
        const gridError = ref('');

        const openGridEditor = () => {
             pendingGrid.cols = gridConfig.cols;
             pendingGrid.rows = gridConfig.rows;
             gridError.value = '';
             isEditingGrid.value = true;
        };

        const saveGridEditor = () => {
            const newW = pendingGrid.cols * CELL_SIZE;
            const newH = pendingGrid.rows * CELL_SIZE;

            // Validate against existing items
            for (const item of items) {
                const itemRight = item.x + (item.widthUnits * CELL_SIZE);
                const itemBottom = item.y + CELL_SIZE;

                if (itemRight > newW) {
                    gridError.value = `Error: Item "${item.name}" would be cut off horizontally.`;
                    return;
                }
                if (itemBottom > newH) {
                    gridError.value = `Error: Item "${item.name}" would be cut off vertically.`;
                    return;
                }
            }

            // Apply changes
            gridConfig.cols = pendingGrid.cols;
            gridConfig.rows = pendingGrid.rows;
            isEditingGrid.value = false;
        };

        const cancelGridEditor = () => {
            isEditingGrid.value = false;
            gridError.value = '';
        };


        // --- State ---
        const isDragging = ref(false);
        const startX = ref(0);
        const startY = ref(0);
        
        // Track the index of the item being currently dragged
        const draggingItemIndex = ref(null);
        
        // Track the ID of the selected item for editing
        const selectedItemId = ref(1);

        // State: Items Array
        const items = reactive([
            {
                id: 1,
                x: 0,
                y: 0,
                widthUnits: 2, // grid units
                name: 'Task 1',
                color: '#3b82f6'
            }
        ]);
        
        // This represents the temporary visual position while dragging
        const dragOffset = ref({ x: 0, y: 0 });

        // --- Computed ---

        const selectedItem = computed(() => {
            return items.find(item => item.id === selectedItemId.value);
        });

        // Computed for display stats only (based on the dragging item or selected item)
        const activeItem = computed(() => {
            if (draggingItemIndex.value !== null) return items[draggingItemIndex.value];
            return selectedItem.value || items[0];
        });

        const activeItemVisualX = computed(() => {
            if (draggingItemIndex.value !== null) {
                return items[draggingItemIndex.value].x + dragOffset.value.x;
            }
            return activeItem.value ? activeItem.value.x : 0;
        });

        const activeItemVisualY = computed(() => {
             if (draggingItemIndex.value !== null) {
                return items[draggingItemIndex.value].y + dragOffset.value.y;
            }
            return activeItem.value ? activeItem.value.y : 0;
        });

        const snappedX = computed(() => Math.round(activeItemVisualX.value / CELL_SIZE));
        const snappedY = computed(() => Math.round(activeItemVisualY.value / CELL_SIZE));

        // Generate Color Palette (8 hues * 5 lightnesses)
        const colorPalette = computed(() => {
            const colors = [];
            // 8 Distinct Hues: Red, Orange, Gold, Green, Teal, Blue, Purple, Pink
            const hueValues = [0, 30, 45, 120, 180, 210, 270, 320];
            // 5 Lightness levels (Dark to Light)
            const lightnessValues = [30, 45, 60, 75, 90];
            
            for (let l of lightnessValues) {
                for (let h of hueValues) {
                    colors.push(`hsl(${h}, 85%, ${l}%)`);
                }
            }
            return colors;
        });

        const ghost = reactive({
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            color: 'transparent',
            visible: false
        });

        // --- History / Undo ---
        const history = ref([]);
        
        const saveHistory = () => {
            // Deep copy the current items state
            history.value.push(JSON.parse(JSON.stringify(items)));
            // Limit history size if needed (e.g. 50 steps)
            if (history.value.length > 50) history.value.shift();
        };

        const undo = () => {
            if (history.value.length === 0) return;
            const previousState = history.value.pop();
            // Replace current items with previous state
            items.splice(0, items.length, ...previousState);
            // Deselect to avoid stale references
            selectedItemId.value = null;
        };

        // --- Methods ---

        const darkenColor = (color) => {
            // Basic approximation since we might use HSL now. 
            // If HSL, reduce 'l'. If Hex, do what we did before.
            // For simplicity in this mix, let's just use a transparent black overlay in CSS instead.
            // Or return 'transparent' if we assume styles handle it.
            // Actually, we can just return the color itself and let CSS box-shadow do the work.
            return color; 
        };
        
        const getItemStyle = (item, index) => {
            const isBeingDragged = draggingItemIndex.value === index;
            
            let x = item.x;
            let y = item.y;
            
            if (isBeingDragged) {
                x += dragOffset.value.x;
                y += dragOffset.value.y;
            }

            return {
                transform: `translate(${x}px, ${y}px)`,
                width: `${item.widthUnits * CELL_SIZE}px`,
                height: `${CELL_SIZE}px`,
                backgroundColor: item.color,
                borderColor: 'rgba(0,0,0,0.2)' // Simple border
            };
        };

        const addItem = () => {
            saveHistory(); // Save before adding
            const newId = items.length > 0 ? Math.max(...items.map(i => i.id)) + 1 : 1;
            
            // Find first free slot (simplistic: try 0,0 then 1,0 etc)
            let newX = 0;
            let newY = 0;
            let found = false;
            
            // Max loops to prevent freeze
            for (let r = 0; r < gridConfig.rows; r++) {
               for (let c = 0; c < gridConfig.cols; c++) {
                   const testX = c * CELL_SIZE;
                   const testY = r * CELL_SIZE;
                   
                   // Check collision with default width of 2
                   const dummyItem = { id: newId, x: testX, y: testY, widthUnits: 2 };
                   if (!checkCollision(dummyItem, items)) { // items -> exclude self? ID check handles it
                       newX = testX;
                       newY = testY;
                       found = true;
                       break;
                   }
               }
               if (found) break;
            }

            const newItem = {
                id: newId,
                x: newX,
                y: newY,
                widthUnits: 2,
                name: `Task ${newId}`,
                color: '#10b981'
            };
            
            items.push(newItem);
            selectedItemId.value = newId;
        };

        // Check if 'candidate' overlaps with any item in 'others'
        // candidate has {id, x, y, widthUnits}
        const checkCollision = (candidate, existingItems) => {
            const candLeft = candidate.x;
            const candRight = candidate.x + (candidate.widthUnits * CELL_SIZE);
            const candTop = candidate.y;
            const candBottom = candidate.y + CELL_SIZE;

            for (const other of existingItems) {
                if (other.id === candidate.id) continue;

                const otherLeft = other.x;
                const otherRight = other.x + (other.widthUnits * CELL_SIZE);
                const otherTop = other.y;
                const otherBottom = other.y + CELL_SIZE;

                // Simple AABB collision
                const overlapX = (candLeft < otherRight) && (candRight > otherLeft);
                const overlapY = (candTop < otherBottom) && (candBottom > otherTop);
                
                if (overlapX && overlapY) {
                    return true;
                }
            }
            return false;
        };

        const startDrag = (event, index) => {
            if (draggingItemIndex.value !== null) return; // already dragging

            draggingItemIndex.value = index;
            selectedItemId.value = items[index].id; // Select on click/drag
            
            isDragging.value = true;
            startX.value = event.clientX;
            startY.value = event.clientY;

            // Initialize ghost immediately
            updateGhost();

            window.addEventListener('mousemove', onDrag);
            window.addEventListener('mouseup', stopDrag);
        };

        const onDrag = (event) => {
            if (!isDragging.value) return;

            const dx = event.clientX - startX.value;
            const dy = event.clientY - startY.value;

            dragOffset.value = { x: dx, y: dy };
            updateGhost(); 
        };

        const updateGhost = () => {
             const index = draggingItemIndex.value;
            if (index === null) return;
            
            const item = items[index];

            // 1. Calculate prospective raw position
            let finalRawX = item.x + dragOffset.value.x;
            let finalRawY = item.y + dragOffset.value.y;

            // 2. Snap
            let snappedPosX = Math.round(finalRawX / CELL_SIZE) * CELL_SIZE;
            let snappedPosY = Math.round(finalRawY / CELL_SIZE) * CELL_SIZE;

            // 3. Constrain
            snappedPosX = Math.max(0, snappedPosX);
            snappedPosY = Math.max(0, snappedPosY);
            
            const itemPxWidth = item.widthUnits * CELL_SIZE;
            snappedPosX = Math.min(snappedPosX, gridWidth.value - itemPxWidth);
            snappedPosY = Math.min(snappedPosY, gridHeight.value - CELL_SIZE);

            // 4. Check Collision
            const candidate = { 
                id: item.id, 
                x: snappedPosX, 
                y: snappedPosY, 
                widthUnits: item.widthUnits 
            };

            const isCollision = checkCollision(candidate, items);

            if (isCollision) {
                // Find closest valid location near the current mouse position
                const closestValid = findClosestValidPosition(item.id, items, snappedPosX, snappedPosY, item.widthUnits);
                
                ghost.x = closestValid.x;
                ghost.y = closestValid.y;
            } else {
                // If valid, ghost shows new position
                ghost.x = snappedPosX;
                ghost.y = snappedPosY;
            }

            ghost.width = itemPxWidth;
            ghost.height = CELL_SIZE;
            ghost.color = item.color;
            ghost.visible = true;
        };

        const findClosestValidPosition = (itemId, allItems, targetX, targetY, widthUnits) => {
            // Spiral search or simple neighborhood search
            // For this grid size, we can check immediate neighbors first, then expand.
            // Let's implement a search outwards from targetX, targetY
            
            // Search radius in grid cells
            const maxRadius = 10; 
            
            // First check exactly where we are (already done by caller, but safe to re-check)
            // But caller says it collided.
            
            // We search in concentric rings around the target cell
            for (let r = 1; r <= maxRadius; r++) {
                // Generate candidates at distance r (manhattan distance or box)
                // Let's do a box around the center
                
                for (let dx = -r; dx <= r; dx++) {
                    for (let dy = -r; dy <= r; dy++) {
                        // We only want the outer ring (radius r)
                        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
                        
                        const testX = targetX + (dx * CELL_SIZE);
                        const testY = targetY + (dy * CELL_SIZE);
                        
                        // Check boundaries
                        if (testX < 0 || testY < 0) continue;
                        if (testX + (widthUnits * CELL_SIZE) > gridWidth.value) continue;
                        if (testY + CELL_SIZE > gridHeight.value) continue;
                        
                        const candidate = { id: itemId, x: testX, y: testY, widthUnits: widthUnits };
                        
                        if (!checkCollision(candidate, allItems)) {
                            return { x: testX, y: testY };
                        }
                    }
                }
            }
            
            // If completely stuck, return original position (fallback)
            const originalItem = allItems.find(i => i.id === itemId);
            return { x: originalItem.x, y: originalItem.y };
        };

        const stopDrag = () => {
            if (!isDragging.value) return;
            
            const index = draggingItemIndex.value;
            const item = items[index];

            // Use the Ghost's final position! 
            // The ghost logic now handles "snap to original" OR "snap to neighbor"
            // So wherever the ghost is currently visible is the valid Drop Target.
            
            // We trust the ghost state because updateGhost runs on every mousemove.
            
            if (ghost.visible) {
                // Only save history if position actually changed
                if (item.x !== ghost.x || item.y !== ghost.y) {
                    saveHistory();
                }

                item.x = ghost.x;
                item.y = ghost.y;
            }

            // 5. Reset
            isDragging.value = false;
            draggingItemIndex.value = null;
            dragOffset.value = { x: 0, y: 0 };
            ghost.visible = false;

            window.removeEventListener('mousemove', onDrag);
            window.removeEventListener('mouseup', stopDrag);
        };

        // --- Persistence (Save/Load) ---
        const fileInput = ref(null);

        const saveProject = () => {
            const data = {
                version: 1,
                timestamp: new Date().toISOString(),
                gridConfig: { ...gridConfig },
                axisConfig: { ...axisConfig },
                items: items
            };
            
            const json = JSON.stringify(data, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const now = new Date();
            const pad = (n) => String(n).padStart(2, '0');
            const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}-${pad(now.getMinutes())}`;

            const a = document.createElement('a');
            a.href = url;
            a.download = `team-roadmap-${timestamp}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        };

        const triggerLoad = () => {
            if (fileInput.value) {
                fileInput.value.click();
            }
        };

        const handleFileUpload = (event) => {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    
                    // Basic validation
                    if (data.items && Array.isArray(data.items)) {
                        items.length = 0; // Clear existing
                        items.push(...data.items);
                    }
                    
                    if (data.gridConfig) {
                        gridConfig.cols = data.gridConfig.cols;
                        gridConfig.rows = data.gridConfig.rows;
                    }

                    if (data.axisConfig) {
                        Object.assign(axisConfig, data.axisConfig);
                    }
                    
                    // Clear selection
                    selectedItemId.value = null;
                    // Save checkpoint so undo works from this point
                    saveHistory(); 

                } catch (err) {
                    console.error("Failed to load project:", err);
                    alert("Error loading file. It may be corrupted or invalid JSON.");
                }
            };
            reader.readAsText(file);
            // Reset input so same file can be selected again
            event.target.value = ''; 
        };

        // Initialize globally
        window.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                undo();
            }
        });

        return {
            items,
            selectedItemId, // for managing selection
            selectedItem,   // for the form
            snappedX,
            snappedY,
            colorPalette,
            startDrag,
            getItemStyle,
            addItem,
            darkenColor,
            ghost,
            isDragging,
            saveHistory, // Export for inputs
            gridConfig,
            gridWidth,
            gridHeight,
            // Grid Editor
            isEditingGrid,
            pendingGrid,
            gridError,
            openGridEditor,
            saveGridEditor,
            cancelGridEditor,
            // Axis
            axisConfig,
            axisLabels,
            // Persistence
            saveProject,
            triggerLoad,
            handleFileUpload,
            fileInput
        };
    }
});

app.mount('#app');