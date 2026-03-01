// --- Global Variables ---
let salesChart = null;
let rawData = []; // Store raw data for sorting and modal
let currentSort = 'amount-desc'; // Default sort
// --- Mock Data (Based on screenshot) ---
const mockData = [
    { timestamp: "2026-02-28 23:19:57", customer: "正源五金行", product: "2107FW", price: 19500, qty: 4, total: 78000 },
    { timestamp: "2026-02-28 23:19:57", customer: "正源五金行", product: "4100NH1", price: 2110, qty: 30, total: 63300 },
    { timestamp: "2026-02-28 23:19:57", customer: "正源五金行", product: "DCC500Z", price: 4800, qty: 30, total: 144000 },
    { timestamp: "2026-02-28 23:19:57", customer: "正源五金行", product: "DCL181FX11", price: 8800, qty: 12, total: 105600 },
    { timestamp: "2026-02-28 23:19:57", customer: "正源五金行", product: "DDF486RGE", price: 14100, qty: 4, total: 56400 },
    { timestamp: "2026-02-28 23:19:57", customer: "正源五金行", product: "DGA404RTX6", price: 15000, qty: 6, total: 90000 },
    { timestamp: "2026-03-01 16:25:24", customer: "國昌五金行倉庫", product: "2107FW", price: 19500, qty: 4, total: 78000 },
    { timestamp: "2026-03-01 16:25:24", customer: "國昌五金行倉庫", product: "9533B", price: 3050, qty: 12, total: 36600 },
    { timestamp: "2026-03-01 16:25:24", customer: "國昌五金行倉庫", product: "HM0810TA", price: 7150, qty: 6, total: 42900 },
    { timestamp: "2026-03-01 16:31:34", customer: "佳欣工具行", product: "2107FW", price: 19500, qty: 8, total: 156000 },
    { timestamp: "2026-03-01 16:31:34", customer: "佳欣工具行", product: "9533BL", price: 3050, qty: 12, total: 36600 },
    { timestamp: "2026-03-01 16:31:34", customer: "佳欣工具行", product: "GA4031SP", price: 1460, qty: 32, total: 46720 },
    { timestamp: "2026-03-01 16:31:34", customer: "佳欣工具行", product: "DLX2225X1", price: 5600, qty: 12, total: 67200 },
    { timestamp: "2026-03-01 16:31:34", customer: "佳欣工具行", product: "GA005GZ", price: 6300, qty: 10, total: 63000 }
];

// --- Data Processing Functions ---

function parseSafeTimestamp(timeStr) {
    if (!timeStr) return 0;
    // Replace dashes to slashes for general safety
    let cleanStr = timeStr.replace(/-/g, '/');
    let timeVal = new Date(cleanStr).getTime();
    if (!isNaN(timeVal)) return timeVal;

    // Fallback for tricky string formats (like containing "上午"/"下午" or "AM"/"PM")
    const digits = timeStr.match(/\d+/g);
    if (digits && digits.length >= 3) {
        let year = parseInt(digits[0]);
        let month = parseInt(digits[1]) - 1; // Month is 0-indexed in JS Date
        let day = parseInt(digits[2]);
        let hour = digits.length > 3 ? parseInt(digits[3]) : 0;
        let minute = digits.length > 4 ? parseInt(digits[4]) : 0;
        let second = digits.length > 5 ? parseInt(digits[5]) : 0;

        if (timeStr.includes('下午') || timeStr.toLowerCase().includes('pm')) {
            if (hour < 12) hour += 12;
        } else if (timeStr.includes('上午') || timeStr.toLowerCase().includes('am')) {
            if (hour === 12) hour = 0;
        }
        return new Date(year, month, day, hour, minute, second).getTime();
    }
    return 0; // default to 0 if parsing completely fails
}

/**
 * Calculates total sales and groups sales by customer
 * @param {Array} data Array of objects with 'customer' and 'total' properties
 * @returns {Object} { totalSales, salesByCustomer }
 */
