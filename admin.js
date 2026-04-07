// ========== VERIFICAR AUTENTICACIÓN ==========
let currentUser = null;
let users = [];
let systemLogs = [];
let sensors = [];

function checkAdminAuth() {
    const session = localStorage.getItem('agroiot_session') || sessionStorage.getItem('agroiot_session');
    if (!session) {
        window.location.href = 'login.html';
        return false;
    }
    try {
        const sessionData = JSON.parse(session);
        if (!sessionData.isLoggedIn || sessionData.user.role !== 'admin') {
            window.location.href = 'index.html';
            return false;
        }
        currentUser = sessionData.user;
        document.getElementById('adminName').innerText = currentUser.name;
        return true;
    } catch(e) {
        window.location.href = 'login.html';
        return false;
    }
}

// ========== DATOS DE EJEMPLO ==========
const defaultUsers = [
    { id: 1, name: 'Administrador', email: 'admin@agroiot.com', role: 'admin', zone: 'all', status: 'active' },
    { id: 2, name: 'Gerente General', email: 'gerente@agroiot.com', role: 'manager', zone: 'all', status: 'active' },
    { id: 3, name: 'Supervisor Norte', email: 'supervisor@agroiot.com', role: 'supervisor', zone: 'norte', status: 'active' },
    { id: 4, name: 'Agricultor', email: 'agricultor@agroiot.com', role: 'farmer', zone: 'sur', status: 'active' }
];

const defaultSensors = [
    { id: 1, name: 'Sensor Temp Norte', type: 'temperature', location: 'Zona Norte', zone: 'norte', status: 'active', lastValue: '23.5°C' },
    { id: 2, name: 'Sensor Humedad Norte', type: 'soil_moisture', location: 'Zona Norte', zone: 'norte', status: 'active', lastValue: '72%' },
    { id: 3, name: 'Sensor Temp Sur', type: 'temperature', location: 'Zona Sur', zone: 'sur', status: 'active', lastValue: '20.1°C' }
];

const defaultLogs = [
    { id: 1, timestamp: new Date().toLocaleString(), user: 'admin@agroiot.com', event: 'login', details: 'Inicio de sesión exitoso' },
    { id: 2, timestamp: new Date().toLocaleString(), user: 'sistema', event: 'alert', details: 'Alerta generada: Temperatura alta' }
];

// ========== CARGAR DATOS ==========
function loadData() {
    const savedUsers = localStorage.getItem('agroiot_users');
    users = savedUsers ? JSON.parse(savedUsers) : defaultUsers;
    
    const savedSensors = localStorage.getItem('agroiot_sensors_admin');
    sensors = savedSensors ? JSON.parse(savedSensors) : defaultSensors;
    
    const savedLogs = localStorage.getItem('agroiot_logs');
    systemLogs = savedLogs ? JSON.parse(savedLogs) : defaultLogs;
    
    updateStats();
    renderUsers();
    renderSensors();
    renderLogs();
}

function updateStats() {
    document.getElementById('totalUsers').innerText = users.filter(u => u.status === 'active').length;
    document.getElementById('totalSensors').innerText = sensors.length;
    document.getElementById('totalReadings').innerText = Math.floor(Math.random() * 1000) + 500;
    document.getElementById('totalAlerts').innerText = Math.floor(Math.random() * 20);
}

