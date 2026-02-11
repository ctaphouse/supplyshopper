// Supply List PWA - Main Application

// ============================================
// Data Management
// ============================================

const STORAGE_KEY = 'supply_data';

const defaultData = {
    version: "2.0",
    categories: [],
    lastModified: new Date().toISOString()
};

let appData = null;

function loadData() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (e) {
        console.error('Error loading data:', e);
    }
    return null;
}

async function loadDefaultData() {
    try {
        const response = await fetch('Supply_Master.json');
        if (response.ok) {
            const data = await response.json();
            return data;
        }
    } catch (e) {
        console.error('Error loading default data:', e);
    }
    return { ...defaultData };
}

async function initializeData() {
    appData = loadData();
    if (!appData) {
        appData = await loadDefaultData();
        saveData();
    }
}

function saveData() {
    appData.lastModified = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
}

function generateId() {
    return `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================
// App State
// ============================================

let currentTab = 'shopping';
let searchQuery = '';

// ============================================
// DOM Elements
// ============================================

const mainContent = document.getElementById('main-content');
const pageTitle = document.getElementById('page-title');
const headerActionBtn = document.getElementById('header-action-btn');
const modalContainer = document.getElementById('modal-container');
const toastContainer = document.getElementById('toast-container');
const tabItems = document.querySelectorAll('.tab-item');

// ============================================
// Tab Navigation
// ============================================

tabItems.forEach(tab => {
    tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;
        switchTab(tabName);
    });
});

function switchTab(tabName) {
    currentTab = tabName;
    searchQuery = '';

    tabItems.forEach(t => t.classList.remove('active'));
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    const titles = {
        shopping: 'Shopping List',
        items: 'All Items',
        categories: 'Categories',
        settings: 'Settings'
    };
    pageTitle.textContent = titles[tabName];

    renderCurrentTab();
}

function renderCurrentTab() {
    switch (currentTab) {
        case 'shopping':
            renderShoppingList();
            break;
        case 'items':
            renderAllItems();
            break;
        case 'categories':
            renderCategories();
            break;
        case 'settings':
            renderSettings();
            break;
    }
}

// ============================================
// Shopping List View
// ============================================

function renderShoppingList() {
    const categoriesWithItems = appData.categories
        .filter(cat => cat.items.some(item => item.isOnShoppingList))
        .sort((a, b) => a.sortOrder - b.sortOrder);

    const totalItems = categoriesWithItems.reduce((sum, cat) =>
        sum + cat.items.filter(i => i.isOnShoppingList).length, 0);

    // Update header action button
    if (totalItems > 0) {
        headerActionBtn.classList.remove('hidden');
        headerActionBtn.classList.add('danger');
        headerActionBtn.onclick = clearShoppingList;
    } else {
        headerActionBtn.classList.add('hidden');
    }

    if (totalItems === 0) {
        mainContent.innerHTML = `
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                    <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/>
                </svg>
                <h3>Your shopping list is empty</h3>
                <p>Add items from the All Items tab</p>
            </div>
        `;
        return;
    }

    let html = '';

    categoriesWithItems.forEach(category => {
        const shoppingItems = category.items
            .filter(item => item.isOnShoppingList)
            .sort((a, b) => a.name.localeCompare(b.name));

        html += `
            <div class="section">
                <div class="section-header">
                    <div class="color-dot" style="background-color: ${category.color}"></div>
                    <h2>${escapeHtml(category.name)}</h2>
                </div>
                ${shoppingItems.map(item => `
                    <div class="item-row" data-item-id="${item.id}" data-category-id="${category.id}">
                        <div class="checkbox" onclick="toggleShoppingCheck(event, '${item.id}', '${category.id}')">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                                <polyline points="20 6 9 17 4 12"/>
                            </svg>
                        </div>
                        <div class="item-info">
                            <div class="item-name">${escapeHtml(item.name)}</div>
                            ${item.notes ? `<div class="item-notes">${escapeHtml(item.notes)}</div>` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    });

    mainContent.innerHTML = html;
}

function toggleShoppingCheck(event, itemId, categoryId) {
    event.stopPropagation();
    const checkbox = event.currentTarget;
    const row = checkbox.closest('.item-row');
    const itemName = row.querySelector('.item-name');

    checkbox.classList.add('checked');
    itemName.classList.add('checked');

    setTimeout(() => {
        const category = appData.categories.find(c => c.id === categoryId);
        if (category) {
            const item = category.items.find(i => i.id === itemId);
            if (item) {
                item.isOnShoppingList = false;
                saveData();
                renderShoppingList();
            }
        }
    }, 400);
}

function clearShoppingList() {
    if (confirm('Clear all items from shopping list?')) {
        appData.categories.forEach(cat => {
            cat.items.forEach(item => {
                item.isOnShoppingList = false;
            });
        });
        saveData();
        renderShoppingList();
        showToast('Shopping list cleared');
    }
}

// ============================================
// All Items View
// ============================================

function renderAllItems() {
    headerActionBtn.classList.add('hidden');

    let html = `
        <div class="search-container">
            <div class="search-bar">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input type="text" placeholder="Search items" id="search-input" value="${escapeHtml(searchQuery)}" oninput="handleSearch(this.value)">
            </div>
        </div>
    `;

    const filteredCategories = appData.categories
        .map(cat => ({
            ...cat,
            items: cat.items.filter(item =>
                item.name.toLowerCase().includes(searchQuery.toLowerCase())
            )
        }))
        .filter(cat => cat.items.length > 0)
        .sort((a, b) => a.sortOrder - b.sortOrder);

    if (filteredCategories.length === 0 && appData.categories.length === 0) {
        html += `
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
                    <line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/>
                    <line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
                </svg>
                <h3>No items yet</h3>
                <p>Add categories first, then add items</p>
            </div>
        `;
    } else if (filteredCategories.length === 0) {
        html += `
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <h3>No results found</h3>
                <p>Try a different search term</p>
            </div>
        `;
    } else {
        filteredCategories.forEach(category => {
            const sortedItems = [...category.items].sort((a, b) => a.name.localeCompare(b.name));

            html += `
                <div class="section">
                    <div class="section-header">
                        <div class="color-dot" style="background-color: ${category.color}"></div>
                        <h2>${escapeHtml(category.name)}</h2>
                        <span class="count">${category.items.length}</span>
                    </div>
                    ${sortedItems.map(item => `
                        <div class="item-row" onclick="openEditItemModal('${item.id}', '${category.id}')">
                            <div class="cart-toggle ${item.isOnShoppingList ? 'active' : ''}"
                                    onclick="toggleCartStatus(event, '${item.id}', '${category.id}')" role="button" tabindex="0">
                                <svg viewBox="0 0 24 24" fill="${item.isOnShoppingList ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                                    <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                                    <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/>
                                </svg>
                            </div>
                            <div class="item-info">
                                <div class="item-name">${escapeHtml(item.name)}</div>
                                ${item.notes ? `<div class="item-notes">${escapeHtml(item.notes)}</div>` : ''}
                            </div>
                            <div class="chevron">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="9 18 15 12 9 6"/>
                                </svg>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        });
    }

    // Add FAB
    html += `
        <button class="fab" onclick="openAddItemModal()" ${appData.categories.length === 0 ? 'disabled style="opacity:0.5"' : ''}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
        </button>
    `;

    mainContent.innerHTML = html;
}

function handleSearch(value) {
    searchQuery = value;
    renderAllItems();
}

function toggleCartStatus(event, itemId, categoryId) {
    event.stopPropagation();

    const category = appData.categories.find(c => c.id === categoryId);
    if (category) {
        const item = category.items.find(i => i.id === itemId);
        if (item) {
            item.isOnShoppingList = !item.isOnShoppingList;
            saveData();
            renderAllItems();
            showToast(item.isOnShoppingList ? 'Added to shopping list' : 'Removed from shopping list');
        }
    }
}

// ============================================
// Categories View
// ============================================

function renderCategories() {
    headerActionBtn.classList.add('hidden');

    let html = '';

    if (appData.categories.length === 0) {
        html += `
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
                </svg>
                <h3>No categories yet</h3>
                <p>Tap + to add your first category</p>
            </div>
        `;
    } else {
        html += '<div class="section">';

        const sortedCategories = [...appData.categories].sort((a, b) => a.sortOrder - b.sortOrder);

        sortedCategories.forEach(category => {
            html += `
                <div class="category-row" onclick="openEditCategoryModal('${category.id}')">
                    <div class="color-circle" style="background-color: ${category.color}"></div>
                    <div class="category-info">
                        <div class="category-name">${escapeHtml(category.name)}</div>
                        <div class="category-count">${category.items.length} items</div>
                    </div>
                    <div class="order-badge">#${category.sortOrder}</div>
                    <div class="chevron">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="9 18 15 12 9 6"/>
                        </svg>
                    </div>
                </div>
            `;
        });

        html += '</div>';
    }

    // Add FAB
    html += `
        <button class="fab" onclick="openAddCategoryModal()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
        </button>
    `;

    mainContent.innerHTML = html;
}

// ============================================
// Settings View
// ============================================

function renderSettings() {
    headerActionBtn.classList.add('hidden');

    const totalItems = appData.categories.reduce((sum, cat) => sum + cat.items.length, 0);
    const shoppingItems = appData.categories.reduce((sum, cat) =>
        sum + cat.items.filter(i => i.isOnShoppingList).length, 0);
    const lastModified = new Date(appData.lastModified).toLocaleDateString();

    mainContent.innerHTML = `
        <div class="section">
            <div class="section-header">
                <h2>Data Summary</h2>
            </div>
            <div class="settings-row">
                <span>Categories</span>
                <span class="value">${appData.categories.length}</span>
            </div>
            <div class="settings-row">
                <span>Total Items</span>
                <span class="value">${totalItems}</span>
            </div>
            <div class="settings-row">
                <span>Shopping List Items</span>
                <span class="value">${shoppingItems}</span>
            </div>
            <div class="settings-row">
                <span>Last Modified</span>
                <span class="value">${lastModified}</span>
            </div>
        </div>

        <div class="section">
            <div class="section-header">
                <h2>Data Management</h2>
            </div>
            <div class="settings-row" onclick="exportData()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                <span>Export JSON</span>
            </div>
            <div class="settings-row" onclick="triggerImport()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                <span>Import JSON</span>
            </div>
            <input type="file" id="import-file" class="file-input" accept=".json" onchange="handleImport(event)">
        </div>

        <div class="section">
            <div class="section-header">
                <h2>Danger Zone</h2>
            </div>
            <div class="settings-row danger" onclick="resetAllData()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                </svg>
                <span>Reset All Data</span>
            </div>
        </div>

        <div class="section">
            <div class="section-header">
                <h2>About</h2>
            </div>
            <div class="settings-row">
                <span>Version</span>
                <span class="value">1.0.0</span>
            </div>
            <div class="settings-row">
                <span>Data Format</span>
                <span class="value">v${appData.version}</span>
            </div>
        </div>
    `;
}

function exportData() {
    const dataStr = JSON.stringify(appData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `Supply_Backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('Data exported successfully');
}

function triggerImport() {
    document.getElementById('import-file').click();
}

function handleImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const imported = JSON.parse(e.target.result);
            if (imported.categories && Array.isArray(imported.categories)) {
                // Ensure all items have isOnShoppingList property
                imported.categories.forEach(cat => {
                    cat.items.forEach(item => {
                        if (typeof item.isOnShoppingList === 'undefined') {
                            item.isOnShoppingList = false;
                        }
                    });
                });
                appData = imported;
                saveData();
                renderSettings();
                showToast('Data imported successfully');
            } else {
                showToast('Invalid file format');
            }
        } catch (err) {
            showToast('Error reading file');
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

function resetAllData() {
    if (confirm('Delete ALL data? This cannot be undone.')) {
        appData = { ...defaultData };
        saveData();
        renderSettings();
        showToast('All data reset');
    }
}

// ============================================
// Modals
// ============================================

function openModal(content) {
    document.querySelector('.modal-content').innerHTML = content;
    modalContainer.classList.remove('hidden');
}

function closeModal() {
    modalContainer.classList.add('hidden');
}

document.querySelector('.modal-backdrop').addEventListener('click', closeModal);

// Add Item Modal
function openAddItemModal() {
    if (appData.categories.length === 0) {
        showToast('Add a category first');
        return;
    }

    const categoryOptions = appData.categories
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(cat => `<option value="${cat.id}">${escapeHtml(cat.name)}</option>`)
        .join('');

    openModal(`
        <div class="modal-header">
            <button class="cancel-btn" onclick="closeModal()">Cancel</button>
            <h2>Add Item</h2>
            <button class="save-btn" id="save-item-btn" onclick="saveNewItem()">Add</button>
        </div>
        <div class="modal-body">
            <div class="form-group">
                <label class="form-label">Item Name</label>
                <input type="text" class="form-input" id="item-name" placeholder="Enter item name" oninput="validateItemForm()">
            </div>
            <div class="form-group">
                <label class="form-label">Notes (optional)</label>
                <input type="text" class="form-input" id="item-notes" placeholder="Add notes">
            </div>
            <div class="form-group">
                <label class="form-label">Category</label>
                <select class="form-select" id="item-category">
                    ${categoryOptions}
                </select>
            </div>
            <div class="form-group">
                <div class="form-toggle">
                    <span>Add to Shopping List</span>
                    <div class="toggle-switch" id="item-shopping" onclick="this.classList.toggle('active')"></div>
                </div>
            </div>
        </div>
    `);

    document.getElementById('item-name').focus();
    validateItemForm();
}

function validateItemForm() {
    const name = document.getElementById('item-name').value.trim();
    document.getElementById('save-item-btn').disabled = !name;
}

function saveNewItem() {
    const name = document.getElementById('item-name').value.trim();
    const notes = document.getElementById('item-notes').value.trim();
    const categoryId = document.getElementById('item-category').value;
    const addToShopping = document.getElementById('item-shopping').classList.contains('active');

    if (!name) return;

    const category = appData.categories.find(c => c.id === categoryId);
    if (category) {
        category.items.push({
            id: generateId(),
            name: name,
            notes: notes,
            isOnShoppingList: addToShopping
        });
        saveData();
        closeModal();
        renderCurrentTab();
        showToast('Item added');
    }
}

// Edit Item Modal
function openEditItemModal(itemId, categoryId) {
    const category = appData.categories.find(c => c.id === categoryId);
    if (!category) return;

    const item = category.items.find(i => i.id === itemId);
    if (!item) return;

    const categoryOptions = appData.categories
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(cat => `<option value="${cat.id}" ${cat.id === categoryId ? 'selected' : ''}>${escapeHtml(cat.name)}</option>`)
        .join('');

    openModal(`
        <div class="modal-header">
            <button class="cancel-btn" onclick="closeModal()">Cancel</button>
            <h2>Edit Item</h2>
            <button class="save-btn" id="save-item-btn" onclick="saveEditedItem('${itemId}', '${categoryId}')">Save</button>
        </div>
        <div class="modal-body">
            <div class="form-group">
                <label class="form-label">Item Name</label>
                <input type="text" class="form-input" id="item-name" value="${escapeHtml(item.name)}" oninput="validateItemForm()">
            </div>
            <div class="form-group">
                <label class="form-label">Notes (optional)</label>
                <input type="text" class="form-input" id="item-notes" value="${escapeHtml(item.notes || '')}">
            </div>
            <div class="form-group">
                <label class="form-label">Category</label>
                <select class="form-select" id="item-category">
                    ${categoryOptions}
                </select>
            </div>
            <div class="form-group">
                <div class="form-toggle">
                    <span>On Shopping List</span>
                    <div class="toggle-switch ${item.isOnShoppingList ? 'active' : ''}" id="item-shopping" onclick="this.classList.toggle('active')"></div>
                </div>
            </div>
            <button class="delete-btn" onclick="deleteItem('${itemId}', '${categoryId}')">Delete Item</button>
        </div>
    `);
}

function saveEditedItem(itemId, originalCategoryId) {
    const name = document.getElementById('item-name').value.trim();
    const notes = document.getElementById('item-notes').value.trim();
    const newCategoryId = document.getElementById('item-category').value;
    const isOnShoppingList = document.getElementById('item-shopping').classList.contains('active');

    if (!name) return;

    const originalCategory = appData.categories.find(c => c.id === originalCategoryId);
    if (!originalCategory) return;

    const itemIndex = originalCategory.items.findIndex(i => i.id === itemId);
    if (itemIndex === -1) return;

    const item = originalCategory.items[itemIndex];
    item.name = name;
    item.notes = notes;
    item.isOnShoppingList = isOnShoppingList;

    // Move to different category if changed
    if (newCategoryId !== originalCategoryId) {
        originalCategory.items.splice(itemIndex, 1);
        const newCategory = appData.categories.find(c => c.id === newCategoryId);
        if (newCategory) {
            newCategory.items.push(item);
        }
    }

    saveData();
    closeModal();
    renderCurrentTab();
    showToast('Item updated');
}

function deleteItem(itemId, categoryId) {
    if (confirm('Delete this item?')) {
        const category = appData.categories.find(c => c.id === categoryId);
        if (category) {
            category.items = category.items.filter(i => i.id !== itemId);
            saveData();
            closeModal();
            renderCurrentTab();
            showToast('Item deleted');
        }
    }
}

// Add Category Modal
const categoryColors = [
    '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
    '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6', '#8b5cf6',
    '#a855f7', '#ec4899'
];

function openAddCategoryModal() {
    const colorGrid = categoryColors.map((color, i) =>
        `<div class="color-option ${i === 0 ? 'selected' : ''}" style="background-color: ${color}" data-color="${color}" onclick="selectColor(this)"></div>`
    ).join('');

    const nextOrder = appData.categories.length > 0
        ? Math.max(...appData.categories.map(c => c.sortOrder)) + 1
        : 1;

    openModal(`
        <div class="modal-header">
            <button class="cancel-btn" onclick="closeModal()">Cancel</button>
            <h2>Add Category</h2>
            <button class="save-btn" id="save-cat-btn" onclick="saveNewCategory()" disabled>Add</button>
        </div>
        <div class="modal-body">
            <div class="form-group">
                <label class="form-label">Category Name</label>
                <input type="text" class="form-input" id="category-name" placeholder="Enter category name" oninput="validateCategoryForm()">
            </div>
            <div class="form-group">
                <label class="form-label">Sort Order</label>
                <input type="number" class="form-input" id="category-order" value="${nextOrder}" min="1">
            </div>
            <div class="form-group">
                <label class="form-label">Color</label>
                <div class="color-grid" id="color-grid">
                    ${colorGrid}
                </div>
            </div>
        </div>
    `);

    document.getElementById('category-name').focus();
}

function selectColor(element) {
    document.querySelectorAll('.color-option').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected');
}

function validateCategoryForm() {
    const name = document.getElementById('category-name').value.trim();
    document.getElementById('save-cat-btn').disabled = !name;
}

function saveNewCategory() {
    const name = document.getElementById('category-name').value.trim();
    const order = parseInt(document.getElementById('category-order').value) || 1;
    const selectedColor = document.querySelector('.color-option.selected');
    const color = selectedColor ? selectedColor.dataset.color : '#14b8a6';

    if (!name) return;

    const id = name.toLowerCase().replace(/[^a-z0-9]/g, '_');

    appData.categories.push({
        id: id,
        name: name,
        items: [],
        sortOrder: order,
        color: color
    });

    saveData();
    closeModal();
    renderCurrentTab();
    showToast('Category added');
}

// Edit Category Modal
function openEditCategoryModal(categoryId) {
    const category = appData.categories.find(c => c.id === categoryId);
    if (!category) return;

    const colorGrid = categoryColors.map(color =>
        `<div class="color-option ${color === category.color ? 'selected' : ''}" style="background-color: ${color}" data-color="${color}" onclick="selectColor(this)"></div>`
    ).join('');

    openModal(`
        <div class="modal-header">
            <button class="cancel-btn" onclick="closeModal()">Cancel</button>
            <h2>Edit Category</h2>
            <button class="save-btn" id="save-cat-btn" onclick="saveEditedCategory('${categoryId}')">Save</button>
        </div>
        <div class="modal-body">
            <div class="form-group">
                <label class="form-label">Category Name</label>
                <input type="text" class="form-input" id="category-name" value="${escapeHtml(category.name)}" oninput="validateCategoryForm()">
            </div>
            <div class="form-group">
                <label class="form-label">Sort Order</label>
                <input type="number" class="form-input" id="category-order" value="${category.sortOrder}" min="1">
            </div>
            <div class="form-group">
                <label class="form-label">Color</label>
                <div class="color-grid" id="color-grid">
                    ${colorGrid}
                </div>
            </div>
            <p style="margin-top: 16px; color: var(--gray-500); font-size: 14px;">
                ${category.items.length} items in this category
            </p>
            <button class="delete-btn" onclick="deleteCategory('${categoryId}')">Delete Category</button>
        </div>
    `);
}

function saveEditedCategory(categoryId) {
    const category = appData.categories.find(c => c.id === categoryId);
    if (!category) return;

    const name = document.getElementById('category-name').value.trim();
    const order = parseInt(document.getElementById('category-order').value) || 1;
    const selectedColor = document.querySelector('.color-option.selected');
    const color = selectedColor ? selectedColor.dataset.color : category.color;

    if (!name) return;

    category.name = name;
    category.sortOrder = order;
    category.color = color;

    saveData();
    closeModal();
    renderCurrentTab();
    showToast('Category updated');
}

function deleteCategory(categoryId) {
    const category = appData.categories.find(c => c.id === categoryId);
    if (!category) return;

    const message = category.items.length > 0
        ? `Delete "${category.name}" and all ${category.items.length} items?`
        : `Delete "${category.name}"?`;

    if (confirm(message)) {
        appData.categories = appData.categories.filter(c => c.id !== categoryId);
        saveData();
        closeModal();
        renderCurrentTab();
        showToast('Category deleted');
    }
}

// ============================================
// Utilities
// ============================================

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 2500);
}

// ============================================
// Service Worker Registration
// ============================================

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('SW registered'))
            .catch(err => console.log('SW registration failed:', err));
    });
}

// ============================================
// Initialize App
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    await initializeData();
    renderCurrentTab();
});
