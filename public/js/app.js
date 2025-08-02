// Unified Time Platform - Main JavaScript Application

class UnifiedTimePlatform {
    constructor() {
        this.currentTimezones = [];
        this.selectedTime = null;
        this.selectedRange = null;
        this.timeFormat = '24h';
        this.showWeekends = false;
        this.userToken = localStorage.getItem('userToken');
        this.userId = localStorage.getItem('userId');
        
        // Clock app state
        this.timerInterval = null;
        this.stopwatchInterval = null;
        this.timerRunning = false;
        this.stopwatchRunning = false;
        this.timerTime = 0;
        this.stopwatchTime = 0;
        this.lapTimes = [];
        this.alarms = JSON.parse(localStorage.getItem('alarms') || '[]');
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.initializeQuickConverter();
        this.initializeWorldClock();
        this.initializeDigitalClock();
        this.initializeAccount();
        this.loadUserTimezone();
        this.startClockUpdates();
        this.checkAlarms();
    }

    setupEventListeners() {
        // Navigation
        document.getElementById('navToggle')?.addEventListener('click', () => {
            document.getElementById('navMenu').classList.toggle('active');
        });

        // Smooth scrolling for navigation links
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = link.getAttribute('href').substring(1);
                const targetElement = document.getElementById(targetId);
                if (targetElement) {
                    targetElement.scrollIntoView({ behavior: 'smooth' });
                }
            });
        });

        // World Clock Controls
        document.getElementById('citySearch')?.addEventListener('input', this.handleCitySearch.bind(this));
        document.getElementById('addLocation')?.addEventListener('click', this.showAddLocationModal.bind(this));
        document.getElementById('timeFormat')?.addEventListener('click', this.toggleTimeFormat.bind(this));
        document.getElementById('showWeekends')?.addEventListener('click', this.toggleWeekends.bind(this));

        // Timeline Controls
        document.getElementById('shareEvent')?.addEventListener('click', this.shareEvent.bind(this));
        document.getElementById('addToCalendar')?.addEventListener('click', this.addToCalendar.bind(this));
        document.getElementById('copyLink')?.addEventListener('click', this.copyLink.bind(this));

        // Digital Clock Tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Timer Controls
        document.getElementById('startTimer')?.addEventListener('click', this.startTimer.bind(this));
        document.getElementById('pauseTimer')?.addEventListener('click', this.pauseTimer.bind(this));
        document.getElementById('resetTimer')?.addEventListener('click', this.resetTimer.bind(this));

        // Stopwatch Controls
        document.getElementById('startStopwatch')?.addEventListener('click', this.startStopwatch.bind(this));
        document.getElementById('pauseStopwatch')?.addEventListener('click', this.pauseStopwatch.bind(this));
        document.getElementById('resetStopwatch')?.addEventListener('click', this.resetStopwatch.bind(this));
        document.getElementById('lapStopwatch')?.addEventListener('click', this.lapStopwatch.bind(this));

        // Alarm Controls
        document.getElementById('addAlarm')?.addEventListener('click', this.showAlarmForm.bind(this));
        document.getElementById('saveAlarm')?.addEventListener('click', this.saveAlarm.bind(this));
        document.getElementById('cancelAlarm')?.addEventListener('click', this.hideAlarmForm.bind(this));

        // Account Controls
        document.getElementById('showRegister')?.addEventListener('click', this.showRegisterForm.bind(this));
        document.getElementById('showLogin')?.addEventListener('click', this.showLoginForm.bind(this));
        document.getElementById('loginFormElement')?.addEventListener('submit', this.handleLogin.bind(this));
        document.getElementById('registerFormElement')?.addEventListener('submit', this.handleRegister.bind(this));
        document.getElementById('logout')?.addEventListener('click', this.handleLogout.bind(this));
        document.getElementById('saveCurrentConfig')?.addEventListener('click', this.saveCurrentConfiguration.bind(this));

        // Clock Settings
        document.getElementById('showSeconds')?.addEventListener('change', this.updateClockDisplay.bind(this));
        document.getElementById('showDate')?.addEventListener('change', this.updateClockDisplay.bind(this));
    }

    // Quick Converter Functions
    async initializeQuickConverter() {
        const conversions = [
            { from: 'UTC', to: 'Asia/Kolkata', element: 'utcToIst' },
            { from: 'America/Chicago', to: 'Asia/Kolkata', element: 'cstToIst' },
            { from: 'America/New_York', to: 'Asia/Kolkata', element: 'estToIst' },
            { from: 'America/Los_Angeles', to: 'Asia/Kolkata', element: 'pstToIst' }
        ];

        for (const conversion of conversions) {
            await this.updateQuickConversion(conversion);
        }

        // Update every minute
        setInterval(() => {
            conversions.forEach(conversion => {
                this.updateQuickConversion(conversion);
            });
        }, 60000);
    }

    async updateQuickConversion({ from, to, element }) {
        try {
            const response = await fetch(`/api/convert?time=${new Date().toLocaleTimeString('en-US', { hour12: false })}&fromTz=${from}&toTz=${to}`);
            const data = await response.json();
            
            const elementEl = document.getElementById(element);
            if (elementEl) {
                elementEl.textContent = data.converted.time;
            }
        } catch (error) {
            console.error('Error updating quick conversion:', error);
        }
    }

    // World Clock Functions
    async initializeWorldClock() {
        await this.loadUserTimezone();
        this.generateTimeline();
        this.updateTimeline();
        
        // Update timeline every minute
        setInterval(() => {
            this.updateTimeline();
        }, 60000);
    }

    async loadUserTimezone() {
        try {
            // Try to get user's timezone from browser
            const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            
            // Find a city in that timezone
            const response = await fetch(`/api/search?q=${userTimezone.split('/').pop()}`);
            const cities = await response.json();
            
            if (cities.length > 0) {
                this.addTimezone(cities[0]);
            } else {
                // Fallback to UTC
                this.addTimezone({ name: 'UTC', country: 'UTC', timezone: 'UTC' });
            }
        } catch (error) {
            console.error('Error loading user timezone:', error);
            // Fallback to UTC
            this.addTimezone({ name: 'UTC', country: 'UTC', timezone: 'UTC' });
        }
    }

    async handleCitySearch(event) {
        const query = event.target.value.trim();
        const resultsContainer = document.getElementById('searchResults');
        
        if (query.length < 2) {
            resultsContainer.classList.remove('active');
            return;
        }

        try {
            const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
            const cities = await response.json();
            
            this.displaySearchResults(cities);
        } catch (error) {
            console.error('Error searching cities:', error);
        }
    }

    displaySearchResults(cities) {
        const resultsContainer = document.getElementById('searchResults');
        resultsContainer.innerHTML = '';
        
        if (cities.length === 0) {
            resultsContainer.innerHTML = '<div class="search-result-item">No cities found</div>';
        } else {
            cities.forEach(city => {
                const item = document.createElement('div');
                item.className = 'search-result-item';
                item.textContent = `${city.name}, ${city.country}`;
                item.addEventListener('click', () => {
                    this.addTimezone(city);
                    resultsContainer.classList.remove('active');
                    document.getElementById('citySearch').value = '';
                });
                resultsContainer.appendChild(item);
            });
        }
        
        resultsContainer.classList.add('active');
    }

    addTimezone(city) {
        // Check if timezone already exists
        if (this.currentTimezones.some(tz => tz.timezone === city.timezone)) {
            return;
        }

        this.currentTimezones.push(city);
        this.generateTimeline();
        this.updateTimeline();
    }

    removeTimezone(index) {
        this.currentTimezones.splice(index, 1);
        this.generateTimeline();
        this.updateTimeline();
    }

    generateTimeline() {
        const timeHeader = document.getElementById('timeHeader');
        const timelineBody = document.getElementById('timelineBody');
        
        // Generate hour headers
        timeHeader.innerHTML = '';
        for (let hour = 0; hour < 24; hour++) {
            const hourHeader = document.createElement('div');
            hourHeader.className = 'hour-header';
            hourHeader.textContent = this.formatHour(hour);
            timeHeader.appendChild(hourHeader);
        }

        // Generate timezone rows
        timelineBody.innerHTML = '';
        this.currentTimezones.forEach((timezone, index) => {
            const row = this.createTimelineRow(timezone, index);
            timelineBody.appendChild(row);
        });
    }

    createTimelineRow(timezone, index) {
        const row = document.createElement('div');
        row.className = 'timeline-row';
        
        // Location info
        const locationInfo = document.createElement('div');
        locationInfo.className = 'location-info';
        locationInfo.innerHTML = `
            <div class="location-name">${timezone.name}</div>
            <div class="location-time" id="time-${index}">Loading...</div>
        `;
        row.appendChild(locationInfo);

        // Time cells
        const timeCells = document.createElement('div');
        timeCells.className = 'time-cells';
        
        for (let hour = 0; hour < 24; hour++) {
            const cell = document.createElement('div');
            cell.className = 'hour-cell';
            cell.dataset.timezone = timezone.timezone;
            cell.dataset.hour = hour;
            cell.textContent = this.formatHour(hour);
            
            // Add click handler
            cell.addEventListener('click', () => {
                this.selectTime(timezone, hour);
            });
            
            // Add hover handler
            cell.addEventListener('mouseenter', () => {
                this.highlightHour(hour);
            });
            
            cell.addEventListener('mouseleave', () => {
                this.clearHighlight();
            });
            
            timeCells.appendChild(cell);
        }
        
        row.appendChild(timeCells);
        return row;
    }

    updateTimeline() {
        this.currentTimezones.forEach((timezone, index) => {
            this.updateTimezoneTime(timezone, index);
            this.updateTimezoneCells(timezone, index);
        });
    }

    async updateTimezoneTime(timezone, index) {
        try {
            const response = await fetch(`/api/time/${encodeURIComponent(timezone.timezone)}`);
            const data = await response.json();
            
            const timeElement = document.getElementById(`time-${index}`);
            if (timeElement) {
                timeElement.textContent = data.currentTime;
            }
        } catch (error) {
            console.error('Error updating timezone time:', error);
        }
    }

    updateTimezoneCells(timezone, index) {
        const now = new Date();
        const currentHour = now.getHours();
        
        // Update cell colors based on time of day
        const cells = document.querySelectorAll(`[data-timezone="${timezone.timezone}"]`);
        cells.forEach((cell, hour) => {
            cell.className = 'hour-cell';
            
            if (hour >= 6 && hour < 18) {
                cell.classList.add('day');
            } else if (hour >= 22 || hour < 6) {
                cell.classList.add('night');
            } else {
                cell.classList.add('work');
            }
            
            if (hour === currentHour) {
                cell.style.border = '2px solid var(--primary-color)';
            } else {
                cell.style.border = '1px solid var(--border-color)';
            }
        });
    }

    selectTime(timezone, hour) {
        this.selectedTime = { timezone, hour };
        this.clearSelection();
        
        // Highlight selected time across all rows
        const cells = document.querySelectorAll(`[data-hour="${hour}"]`);
        cells.forEach(cell => {
            cell.classList.add('selected');
        });
        
        // Show timeline controls
        const controls = document.getElementById('timelineControls');
        controls.style.display = 'flex';
        
        // Update selected time display
        const selectedTimeEl = document.getElementById('selectedTime');
        const time = this.formatHour(hour);
        selectedTimeEl.textContent = `${time} in ${timezone.name}`;
    }

    highlightHour(hour) {
        const cells = document.querySelectorAll(`[data-hour="${hour}"]`);
        cells.forEach(cell => {
            cell.style.backgroundColor = 'var(--accent-color)';
            cell.style.color = 'white';
        });
    }

    clearHighlight() {
        const cells = document.querySelectorAll('.hour-cell');
        cells.forEach(cell => {
            if (!cell.classList.contains('selected')) {
                cell.style.backgroundColor = '';
                cell.style.color = '';
            }
        });
    }

    clearSelection() {
        const cells = document.querySelectorAll('.hour-cell');
        cells.forEach(cell => {
            cell.classList.remove('selected');
        });
    }

    toggleTimeFormat() {
        this.timeFormat = this.timeFormat === '24h' ? '12h' : '24h';
        const button = document.getElementById('timeFormat');
        button.textContent = this.timeFormat;
        this.updateTimeline();
    }

    toggleWeekends() {
        this.showWeekends = !this.showWeekends;
        const button = document.getElementById('showWeekends');
        button.textContent = this.showWeekends ? 'Hide Weekends' : 'Show Weekends';
        // TODO: Implement weekend highlighting
    }

    formatHour(hour) {
        if (this.timeFormat === '12h') {
            const period = hour >= 12 ? 'PM' : 'AM';
            const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
            return `${displayHour}${period}`;
        }
        return hour.toString().padStart(2, '0');
    }

    // Sharing Functions
    async shareEvent() {
        if (!this.selectedTime) return;
        
        const title = prompt('Enter event title:');
        if (!title) return;
        
        try {
            const response = await fetch('/api/events', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title,
                    startTime: new Date().toISOString(),
                    timezones: this.currentTimezones
                })
            });
            
            const data = await response.json();
            const shareUrl = `${window.location.origin}${data.shareUrl}`;
            
            if (navigator.share) {
                await navigator.share({
                    title,
                    text: `Check out this event: ${title}`,
                    url: shareUrl
                });
            } else {
                await this.copyToClipboard(shareUrl);
                alert('Event link copied to clipboard!');
            }
        } catch (error) {
            console.error('Error sharing event:', error);
            alert('Error sharing event');
        }
    }

    addToCalendar() {
        if (!this.selectedTime) return;
        
        const event = {
            title: 'Meeting',
            start: new Date(),
            end: new Date(Date.now() + 60 * 60 * 1000), // 1 hour later
            description: 'Meeting scheduled via Unified Time Platform'
        };
        
        const icsContent = this.generateICS(event);
        const blob = new Blob([icsContent], { type: 'text/calendar' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'event.ics';
        a.click();
        
        URL.revokeObjectURL(url);
    }

    generateICS(event) {
        return `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
SUMMARY:${event.title}
DTSTART:${event.start.toISOString().replace(/[-:]/g, '').split('.')[0]}Z
DTEND:${event.end.toISOString().replace(/[-:]/g, '').split('.')[0]}Z
DESCRIPTION:${event.description}
END:VEVENT
END:VCALENDAR`;
    }

    async copyLink() {
        if (!this.selectedTime) return;
        
        const url = new URL(window.location);
        url.searchParams.set('timezones', JSON.stringify(this.currentTimezones));
        url.searchParams.set('selectedTime', JSON.stringify(this.selectedTime));
        
        await this.copyToClipboard(url.toString());
        alert('Link copied to clipboard!');
    }

    async copyToClipboard(text) {
        if (navigator.clipboard) {
            await navigator.clipboard.writeText(text);
        } else {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
        }
    }

    // Digital Clock Functions
    initializeDigitalClock() {
        this.updateClockDisplay();
        this.loadAlarms();
        
        // Update clock every second
        setInterval(() => {
            this.updateClockDisplay();
        }, 1000);
    }

    updateClockDisplay() {
        const now = new Date();
        const timeElement = document.getElementById('currentTime');
        const dateElement = document.getElementById('currentDate');
        
        if (timeElement) {
            const showSeconds = document.getElementById('showSeconds')?.checked ?? true;
            const format = showSeconds ? 'HH:mm:ss' : 'HH:mm';
            timeElement.textContent = now.toLocaleTimeString('en-US', { 
                hour12: false,
                hour: '2-digit',
                minute: '2-digit',
                second: showSeconds ? '2-digit' : undefined
            });
        }
        
        if (dateElement) {
            const showDate = document.getElementById('showDate')?.checked ?? true;
            if (showDate) {
                dateElement.textContent = now.toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
            } else {
                dateElement.textContent = '';
            }
        }
    }

    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        
        // Update tab content
        document.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.remove('active');
        });
        document.getElementById(`${tabName}Tab`).classList.add('active');
    }

    // Timer Functions
    startTimer() {
        if (this.timerRunning) return;
        
        const hours = parseInt(document.getElementById('timerHours').value) || 0;
        const minutes = parseInt(document.getElementById('timerMinutes').value) || 0;
        const seconds = parseInt(document.getElementById('timerSeconds').value) || 0;
        
        this.timerTime = (hours * 3600 + minutes * 60 + seconds) * 1000;
        
        if (this.timerTime <= 0) return;
        
        this.timerRunning = true;
        document.getElementById('startTimer').disabled = true;
        document.getElementById('pauseTimer').disabled = false;
        
        this.timerInterval = setInterval(() => {
            this.timerTime -= 1000;
            this.updateTimerDisplay();
            
            if (this.timerTime <= 0) {
                this.stopTimer();
                this.playAlarmSound();
            }
        }, 1000);
    }

    pauseTimer() {
        if (!this.timerRunning) return;
        
        this.timerRunning = false;
        clearInterval(this.timerInterval);
        document.getElementById('startTimer').disabled = false;
        document.getElementById('pauseTimer').disabled = true;
    }

    resetTimer() {
        this.pauseTimer();
        this.timerTime = 0;
        this.updateTimerDisplay();
        document.getElementById('timerHours').value = '0';
        document.getElementById('timerMinutes').value = '0';
        document.getElementById('timerSeconds').value = '0';
    }

    stopTimer() {
        this.pauseTimer();
        this.timerTime = 0;
        this.updateTimerDisplay();
    }

    updateTimerDisplay() {
        const hours = Math.floor(this.timerTime / 3600000);
        const minutes = Math.floor((this.timerTime % 3600000) / 60000);
        const seconds = Math.floor((this.timerTime % 60000) / 1000);
        
        const display = document.getElementById('timerDisplay');
        if (display) {
            display.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
    }

    // Stopwatch Functions
    startStopwatch() {
        if (this.stopwatchRunning) return;
        
        this.stopwatchRunning = true;
        document.getElementById('startStopwatch').disabled = true;
        document.getElementById('pauseStopwatch').disabled = false;
        
        this.stopwatchInterval = setInterval(() => {
            this.stopwatchTime += 10;
            this.updateStopwatchDisplay();
        }, 10);
    }

    pauseStopwatch() {
        if (!this.stopwatchRunning) return;
        
        this.stopwatchRunning = false;
        clearInterval(this.stopwatchInterval);
        document.getElementById('startStopwatch').disabled = false;
        document.getElementById('pauseStopwatch').disabled = true;
    }

    resetStopwatch() {
        this.pauseStopwatch();
        this.stopwatchTime = 0;
        this.lapTimes = [];
        this.updateStopwatchDisplay();
        this.updateLapTimes();
    }

    lapStopwatch() {
        if (!this.stopwatchRunning) return;
        
        this.lapTimes.push(this.stopwatchTime);
        this.updateLapTimes();
    }

    updateStopwatchDisplay() {
        const hours = Math.floor(this.stopwatchTime / 3600000);
        const minutes = Math.floor((this.stopwatchTime % 3600000) / 60000);
        const seconds = Math.floor((this.stopwatchTime % 60000) / 1000);
        const centiseconds = Math.floor((this.stopwatchTime % 1000) / 10);
        
        const display = document.getElementById('stopwatchDisplay');
        if (display) {
            display.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
        }
    }

    updateLapTimes() {
        const container = document.getElementById('lapTimes');
        if (!container) return;
        
        container.innerHTML = '';
        this.lapTimes.forEach((lapTime, index) => {
            const hours = Math.floor(lapTime / 3600000);
            const minutes = Math.floor((lapTime % 3600000) / 60000);
            const seconds = Math.floor((lapTime % 60000) / 1000);
            const centiseconds = Math.floor((lapTime % 1000) / 10);
            
            const lapElement = document.createElement('div');
            lapElement.className = 'lap-time';
            lapElement.innerHTML = `
                <span>Lap ${index + 1}</span>
                <span>${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}</span>
            `;
            container.appendChild(lapElement);
        });
    }

    // Alarm Functions
    loadAlarms() {
        this.updateAlarmList();
    }

    showAlarmForm() {
        document.getElementById('alarmForm').style.display = 'block';
    }

    hideAlarmForm() {
        document.getElementById('alarmForm').style.display = 'none';
        document.getElementById('alarmTime').value = '';
        document.getElementById('alarmLabel').value = '';
        document.querySelectorAll('.day-selector input').forEach(input => {
            input.checked = false;
        });
    }

    saveAlarm() {
        const time = document.getElementById('alarmTime').value;
        const label = document.getElementById('alarmLabel').value || 'Alarm';
        const days = Array.from(document.querySelectorAll('.day-selector input:checked')).map(input => parseInt(input.value));
        
        if (!time) {
            alert('Please select a time');
            return;
        }
        
        const alarm = {
            id: Date.now(),
            time,
            label,
            days,
            enabled: true
        };
        
        this.alarms.push(alarm);
        localStorage.setItem('alarms', JSON.stringify(this.alarms));
        this.updateAlarmList();
        this.hideAlarmForm();
    }

    updateAlarmList() {
        const container = document.getElementById('alarmList');
        if (!container) return;
        
        // Keep the add button
        const addButton = container.querySelector('.add-alarm');
        container.innerHTML = '';
        container.appendChild(addButton);
        
        this.alarms.forEach(alarm => {
            const alarmElement = document.createElement('div');
            alarmElement.className = 'alarm-item';
            alarmElement.innerHTML = `
                <div>
                    <div class="alarm-time">${alarm.time}</div>
                    <div class="alarm-label">${alarm.label}</div>
                </div>
                <div>
                    <button class="btn btn-sm btn-secondary" onclick="app.toggleAlarm(${alarm.id})">
                        ${alarm.enabled ? 'Disable' : 'Enable'}
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="app.deleteAlarm(${alarm.id})">Delete</button>
                </div>
            `;
            container.appendChild(alarmElement);
        });
    }

    toggleAlarm(id) {
        const alarm = this.alarms.find(a => a.id === id);
        if (alarm) {
            alarm.enabled = !alarm.enabled;
            localStorage.setItem('alarms', JSON.stringify(this.alarms));
            this.updateAlarmList();
        }
    }

    deleteAlarm(id) {
        this.alarms = this.alarms.filter(a => a.id !== id);
        localStorage.setItem('alarms', JSON.stringify(this.alarms));
        this.updateAlarmList();
    }

    checkAlarms() {
        const now = new Date();
        const currentTime = now.toTimeString().slice(0, 5);
        const currentDay = now.getDay();
        
        this.alarms.forEach(alarm => {
            if (alarm.enabled && alarm.time === currentTime) {
                if (alarm.days.length === 0 || alarm.days.includes(currentDay)) {
                    this.triggerAlarm(alarm);
                }
            }
        });
    }

    triggerAlarm(alarm) {
        this.playAlarmSound();
        
        if (Notification.permission === 'granted') {
            new Notification('Alarm', {
                body: alarm.label,
                icon: '/favicon.ico'
            });
        } else if (Notification.permission !== 'denied') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    new Notification('Alarm', {
                        body: alarm.label,
                        icon: '/favicon.ico'
                    });
                }
            });
        }
    }

    playAlarmSound() {
        // Create a simple beep sound
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
    }

    // Account Functions
    initializeAccount() {
        if (this.userToken) {
            this.showUserDashboard();
        } else {
            this.showLoginForm();
        }
    }

    showLoginForm() {
        document.getElementById('loginForm').style.display = 'block';
        document.getElementById('registerForm').style.display = 'none';
        document.getElementById('userDashboard').style.display = 'none';
    }

    showRegisterForm() {
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('registerForm').style.display = 'block';
        document.getElementById('userDashboard').style.display = 'none';
    }

    showUserDashboard() {
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('registerForm').style.display = 'none';
        document.getElementById('userDashboard').style.display = 'block';
        this.loadSavedConfigurations();
    }

    async handleLogin(event) {
        event.preventDefault();
        
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.userToken = data.token;
                this.userId = data.userId;
                localStorage.setItem('userToken', data.token);
                localStorage.setItem('userId', data.userId);
                this.showUserDashboard();
            } else {
                alert(data.error || 'Login failed');
            }
        } catch (error) {
            console.error('Login error:', error);
            alert('Login failed');
        }
    }

    async handleRegister(event) {
        event.preventDefault();
        
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;
        
        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.userToken = data.token;
                this.userId = data.userId;
                localStorage.setItem('userToken', data.token);
                localStorage.setItem('userId', data.userId);
                this.showUserDashboard();
            } else {
                alert(data.error || 'Registration failed');
            }
        } catch (error) {
            console.error('Registration error:', error);
            alert('Registration failed');
        }
    }

    handleLogout() {
        this.userToken = null;
        this.userId = null;
        localStorage.removeItem('userToken');
        localStorage.removeItem('userId');
        this.showLoginForm();
    }

    async loadSavedConfigurations() {
        if (!this.userToken) return;
        
        try {
            const response = await fetch('/api/configs', {
                headers: {
                    'Authorization': `Bearer ${this.userToken}`
                }
            });
            
            if (response.ok) {
                const configs = await response.json();
                this.displaySavedConfigurations(configs);
            }
        } catch (error) {
            console.error('Error loading configurations:', error);
        }
    }

    displaySavedConfigurations(configs) {
        const container = document.getElementById('savedConfigsList');
        if (!container) return;
        
        container.innerHTML = '';
        
        configs.forEach(config => {
            const configElement = document.createElement('div');
            configElement.className = 'saved-config-item';
            configElement.innerHTML = `
                <span>${config.name}</span>
                <button class="btn btn-sm btn-secondary" onclick="app.loadConfiguration(${config.id})">Load</button>
            `;
            container.appendChild(configElement);
        });
    }

    async saveCurrentConfiguration() {
        if (!this.userToken) {
            alert('Please log in to save configurations');
            return;
        }
        
        const name = prompt('Enter configuration name:');
        if (!name) return;
        
        try {
            const response = await fetch('/api/configs', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.userToken}`
                },
                body: JSON.stringify({
                    name,
                    timezones: this.currentTimezones
                })
            });
            
            if (response.ok) {
                alert('Configuration saved!');
                this.loadSavedConfigurations();
            } else {
                alert('Failed to save configuration');
            }
        } catch (error) {
            console.error('Error saving configuration:', error);
            alert('Failed to save configuration');
        }
    }

    async loadConfiguration(configId) {
        if (!this.userToken) {
            alert('Please log in to load configurations');
            return;
        }
        
        try {
            const response = await fetch(`/api/configs/${configId}`, {
                headers: {
                    'Authorization': `Bearer ${this.userToken}`
                }
            });
            
            if (response.ok) {
                const config = await response.json();
                this.currentTimezones = config.timezones;
                this.generateTimeline();
                this.updateTimeline();
                alert('Configuration loaded!');
            } else {
                alert('Failed to load configuration');
            }
        } catch (error) {
            console.error('Error loading configuration:', error);
            alert('Failed to load configuration');
        }
    }

    // Utility Functions
    startClockUpdates() {
        // Update current time display every second
        setInterval(() => {
            this.updateClockDisplay();
        }, 1000);
        
        // Check alarms every minute
        setInterval(() => {
            this.checkAlarms();
        }, 60000);
    }

    showAddLocationModal() {
        // Simple modal for adding locations
        const city = prompt('Enter city name:');
        if (city) {
            this.handleCitySearch({ target: { value: city } });
        }
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new UnifiedTimePlatform();
});

// Handle URL parameters for shared events
window.addEventListener('load', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const timezonesParam = urlParams.get('timezones');
    const selectedTimeParam = urlParams.get('selectedTime');
    
    if (timezonesParam && window.app) {
        try {
            const timezones = JSON.parse(timezonesParam);
            window.app.currentTimezones = timezones;
            window.app.generateTimeline();
            window.app.updateTimeline();
        } catch (error) {
            console.error('Error parsing timezones from URL:', error);
        }
    }
    
    if (selectedTimeParam && window.app) {
        try {
            const selectedTime = JSON.parse(selectedTimeParam);
            window.app.selectedTime = selectedTime;
            window.app.selectTime(selectedTime.timezone, selectedTime.hour);
        } catch (error) {
            console.error('Error parsing selected time from URL:', error);
        }
    }
});