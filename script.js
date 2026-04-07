// ========== VERIFICACIÓN DE AUTENTICACIÓN ==========
let currentUser = null;

function checkAuth() {
    // Verificar sesión en localStorage o sessionStorage
    const session = localStorage.getItem('agroiot_session') || sessionStorage.getItem('agroiot_session');
    
    if (!session) {
        window.location.href = 'login.html';
        return false;
    }
    
    try {
        const sessionData = JSON.parse(session);
        if (!sessionData.isLoggedIn) {
            window.location.href = 'login.html';
            return false;
        }
        currentUser = sessionData.user;
        return true;
    } catch(e) {
        window.location.href = 'login.html';
        return false;
    }
}

// ========== CERRAR SESIÓN ==========
function logout() {
    localStorage.removeItem('agroiot_session');
    sessionStorage.removeItem('agroiot_session');
    window.location.href = 'login.html';
}

// ========== CONFIGURACIÓN DE SENSORES PARA PLANTAS ==========
let SENSORS = [
    { id: 'temp_norte', name: '🌡️ Temperatura', location: 'Zona Norte - Tomates', unit: '°C', min: 18, max: 28, type: 'temp', zone: 'norte', pinned: false, value: 23.5, icon: 'fa-temperature-high' },
    { id: 'soil_norte', name: '💧 Humedad Suelo', location: 'Zona Norte - Tomates', unit: '%', min: 60, max: 80, type: 'soil', zone: 'norte', pinned: false, value: 72, icon: 'fa-tint' },
    { id: 'temp_sur', name: '🌡️ Temperatura', location: 'Zona Sur - Lechugas', unit: '°C', min: 15, max: 24, type: 'temp', zone: 'sur', pinned: false, value: 20.1, icon: 'fa-temperature-high' },
    { id: 'soil_sur', name: '💧 Humedad Suelo', location: 'Zona Sur - Lechugas', unit: '%', min: 65, max: 85, type: 'soil', zone: 'sur', pinned: false, value: 78, icon: 'fa-tint' },
    { id: 'light_este', name: '☀️ Luz Solar', location: 'Zona Este - Pimientos', unit: 'lux', min: 20000, max: 80000, type: 'light', zone: 'este', pinned: false, value: 45000, icon: 'fa-sun' },
    { id: 'humidity_oeste', name: '💨 Humedad Ambiente', location: 'Zona Oeste - Fresas', unit: '%', min: 40, max: 70, type: 'humidity', zone: 'oeste', pinned: false, value: 55, icon: 'fa-tachometer-alt' },
    { id: 'ph_invernadero', name: '🧪 pH Suelo', location: 'Invernadero - Hidroponía', unit: 'pH', min: 5.5, max: 6.8, type: 'ph', zone: 'invernadero', pinned: false, value: 6.2, icon: 'fa-flask' },
    { id: 'temp_invernadero', name: '🌡️ Temperatura', location: 'Invernadero - Hidroponía', unit: '°C', min: 20, max: 26, type: 'temp', zone: 'invernadero', pinned: false, value: 23.8, icon: 'fa-temperature-high' }
];

let readingsHistory = [];
let alerts = [];
let chartInstance = null;
let intervalId = null;
let currentSensorFilter = 'all';
let currentTimeRange = 15;
let currentZoneFilter = 'all';
let alertFilter = 'all';

// ========== FUNCIONES DE USUARIO ==========
function updateUserUI() {
    const userNameSpan = document.getElementById('userName');
    const userRoleSpan = document.getElementById('userRole');
    
    if (userNameSpan && currentUser) {
        userNameSpan.textContent = currentUser.name;
    }
    if (userRoleSpan && currentUser) {
        let roleText = '';
        switch(currentUser.role) {
            case 'admin': roleText = 'Administrador'; break;
            case 'farmer': roleText = 'Agricultor'; break;
            default: roleText = 'Usuario';
        }
        userRoleSpan.textContent = roleText;
    }
    
    // Restringir zonas según el rol del usuario
    if (currentUser && currentUser.zone !== 'all') {
        currentZoneFilter = currentUser.zone;
        const zoneSelect = document.getElementById('zoneFilter');
        if (zoneSelect) {
            zoneSelect.value = currentUser.zone;
            zoneSelect.disabled = true;
        }
    }
}

