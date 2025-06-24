// Constants and variables
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
let drawCount = 0;
let isNetworkCompleted = false;
let currentMode = "normal";
let routesData = [];
let mergedNodes = new Map();
let graphLayout = 'force';
let nodePositions = {};
let isDragging = false;
let dragNode = null;
let startX, startY;
let drawnItems = new L.FeatureGroup();
let endpointMarkers = new L.FeatureGroup();
let highlightLayer = new L.FeatureGroup();
let connectionLines = new L.FeatureGroup();
let mergedNodesLayer = new L.FeatureGroup();
let currentEdge = null;
let optimizationResults = [];

// Initialize the map
const map = L.map('map', {
    minZoom: 3,
    maxZoom: 20
}).setView([14.604, 120.979], 15);

// Add tile layer
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 20
}).addTo(map);

map.addLayer(drawnItems);
map.addLayer(endpointMarkers);
map.addLayer(highlightLayer);
map.addLayer(connectionLines);
map.addLayer(mergedNodesLayer);

// Initialize graph
const graph = document.getElementById('graph');
graph.addEventListener('mousedown', startDrag);
graph.addEventListener('mousemove', dragNodeHandler);
graph.addEventListener('mouseup', endDrag);
graph.addEventListener('mouseleave', endDrag);

// Functions
function getColor(distance) {
    if (distance < 1) return "green";
    if (distance <= 3) return "orange";
    return "red";
}

function createEndpointMarker(latlng, label, color) {
    const marker = L.circleMarker(latlng, {
        radius: 12,
        fillColor: color,
        color: "#fff",
        weight: 2,
        fillOpacity: 0.9,
    });
    
    marker.bindTooltip(label, {
        permanent: true,
        direction: "center",
        className: "endpoint-label",
    });
    
    return marker;
}

function createMergedNodeMarker(latlng, label) {
    const marker = L.circleMarker(latlng, {
        radius: 18,
        fillColor: "#FFD700",
        color: "#1a2a6c",
        weight: 4,
        fillOpacity: 1,
    });
    
    marker.bindTooltip(label, {
        permanent: true,
        direction: "center",
        className: "merged-node",
    });
    
    return marker;
}

function updateRoutesList() {
    const routesList = document.getElementById("routesList");
    routesList.innerHTML = "";
    
    if (routesData.length === 0) {
        routesList.innerHTML = '<div style="padding: 10px; text-align: center; color: #666;">No streets added yet. Draw a street to begin.</div>';
        return;
    }
    
    routesData.forEach((route, index) => {
        const routeItem = document.createElement("div");
        routeItem.className = "route-item";
        
        let damageBadge = "";
        if (route.damage) {
            if (route.damage === "low") damageBadge = '<span style="background:green;color:white;padding:1px 5px;border-radius:10px;font-size:10px;">Low</span>';
            if (route.damage === "medium") damageBadge = '<span style="background:orange;color:white;padding:1px 5px;border-radius:10px;font-size:10px;">Medium</span>';
            if (route.damage === "high") damageBadge = '<span style="background:red;color:white;padding:1px 5px;border-radius:10px;font-size:10px;">High</span>';
        }
        
        routeItem.innerHTML = `
            <strong>${route.label}</strong>: ${route.name} ${damageBadge}<br>
            <span style="color: ${route.color}">Distance: ${route.distance.toFixed(3)} km</span>
            ${route.responseTime ? `<br>Response: ${route.responseTime} hours` : ''}
        `;
        routeItem.onclick = () => {
            if (currentMode === "remove") {
                removeSpecificRoute(route);
            } else {
                highlightRoute(route.name);
            }
        };
        routesList.appendChild(routeItem);
    });
    
    // Update complete button state
    const completeBtn = document.getElementById("completeBtn");
    const optimizeBtn = document.getElementById("optimizeBtn");
    if (routesData.length < 2) {
        completeBtn.disabled = true;
        completeBtn.innerHTML = `<i class="fas fa-project-diagram"></i> Complete Network (${routesData.length}/2 needed)`;
        optimizeBtn.disabled = true;
    } else if (isNetworkCompleted) {
        completeBtn.disabled = true;
        completeBtn.innerHTML = `<i class="fas fa-check"></i> Network Completed`;
        optimizeBtn.disabled = false;
    } else {
        completeBtn.disabled = false;
        completeBtn.innerHTML = `<i class="fas fa-project-diagram"></i> Complete Network (${routesData.length})`;
        optimizeBtn.disabled = false;
    }
}

