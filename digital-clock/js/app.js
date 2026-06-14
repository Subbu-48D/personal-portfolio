// Digital Clock Main Application

class DigitalClockApp {
    constructor() {
        // Configuration
        this.DEBUG = false;
        this.UPDATE_INTERVAL = 100; // ms
        this.STORAGE_KEY_ZONES = 'digitalClock_zones';
        this.STORAGE_KEY_FORMAT = 'digitalClock_format';
        this.STORAGE_KEY_THEME = 'digitalClock_theme';

        // State
        this.timeZones = [];
        this.is24Hour = true;
        this.animationFrameId = null;

        // DOM Elements
        this.elements = {
            addTimeZoneBtn: null,
            themeToggle: null,
            formatToggle: null,
            clocksContainer: null,
            dropdownOverlay: null,
            dropdownContainer: null,
            dropdownList: null,
            dropdownSearch: null,
            searchInput: null,
            closeDropdown: null,
            toastContainer: null
        };

        // Keyboard shortcuts
        this.shortcuts = {
            'ctrl+t': () => this.toggleTheme(),
            'ctrl+f': () => this.toggleFormat(),
            'ctrl+a': () => this.showDropdown(),
            'escape': () => this.hideDropdown()
        };

        this.init();
    }

    init() {
        this.log('Initializing Digital Clock App');
        this.cacheElements();
        this.loadPreferences();
        this.setupTheme();
        this.setupEventListeners();
        this.loadTimeZones();
        this.render();
        this.startUpdating();
    }

    cacheElements() {
        this.elements = {
            addTimeZoneBtn: document.getElementById('addTimeZoneBtn'),
            themeToggle: document.getElementById('themeToggle'),
            formatToggle: document.getElementById('formatToggle'),
            clocksContainer: document.getElementById('clocksContainer'),
            dropdownOverlay: document.getElementById('dropdownOverlay'),
            dropdownContainer: document.getElementById('dropdownContainer'),
            dropdownList: document.getElementById('dropdownList'),
            dropdownSearch: document.getElementById('dropdownSearch'),
            searchInput: document.querySelector('.search-input'),
            closeDropdown: document.getElementById('closeDropdown'),
            toastContainer: document.getElementById('toastContainer')
        };
    }

    setupEventListeners() {
        // Buttons
        this.elements.addTimeZoneBtn.addEventListener('click', () => this.showDropdown());
        this.elements.themeToggle.addEventListener('click', () => this.toggleTheme());
        this.elements.formatToggle.addEventListener('click', () => this.toggleFormat());
        this.elements.closeDropdown.addEventListener('click', () => this.hideDropdown());
        this.elements.dropdownOverlay.addEventListener('click', () => this.hideDropdown());

        // Search
        this.elements.dropdownSearch.addEventListener('input', (e) => this.filterTimeZones(e.target.value));
        this.elements.searchInput.addEventListener('input', (e) => this.filterClocks(e.target.value));

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboardShortcut(e));