// ========== FUNCIONES AUXILIARES ==========
function showToast(message, type = 'info') {
    const toastDiv = document.createElement('div');
    toastDiv.className = 'toast';
    const icon = type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle';
    toastDiv.innerHTML = `<i class="fas ${icon}"></i> ${message}`;
    document.body.appendChild(toastDiv);
    setTimeout(() => toastDiv.remove(), 3000);
}

function generateReading(sensor) {
    let base = (sensor.min + sensor.max) / 2;
    let variation = (Math.random() - 0.5) * (sensor.max - sensor.min) * 0.3;
    let value = base + variation;
    
    if (Math.random() < 0.1) {
        if (sensor.type === 'soil') {
            value = Math.random() > 0.5 ? sensor.min - (Math.random() * 15) : sensor.max + (Math.random() * 10);
        } else if (sensor.type === 'ph') {
            value = Math.random() > 0.5 ? sensor.min - (Math.random() * 1.5) : sensor.max + (Math.random() * 1);
        } else {
            value = Math.random() > 0.6 ? sensor.min - (Math.random() * 5) : sensor.max + (Math.random() * 8);
        }
    }
    
    if (sensor.type === 'ph') {
        return parseFloat(Math.min(Math.max(value, sensor.min - 2), sensor.max + 1.5).toFixed(1));
    }
    return parseFloat(Math.min(Math.max(value, sensor.min - 10), sensor.max + 15).toFixed(1));
}

function checkAnomaly(sensor, value) {
    if (value < sensor.min || value > sensor.max) {
        let isCritical = false;
        let message = '';
        
        if (sensor.type === 'soil') {
            isCritical = (value < sensor.min - 15 || value > sensor.max + 10);
            message = `${isCritical ? '🔴 CRÍTICA' : '🟡 ALERTA'} ${sensor.name} en ${sensor.location}: ${value}${sensor.unit} - ${value < sensor.min ? 'Suelo seco' : 'Exceso de humedad'}`;
        } else if (sensor.type === 'ph') {
            isCritical = (value < sensor.min - 1 || value > sensor.max + 0.8);
            message = `${isCritical ? '🔴 CRÍTICA' : '🟡 ALERTA'} pH en ${sensor.location}: ${value} - ${value < sensor.min ? 'Suelo ácido' : 'Suelo alcalino'}`;
        } else if (sensor.type === 'temp') {
            isCritical = (value < sensor.min - 4 || value > sensor.max + 6);
            message = `${isCritical ? '🔴 CRÍTICA' : '🟡 ALERTA'} Temperatura en ${sensor.location}: ${value}°C`;
        } else {
            isCritical = (value < sensor.min - 10 || value > sensor.max + 15);
            message = `${isCritical ? '🔴 CRÍTICA' : '🟡 ALERTA'} ${sensor.name} en ${sensor.location}: ${value}${sensor.unit}`;
        }
        
        const severity = isCritical ? 'critical' : 'warning';
        const exists = alerts.some(a => a.msg === message && (Date.now() - a.timestamp) < 60000);
        if (!exists) {
            alerts.unshift({ msg: message, timestamp: Date.now(), severity, sensorId: sensor.id });
            if (alerts.length > 50) alerts.pop();
            showToast(message, severity === 'critical' ? 'error' : 'warning');
            updateAlertUI();
        }
        return true;
    }
    return false;
}

function updateAlertUI() {
    const alertsListEl = document.getElementById('alertsList');
    if (!alertsListEl) return;
    
    let filteredAlerts = alerts;
    if (alertFilter === 'critical') filteredAlerts = alerts.filter(a => a.severity === 'critical');
    if (alertFilter === 'warning') filteredAlerts = alerts.filter(a => a.severity === 'warning');
    
    if (filteredAlerts.length === 0) {
        alertsListEl.innerHTML = '<li>✅ Sin alertas activas - Cultivos saludables</li>';
    } else {
        alertsListEl.innerHTML = filteredAlerts.map(a => `
            <li>
                <i class="fas ${a.severity === 'critical' ? 'fa-skull-crosswalk' : 'fa-exclamation-triangle'}"></i>
                <span>[${new Date(a.timestamp).toLocaleTimeString()}] ${a.msg}</span>
            </li>
        `).join('');
    }
    
    const activeCount = alerts.filter(a => (Date.now() - a.timestamp) < 300000).length;
    const alertCountHeader = document.getElementById('alertCountHeader');
    const alertBadge = document.getElementById('alertBadge');
    if (alertCountHeader) alertCountHeader.innerText = activeCount;
    if (alertBadge) alertBadge.innerText = activeCount;
}