function enableAddStreet() {
    currentMode = "add";
    updateButtonStates();
    document.getElementById("measurement").innerHTML = 
        "<strong>ADD MODE:</strong> Draw a line to add a new street";
    map.getContainer().style.cursor = "crosshair";
    startDrawing();
}

function enableRemoveStreet() {
    currentMode = "remove";
    updateButtonStates();
    document.getElementById("measurement").innerHTML = 
        "<strong>REMOVE MODE:</strong> Click a route in the list to remove it";
    map.getContainer().style.cursor = "pointer";
}

function updateButtonStates() {
    const addBtn = document.getElementById("addStreetBtn");
    const removeBtn = document.getElementById("removeStreetBtn");
    const optimizeBtn = document.getElementById("optimizeBtn");
    
    addBtn.style.background = currentMode === "add" ? 
        "linear-gradient(to bottom, #218838, #1e7e34)" : 
        "linear-gradient(to bottom, #28a745, #1e7e34)";
        
    removeBtn.style.background = currentMode === "remove" ? 
        "linear-gradient(to bottom, #e0a800, #d39e00)" : 
        "linear-gradient(to bottom, #ffc107, #e0a800)";
        
    optimizeBtn.style.background = currentMode === "optimize" ? 
        "linear-gradient(to bottom, #7b1fa2, #6a1b9a)" : 
        "linear-gradient(to bottom, #9c27b0, #7b1fa2)";
}

function resetMode() {
    currentMode = "normal";
    map.getContainer().style.cursor = "";
    updateButtonStates();
}

function removeSpecificRoute(routeToRemove) {
    // Find and remove the layer
    drawnItems.eachLayer((layer) => {
        if (layer.routeData && layer.routeData.label === routeToRemove.label) {
            drawnItems.removeLayer(layer);
        }
    });
    
    // Remove from routes data
    const index = routesData.findIndex(route => route.label === routeToRemove.label);
    if (index > -1) {
        routesData.splice(index, 1);
    }
    
    rebuildEndpointMarkers();
    updateRoutesList();
    clearHighlight();
    
    // If network was completed, reset it
    if (isNetworkCompleted) {
        connectionLines.clearLayers();
        mergedNodesLayer.clearLayers();
        mergedNodes.clear();
        isNetworkCompleted = false;
        clearGraph();
    }
    
    resetMode();
    document.getElementById("measurement").innerHTML = 
        `Removed route: ${routeToRemove.label} - ${routeToRemove.name}`;
}

function rebuildEndpointMarkers() {
    endpointMarkers.clearLayers();
    
    if (!isNetworkCompleted) {
        drawnItems.eachLayer((layer) => {
            if (layer.routeData) {
                const latlngs = layer.getLatLngs();
                const route = layer.routeData;
                const startLabel = route.label.split(" → ")[0];
                const endLabel = route.label.split(" → ")[1];
                
                const startMarker = createEndpointMarker(latlngs[0], startLabel, route.color);
                const endMarker = createEndpointMarker(latlngs[latlngs.length - 1], endLabel, route.color);
                
                endpointMarkers.addLayer(startMarker);
                endpointMarkers.addLayer(endMarker);
            }
        });
    }
}