// ========== RENDERIZAR TABLAS ==========
function renderUsers() {
    const tbody = document.getElementById('usersList');
    tbody.innerHTML = users.map(user => `
        <tr>
            <td>${user.name}</td>
            <td>${user.email}</td>
            <td>${user.role}</td>
            <td>${user.zone}</td>
            <td><span class="status-badge ${user.status === 'active' ? 'status-active' : 'status-inactive'}">${user.status === 'active' ? 'Activo' : 'Inactivo'}</span></td>
            <td>
                <button class="action-btn edit" onclick="editUser(${user.id})"><i class="fas fa-edit"></i></button>
                <button class="action-btn delete" onclick="deleteUser(${user.id})"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

function renderSensors() {
    const tbody = document.getElementById('sensorsList');
    tbody.innerHTML = sensors.map(sensor => `
        <tr>
            <td>${sensor.name}</td>
            <td>${sensor.type}</td>
            <td>${sensor.location}</td>
            <td>${sensor.zone}</td>
            <td><span class="status-badge ${sensor.status === 'active' ? 'status-active' : 'status-inactive'}">${sensor.status === 'active' ? 'Activo' : 'Inactivo'}</span></td>
            <td>${sensor.lastValue}</td>
            <td>
                <button class="action-btn edit" onclick="editSensor(${sensor.id})"><i class="fas fa-edit"></i></button>
                <button class="action-btn delete" onclick="deleteSensor(${sensor.id})"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

function renderLogs() {
    const filter = document.getElementById('logFilter')?.value || 'all';
    let filtered = systemLogs;
    if (filter !== 'all') filtered = systemLogs.filter(l => l.event === filter);
    
    const tbody = document.getElementById('logsList');
    tbody.innerHTML = filtered.slice(-50).reverse().map(log => `
        <tr>
            <td>${log.timestamp}</td>
            <td>${log.user}</td>
            <td>${log.event}</td>
            <td>${log.details}</td>
        </tr>
    `).join('');
}

// ========== CRUD USUARIOS ==========
let editingUserId = null;

function editUser(id) {
    const user = users.find(u => u.id === id);
    if (user) {
        editingUserId = id;
        document.getElementById('userModalTitle').innerText = 'Editar Usuario';
        document.getElementById('userName').value = user.name;
        document.getElementById('userEmail').value = user.email;
        document.getElementById('userRole').value = user.role;
        document.getElementById('userZone').value = user.zone;
        document.getElementById('userPassword').placeholder = 'Dejar en blanco para no cambiar';
        document.getElementById('userModal').style.display = 'flex';
    }
}

function deleteUser(id) {
    if (confirm('¿Eliminar este usuario?')) {
        users = users.filter(u => u.id !== id);
        localStorage.setItem('agroiot_users', JSON.stringify(users));
        addLog(currentUser.email, 'user_delete', `Usuario ID ${id} eliminado`);
        renderUsers();
        updateStats();
    }
}

document.getElementById('addUserBtn')?.addEventListener('click', () => {
    editingUserId = null;
    document.getElementById('userModalTitle').innerText = 'Nuevo Usuario';
    document.getElementById('userForm').reset();
    document.getElementById('userPassword').placeholder = 'Contraseña requerida';
    document.getElementById('userModal').style.display = 'flex';
});

document.getElementById('userForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const userData = {
        id: editingUserId || Date.now(),
        name: document.getElementById('userName').value,
        email: document.getElementById('userEmail').value,
        role: document.getElementById('userRole').value,
        zone: document.getElementById('userZone').value,
        status: 'active'
    };
    
    if (editingUserId) {
        const index = users.findIndex(u => u.id === editingUserId);
        users[index] = { ...users[index], ...userData };
        addLog(currentUser.email, 'user_edit', `Usuario ${userData.email} editado`);
    } else {
        users.push(userData);
        addLog(currentUser.email, 'user_create', `Usuario ${userData.email} creado`);
    }
    
    localStorage.setItem('agroiot_users', JSON.stringify(users));
    document.getElementById('userModal').style.display = 'none';
    renderUsers();
    updateStats();
});

// ========== CRUD SENSORES ==========
function editSensor(id) {
    alert('Función de edición de sensores - Implementar según necesidades');
}

function deleteSensor(id) {
    if (confirm('¿Desactivar este sensor?')) {
        sensors = sensors.filter(s => s.id !== id);
        localStorage.setItem('agroiot_sensors_admin', JSON.stringify(sensors));
        addLog(currentUser.email, 'sensor_delete', `Sensor ID ${id} eliminado`);
        renderSensors();
        updateStats();
    }
}

// ========== REGISTROS ==========
function addLog(user, event, details) {
    systemLogs.unshift({
        id: Date.now(),
        timestamp: new Date().toLocaleString(),
        user: user,
        event: event,
        details: details
    });
    if (systemLogs.length > 500) systemLogs.pop();
    localStorage.setItem('agroiot_logs', JSON.stringify(systemLogs));
    renderLogs();
}

document.getElementById('clearLogsBtn')?.addEventListener('click', () => {
    if (confirm('¿Limpiar todos los registros?')) {
        systemLogs = [];
        localStorage.setItem('agroiot_logs', JSON.stringify(systemLogs));
        renderLogs();
    }
});

document.getElementById('logFilter')?.addEventListener('change', () => renderLogs());

// ========== CONFIGURACIÓN ==========
document.getElementById('backupBtn')?.addEventListener('click', () => {
    const backup = {
        users: users,
        sensors: sensors,
        logs: systemLogs,
        date: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agroiot_backup_${new Date().toISOString().slice(0,19)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    addLog(currentUser.email, 'backup', 'Respaldo exportado');
});

document.getElementById('saveSettingsBtn')?.addEventListener('click', () => {
    const alertEmail = document.getElementById('alertEmail').value;
    const webhookUrl = document.getElementById('webhookUrl').value;
    localStorage.setItem('agroiot_alert_email', alertEmail);
    localStorage.setItem('agroiot_webhook', webhookUrl);
    addLog(currentUser.email, 'settings', 'Configuración guardada');
    alert('Configuración guardada');
});

// ========== INICIALIZACIÓN ==========
function initAdmin() {
    if (!checkAdminAuth()) return;
    loadData();
    
    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
        });
    });
    
    // Tema oscuro
    const savedTheme = localStorage.getItem('agroiot_theme');
    if (savedTheme === 'dark') document.body.classList.add('dark');
    document.getElementById('themeToggleBtn')?.addEventListener('click', () => {
        document.body.classList.toggle('dark');
        localStorage.setItem('agroiot_theme', document.body.classList.contains('dark') ? 'dark' : 'light');
    });
    
    // Cerrar modales
    document.getElementById('closeUserModal')?.addEventListener('click', () => {
        document.getElementById('userModal').style.display = 'none';
    });
    window.addEventListener('click', (e) => {
        if (e.target === document.getElementById('userModal')) {
            document.getElementById('userModal').style.display = 'none';
        }
    });
    
    // Logout
    document.getElementById('logoutBtn')?.addEventListener('click', () => {
        localStorage.removeItem('agroiot_session');
        sessionStorage.removeItem('agroiot_session');
        window.location.href = 'login.html';
    });
}

initAdmin();