function updateStats() {
    const now = Date.now();
    const recent = readingsHistory.filter(r => (now - r.ts) < 300000);
    
    const temps = recent.filter(r => r.type === 'temp').map(r => r.value);
    const soils = recent.filter(r => r.type === 'soil').map(r => r.value);
    const lights = recent.filter(r => r.type === 'light').map(r => r.value);
    
    const avgTempSpan = document.getElementById('avgTemp');
    const avgSoilSpan = document.getElementById('avgSoil');
    const avgLightSpan = document.getElementById('avgLight');
    const healthStatusSpan = document.getElementById('healthStatus');
    
    if (avgTempSpan) avgTempSpan.innerText = temps.length ? (temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1) + '°C' : '--°C';
    if (avgSoilSpan) avgSoilSpan.innerText = soils.length ? (soils.reduce((a, b) => a + b, 0) / soils.length).toFixed(0) + '%' : '--%';
    if (avgLightSpan) avgLightSpan.innerText = lights.length ? Math.round((lights.reduce((a, b) => a + b, 0) / lights.length)).toLocaleString() + ' lux' : '-- lux';
    
    let healthScore = 100;
    const lastReadings = readingsHistory.slice(-20);
    const anomalies = lastReadings.filter(r => r.isAnomaly).length;
    healthScore = Math.max(0, 100 - (anomalies * 5));
    if (healthStatusSpan) {
        healthStatusSpan.innerText = healthScore + '%';
        if (healthScore >= 80) {
            healthStatusSpan.style.color = '#22c55e';
        } else if (healthScore >= 50) {
            healthStatusSpan.style.color = '#f59e0b';
        } else {
            healthStatusSpan.style.color = '#ef4444';
        }
    }
}

function updateRecommendations() {
    const recommendationsList = document.getElementById('recommendationsList');
    if (!recommendationsList) return;
    
    const lastSoil = readingsHistory.filter(r => r.type === 'soil').slice(-5);
    const lastTemp = readingsHistory.filter(r => r.type === 'temp').slice(-5);
    const lastPh = readingsHistory.filter(r => r.type === 'ph').slice(-5);
    
    const avgSoil = lastSoil.length ? lastSoil.reduce((a,b) => a + b.value, 0) / lastSoil.length : 70;
    const avgTemp = lastTemp.length ? lastTemp.reduce((a,b) => a + b.value, 0) / lastTemp.length : 22;
    const avgPh = lastPh.length ? lastPh.reduce((a,b) => a + b.value, 0) / lastPh.length : 6.2;
    
    const recommendations = [];
    
    if (avgSoil < 55) {
        recommendations.push('💧 ¡Suelo seco! Se recomienda activar riego en las próximas 2 horas.');
    } else if (avgSoil > 85) {
        recommendations.push('⚠️ Exceso de humedad en el suelo. Reducir frecuencia de riego.');
    } else {
        recommendations.push('✅ Nivel de humedad del suelo óptimo. Mantener plan de riego actual.');
    }
    
    if (avgTemp > 28) {
        recommendations.push('🌡️ Temperatura elevada. Activar ventilación o sombreado en invernadero.');
    } else if (avgTemp < 16) {
        recommendations.push('❄️ Temperatura baja. Proteger cultivos sensibles al frío.');
    }
    
    if (avgPh < 5.5) {
        recommendations.push('🧪 Suelo ácido. Aplicar cal agrícola para subir el pH.');
    } else if (avgPh > 7.0) {
        recommendations.push('🧪 Suelo alcalino. Aplicar azufre o materia orgánica para bajar el pH.');
    }
    
    if (recommendations.length === 0) {
        recommendations.push('🌱 Todo en orden. Tus cultivos están en condiciones óptimas.');
        recommendations.push('📊 Revisa la gráfica de tendencias para planificar la próxima cosecha.');
    }
    
    recommendationsList.innerHTML = recommendations.map(rec => `<li><i class="fas fa-leaf"></i> ${rec}</li>`).join('');
}