function completeNetwork() {
    if (routesData.length < 2) {
        alert("You need at least 2 streets to complete a network!");
        return;
    }
    
    // Clear previous network completion
    connectionLines.clearLayers();
    mergedNodesLayer.clearLayers();
    endpointMarkers.clearLayers();
    mergedNodes.clear();
    
    // Group endpoints by their labels (nodes with same name)
    const nodeGroups = new Map();
    
    routesData.forEach((route) => {
        const startLabel = route.label.split(" → ")[0];
        const endLabel = route.label.split(" → ")[1];
        
        if (!nodeGroups.has(startLabel)) nodeGroups.set(startLabel, []);
        if (!nodeGroups.has(endLabel)) nodeGroups.set(endLabel, []);
        
        nodeGroups.get(startLabel).push({
            point: route.startPoint,
            route: route,
            type: "start"
        });
        
        nodeGroups.get(endLabel).push({
            point: route.endPoint,
            route: route,
            type: "end"
        });
    });
    
    // Create merged nodes and update route endpoints
    let mergedNodesCount = 0;
    
    nodeGroups.forEach((nodeInstances, nodeName) => {
        if (nodeInstances.length > 1) {
            // This node appears multiple times - merge them
            mergedNodesCount++;
            
            // Calculate center point for this merged node
            const centerLat = nodeInstances.reduce((sum, instance) => sum + instance.point.lat, 0) / nodeInstances.length;
            const centerLng = nodeInstances.reduce((sum, instance) => sum + instance.point.lng, 0) / nodeInstances.length;
            const centerPoint = L.latLng(centerLat, centerLng);
            
            // Store merged node position
            mergedNodes.set(nodeName, centerPoint);
            
            // Create merged node marker
            const mergedMarker = createMergedNodeMarker(centerPoint, nodeName);
            mergedNodesLayer.addLayer(mergedMarker);
            
            // Update the actual route endpoints to point to the merged position
            nodeInstances.forEach((instance) => {
                const routeIndex = routesData.findIndex(r => r === instance.route);
                if (routeIndex !== -1) {
                    if (instance.type === "start") {
                        routesData[routeIndex].startPoint = centerPoint;
                    } else {
                        routesData[routeIndex].endPoint = centerPoint;
                    }
                    
                    // Update the actual line geometry
                    drawnItems.eachLayer((layer) => {
                        if (layer.routeData && layer.routeData === instance.route) {
                            const latlngs = layer.getLatLngs();
                            if (instance.type === "start") {
                                latlngs[0] = centerPoint;
                            } else {
                                latlngs[latlngs.length - 1] = centerPoint;
                            }
                            layer.setLatLngs(latlngs);
                        }
                    });
                }
            });
        } else {
            // Single instance node - create a regular endpoint marker
            const instance = nodeInstances[0];
            const marker = createEndpointMarker(instance.point, nodeName, instance.route.color);
            endpointMarkers.addLayer(marker);
        }
    });
    
    isNetworkCompleted = true;
    updateRoutesList();
    visualizeGraph();
    
    // Update stats
    document.getElementById("nodeCount").textContent = nodeGroups.size;
    document.getElementById("edgeCount").textContent = routesData.length;
    document.getElementById("mergedCount").textContent = mergedNodesCount;
    document.getElementById("streetCount").textContent = routesData.length;
    
    document.getElementById("measurement").innerHTML = `
        <strong>🌐 Network Completed!</strong><br>
        Streets: ${routesData.length}<br>
        Total Nodes: ${nodeGroups.size}<br>
        Merged Nodes: ${mergedNodesCount}<br>
        <small>Blue circles are endpoints<br>Yellow circles are merged nodes</small>
    `;
}