function processSalesData(data) {
    let totalSales = 0;
    const customerMap = {};

    data.forEach(item => {
        // Remove commas if any and parse to float, default to 0 if invalid
        const amount = parseFloat(String(item.total).replace(/,/g, '')) || 0;
        const customer = item.customer || '未知客戶';
        // Ensure timestamp exists for sorting
        const timeStr = item.timestamp || '';

        totalSales += amount;

        if (!customerMap[customer]) {
            customerMap[customer] = {
                totalAmount: 0,
                // store parsed timestamps for accurate Date comparison later
                latestTimestamp: 0,
                earliestTimestamp: Number.MAX_SAFE_INTEGER,
                items: []
            };
        }
        customerMap[customer].totalAmount += amount;
        customerMap[customer].items.push(item);

        // Update customer's latest/earliest dates by parsing date string
        if (timeStr) {
            let timeVal = parseSafeTimestamp(timeStr);
            if (timeVal > 0) {
                if (timeVal > customerMap[customer].latestTimestamp) {
                    customerMap[customer].latestTimestamp = timeVal;
                }
                if (customerMap[customer].earliestTimestamp === Number.MAX_SAFE_INTEGER || timeVal < customerMap[customer].earliestTimestamp) {
                    customerMap[customer].earliestTimestamp = timeVal;
                }
            }
        }
    });

    // Convert map to array for sorting
    let customerList = Object.keys(customerMap).map(key => ({
        name: key,
        ...customerMap[key]
    }));

    // Sorting Logic
    customerList.sort((a, b) => {
        if (currentSort === 'amount-desc') return b.totalAmount - a.totalAmount;
        if (currentSort === 'amount-asc') return a.totalAmount - b.totalAmount;
        if (currentSort === 'date-desc') {
            // Newest to oldest (based on customer's latest order)
            let diff = b.latestTimestamp - a.latestTimestamp;
            return diff !== 0 ? diff : (b.totalAmount - a.totalAmount); // fallback to amount
        }
        if (currentSort === 'date-asc') {
            // Oldest to newest (based on customer's earliest order)
            let diff = a.earliestTimestamp - b.earliestTimestamp;
            return diff !== 0 ? diff : (b.totalAmount - a.totalAmount); // fallback to amount
        }
        return 0;
    });

    const sortedLabels = customerList.map(c => c.name);
    const sortedData = customerList.map(c => c.totalAmount);

    return { totalSales, sortedLabels, sortedData, customerMap };
}

/**
 * Updates the UI with processed data
 */
function updateUI(totalSales, labels, data, customerMap) {
    // 1. Update Total Sales KPI
    const totalSalesElement = document.getElementById('total-sales');
    totalSalesElement.textContent = `NT$ ${totalSales.toLocaleString('en-US')}`;

    // Update Goal Achievement KPI
    updateGoalAchievement(totalSales);

    // 2. Update Chart
    const ctx = document.getElementById('salesByCustomerChart').getContext('2d');

    // Destroy existing chart if it exists to prevent memory leaks and overlay bugs
    if (salesChart) {
        salesChart.destroy();
    }

    // Chart.js Configuration
    Chart.defaults.color = '#94a3b8'; // Text color
    Chart.defaults.font.family = "'Inter', sans-serif";

    salesChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: '總業績 (NT$)',
                data: data,
                backgroundColor: [
                    'rgba(59, 130, 246, 0.8)', // Blue
                    'rgba(139, 92, 246, 0.8)', // Purple
                    'rgba(16, 185, 129, 0.8)', // Green
                    'rgba(245, 158, 11, 0.8)', // Yellow
                    'rgba(239, 68, 68, 0.8)'   // Red
                ],
                borderColor: [
                    'rgba(59, 130, 246, 1)',
                    'rgba(139, 92, 246, 1)',
                    'rgba(16, 185, 129, 1)',
                    'rgba(245, 158, 11, 1)',
                    'rgba(239, 68, 68, 1)'
                ],
                borderWidth: 1,
                borderRadius: 6,
            }]
        },
        options: {
            indexAxis: 'y', // Convert to horizontal bar chart
            responsive: true,
            maintainAspectRatio: false,
            // Custom click handler for Modal
            onClick: (event, elements) => {
                if (elements.length > 0) {
                    const firstPoint = elements[0];
                    const label = salesChart.data.labels[firstPoint.index];
                    openModal(label, customerMap[label]);
                }
            },
            onHover: (event, chartElement) => {
                event.native.target.style.cursor = chartElement[0] ? 'pointer' : 'default';
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.x !== null) { // Note: now checking x because axis is flipped
                                label += 'NT$ ' + context.parsed.x.toLocaleString('en-US');
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)',
                        borderColor: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        callback: function (value) {
                            if (value >= 1000) {
                                return 'NT$ ' + (value / 1000) + 'k';
                            }
                            return 'NT$ ' + value;
                        }
                    }
                },
                y: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: 'var(--text-primary)',
                        font: {
                            size: 14
                        }
                    }
                }
            }
        }
    });
}

// --- Modal Logic ---