        // Theme change detection
        if (window.matchMedia) {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
                this.setupTheme();
            });
        }

        this.log('Event listeners setup complete');
    }

    setupTheme() {
        const theme = this.getFromStorage(this.STORAGE_KEY_THEME) || this.getSystemTheme();
        this.setTheme(theme);
    }

    getSystemTheme() {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return 'dark';
        }
        return 'light';
    }

    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        this.saveToStorage(this.STORAGE_KEY_THEME, theme);
        
        // Update button icon
        const icon = theme === 'dark' ? '☀️' : '🌙';
        this.elements.themeToggle.querySelector('.icon').textContent = icon;
    }

    toggleTheme() {
        const current = document.documentElement.getAttribute('data-theme') || 'light';
        const newTheme = current === 'light' ? 'dark' : 'light';
        this.setTheme(newTheme);
        this.showToast(`Theme changed to ${newTheme}`, 'info');
    }

    toggleFormat() {
        this.is24Hour = !this.is24Hour;
        this.saveToStorage(this.STORAGE_KEY_FORMAT, this.is24Hour);
        
        // Update button
        this.elements.formatToggle.querySelector('.icon').textContent = this.is24Hour ? '24H' : '12H';
        
        this.render();
        this.showToast(`Format changed to ${this.is24Hour ? '24-hour' : '12-hour'}`, 'info');
    }

    loadPreferences() {
        this.is24Hour = this.getFromStorage(this.STORAGE_KEY_FORMAT, true);
        this.elements.formatToggle.querySelector('.icon').textContent = this.is24Hour ? '24H' : '12H';
    }

    loadTimeZones() {
        const saved = this.getFromStorage(this.STORAGE_KEY_ZONES, []);
        this.timeZones = saved.length > 0 ? saved : ['UTC', 'Asia/Kolkata', 'America/New_York'];
        this.saveTimeZones();
        this.populateDropdown();
    }

    saveTimeZones() {
        this.saveToStorage(this.STORAGE_KEY_ZONES, this.timeZones);
    }

    populateDropdown() {
        const zones = this.getSortedTimeZones();
        this.elements.dropdownList.innerHTML = zones.map(zone => `
            <li class="dropdown-list-item" data-code="${zone.code}">
                <div class="dropdown-list-item-name">${zone.label} - ${zone.code}</div>
                <div class="dropdown-list-item-info">${zone.country} (UTC${this.formatOffset(zone.offset)})</div>
            </li>
        `).join('');

        // Add click listeners
        this.elements.dropdownList.querySelectorAll('.dropdown-list-item').forEach(item => {
            item.addEventListener('click', () => {
                const code = item.dataset.code;
                this.addTimeZone(code);
            });
        });
    }

    filterTimeZones(query) {
        const items = this.elements.dropdownList.querySelectorAll('.dropdown-list-item');
        const lowerQuery = query.toLowerCase();

        items.forEach(item => {
            const text = item.textContent.toLowerCase();
            item.style.display = text.includes(lowerQuery) ? '' : 'none';
        });
    }

    filterClocks(query) {
        const cards = this.elements.clocksContainer.querySelectorAll('.clock-card');
        const lowerQuery = query.toLowerCase();

        cards.forEach(card => {
            const text = card.textContent.toLowerCase();
            card.style.display = text.includes(lowerQuery) ? '' : 'none';
        });
    }

    addTimeZone(code) {
        if (this.timeZones.includes(code)) {
            this.showToast('This time zone is already added', 'warning');
            return;
        }

        this.timeZones.push(code);
        this.saveTimeZones();
        this.render();
        this.hideDropdown();
        this.showToast(`${code} added`, 'success');
    }

    removeTimeZone(code) {
        this.timeZones = this.timeZones.filter(z => z !== code);
        this.saveTimeZones();
        this.render();
        this.showToast(`${code} removed`, 'info');
    }

    showDropdown() {
        this.elements.dropdownOverlay.classList.add('active');
        this.elements.dropdownContainer.classList.add('active');
        this.elements.dropdownSearch.focus();
    }

    hideDropdown() {
        this.elements.dropdownOverlay.classList.remove('active');
        this.elements.dropdownContainer.classList.remove('active');
        this.elements.dropdownSearch.value = '';
        this.populateDropdown();
    }

    render() {
        if (this.timeZones.length === 0) {
            this.renderEmptyState();
            return;
        }

        this.elements.clocksContainer.innerHTML = this.timeZones.map(code => {
            const zone = this.getTimeZone(code);
            const time = this.getTimeInTimeZone(zone.offset);
            const formatted = this.formatTime(time, this.is24Hour);
            const date = this.formatDate(time);
            const day = this.getDayOfWeek(time);

            return `
                <div class="clock-card" data-zone="${code}">
                    <div class="clock-header">
                        <div class="clock-info">
                            <h3>${zone.label}</h3>
                            <p>${zone.country}</p>
                            <span class="clock-offset">${this.formatOffset(zone.offset)}</span>
                        </div>
                        <button class="remove-btn" data-zone="${code}" aria-label="Remove ${code}">×</button>
                    </div>
                    <div class="clock-display">
                        <div class="time-display">${formatted.time}</div>
                        ${formatted.period ? `<div class="period">${formatted.period}</div>` : ''}
                        <div class="date-display">${date}</div>
                        <div class="day-display">${day}</div>
                    </div>
                    <div class="clock-footer">
                        <span class="status-indicator">
                            <span class="status-dot"></span>
                            Live
                        </span>
                        <span class="timezone-code">${code}</span>
                    </div>
                </div>
            `;
        }).join('');

        // Add remove button listeners
        this.elements.clocksContainer.querySelectorAll('.remove-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.removeTimeZone(btn.dataset.zone);
            });
        });
    }

    renderEmptyState() {
        this.elements.clocksContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🕐</div>
                <h2>No time zones added</h2>
                <p>Click "Add Time Zone" to display clocks</p>
            </div>
        `;
    }

    startUpdating() {
        const update = () => {
            this.render();
            this.animationFrameId = setTimeout(update, this.UPDATE_INTERVAL);
        };
        update();
    }

    handleKeyboardShortcut(e) {
        let shortcut = '';
        if (e.ctrlKey || e.metaKey) shortcut += 'ctrl+';
        if (e.shiftKey) shortcut += 'shift+';
        if (e.altKey) shortcut += 'alt+';
        shortcut += e.key.toLowerCase();

        if (this.shortcuts[shortcut]) {
            e.preventDefault();
            this.shortcuts[shortcut]();
        }
    }

    // Time utilities
    getTimeInTimeZone(offset) {
        const now = new Date();
        const utcTime = now.getTime() + now.getTimezoneOffset() * 60000;
        const offsetMs = offset * 60 * 60 * 1000;
        return new Date(utcTime + offsetMs);
    }

    formatTime(date, is24Hour = true) {
        const hours = date.getHours();
        const minutes = date.getMinutes();
        const seconds = date.getSeconds();

        if (is24Hour) {
            return {
                time: `${this.padZero(hours)}:${this.padZero(minutes)}:${this.padZero(seconds)}`,
                period: ''
            };
        } else {
            const period = hours >= 12 ? 'PM' : 'AM';
            const display12Hour = hours % 12 || 12;
            return {
                time: `${this.padZero(display12Hour)}:${this.padZero(minutes)}:${this.padZero(seconds)}`,
                period: period
            };
        }
    }

    formatDate(date) {
        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        return date.toLocaleDateString('en-US', options);
    }

    getDayOfWeek(date) {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return days[date.getDay()];
    }

    formatOffset(offset) {
        const sign = offset >= 0 ? '+' : '-';
        const absOffset = Math.abs(offset);
        const hours = Math.floor(absOffset);
        const minutes = (absOffset % 1) * 60;

        if (minutes === 0) {
            return `${sign}${hours}:00`;
        } else {
            return `${sign}${hours}:${String(minutes).padStart(2, '0')}`;
        }
    }

    padZero(num) {
        return String(num).padStart(2, '0');
    }

    // Time zone data
    getTimeZone(code) {
        const TIME_ZONES = {
            'UTC': { offset: 0, label: 'UTC', country: 'Coordinated Universal Time', major: true },
            'America/New_York': { offset: -5, label: 'EST', country: 'Eastern Standard Time', major: true },
            'America/Chicago': { offset: -6, label: 'CST', country: 'Central Standard Time', major: true },
            'America/Denver': { offset: -7, label: 'MST', country: 'Mountain Standard Time', major: true },
            'America/Los_Angeles': { offset: -8, label: 'PST', country: 'Pacific Standard Time', major: true },
            'Europe/London': { offset: 0, label: 'GMT', country: 'London, United Kingdom', major: true },
            'Europe/Paris': { offset: 1, label: 'CET', country: 'Paris, France', major: true },
            'Europe/Moscow': { offset: 3, label: 'MSK', country: 'Moscow, Russia', major: true },
            'Asia/Dubai': { offset: 4, label: 'GST', country: 'Dubai, United Arab Emirates', major: true },
            'Asia/Kolkata': { offset: 5.5, label: 'IST', country: 'India Standard Time', major: true },
            'Asia/Bangkok': { offset: 7, label: 'ICT', country: 'Bangkok, Thailand', major: true },
            'Asia/Singapore': { offset: 8, label: 'SGT', country: 'Singapore', major: true },
            'Asia/Hong_Kong': { offset: 8, label: 'HKT', country: 'Hong Kong', major: true },
            'Asia/Shanghai': { offset: 8, label: 'CST', country: 'Shanghai, China', major: true },
            'Asia/Tokyo': { offset: 9, label: 'JST', country: 'Japan Standard Time', major: true },
            'Asia/Seoul': { offset: 9, label: 'KST', country: 'Seoul, South Korea', major: true },
            'Australia/Sydney': { offset: 10, label: 'AEST', country: 'Sydney, Australia', major: true },
            'Pacific/Auckland': { offset: 12, label: 'NZST', country: 'Auckland, New Zealand', major: true }
        };

        return TIME_ZONES[code] || { offset: 0, label: code, country: code, major: false };
    }

    getSortedTimeZones() {
        const TIME_ZONES = {
            'UTC': { offset: 0, label: 'UTC', country: 'Coordinated Universal Time', major: true },
            'America/New_York': { offset: -5, label: 'EST', country: 'Eastern Standard Time', major: true },
            'America/Chicago': { offset: -6, label: 'CST', country: 'Central Standard Time', major: true },
            'America/Denver': { offset: -7, label: 'MST', country: 'Mountain Standard Time', major: true },
            'America/Los_Angeles': { offset: -8, label: 'PST', country: 'Pacific Standard Time', major: true },
            'Europe/London': { offset: 0, label: 'GMT', country: 'London, United Kingdom', major: true },
            'Europe/Paris': { offset: 1, label: 'CET', country: 'Paris, France', major: true },
            'Europe/Moscow': { offset: 3, label: 'MSK', country: 'Moscow, Russia', major: true },
            'Asia/Dubai': { offset: 4, label: 'GST', country: 'Dubai, United Arab Emirates', major: true },
            'Asia/Kolkata': { offset: 5.5, label: 'IST', country: 'India Standard Time', major: true },
            'Asia/Bangkok': { offset: 7, label: 'ICT', country: 'Bangkok, Thailand', major: true },
            'Asia/Singapore': { offset: 8, label: 'SGT', country: 'Singapore', major: true },
            'Asia/Hong_Kong': { offset: 8, label: 'HKT', country: 'Hong Kong', major: true },
            'Asia/Shanghai': { offset: 8, label: 'CST', country: 'Shanghai, China', major: true },
            'Asia/Tokyo': { offset: 9, label: 'JST', country: 'Japan Standard Time', major: true },
            'Asia/Seoul': { offset: 9, label: 'KST', country: 'Seoul, South Korea', major: true },
            'Australia/Sydney': { offset: 10, label: 'AEST', country: 'Sydney, Australia', major: true },
            'Pacific/Auckland': { offset: 12, label: 'NZST', country: 'Auckland, New Zealand', major: true }
        };

        const zones = Object.entries(TIME_ZONES).map(([code, data]) => ({ code, ...data }));
        return zones.sort((a, b) => {
            if (a.major !== b.major) return b.major - a.major;
            return a.label.localeCompare(b.label);
        });
    }

    // Storage helpers
    saveToStorage(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.error('Failed to save to storage:', e);
            return false;
        }
    }

    getFromStorage(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (e) {
            console.error('Failed to read from storage:', e);
            return defaultValue;
        }
    }

    // Toast notifications
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;

        this.elements.toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // Logging
    log(...args) {
        if (this.DEBUG) {
            console.log('[Digital Clock]', ...args);
        }
    }

    // Public API
    getAllClocks() {
        return this.timeZones;
    }

    getClockCount() {
        return this.timeZones.length;
    }

    savePreferences() {
        this.saveTimeZones();
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.digitalClock = new DigitalClockApp();
});