function visualizeGraph() {
    // Clear the graph container
    clearGraph();
    
    // Get all unique nodes
    const nodes = new Set();
    routesData.forEach(route => {
        const [start, end] = route.label.split(" → ");
        nodes.add(start);
        nodes.add(end);
    });
    
    // Create positions for nodes
    const nodeList = Arrayay.from(nodes);
    const graphWidth = graph.offsetWidth;
    const graphHeight = graph.offsetHeight;
    
    // Arrayange nodes in a circle
    if (graphLayout === 'circle') {
        const centerX = graphWidth / 2;
        const centerY = graphHeight / 2;
        const radius = Math.min(graphWidth, graphHeight) * 0.4;
        
        nodeList.forEach((node, i) => {
            const angle = (i / nodeList.length) * 2 * Math.PI;
            const x = centerX + radius * Math.cos(angle) - 20;
            const y = centerY + radius * Math.sin(angle) - 20;
            nodePositions[node] = { x, y };
        });
    } 
    // Arrayange nodes in a force layout (random with some spacing)
    else {
        nodeList.forEach(node => {
            const x = 50 + Math.random() * (graphWidth - 100);
            const y = 50 + Math.random() * (graphHeight - 100);
            nodePositions[node] = { x, y };
        });
    }
    
    // Create nodes
    nodeList.forEach(node => {
        const isMerged = mergedNodes.has(node);
        const nodeEl = document.createElement('div');
        nodeEl.className = `graph-node ${isMerged ? 'merged' : ''}`;
        nodeEl.textContent = node;
        nodeEl.style.left = `${nodePositions[node].x}px`;
        nodeEl.style.top = `${nodePositions[node].y}px`;
        nodeEl.dataset.node = node;
        graph.appendChild(nodeEl);
    });
    
    // Create edges
    routesData.forEach(route => {
        const [start, end] = route.label.split(" → ");
        const startPos = nodePositions[start];
        const endPos = nodePositions[end];
        
        if (startPos && endPos) {
            // Calculate distance between points
            const dx = endPos.x - startPos.x;
            const dy = endPos.y - startPos.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // Calculate angle
            const angle = Math.atan2(dy, dx) * 180 / Math.PI;
            
            // Create edge line
            const edge = document.createElement('div');
            edge.className = 'graph-edge';
            if (optimizationResults.includes(route.label)) {
                edge.classList.add('optimized-edge');
            }
            edge.style.width = `${distance}px`;
            edge.style.left = `${startPos.x + 20}px`;
            edge.style.top = `${startPos.y + 20}px`;
            edge.style.transform = `rotate(${angle}deg)`;
            edge.dataset.route = JSON.stringify(route);
            graph.appendChild(edge);
            
            // Add click event to edge
            edge.addEventListener('click', function(e) {
                e.stopPropagation();
                openEdgeForm(route);
            });
            
            // Create edge label (midpoint)
            const label = document.createElement('div');
            label.className = 'graph-edge-label';
            if (optimizationResults.includes(route.label)) {
                label.classList.add('optimized-edge');
            }
            label.textContent = `${route.distance.toFixed(2)} km`;
            label.style.left = `${(startPos.x + endPos.x) / 2}px`;
            label.style.top = `${(startPos.y + endPos.y) / 2}px`;
            label.dataset.route = JSON.stringify(route);
            graph.appendChild(label);
            
            // Add click event to label
            label.addEventListener('click', function(e) {
                e.stopPropagation();
                openEdgeForm(route);
            });
        }
    });
}

function clearGraph() {
    graph.innerHTML = '';
    nodePositions = {};
}

function arrayangeGraph(layout) {
    graphLayout = layout;
    if (isNetworkCompleted) {
        visualizeGraph();
    }
}

function startDrag(e) {
    if (e.target.classList.contains('graph-node')) {
        isDragging = true;
        dragNode = e.target;
        startX = e.clientX;
        startY = e.clientY;
        dragNode.style.zIndex = 100;
        dragNode.style.cursor = 'grabbing';
    }
}

function dragNodeHandler(e) {
    if (!isDragging || !dragNode) return;
    
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    
    const nodeId = dragNode.dataset.node;
    nodePositions[nodeId].x += dx;
    nodePositions[nodeId].y += dy;
    
    dragNode.style.left = `${nodePositions[nodeId].x}px`;
    dragNode.style.top = `${nodePositions[nodeId].y}px`;
    
    startX = e.clientX;
    startY = e.clientY;
    
    // Update edges connected to this node
    updateEdgesForNode(nodeId);
}