function updateChart() {
    if (!chartInstance) return;
    
    let filteredHistory = [...readingsHistory];
    if (currentTimeRange > 0) {
        const limit = Date.now() - (currentTimeRange * 60 * 1000);
        filteredHistory = filteredHistory.filter(r => r.ts > limit);
    }
    if (currentSensorFilter !== 'all') {
        filteredHistory = filteredHistory.filter(r => r.type === currentSensorFilter);
    }
    if (currentZoneFilter !== 'all') {
        filteredHistory = filteredHistory.filter(r => r.zone === currentZoneFilter);
    }
    
    const sensorGroups = {};
    filteredHistory.forEach(r => {
        if (!sensorGroups[r.sensorId]) sensorGroups[r.sensorId] = [];
        sensorGroups[r.sensorId].push(r);
    });
    
    const datasets = [];
    const colors = {
        temp: '#ef4444', soil: '#3b82f6', light: '#f59e0b',
        humidity: '#8b5cf6', ph: '#10b981'
    };
    
    Object.keys(sensorGroups).forEach(sid => {
        const sensorData = sensorGroups[sid].slice(-20);
        const sensorObj = SENSORS.find(s => s.id === sid);
        if (sensorObj) {
            datasets.push({
                label: `${sensorObj.name} (${sensorObj.location})`,
                data: sensorData.map(p => p.value),
                borderColor: colors[sensorObj.type] || '#22c55e',
                backgroundColor: 'transparent',
                borderWidth: 2,
                pointRadius: 3,
                pointHoverRadius: 6,
                fill: false,
                tension: 0.3
            });
        }
    });
    
    const labels = filteredHistory.slice(-20).map(r => r.timeLabel);
    chartInstance.data.datasets = datasets;
    chartInstance.data.labels = labels;
    chartInstance.update();
}

function renderSensors() {
    const sensorsGrid = document.getElementById('sensorsGrid');
    if (!sensorsGrid) return;
    
    let filtered = [...SENSORS];
    if (currentSensorFilter !== 'all') {
        filtered = filtered.filter(s => s.type === currentSensorFilter);
    }
    if (currentZoneFilter !== 'all') {
        filtered = filtered.filter(s => s.zone === currentZoneFilter);
    }
    
    filtered.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
    
    sensorsGrid.innerHTML = '';
    
    filtered.forEach(sensor => {
        const isAnomaly = (sensor.value < sensor.min || sensor.value > sensor.max);
        const statusText = isAnomaly ? '⚠️ Atención' : '🌱 Óptimo';
        const statusColor = isAnomaly ? '#ef4444' : '#22c55e';
        
        const card = document.createElement('div');
        card.className = `sensor-card ${isAnomaly ? 'anomaly' : ''}`;
        card.innerHTML = `
            <div class="sensor-header">
                <span class="sensor-name"><i class="fas ${sensor.icon}"></i> ${sensor.name}</span>
                <button class="pin-btn ${sensor.pinned ? 'pinned' : ''}" data-id="${sensor.id}">
                    <i class="fas fa-thumbtack"></i>
                </button>
            </div>
            <div class="sensor-location">
                <i class="fas fa-map-marker-alt"></i> ${sensor.location}
            </div>
            <div class="sensor-value">
                ${sensor.value} <span style="font-size:1rem">${sensor.unit}</span>
            </div>
            <div class="sensor-range">
                <i class="fas fa-chart-line"></i> Óptimo: ${sensor.min} - ${sensor.max} ${sensor.unit}
            </div>
            <div class="sensor-footer">
                <span><i class="fas fa-clock"></i> ${new Date().toLocaleTimeString()}</span>
                <span style="color:${statusColor}"><i class="fas ${isAnomaly ? 'fa-bell' : 'fa-check-circle'}"></i> ${statusText}</span>
            </div>
        `;
        sensorsGrid.appendChild(card);
    });
    
    document.querySelectorAll('.pin-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            const sensor = SENSORS.find(s => s.id === id);
            if (sensor) {
                sensor.pinned = !sensor.pinned;
                renderSensors();
                savePins();
                showToast(`${sensor.name} ${sensor.pinned ? 'fijado' : 'liberado'}`, 'info');
            }
        });
    });
}

function takeReadings() {
    SENSORS.forEach(sensor => {
        const newVal = generateReading(sensor);
        sensor.value = newVal;
        const isAnomaly = checkAnomaly(sensor, newVal);
        
        const readingEntry = {
            sensorId: sensor.id,
            type: sensor.type,
            zone: sensor.zone,
            value: newVal,
            ts: Date.now(),
            timeLabel: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            isAnomaly: isAnomaly
        };
        
        readingsHistory.push(readingEntry);
        if (readingsHistory.length > 300) readingsHistory.shift();
    });
    
    renderSensors();
    updateStats();
    updateChart();
    updateAlertUI();
    updateRecommendations();
}

