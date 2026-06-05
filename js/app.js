// ==================== DATA MANAGER ====================
const DataManager = {
    STORAGE_KEY: "hajaiji_repairs_v2",
    THEME_KEY: "hajaiji_theme",

    load() {
        const stored = localStorage.getItem(this.STORAGE_KEY);
        return stored ? JSON.parse(stored) : null;
    },

    save(data) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    },

    getTheme() {
        return localStorage.getItem(this.THEME_KEY) || 'light';
    },

    setTheme(theme) {
        localStorage.setItem(this.THEME_KEY, theme);
    },

    exportJSON() {
        const data = this.load() || [];
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `hajaiji_backup_${new Date().toISOString().slice(0,10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    },

    importJSON(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    if (Array.isArray(data)) {
                        this.save(data);
                        resolve(data);
                    } else {
                        reject(new Error('Invalid data format'));
                    }
                } catch (err) {
                    reject(err);
                }
            };
            reader.readAsText(file);
        });
    }
};

// ==================== APP STATE ====================
let requests = [];
let currentEditId = null;
let searchTerm = "";

// ==================== CHART INSTANCES ====================
let statusChartInstance = null;
let deviceChartInstance = null;
let revenueChartInstance = null;

// ==================== INIT ====================
function init() {
    loadData();
    setupTabs();
    setupTheme();
    setupEvents();
    setDefaultDate();
    renderAll();
    hideLoading();
}

function hideLoading() {
    const loader = document.getElementById('loadingOverlay');
    if (loader) {
        loader.classList.add('hidden');
        setTimeout(() => loader.remove(), 500);
    }
}

// ==================== DATA ====================
function loadData() {
    const stored = DataManager.load();
    if (stored && stored.length > 0) {
        requests = stored;
    } else {
        seedData();
    }
}

function seedData() {
    const today = new Date().toISOString().slice(0,10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0,10);
    const twoDaysAgo = new Date(Date.now() - 172800000).toISOString().slice(0,10);
    const lastWeek = new Date(Date.now() - 604800000).toISOString().slice(0,10);

    requests = [
        { id: Date.now()+1, customerName: "سمير عبد النور", phone: "0555123456", deviceType: "مكيف", issue: "مكيف لا يبرد + ضاغط صاخب", price: 4500, requestDate: twoDaysAgo, status: "قيد الإصلاح" },
        { id: Date.now()+2, customerName: "فاطمة الزهراء", phone: "0667891234", deviceType: "ثلاجة", issue: "ثلاجة لا تثلج بالكامل وتراكم ثلج", price: 3200, requestDate: yesterday, status: "قيد الانتظار" },
        { id: Date.now()+3, customerName: "رابح مقدم", phone: "0770123456", deviceType: "مكيف", issue: "تسرب ماء من الوحدة الداخلية", price: 2800, requestDate: today, status: "مكتمل" },
        { id: Date.now()+4, customerName: "عائشة بوعلام", phone: "0555987654", deviceType: "غسالة", issue: "الغسالة لا تسحب الماء", price: 1500, requestDate: today, status: "قيد الانتظار" },
        { id: Date.now()+5, customerName: "سمير عبد النور", phone: "0555123456", deviceType: "ثلاجة", issue: "تغيير مروحة التبريد", price: 1800, requestDate: yesterday, status: "مكتمل" },
        { id: Date.now()+6, customerName: "كريم بلعربي", phone: "0666112233", deviceType: "مكيف", issue: "تنظيف فلاتر + شحن فريون", price: 2200, requestDate: lastWeek, status: "مكتمل" },
        { id: Date.now()+7, customerName: "نادية بوزيد", phone: "0777889900", deviceType: "مجفف", issue: "المجفف لا يدور", price: 1200, requestDate: twoDaysAgo, status: "قيد الإصلاح" }
    ];
    DataManager.save(requests);
}

function persistData() {
    DataManager.save(requests);
}

// ==================== RENDER ALL ====================
function renderAll() {
    updateStats();
    renderTable();
    updateQuickInsights();
    renderCharts();
    renderReports();
    renderClients();
}

// ==================== STATS ====================
function updateStats() {
    document.getElementById("totalCount").innerText = requests.length;
    document.getElementById("pendingCount").innerText = requests.filter(r => r.status === "قيد الانتظار").length;
    document.getElementById("progressCount").innerText = requests.filter(r => r.status === "قيد الإصلاح").length;
    document.getElementById("completedCount").innerText = requests.filter(r => r.status === "مكتمل").length;
}

function updateQuickInsights() {
    const unique = new Set(requests.map(r => (r.phone || '') + '|' + r.customerName)).size;
    document.getElementById("uniqueClientsCount").innerText = unique;
    const revenue = requests.reduce((s, r) => s + (Number(r.price) || 0), 0);
    document.getElementById("totalRevenue").innerText = revenue.toLocaleString() + " دج";
    const avg = requests.length ? Math.round(revenue / requests.length) : 0;
    document.getElementById("avgPrice").innerText = avg.toLocaleString() + " دج";
    if (requests.length) {
        const last = [...requests].sort((a,b) => new Date(b.requestDate) - new Date(a.requestDate))[0];
        document.getElementById("lastRequestDate").innerText = last.requestDate;
    } else {
        document.getElementById("lastRequestDate").innerText = "لا توجد طلبات";
    }
}

// ==================== CHARTS ====================
function renderCharts() {
    renderStatusChart();
    renderDeviceChart();
    renderRevenueChart();
}

function renderStatusChart() {
    const pending = requests.filter(r => r.status === "قيد الانتظار").length;
    const progress = requests.filter(r => r.status === "قيد الإصلاح").length;
    const completed = requests.filter(r => r.status === "مكتمل").length;
    const cancelled = requests.filter(r => r.status === "ملغي").length;

    const ctx = document.getElementById('statusChart').getContext('2d');
    if (statusChartInstance) statusChartInstance.destroy();

    statusChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['قيد الانتظار', 'قيد الإصلاح', 'مكتمل', 'ملغي'],
            datasets: [{
                data: [pending, progress, completed, cancelled],
                backgroundColor: ['#f59e0b', '#3b82f6', '#10b981', '#ef4444'],
                borderWidth: 0,
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '65%',
            plugins: {
                legend: { 
                    position: 'bottom', 
                    rtl: true, 
                    labels: { font: { family: 'Cairo' }, padding: 20, usePointStyle: true } 
                }
            }
        }
    });
}

function renderDeviceChart() {
    const devices = {};
    requests.forEach(r => { devices[r.deviceType] = (devices[r.deviceType] || 0) + 1; });

    const ctx = document.getElementById('deviceChart').getContext('2d');
    if (deviceChartInstance) deviceChartInstance.destroy();

    deviceChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(devices),
            datasets: [{
                label: 'عدد الطلبات',
                data: Object.values(devices),
                backgroundColor: ['#0f3b4d', '#f4b942', '#10b981', '#8b5cf6', '#ef4444'],
                borderRadius: 8,
                barThickness: 30
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { 
                y: { beginAtZero: true, ticks: { font: { family: 'Cairo' } } }, 
                x: { ticks: { font: { family: 'Cairo' } } } 
            }
        }
    });
}

function renderRevenueChart() {
    const last30 = {};
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
        const d = new Date(today); d.setDate(d.getDate() - i);
        last30[d.toISOString().slice(0,10)] = 0;
    }
    requests.forEach(r => {
        if (last30.hasOwnProperty(r.requestDate)) {
            last30[r.requestDate] += Number(r.price) || 0;
        }
    });

    const ctx = document.getElementById('revenueChart').getContext('2d');
    if (revenueChartInstance) revenueChartInstance.destroy();

    revenueChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: Object.keys(last30).map(d => d.slice(5)),
            datasets: [{
                label: 'الإيرادات (دج)',
                data: Object.values(last30),
                borderColor: '#0f3b4d',
                backgroundColor: 'rgba(15,59,77,0.08)',
                fill: true,
                tension: 0.4,
                pointRadius: 3,
                pointBackgroundColor: '#f4b942'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { 
                y: { beginAtZero: true, ticks: { font: { family: 'Cairo' } } }, 
                x: { ticks: { font: { family: 'Cairo' }, maxRotation: 45 } } 
            }
        }
    });
}

// ==================== REPORTS ====================
function renderReports() {
    const now = new Date();
    const monthStr = now.toISOString().slice(0,7);
    const monthReqs = requests.filter(r => r.requestDate && r.requestDate.startsWith(monthStr));

    document.getElementById("monthCount").innerText = monthReqs.length;
    document.getElementById("monthRevenue").innerText = monthReqs.reduce((s,r) => s + (Number(r.price)||0), 0).toLocaleString() + " دج";
    document.getElementById("monthAC").innerText = monthReqs.filter(r => r.deviceType === "مكيف").length;
    document.getElementById("monthFridge").innerText = monthReqs.filter(r => r.deviceType === "ثلاجة").length;

    const top5 = [...requests].sort((a,b) => (Number(b.price)||0) - (Number(a.price)||0)).slice(0,5);
    const topContainer = document.getElementById("topOrders");

    if (!top5.length) { 
        topContainer.innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:20px;">لا توجد بيانات</div>'; 
        return; 
    }

    topContainer.innerHTML = top5.map((r,i) => `
        <div class="report-item">
            <span class="label">${i+1}. ${escapeHtml(r.customerName)} — ${r.deviceType}</span>
            <span class="value">${Number(r.price).toLocaleString()} دج</span>
        </div>
    `).join('');
}

// ==================== CLIENTS ====================
function renderClients() {
    const clients = {};
    requests.forEach(r => {
        const key = r.phone + '|' + r.customerName;
        if (!clients[key]) clients[key] = { name: r.customerName, phone: r.phone, count: 0, total: 0, lastDate: '' };
        clients[key].count++;
        clients[key].total += Number(r.price) || 0;
        if (r.requestDate > clients[key].lastDate) clients[key].lastDate = r.requestDate;
    });

    const tbody = document.getElementById("clientsBody");
    const list = Object.values(clients).sort((a,b) => b.total - a.total);

    if (!list.length) { 
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:40px;">لا يوجد عملاء</td></tr>'; 
        return; 
    }

    tbody.innerHTML = list.map(c => `
        <tr>
            <td><strong>${escapeHtml(c.name)}</strong></td>
            <td>${escapeHtml(c.phone) || "—"}</td>
            <td><span class="badge" style="background:#e0f2fe;color:#0369a1;">${c.count}</span></td>
            <td><strong>${c.total.toLocaleString()} دج</strong></td>
            <td>${c.lastDate}</td>
        </tr>
    `).join('');
}

// ==================== TABLE ====================
function renderTable() {
    const tbody = document.getElementById("tableBody");
    let filtered = [...requests];

    if (searchTerm.trim()) {
        const term = searchTerm.trim().toLowerCase();
        filtered = requests.filter(r =>
            r.customerName.toLowerCase().includes(term) ||
            (r.phone && r.phone.includes(term)) ||
            r.deviceType.includes(term) ||
            (r.issue && r.issue.toLowerCase().includes(term))
        );
    }

    if (!filtered.length) {
        tbody.innerHTML = getEmptyStateHTML();
        return;
    }

    tbody.innerHTML = filtered.map(req => {
        const statusMap = {
            "قيد الانتظار": "status-pending",
            "قيد الإصلاح": "status-progress",
            "مكتمل": "status-completed",
            "ملغي": "status-cancelled"
        };
        const sc = statusMap[req.status] || "status-pending";
        return `<tr>
            <td><strong>${escapeHtml(req.customerName)}</strong></td>
            <td>${escapeHtml(req.phone) || "—"}</td>
            <td><span class="badge" style="background:#f1f5f9;color:#475569;">${req.deviceType}</span></td>
            <td style="max-width:200px;white-space:normal;font-size:0.85rem;color:var(--text-muted);">${escapeHtml(req.issue?.substring(0,50) || '')}${(req.issue?.length > 50) ? '...' : ''}</td>
            <td><strong>${Number(req.price).toLocaleString()}</strong></td>
            <td style="font-size:0.85rem;">${req.requestDate || "—"}</td>
            <td><span class="badge ${sc}">${req.status}</span></td>
            <td class="action-icons">
                <button class="action-btn edit" onclick="editRequest(${req.id})" title="تعديل"><i class="fas fa-edit"></i></button>
                <button class="action-btn delete" onclick="deleteRequest(${req.id})" title="حذف"><i class="fas fa-trash-alt"></i></button>
                <button class="action-btn print" onclick="printInvoice(${req.id})" title="فاتورة"><i class="fas fa-print"></i></button>
            </td>
        </tr>`;
    }).join('');
}

function getEmptyStateHTML() {
    return `<tr><td colspan="8">
        <div class="empty-state">
            <i class="fas fa-inbox"></i>
            <h3>لا توجد طلبات مطابقة</h3>
            <p>جرب البحث بكلمات مختلفة أو أضف طلباً جديداً</p>
        </div>
    </td></tr>`;
}

// ==================== CRUD ====================
function saveRequest() {
    const customerName = document.getElementById("customerName").value.trim();
    if (!customerName) { showToast("يرجى إدخال اسم العميل", "error"); return; }

    const phone = document.getElementById("phone").value.trim();
    const deviceType = document.getElementById("deviceType").value;
    const issue = document.getElementById("issue").value.trim();
    let price = parseFloat(document.getElementById("price").value);
    if (isNaN(price)) price = 0;
    let requestDate = document.getElementById("requestDate").value;
    if (!requestDate) requestDate = new Date().toISOString().slice(0,10);
    const status = document.getElementById("status").value;

    if (currentEditId === null) {
        requests.push({ id: Date.now(), customerName, phone, deviceType, issue, price, requestDate, status });
        showToast("تم إضافة الطلب بنجاح", "success");
    } else {
        const idx = requests.findIndex(r => r.id == currentEditId);
        if (idx !== -1) {
            requests[idx] = { ...requests[idx], customerName, phone, deviceType, issue, price, requestDate, status };
            showToast("تم تحديث الطلب بنجاح", "success");
        }
        currentEditId = null;
        resetFormUI();
    }

    persistData();
    clearForm();
    renderAll();
    switchTab('requests');
}

function editRequest(id) {
    const req = requests.find(r => r.id == id);
    if (!req) return;

    currentEditId = req.id;
    document.getElementById("customerName").value = req.customerName;
    document.getElementById("phone").value = req.phone || "";
    document.getElementById("deviceType").value = req.deviceType;
    document.getElementById("issue").value = req.issue || "";
    document.getElementById("price").value = req.price;
    document.getElementById("requestDate").value = req.requestDate || "";
    document.getElementById("status").value = req.status;
    document.getElementById("formTitleText").innerHTML = '<i class="fas fa-edit"></i> تعديل الطلب #' + req.id.toString().slice(-4);
    document.getElementById("saveBtn").innerHTML = '<i class="fas fa-check-double"></i> تحديث الطلب';

    switchTab('form');
    document.querySelector(".form-card").scrollIntoView({ behavior: "smooth" });
}

function deleteRequest(id) {
    openModal("حذف الطلب", "هل أنت متأكد من حذف هذا الطلب؟ لا يمكن التراجع.", () => {
        requests = requests.filter(r => r.id != id);
        persistData();
        if (currentEditId == id) { cancelEdit(); }
        renderAll();
        showToast("تم حذف الطلب", "info");
        closeModal();
    });
}

function cancelEdit() {
    currentEditId = null;
    clearForm();
    resetFormUI();
    showToast("تم إلغاء التعديل", "info");
}

function resetFormUI() {
    document.getElementById("formTitleText").innerHTML = '<i class="fas fa-plus-circle"></i> طلب صيانة جديد';
    document.getElementById("saveBtn").innerHTML = '<i class="fas fa-save"></i> حفظ الطلب';
}

function clearForm() {
    document.getElementById("customerName").value = "";
    document.getElementById("phone").value = "";
    document.getElementById("deviceType").value = "مكيف";
    document.getElementById("issue").value = "";
    document.getElementById("price").value = "0";
    document.getElementById("requestDate").value = new Date().toISOString().slice(0,10);
    document.getElementById("status").value = "قيد الانتظار";
}

function confirmClearAll() {
    openModal("مسح جميع البيانات", "هل أنت متأكد من مسح جميع الطلبات؟ لا يمكن التراجع أبداً.", () => {
        requests = [];
        persistData();
        renderAll();
        showToast("تم مسح جميع البيانات", "info");
        closeModal();
    });
}

// ==================== PRINT INVOICE ====================
function printInvoice(id) {
    const req = requests.find(r => r.id == id);
    if (!req) return;

    const inv = document.getElementById("invoicePrint");
    inv.innerHTML = `
        <div style="text-align:center;margin-bottom:30px;">
            <h1 style="color:#0f3b4d;font-size:1.8rem;margin-bottom:5px;"><i class="fas fa-snowflake"></i> تبريد وتكييف حجايجي</h1>
            <p style="color:#666;">المالك والتقني المعتمد: <strong>حجايجي لحسن</strong></p>
            <p style="color:#888;font-size:0.85rem;">إصلاح احترافي للمكيفات والثلاجات</p>
        </div>
        <div style="border:2px solid #0f3b4d;border-radius:12px;padding:20px;margin-bottom:20px;">
            <h2 style="text-align:center;color:#0f3b4d;margin-bottom:15px;">فاتورة صيانة رقم #${req.id.toString().slice(-6)}</h2>
            <table style="width:100%;border-collapse:collapse;">
                <tr><td style="padding:10px;border-bottom:1px solid #eee;font-weight:bold;width:40%;">العميل:</td><td style="padding:10px;border-bottom:1px solid #eee;">${escapeHtml(req.customerName)}</td></tr>
                <tr><td style="padding:10px;border-bottom:1px solid #eee;font-weight:bold;">الهاتف:</td><td style="padding:10px;border-bottom:1px solid #eee;">${escapeHtml(req.phone) || "—"}</td></tr>
                <tr><td style="padding:10px;border-bottom:1px solid #eee;font-weight:bold;">الجهاز:</td><td style="padding:10px;border-bottom:1px solid #eee;">${req.deviceType}</td></tr>
                <tr><td style="padding:10px;border-bottom:1px solid #eee;font-weight:bold;">وصف العطل:</td><td style="padding:10px;border-bottom:1px solid #eee;">${escapeHtml(req.issue) || "—"}</td></tr>
                <tr><td style="padding:10px;border-bottom:1px solid #eee;font-weight:bold;">التاريخ:</td><td style="padding:10px;border-bottom:1px solid #eee;">${req.requestDate}</td></tr>
                <tr><td style="padding:10px;border-bottom:1px solid #eee;font-weight:bold;">الحالة:</td><td style="padding:10px;border-bottom:1px solid #eee;">${req.status}</td></tr>
                <tr><td style="padding:15px 10px;font-weight:bold;font-size:1.2rem;color:#0f3b4d;">المبلغ الإجمالي:</td><td style="padding:15px 10px;font-weight:bold;font-size:1.4rem;color:#c0392b;">${Number(req.price).toLocaleString()} دج</td></tr>
            </table>
        </div>
        <div style="text-align:center;color:#888;font-size:0.8rem;margin-top:30px;">
            <p>شكراً لثقتكم بنا — للاستفسار: 05XX-XXXXXX</p>
            <p>تاريخ الطباعة: ${new Date().toLocaleDateString('ar-DZ')}</p>
        </div>
    `;
    window.print();
}

// ==================== EXPORT ====================
function exportToExcel() {
    const data = requests.map(r => ({
        'العميل': r.customerName,
        'الهاتف': r.phone,
        'الجهاز': r.deviceType,
        'العطل': r.issue,
        'السعر': r.price,
        'التاريخ': r.requestDate,
        'الحالة': r.status
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "الطلبات");
    XLSX.writeFile(wb, "طلبات_حجايجي_" + new Date().toISOString().slice(0,10) + ".xlsx");
    showToast("تم تصدير Excel بنجاح", "success");
}

function exportToPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    doc.setFont("helvetica");
    doc.text("تبريد وتكييف حجايجي - تقرير الطلبات", 140, 15, { align: 'center' });
    doc.setFontSize(10);
    doc.text("تاريخ التقرير: " + new Date().toLocaleDateString('ar-DZ'), 140, 22, { align: 'center' });

    const body = requests.map(r => [
        r.customerName, 
        r.phone || "—", 
        r.deviceType, 
        r.issue?.substring(0,30) || "—", 
        r.price.toLocaleString(), 
        r.requestDate, 
        r.status
    ]);

    doc.autoTable({
        head: [['العميل', 'الهاتف', 'الجهاز', 'العطل', 'السعر', 'التاريخ', 'الحالة']],
        body: body,
        startY: 30,
        theme: 'grid',
        styles: { font: 'helvetica', fontSize: 9, halign: 'right' },
        headStyles: { fillColor: [15, 59, 77], textColor: 255 },
        alternateRowStyles: { fillColor: [240, 244, 248] }
    });

    doc.save("تقرير_حجايجي_" + new Date().toISOString().slice(0,10) + ".pdf");
    showToast("تم تصدير PDF بنجاح", "success");
}

function exportBackup() {
    DataManager.exportJSON();
    showToast("تم تصدير النسخة الاحتياطية", "success");
}

function importBackup(input) {
    const file = input.files[0];
    if (!file) return;

    DataManager.importJSON(file)
        .then(data => {
            requests = data;
            renderAll();
            showToast("تم استيراد البيانات بنجاح", "success");
        })
        .catch(err => {
            showToast("خطأ في استيراد الملف: " + err.message, "error");
        });
    input.value = '';
}

// ==================== TABS ====================
function setupTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            switchTab(btn.dataset.tab);
        });
    });
}

function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(b => 
        b.classList.toggle('active', b.dataset.tab === tabName)
    );
    document.querySelectorAll('.tab-panel').forEach(p => 
        p.classList.toggle('active', p.id === 'tab-' + tabName)
    );
    if (tabName === 'reports') renderCharts();
}

// ==================== THEME ====================
function setupTheme() {
    const saved = DataManager.getTheme();
    if (saved === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    updateThemeIcon();

    document.getElementById('themeToggle').addEventListener('click', () => {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
        DataManager.setTheme(isDark ? 'light' : 'dark');
        updateThemeIcon();
    });
}

function updateThemeIcon() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    document.getElementById('themeToggle').innerHTML = `<i class="fas fa-${isDark ? 'sun' : 'moon'}"></i>`;
}

// ==================== MODAL ====================
function openModal(title, text, onConfirm) {
    document.getElementById("modalTitle").innerText = title;
    document.getElementById("modalText").innerText = text;
    document.getElementById("modal").classList.add("active");
    document.getElementById("modalConfirm").onclick = onConfirm;
}

function closeModal() {
    document.getElementById("modal").classList.remove("active");
}

// ==================== TOAST ====================
function showToast(msg, type) {
    const container = document.getElementById("toastContainer");
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? 'fa-check-circle' : (type === 'error' ? 'fa-exclamation-triangle' : 'fa-info-circle');
    toast.innerHTML = `<i class="fas ${icon}"></i> ${msg}`;
    container.appendChild(toast);
    setTimeout(() => { toast.remove(); }, 3000);
}

// ==================== EVENTS ====================
function setupEvents() {
    document.getElementById("saveBtn").addEventListener("click", saveRequest);
    document.getElementById("cancelEditBtn").addEventListener("click", cancelEdit);
    document.getElementById("searchInput").addEventListener("input", function(e) {
        searchTerm = e.target.value;
        renderTable();
    });
}

function setDefaultDate() {
    if(!document.getElementById("requestDate").value) {
        document.getElementById("requestDate").value = new Date().toISOString().slice(0,10);
    }
}

// ==================== UTILS ====================
function escapeHtml(str) { 
    if(!str) return ''; 
    return str.replace(/[&<>]/g, function(m){
        if(m==='&') return '&amp;'; 
        if(m==='<') return '&lt;'; 
        if(m==='>') return '&gt;'; 
        return m;
    });
}

// ==================== GLOBAL EXPORTS ====================
window.editRequest = editRequest;
window.deleteRequest = deleteRequest;
window.printInvoice = printInvoice;
window.exportToExcel = exportToExcel;
window.exportToPDF = exportToPDF;
window.exportBackup = exportBackup;
window.importBackup = importBackup;
window.confirmClearAll = confirmClearAll;
window.closeModal = closeModal;

// ==================== START ====================
document.addEventListener('DOMContentLoaded', init);