function updateEdgesForNode(nodeId) {
    // Remove all edges and labels
    document.querySelectorAll('.graph-edge, .graph-edge-label').forEach(el => el.remove());
    
    // Recreate all edges
    routesData.forEach(route => {
        const [start, end] = route.label.split(" → ");
        const startPos = nodePositions[start];
        const endPos = nodePositions[end];
        
        if (startPos && endPos) {
            // Calculate distance between points
            const dx = endPos.x - startPos.x;
            const dy = endPos.y - startPos.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // Calculate angle
            const angle = Math.atan2(dy, dx) * 180 / Math.PI;
            
            // Create edge line
            const edge = document.createElement('div');
            edge.className = 'graph-edge';
            if (optimizationResults.includes(route.label)) {
                edge.classList.add('optimized-edge');
            }
            edge.style.width = `${distance}px`;
            edge.style.left = `${startPos.x + 20}px`;
            edge.style.top = `${startPos.y + 20}px`;
            edge.style.transform = `rotate(${angle}deg)`;
            edge.dataset.route = JSON.stringify(route);
            graph.appendChild(edge);
            
            // Add click event to edge
            edge.addEventListener('click', function(e) {
                e.stopPropagation();
                openEdgeForm(route);
            });
            
            // Create edge label (midpoint)
            const label = document.createElement('div');
            label.className = 'graph-edge-label';
            if (optimizationResults.includes(route.label)) {
                label.classList.add('optimized-edge');
            }
            label.textContent = `${route.distance.toFixed(2)} km`;
            label.style.left = `${(startPos.x + endPos.x) / 2}px`;
            label.style.top = `${(startPos.y + endPos.y) / 2}px`;
            label.dataset.route = JSON.stringify(route);
            graph.appendChild(label);
            
            // Add click event to label
            label.addEventListener('click', function(e) {
                e.stopPropagation();
                openEdgeForm(route);
            });
        }
    });
}

function endDrag() {
    if (isDragging && dragNode) {
        isDragging = false;
        dragNode.style.zIndex = 10;
        dragNode.style.cursor = 'pointer';
        dragNode = null;
    }
}

function performSearch() {
    const searchTerm = document.getElementById("streetSearch").value.trim();
    if (!searchTerm) {
        alert("Please enter a search term");
        return;
    }
    
    highlightRoute(searchTerm);
}

function highlightRoute(streetName) {
    clearHighlight();
    
    const matchingRoutes = routesData.filter(route => 
        route.name.toLowerCase().includes(streetName.toLowerCase())
    );
    
    if (matchingRoutes.length === 0) {
        alert(`No routes found containing "${streetName}"`);
        return;
    }
    
    let totalDistance = 0;
    let routeLabels = [];
    
    matchingRoutes.forEach(route => {
        totalDistance += route.distance;
        routeLabels.push(route.label);
        
        drawnItems.eachLayer(layer => {
            if (layer.routeData && layer.routeData.name === route.name) {
                const highlightLine = L.polyline(layer.getLatLngs(), {
                    color: "#ff6b35",
                    weight: 8,
                    opacity: 0.7,
                    dashArrayay: "10, 5",
                });
                highlightLayer.addLayer(highlightLine);
            }
        });
    });
    
    document.getElementById("measurement").innerHTML = `
        <strong>Found "${streetName}"</strong><br>
        Routes: ${routeLabels.join(", ")}<br>
        Total Distance: ${totalDistance.toFixed(3)} km<br>
        Segments: ${matchingRoutes.length}
    `;
}

function clearHighlight() {
    highlightLayer.clearLayers();
    
    if (routesData.length > 0) {
        document.getElementById("measurement").innerHTML = 
            "Search cleared - Draw lines to measure distances";
    } else {
        document.getElementById("measurement").innerHTML = 
            "Draw a line to measure distance";
    }
}

function openEdgeForm(route) {
    currentEdge = route;
    document.getElementById('streetName').value = route.name;
    document.getElementById('damageLevel').value = route.damage || 'low';
    document.getElementById('responseTime').value = route.responseTime || 24;
    document.getElementById('edgeForm').style.display = 'block';
}

function closeEdgeForm() {
    document.getElementById('edgeForm').style.display = 'none';
    currentEdge = null;
}

function saveEdgeInfo() {
    if (currentEdge) {
        currentEdge.name = document.getElementById('streetName').value;
        currentEdge.damage = document.getElementById('damageLevel').value;
        currentEdge.responseTime = parseInt(document.getElementById('responseTime').value);
        
        // Update the route list
        updateRoutesList();
        
        // Update the tooltip on the map
        drawnItems.eachLayer(layer => {
            if (layer.routeData && layer.routeData.label === currentEdge.label) {
                layer.bindTooltip(
                    `${currentEdge.label}<br>${currentEdge.name}<br>${currentEdge.distance.toFixed(3)} km`,
                    { permanent: false, direction: "center", className: "distance-label" }
                );
            }
        });
        
        closeEdgeForm();
        alert("Street information updated successfully!");
    }
}