function exportCSV() {
    if (readingsHistory.length === 0) {
        showToast('No hay datos para exportar', 'warning');
        return;
    }
    
    const headers = ['Sensor', 'Zona', 'Tipo', 'Valor', 'Timestamp', 'Anomalía'];
    const rows = readingsHistory.map(r => {
        const sensor = SENSORS.find(s => s.id === r.sensorId);
        return [sensor?.name || r.sensorId, r.zone, r.type, r.value, new Date(r.ts).toLocaleString(), r.isAnomaly ? 'Sí' : 'No'];
    });
    
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agroiot_export_${new Date().toISOString().slice(0, 19)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exportación completada', 'success');
}

function openModal() {
    const modal = document.getElementById('thresholdModal');
    const listDiv = document.getElementById('thresholdsList');
    if (!modal || !listDiv) return;
    
    listDiv.innerHTML = SENSORS.map(s => `
        <div class="threshold-row">
            <strong><i class="fas ${s.icon}"></i> ${s.name} (${s.location})</strong>
            <div>
                <input type="number" id="min_${s.id}" value="${s.min}" step="${s.type === 'ph' ? 0.1 : 1}" style="width:70px"> - 
                <input type="number" id="max_${s.id}" value="${s.max}" step="${s.type === 'ph' ? 0.1 : 1}" style="width:70px"> ${s.unit}
            </div>
        </div>
    `).join('');
    modal.style.display = 'flex';
}

function saveThresholds() {
    SENSORS.forEach(s => {
        const minInput = document.getElementById(`min_${s.id}`);
        const maxInput = document.getElementById(`max_${s.id}`);
        if (minInput && maxInput) {
            const newMin = parseFloat(minInput.value);
            const newMax = parseFloat(maxInput.value);
            if (!isNaN(newMin)) s.min = newMin;
            if (!isNaN(newMax)) s.max = newMax;
        }
    });
    const modal = document.getElementById('thresholdModal');
    if (modal) modal.style.display = 'none';
    showToast('Umbrales agrícolas actualizados', 'success');
    takeReadings();
}

function openIrrigationModal() {
    const modal = document.getElementById('irrigationModal');
    const infoDiv = document.getElementById('irrigationInfo');
    if (!modal || !infoDiv) return;
    
    const lastSoil = readingsHistory.filter(r => r.type === 'soil').slice(-10);
    const avgSoil = lastSoil.length ? lastSoil.reduce((a,b) => a + b.value, 0) / lastSoil.length : 70;
    const needsWater = avgSoil < 60;
    
    infoDiv.innerHTML = `
        <div style="text-align:center; padding:15px;">
            <i class="fas fa-tint" style="font-size:3rem; color:#3b82f6;"></i>
            <p style="margin:15px 0;"><strong>Humedad promedio del suelo:</strong> ${avgSoil.toFixed(1)}%</p>
            <p style="margin:10px 0;">${needsWater ? '⚠️ Los cultivos necesitan riego' : '✅ La humedad del suelo es adecuada'}</p>
            <div style="background:#e2e8f0; border-radius:10px; height:10px; margin:15px 0;">
                <div style="background:#3b82f6; width:${avgSoil}%; height:10px; border-radius:10px;"></div>
            </div>
            <p style="font-size:0.85rem;">Usuario: ${currentUser?.name || 'Desconocido'}</p>
        </div>
    `;
    modal.style.display = 'flex';
}

function activateManualRiego() {
    showToast('💧 Sistema de riego activado manualmente', 'success');
    setTimeout(() => {
        const soilSensors = SENSORS.filter(s => s.type === 'soil');
        soilSensors.forEach(s => {
            s.value = Math.min(s.max, s.value + 8);
        });
        takeReadings();
        showToast('✅ Riego completado - Humedad del suelo aumentada', 'success');
    }, 2000);
    const modal = document.getElementById('irrigationModal');
    if (modal) modal.style.display = 'none';
}

function toggleTheme() {
    if (document.body.classList.contains('dark')) {
        document.body.classList.remove('dark');
        localStorage.setItem('agroiot_theme', 'light');
    } else {
        document.body.classList.add('dark');
        localStorage.setItem('agroiot_theme', 'dark');
    }
}

function savePins() {
    const pins = {};
    SENSORS.forEach(s => { pins[s.id] = s.pinned; });
    localStorage.setItem('agroiot_pins', JSON.stringify(pins));
}

function loadPreferences() {
    const savedTheme = localStorage.getItem('agroiot_theme');
    if (savedTheme === 'dark') document.body.classList.add('dark');
    
    const savedPins = localStorage.getItem('agroiot_pins');
    if (savedPins) {
        try {
            const pins = JSON.parse(savedPins);
            SENSORS.forEach(s => {
                if (pins[s.id]) s.pinned = pins[s.id];
            });
        } catch(e) {}
    }
}

function initChart() {
    const canvas = document.getElementById('trendChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    chartInstance = new Chart(ctx, {
        type: 'line',
        data: { labels: [], datasets: [] },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { position: 'top', labels: { usePointStyle: true, boxWidth: 10 } },
                tooltip: { mode: 'index', intersect: false }
            },
            scales: {
                y: { beginAtZero: false, grid: { color: '#e2e8f0' } },
                x: { grid: { display: false } }
            }
        }
    });
}