const modal = document.getElementById('customer-modal');
const closeModalBtn = document.getElementById('close-modal');
const modalTableBody = document.getElementById('modal-table-body');
const modalCustomerName = document.getElementById('modal-customer-name');
const modalTotalAmount = document.getElementById('modal-total-amount');

function openModal(customerName, customerData) {
    modalCustomerName.textContent = customerName;
    modalTotalAmount.textContent = `NT$ ${customerData.totalAmount.toLocaleString('en-US')}`;

    // Clear old rows
    modalTableBody.innerHTML = '';

    // Safety check if items exist
    if (customerData.items && customerData.items.length > 0) {
        // Sort items essentially by timestamp newest first here for display
        const sortedItems = [...customerData.items].sort((a, b) => {
            const timeA = parseSafeTimestamp(a.timestamp);
            const timeB = parseSafeTimestamp(b.timestamp);
            if (currentSort === 'date-asc') {
                return (timeA !== timeB) ? (timeA - timeB) : (b.total - a.total); // Oldest first
            }
            return (timeA !== timeB) ? (timeB - timeA) : (b.total - a.total); // Newest first
        });

        sortedItems.forEach(item => {
            const tr = document.createElement('tr');

            // Format numbers safely
            const price = parseFloat(String(item.price).replace(/,/g, '')) || 0;
            const subtotal = parseFloat(String(item.total).replace(/,/g, '')) || 0;

            tr.innerHTML = `
                <td>${item.product || '-'}</td>
                <td>NT$ ${price.toLocaleString('en-US')}</td>
                <td>${item.qty || '-'}</td>
                <td>NT$ ${subtotal.toLocaleString('en-US')}</td>
            `;
            modalTableBody.appendChild(tr);
        });
    } else {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="4" style="text-align: center;">無詳細明細資料</td>`;
        modalTableBody.appendChild(tr);
    }

    modal.style.display = 'flex';
}

closeModalBtn.addEventListener('click', () => {
    modal.style.display = 'none';
});

window.addEventListener('click', (e) => {
    if (e.target === modal) {
        modal.style.display = 'none';
    }
});

// --- Dashboard Refresh Logic ---
function refreshDashboard() {
    const { totalSales, sortedLabels, sortedData, customerMap } = processSalesData(rawData);
    updateUI(totalSales, sortedLabels, sortedData, customerMap);
}

// --- Initialization ---

// Initialize with Google Sheets data
function init() {
    console.log("Loading data from Google Sheets...");

    // 加上 timestamp (%26t=...) 來強制瀏覽器不要使用暫存，抓取最新資料
    const cacheBuster = `&t=${new Date().getTime()}`;
    let sheetUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTbq_M3IExfgFtEifY959VVRnRbYJghxnzSlwA72zdPvRoq45RMP0sDoJGh1URpsaCf0t1u4zcf1c3b/pub?output=csv" + cacheBuster;

    // 解決直接點擊 index.html (file://) 造成的 CORS 錯誤
    if (window.location.protocol === 'file:') {
        sheetUrl = 'https://corsproxy.io/?' + encodeURIComponent(sheetUrl);
    }

    loadDataFromGoogleSheet(sheetUrl);
}

// Run init when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    init();

    const sortDropdown = document.getElementById('sort-select');
    if (sortDropdown) {
        // Automatically load last used sort order if requested in the future.
        sortDropdown.addEventListener('change', (event) => {
            currentSort = event.target.value;
            refreshDashboard();
        });
    }

    const goalInput = document.getElementById('goal-amount-input');
    if (goalInput) {
        // Load saved goal from localStorage
        const savedGoal = localStorage.getItem('dashboard_goal_amount');
        if (savedGoal) {
            goalInput.value = savedGoal;
        }

        goalInput.addEventListener('input', () => {
            // Save to LocalStorage immediately
            localStorage.setItem('dashboard_goal_amount', goalInput.value);

            // Re-calculate achievement without needing full refresh
            const totalSalesText = document.getElementById('total-sales').textContent.replace(/[^0-9.-]+/g, "");
            const currentTotal = parseFloat(totalSalesText) || 0;
            updateGoalAchievement(currentTotal);
        });
    }
});

function updateGoalAchievement(totalSales) {
    const goalInput = document.getElementById('goal-amount-input');
    const achievementRateEl = document.getElementById('achievement-rate');
    const progressBarFill = document.getElementById('progress-bar-fill');

    const diffPrefixEl = document.getElementById('goal-difference-prefix');
    const diffAmountEl = document.getElementById('goal-difference-amount');

    if (!goalInput || !achievementRateEl || !progressBarFill) return;

    let goalAmount = parseFloat(goalInput.value);

    // Prevent division by zero or negative goals
    if (isNaN(goalAmount) || goalAmount <= 0) {
        achievementRateEl.textContent = "---%";
        progressBarFill.style.width = "0%";
        if (diffPrefixEl) diffPrefixEl.style.display = 'none';
        if (diffAmountEl) diffAmountEl.style.display = 'none';
        return;
    }

    if (diffPrefixEl) diffPrefixEl.style.display = 'inline';
    if (diffAmountEl) diffAmountEl.style.display = 'inline';

    const rate = (totalSales / goalAmount) * 100;
    achievementRateEl.textContent = `${rate.toFixed(2)}%`;

    const diff = totalSales - goalAmount;
    if (diff >= 0) {
        diffPrefixEl.textContent = "超標: ";
        diffAmountEl.textContent = `NT$ ${diff.toLocaleString('en-US')}`;
        diffAmountEl.style.color = '#10b981'; // Green
    } else {
        diffPrefixEl.textContent = "還差: ";
        diffAmountEl.textContent = `NT$ ${Math.abs(diff).toLocaleString('en-US')}`;
        diffAmountEl.style.color = '#ef4444'; // Red
    }

    // Cap progress bar visual at 100%
    const visualRate = Math.min(rate, 100);
    progressBarFill.style.width = `${visualRate}%`;

    // Change color based on achievement
    if (rate >= 100) {
        achievementRateEl.style.color = '#10b981'; // Green
        progressBarFill.style.background = 'linear-gradient(90deg, #10b981 0%, #059669 100%)';
    } else if (rate >= 80) {
        achievementRateEl.style.color = '#f59e0b'; // Yellow
        progressBarFill.style.background = 'linear-gradient(90deg, #3b82f6 0%, #10b981 100%)';
    } else {
        achievementRateEl.style.color = 'var(--text-primary)';
        progressBarFill.style.background = 'linear-gradient(90deg, #3b82f6 0%, #60a5fa 100%)';
    }
}


// --- Utility for Future: CSV Parsing ---
// When user provides the Google Sheet CSV URL, we can use this function.

async function loadDataFromGoogleSheet(csvUrl) {
    try {
        const response = await fetch(csvUrl);
        const csvText = await response.text();
        const parsedData = parseCSV(csvText);

        // Store in global rawData
        rawData = parsedData.map(row => ({
            timestamp: row['時間戳記'] || row['建立時間'] || row['時間'] || row['日期'] || row['Date'] || '',
            customer: row['客戶名稱'] || '',
            product: row['商品型號'] || '',
            price: row['價格'] || '',
            qty: row['數量'] || '',
            total: row['小計'] || ''
        })).filter(item => item.customer && item.total); // Filter out empty rows

        refreshDashboard();

        document.querySelector('.status-indicator span:last-child').textContent = '即時資料連線中 (Google Sheets)';

    } catch (error) {
        console.error("Error loading data from Google Sheets:", error);
        alert("載入資料失敗，請確認網址是否正確且已發佈為 CSV。");
    }
}

// Simple CSV parser (handles basic quoting)
function parseCSV(csvText) {
    const lines = csvText.split(/\r?\n/);
    if (lines.length === 0) return [];

    let headerLine = lines[0];
    // Remove UTF-8 BOM if present
    if (headerLine.charCodeAt(0) === 0xFEFF) {
        headerLine = headerLine.substring(1);
    }
    const headers = parseCSVLine(headerLine);
    const result = [];

    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;

        const obj = {};
        const currentline = parseCSVLine(lines[i]);

        for (let j = 0; j < headers.length; j++) {
            obj[headers[j]] = currentline[j] !== undefined ? currentline[j] : '';
        }
        result.push(obj);
    }
    return result;
}

// More robust CSV line parser capable of handling quotes properly and spaces
function parseCSVLine(text) {
    let ret = [];
    let state = 0; // 0: unquoted field, 1: quoted field
    let value = "";
    for (let i = 0; i < text.length; i++) {
        let c = text[i];
        if (state === 0) {
            if (c === ',') {
                ret.push(value.trim());
                value = "";
            } else if (c === '"') {
                state = 1;
            } else {
                value += c;
            }
        } else if (state === 1) {
            if (c === '"') {
                if (i + 1 < text.length && text[i + 1] === '"') {
                    value += '"'; // escaped quote
                    i++;
                } else {
                    state = 0; // end of quoted field
                }
            } else {
                value += c;
            }
        }
    }
    ret.push(value.trim());
    return ret;
}
