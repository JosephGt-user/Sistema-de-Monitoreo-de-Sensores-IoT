let reportChart = null;
let currentUser = null;

function checkAuth() {
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
        document.getElementById('userName').innerText = currentUser.name;
        return true;
    } catch(e) {
        window.location.href = 'login.html';
        return false;
    }
}

function generateReportData() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const zone = document.getElementById('reportZone').value;
    const type = document.getElementById('reportType').value;
    
    // Simular datos para el reporte
    const days = 30;
    const labels = [];
    const values = [];
    
    for (let i = 0; i < days; i++) {
        labels.push(`Día ${i + 1}`);
        let baseValue = 0;
        switch(type) {
            case 'temperature': baseValue = 22 + Math.sin(i / 5) * 5; break;
            case 'soil': baseValue = 70 + Math.cos(i / 7) * 10; break;
            case 'light': baseValue = 45000 + Math.sin(i / 3) * 15000; break;
            case 'ph': baseValue = 6.2 + Math.sin(i / 10) * 0.5; break;
        }
        values.push(parseFloat((baseValue + (Math.random() - 0.5) * 5).toFixed(1)));
    }
    
    const avg = (values.reduce((a,b) => a + b, 0) / values.length).toFixed(1);
    const max = Math.max(...values).toFixed(1);
    const min = Math.min(...values).toFixed(1);
    
    document.getElementById('avgValue').innerText = avg;
    document.getElementById('maxValue').innerText = max;
    document.getElementById('minValue').innerText = min;
    document.getElementById('totalReadingsReport').innerText = values.length;
    
    if (reportChart) reportChart.destroy();
    const ctx = document.getElementById('reportChart').getContext('2d');
    reportChart = new Chart(ctx, {
        type: 'line',
        data: { labels: labels, datasets: [{ label: type, data: values, borderColor: '#22c55e', fill: true, backgroundColor: '#22c55e20' }] },
        options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { position: 'top' } } }
    });
}

function exportToCSV() {
    if (!reportChart) return;
    const labels = reportChart.data.labels;
    const values = reportChart.data.datasets[0].data;
    let csv = 'Día,Valor\n';
    for (let i = 0; i < labels.length; i++) {
        csv += `${labels[i]},${values[i]}\n`;
    }
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte_${new Date().toISOString().slice(0,19)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

function printReport() {
    window.print();
}

function initReports() {
    if (!checkAuth()) return;
    
    const today = new Date();
    const monthAgo = new Date(today);
    monthAgo.setDate(monthAgo.getDate() - 30);
    
    document.getElementById('startDate').value = monthAgo.toISOString().slice(0,10);
    document.getElementById('endDate').value = today.toISOString().slice(0,10);
    
    document.getElementById('generateReportBtn').addEventListener('click', generateReportData);
    document.getElementById('exportExcelBtn').addEventListener('click', exportToCSV);
    document.getElementById('exportPDFBtn').addEventListener('click', () => alert('PDF generado (simulado)'));
    document.getElementById('printBtn').addEventListener('click', printReport);
    document.getElementById('backBtn').addEventListener('click', () => window.location.href = 'index.html');
    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.removeItem('agroiot_session');
        sessionStorage.removeItem('agroiot_session');
        window.location.href = 'login.html';
    });
    
    const savedTheme = localStorage.getItem('agroiot_theme');
    if (savedTheme === 'dark') document.body.classList.add('dark');
    document.getElementById('themeToggleBtn').addEventListener('click', () => {
        document.body.classList.toggle('dark');
        localStorage.setItem('agroiot_theme', document.body.classList.contains('dark') ? 'dark' : 'light');
    });
    
    generateReportData();
}

initReports();