function startDrawing() {
    map.off('click');
    map.on('click', function(e) {
        if (currentMode !== 'add') return;
        
        const startPoint = e.latlng;
        const startLabel = LETTERS[drawCount];
        
        // Create temporary marker
        const tempMarker = L.marker(startPoint, {
            icon: L.divIcon({
                className: 'temp-marker',
                html: `<div style="background: #007bff; color: white; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-weight: bold;">${startLabel}</div>`,
                iconSize: [20, 20]
            })
        }).addTo(map);
        
        let polyline = null;
        
        map.on('mousemove', function(e) {
            if (polyline) {
                map.removeLayer(polyline);
            }
            
            polyline = L.polyline([startPoint, e.latlng], {
                color: 'red',
                weight: 3
            }).addTo(map);
        });
        
        map.on('click', function(e) {
            map.off('mousemove');
            map.off('click');
            
            if (polyline) {
                map.removeLayer(polyline);
            }
            
            const endPoint = e.latlng;
            const endLabel = LETTERS[drawCount + 1];
            const routeLabel = `${startLabel} → ${endLabel}`;
            
            // Remove temp marker
            map.removeLayer(tempMarker);
            
            // Create the actual line
            const actualLine = L.polyline([startPoint, endPoint], {
                color: 'red',
                weight: 4
            }).addTo(drawnItems);
            
            // Calculate distance
            const distance = startPoint.distanceTo(endPoint) / 1000;
            
            // Ask for street name
            const streetName = prompt(`Enter the street name for route ${routeLabel}:`, "Unnamed Street") || "Unnamed Street";
            
            // Get color based on distance
            const lineColor = getColor(distance);
            actualLine.setStyle({ color: lineColor });
            
            // Save route data
            const routeData = {
                label: routeLabel,
                name: streetName,
                distance: distance,
                color: lineColor,
                startPoint: startPoint,
                endPoint: endPoint,
                damage: 'medium',
                responseTime: 24
            };
            routesData.push(routeData);
            actualLine.routeData = routeData;
            
            // Add endpoint markers
            if (!isNetworkCompleted) {
                const startMarker = createEndpointMarker(startPoint, startLabel, lineColor);
                const endMarker = createEndpointMarker(endPoint, endLabel, lineColor);
                endpointMarkers.addLayer(startMarker);
                endpointMarkers.addLayer(endMarker);
            }
            
            // Add tooltip
            actualLine.bindTooltip(
                `${routeLabel}<br>${streetName}<br>${distance.toFixed(3)} km`,
                { permanent: false, direction: "center", className: "distance-label" }
            );
            
            drawCount++;
            updateRoutesList();
            
            // Reset mode after adding
            resetMode();
            
            // Reset network if completed
            if (isNetworkCompleted) {
                connectionLines.clearLayers();
                mergedNodesLayer.clearLayers();
                mergedNodes.clear();
                isNetworkCompleted = false;
                rebuildEndpointMarkers();
                updateRoutesList();
                clearGraph();
            }
        });
    });
}