function setupEventListeners() {
    const sensorTypeFilter = document.getElementById('sensorTypeFilter');
    const timeRangeFilter = document.getElementById('timeRangeFilter');
    const zoneFilter = document.getElementById('zoneFilter');
    const forceRefreshBtn = document.getElementById('forceRefreshBtn');
    const clearAlertsBtn = document.getElementById('clearAlertsBtn');
    const exportBtn = document.getElementById('exportBtn');
    const configBtn = document.getElementById('configBtn');
    const irrigationBtn = document.getElementById('irrigationBtn');
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const saveThresholdsBtn = document.getElementById('saveThresholdsBtn');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const closeIrrigationModal = document.getElementById('closeIrrigationModal');
    const manualRiegoBtn = document.getElementById('manualRiegoBtn');
    
    if (sensorTypeFilter) {
        sensorTypeFilter.addEventListener('change', (e) => {
            currentSensorFilter = e.target.value;
            renderSensors();
            updateChart();
        });
    }
    
    if (timeRangeFilter) {
        timeRangeFilter.addEventListener('change', (e) => {
            currentTimeRange = parseInt(e.target.value);
            updateChart();
            updateStats();
        });
    }
    
    if (zoneFilter && (!currentUser || currentUser.zone === 'all')) {
        zoneFilter.addEventListener('change', (e) => {
            currentZoneFilter = e.target.value;
            renderSensors();
            updateChart();
        });
    }
    
    if (forceRefreshBtn) forceRefreshBtn.addEventListener('click', () => takeReadings());
    if (clearAlertsBtn) {
        clearAlertsBtn.addEventListener('click', () => {
            alerts = [];
            updateAlertUI();
            showToast('Alertas limpiadas', 'info');
        });
    }
    if (exportBtn) exportBtn.addEventListener('click', exportCSV);
    if (configBtn && currentUser && currentUser.role === 'admin') {
        configBtn.addEventListener('click', openModal);
    } else if (configBtn) {
        configBtn.style.opacity = '0.5';
        configBtn.disabled = true;
        configBtn.title = 'Solo administradores';
    }
    if (irrigationBtn) irrigationBtn.addEventListener('click', openIrrigationModal);
    if (themeToggleBtn) themeToggleBtn.addEventListener('click', toggleTheme);
    if (logoutBtn) logoutBtn.addEventListener('click', logout);
    if (saveThresholdsBtn) saveThresholdsBtn.addEventListener('click', saveThresholds);
    if (closeModalBtn) closeModalBtn.addEventListener('click', () => {
        const modal = document.getElementById('thresholdModal');
        if (modal) modal.style.display = 'none';
    });
    if (closeIrrigationModal) closeIrrigationModal.addEventListener('click', () => {
        const modal = document.getElementById('irrigationModal');
        if (modal) modal.style.display = 'none';
    });
    if (manualRiegoBtn) manualRiegoBtn.addEventListener('click', activateManualRiego);
    
    window.addEventListener('click', (e) => {
        const thresholdModal = document.getElementById('thresholdModal');
        const irrigationModal = document.getElementById('irrigationModal');
        if (e.target === thresholdModal) thresholdModal.style.display = 'none';
        if (e.target === irrigationModal) irrigationModal.style.display = 'none';
    });
    
    document.querySelectorAll('.alert-tab').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.alert-tab').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            alertFilter = btn.dataset.filter;
            updateAlertUI();
        });
    });
}

function init() {
    // Verificar autenticación
    if (!checkAuth()) return;
    
    loadPreferences();
    updateUserUI();
    initChart();
    setupEventListeners();
    takeReadings();
    intervalId = setInterval(() => takeReadings(), 6000);
    setInterval(() => savePins(), 10000);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}