// Knapsack algorithm for maintenance optimization
function optimizeMaintenance() {
    if (routesData.length === 0) {
        alert("Please add at least one road to optimize");
        return;
    }
    
    // Clear previous optimization highlights
    highlightLayer.clearLayers();
    optimizationResults = [];
    
    // Convert damage levels to scores
    const damageScores = {
        'low': 1,
        'medium': 2,
        'high': 3
    };
    
    // Prepare items for knapsack
    const items = routesData.map(route => {
        return {
            label: route.label,
            name: route.name,
            damageScore: damageScores[route.damage] || 1,
            responseDays: (route.responseTime || 24) / 24, // Convert hours to days
            route: route
        };
    });
    
    // Knapsack capacity (30 days)
    const capacity = 30;
    
    // Solve knapsack problem
    const result = knapSack(capacity, items);
    
    // Update optimization results
    optimizationResults = result.selectedItems.map(item => item.label);
    
    // Display results
    displayOptimizationResults(result);
    
    // Highlight optimized roads on map
    result.selectedItems.forEach(item => {
        drawnItems.eachLayer(layer => {
            if (layer.routeData && layer.routeData.label === item.label) {
                const highlightLine = L.polyline(layer.getLatLngs(), {
                    color: "#9c27b0",
                    weight: 8,
                    opacity: 0.7,
                    dashArrayay: "10, 5",
                });
                highlightLayer.addLayer(highlightLine);
            }
        });
    });
    
    // Update graph visualization
    if (isNetworkCompleted) {
        visualizeGraph();
    }
    
    document.getElementById("measurement").innerHTML = `
        <strong>🔧 Maintenance Optimization Complete</strong><br>
        Prioritized roads: ${result.selectedItems.length}<br>
        Total damage score: ${result.totalValue}<br>
        Days required: ${result.totalWeight.toFixed(1)} days
    `;
}

function displayOptimizationResults(result) {
    const priorityList = document.getElementById("priorityList");
    priorityList.innerHTML = "";
    
    if (result.selectedItems.length === 0) {
        priorityList.innerHTML = '<div class="priority-item">No roads selected. Increase capacity or add more roads.</div>';
        return;
    }
    
    // Sort by damage score (descending)
    result.selectedItems.sort((a, b) => b.damageScore - a.damageScore);
    
    result.selectedItems.forEach(item => {
        const priorityItem = document.createElement("div");
        let damageClass = "";
        
        switch(item.route.damage) {
            case 'high':
                damageClass = 'high';
                break;
            case 'medium':
                damageClass = 'medium';
                break;
            default:
                damageClass = 'low';
        }
        
        priorityItem.className = `priority-item ${damageClass}`;
        priorityItem.innerHTML = `
            <strong>${item.name}</strong><br>
            <span>${item.label} | Damage: ${item.route.damage}</span><br>
            <span>Response: ${item.route.responseTime} hours (${item.responseDays.toFixed(1)} days)</span>
        `;
        priorityList.appendChild(priorityItem);
    });
    
    // Update stats
    document.getElementById("totalDamage").textContent = result.totalValue;
    document.getElementById("daysRequired").textContent = result.totalWeight.toFixed(1);
    document.getElementById("roadsOptimized").textContent = result.selectedItems.length;
    document.getElementById("capacityUsed").textContent = `${Math.round((result.totalWeight / 30) * 100)}%`;
    
    // Show results panel
    document.getElementById("optimizationResults").style.display = 'block';
}

// Initialize
updateRoutesList();

// Quick Sort draft onliii 
function quickSort(array, low = 0, high = array.length - 1, compareFunction, steps = []) {

    if (low < high) {
        const partitionIndex = partition(array, low, high, compareFunction, steps);
        quickSort(array, low, partitionIndex - 1, compareFunction, steps);
        quickSort(array, partitionIndex + 1, high, compareFunction, steps);
    }

    return { sorted: array, steps: steps };

}

function partition(array, low, high, compareFunction, steps) {

    const pivot = array[high];
    let i = low - 1;

    steps.push({
        action: `Partitioning with pivot: ${pivot.name} (${pivot.distance.toFixed(3)} km)`,
        array: [...array],
        pivotIndex: high,
        lowIndex: low,
        highIndex: high
    });

    for (let j = low; j < high; j++) {
        if (compareFunction(array[j], pivot) <= 0) {
            i++;
            [array[i], array[j]] = [array[j], array[i]];
            steps.push({
                action: `Swapped ${array[i].name} with ${array[j].name}`,
                array: [...array],
                swapped: [i, j]
            });
        }
    }

    [array[i + 1], array[high]] = [array[high], array[i + 1]];
    steps.push({
        action: `Placed pivot ${pivot.name} at position ${i + 1}`,
        array: [...array],
        pivotFinal: i + 1
    });

    return i + 1;

}   