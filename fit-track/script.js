/**
 * FitTrack App Logic
 * Modular app object handling navigation, rendering, models and localStorage persistence.
 */

// Daily Workouts Definition
const workoutsBase = [
    { id: 1, name: 'Push-ups', time: 60, icon: 'fa-child-reaching' },
    { id: 2, name: 'Squats', time: 60, icon: 'fa-arrow-down-up-active' },
    { id: 3, name: 'Running', time: 300, icon: 'fa-person-running' },
    { id: 4, name: 'Plank', time: 60, icon: 'fa-bed' }
];

// Application State Model
let state = {
    userName: 'User',
    theme: 'dark', // 'dark' or 'light'
    lastLoginDate: null,
    streak: 0,
    water: 0,
    waterGoal: 2000,
    steps: 0,
    stepGoal: 10000,
    bmi: null,
    weightHistory: [], // { date: string, weight: number }
    sleepHistory: [],  // { date: string, hours: number }
    customWorkouts: [], // { name, time, icon }
    macros: {
        date: new Date().toISOString().split('T')[0],
        cals: 0, calsGoal: 2000,
        pro: 0, carbs: 0, fats: 0
    },
    badges: [] // array of unlocked badge IDs: ['water', 'streak7', 'workout1']
};

let chartInstances = {}; // to hold Chart.js objects

const app = {
    // Timer properties
    timerInterval: null,
    timeLeft: 0,
    isTimerRunning: false,

    // Initialize the app lifecycle
    init() {
        this.loadState();
        this.applyTheme();
        this.checkStreak();
        this.checkMacroDate();
        this.setupNavigation();
        this.renderWorkouts();
        this.updateWaterUI();
        this.renderProgress();
        this.renderSleep();
        this.updateActivityUI();
        this.updateSettingsUI();
        this.updateDietUI();
        this.checkAchievements();
        this.syncWithHub();
        
        // Listen for global theme changes
        window.addEventListener('storage', (e) => {
            if (e.key === 'fitnessHubTheme') {
                state.theme = e.newValue;
                this.applyTheme();
                this.saveState();
            }
        });

        // Delay chart render slightly so DOM computes sizes
        setTimeout(() => {
            this.initCharts();
        }, 100);
    },
    
    checkStreak() {
        const today = new Date().toISOString().split('T')[0];
        if (state.lastLoginDate !== today) {
            if (state.lastLoginDate) {
                const lastDate = new Date(state.lastLoginDate);
                const currDate = new Date(today);
                const diffTime = Math.abs(currDate - lastDate);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                if (diffDays === 1) {
                    state.streak += 1;
                } else if (diffDays > 1) {
                    state.streak = 1;
                }
            } else {
                state.streak = 1;
            }
            state.lastLoginDate = today;
            this.saveState();
        }
        document.getElementById('streak-count').textContent = state.streak;
    },
    
    checkMacroDate() {
        const today = new Date().toISOString().split('T')[0];
        if (!state.macros) {
            state.macros = { date: today, cals: 0, calsGoal: 2000, pro: 0, carbs: 0, fats: 0 };
        } else if (state.macros.date !== today) {
            state.macros = { date: today, cals: 0, calsGoal: state.macros.calsGoal || 2000, pro: 0, carbs: 0, fats: 0 };
            this.saveState();
        }
    },

    // Save and load user data
    loadState() {
        try {
            const saved = localStorage.getItem('fitTrackData');
            if (saved) {
                state = { ...state, ...JSON.parse(saved) };
            } else {
                // Seed some sample data for empty state wow factor
                const today = new Date();
                state.weightHistory = [
                    { date: today.toISOString().split('T')[0], weight: 74.2 },
                    { date: new Date(today.setDate(today.getDate() - 5)).toISOString().split('T')[0], weight: 75.0 }
                ];
                
                state.sleepHistory = [
                    { date: today.toISOString().split('T')[0], hours: 7.5 }
                ];
            }
        } catch (e) {
            console.error("Local Storage restricted", e);
        }
    },

    saveState() {
        try {
            localStorage.setItem('fitTrackData', JSON.stringify(state));
            this.syncWithHub(); // Sync globally on every save
        } catch (e) {
            console.error("Local Storage restricted");
        }
    },

    syncWithHub() {
        try {
            const shared = JSON.parse(localStorage.getItem('fitnessHubSharedProfile') || '{}');
            // Update shared profile with FitTrack data
            shared.userName = state.userName;
            if (state.weightHistory.length > 0) {
                shared.weight = state.weightHistory[0].weight;
            }
            localStorage.setItem('fitnessHubSharedProfile', JSON.stringify(shared));
            
            // Shared theme check
            const globalTheme = localStorage.getItem('fitnessHubTheme');
            if (globalTheme && globalTheme !== state.theme) {
                state.theme = globalTheme;
                this.applyTheme();
            }
        } catch (e) {
            console.warn("Global sync failed", e);
        }
    },
    
    // Theme Management
    toggleTheme() {
        state.theme = state.theme === 'dark' ? 'light' : 'dark';
        this.applyTheme();
        this.saveState();
        
        // Redraw charts for appropriate axis colors
        setTimeout(() => this.updateCharts(), 50);
    },
    
    applyTheme() {
        const icon = document.getElementById('theme-icon');
        if (state.theme === 'light') {
            document.body.classList.add('light-theme');
            if(icon) { icon.classList.remove('fa-moon'); icon.classList.add('fa-sun'); }
            if (typeof Chart !== 'undefined') Chart.defaults.color = '#64748b';
        } else {
            document.body.classList.remove('light-theme');
            if(icon) { icon.classList.remove('fa-sun'); icon.classList.add('fa-moon'); }
            if (typeof Chart !== 'undefined') Chart.defaults.color = '#94a3b8';
        }
    },

    // Navigation and Routing Logic
    setupNavigation() {
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', () => {
                const targetId = item.getAttribute('data-target');
                this.navigate(targetId);
            });
        });
    },
    
    navigate(targetId) {
        // Toggle Nav Icons Active State
        document.querySelectorAll('.nav-item').forEach(nav => {
            if (nav.getAttribute('data-target') === targetId) {
                nav.classList.add('active');
            } else {
                nav.classList.remove('active');
            }
        });

        // Toggle Views
        document.querySelectorAll('.page').forEach(page => {
            if (page.id === targetId) {
                page.classList.add('active');
            } else {
                page.classList.remove('active');
            }
        });
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    // Rendering the Workflow Models
    getWorkouts() {
        return [...workoutsBase, ...(state.customWorkouts || [])];
    },

    renderWorkouts() {
        const listContainer = document.getElementById('workout-list');
        const allWorkouts = this.getWorkouts();
        
        listContainer.innerHTML = allWorkouts.map(w => {
            const min = Math.floor(w.time / 60);
            const sec = w.time % 60;
            const timeDisplay = `${min} min ${sec ? sec + ' sec' : ''}`;
            
            return `
            <div class="workout-item" onclick="app.openTimer('${w.name}', ${w.time})" aria-label="Start ${w.name}">
                <div class="workout-info">
                    <div class="workout-icon">
                        <i class="fa-solid ${w.icon}"></i>
                    </div>
                    <div>
                        <h3 style="font-weight: 500; font-size: 1.1rem; margin-bottom: 0.2rem;">${w.name}</h3>
                        <p style="color: var(--text-muted); font-size: 0.85rem;">
                            <i class="fa-regular fa-clock" style="margin-right: 4px;"></i>${timeDisplay}
                        </p>
                    </div>
                </div>
                <i class="fa-solid fa-play" style="color: var(--primary); font-size: 1.2rem;"></i>
            </div>
        `}).join('');
    },

    addCustomWorkout() {
        const nameInput = document.getElementById('custom-workout-name');
        const timeInput = document.getElementById('custom-workout-time');
        const name = nameInput.value.trim();
        const time = parseInt(timeInput.value);
        
        if (!name || !time || time < 10) return;
        
        if (!state.customWorkouts) state.customWorkouts = [];
        state.customWorkouts.push({
            id: Date.now(),
            name: name,
            time: time,
            icon: 'fa-bolt'
        });
        
        this.saveState();
        this.renderWorkouts();
        nameInput.value = '';
        timeInput.value = '';
    },

    // -------------------------
    // Water Intake Logic
    // -------------------------
    addWater(amount) {
        state.water += amount;
        
        // Boundaries
        if (state.water < 0) state.water = 0;
        const maxLimit = state.waterGoal * 1.5; // Allow over-hydration ui scaling
        if (state.water > maxLimit) state.water = maxLimit;
        
        this.updateWaterUI();
        this.saveState();
        this.checkAchievements();
    },

    updateWaterUI() {
        const fillPercentage = Math.min((state.water / state.waterGoal) * 100, 100);
        
        // Animate elements
        document.getElementById('water-level').style.height = `${fillPercentage}%`;
        
        // Format strings
        const wStr = `${state.water} / ${state.waterGoal} ml`;
        document.getElementById('water-text').textContent = wStr;
        document.getElementById('dash-water-value').textContent = `${state.water} ml`;
    },

    // -------------------------
    // BMI Calculator Logic
    // -------------------------
    calculateBMI() {
        const weightInput = document.getElementById('bmi-weight');
        const heightInput = document.getElementById('bmi-height');
        
        const weight = parseFloat(weightInput.value);
        const heightCm = parseFloat(heightInput.value);
        
        if (!weight || !heightCm) {
            alert('Please enter a valid weight and height.');
            return;
        }
        
        const heightM = heightCm / 100;
        const bmi = (weight / (heightM * heightM)).toFixed(1);
        
        let category, color;
        
        if (bmi < 18.5) { 
            category = 'Underweight'; 
            color = 'var(--warning)'; 
        } else if (bmi >= 18.5 && bmi <= 24.9) { 
            category = 'Normal'; 
            color = 'var(--accent)'; 
        } else if (bmi >= 25 && bmi <= 29.9) { 
            category = 'Overweight'; 
            color = '#f97316'; 
        } else { 
            category = 'Obese'; 
            color = 'var(--danger)'; 
        }

        const valueDiv = document.getElementById('bmi-value-display');
        const categoryDiv = document.getElementById('bmi-category-display');

        valueDiv.textContent = bmi;
        valueDiv.style.color = color;
        categoryDiv.textContent = category;
        categoryDiv.style.color = color;
        
        document.getElementById('bmi-result').style.display = 'block';
        
        // Sync State
        state.bmi = bmi;
        document.getElementById('dash-bmi-value').textContent = bmi;
        this.saveState();
    },

    // -------------------------
    // Weight Logging System
    // -------------------------
    addWeightRecord() {
        const input = document.getElementById('progress-weight');
        const weight = parseFloat(input.value);
        
        if (!weight) return;
        
        // Grab current normalized datestring string standard YYYY-MM-DD
        const date = new Date().toISOString().split('T')[0];
        
        // Overwrite if same day exists, else unshift to array
        const existingRecordIndex = state.weightHistory.findIndex(r => r.date === date);
        
        if (existingRecordIndex > -1) {
            state.weightHistory[existingRecordIndex].weight = weight;
        } else {
            state.weightHistory.unshift({ date, weight });
        }
        
        // Chronological latest first
        state.weightHistory.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        this.renderProgress();
        this.updateCharts();
        this.saveState();
        input.value = '';
    },

    renderProgress() {
        const list = document.getElementById('progress-list');
        
        if (state.weightHistory.length === 0) {
            list.innerHTML = '<p style="text-align:center; color: var(--text-muted); padding: 2rem;">No weight data logged yet</p>';
            return;
        }
        
        list.innerHTML = state.weightHistory.map((record, index) => {
            let diffHtml = '';
            
            // Calculate differences mapping against earlier date
            if (index < state.weightHistory.length - 1) {
                const prevWeight = state.weightHistory[index + 1].weight;
                const diff = (record.weight - prevWeight).toFixed(1);
                
                if (diff > 0) {
                    diffHtml = `<div class="trend-pill" style="background: rgba(239, 68, 68, 0.1); color: var(--danger);"><i class="fa-solid fa-arrow-up"></i> ${diff}</div>`;
                } else if (diff < 0) {
                    diffHtml = `<div class="trend-pill" style="background: rgba(16, 185, 129, 0.1); color: var(--accent);"><i class="fa-solid fa-arrow-down"></i> ${Math.abs(diff)}</div>`;
                } else {
                    diffHtml = `<div class="trend-pill" style="background: rgba(255, 255, 255, 0.05); color: var(--text-muted);"><i class="fa-solid fa-minus"></i> 0.0</div>`;
                }
            } else {
                diffHtml = `<div class="trend-pill" style="background: rgba(14, 165, 233, 0.1); color: var(--primary);">Initial</div>`;
            }
            
            const displayDate = new Date(record.date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
            
            return `
                <div class="progress-item">
                    <div>
                        <div class="weight-val">${record.weight} kg</div>
                        <div class="date-val">${displayDate}</div>
                    </div>
                    <div>
                        ${diffHtml}
                    </div>
                </div>
            `;
        }).join('');
    },

    // -------------------------
    // Activity / Steps System
    // -------------------------
    addSteps() {
        const input = document.getElementById('activity-add-steps');
        const steps = parseInt(input.value);
        if (!steps || steps <= 0) return;
        
        state.steps += steps;
        this.updateActivityUI();
        this.saveState();
        input.value = '';
    },
    
    updateActivityUI() {
        document.getElementById('activity-steps').textContent = state.steps;
        
        // Simple calorie calculation: roughly ~40 calories per 1000 steps
        const stepCalories = Math.floor(state.steps * 0.04);
        
        // Workout calories (mock representation using time left history if this was a real app)
        // For demo, we just multiply steps for now.
        const totalCals = 1240 + stepCalories; // Start with base 1240 for dashboard demo look
        
        // Let's just update real UI element if it existed dynamically. 
        // Note: dash calorie isn't ID'd yet, but we'll add logic to sleep instead.
    },
    
    // -------------------------
    // Sleep Tracking System
    // -------------------------
    addSleepRecord() {
        const bedTime = document.getElementById('sleep-bedtime').value;
        const wakeTime = document.getElementById('sleep-waketime').value;
        
        if (!bedTime || !wakeTime) return;
        
        // Parse hours and minutes
        const [bedH, bedM] = bedTime.split(':').map(Number);
        const [wakeH, wakeM] = wakeTime.split(':').map(Number);
        
        let hoursSlept = 0;
        
        // Calculate difference handling overnight
        if (wakeH > bedH || (wakeH === bedH && wakeM >= bedM)) {
            // Same day sleep (e.g. 01:00 to 09:00, or naps)
            hoursSlept = (wakeH + wakeM/60) - (bedH + bedM/60);
        } else {
            // Overnight sleep (e.g. 22:00 to 06:00)
            hoursSlept = (24 - (bedH + bedM/60)) + (wakeH + wakeM/60);
        }
        
        // Round to 1 decimal place
        const hours = Math.round(hoursSlept * 10) / 10;
        
        if (hours <= 0) return;
        
        const date = new Date().toISOString().split('T')[0];
        
        const existingRecordIndex = state.sleepHistory.findIndex(r => r.date === date);
        
        if (existingRecordIndex > -1) {
            state.sleepHistory[existingRecordIndex].hours = hours;
        } else {
            state.sleepHistory.unshift({ date, hours });
        }
        
        state.sleepHistory.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        this.renderSleep();
        this.updateCharts();
        this.saveState();
    },

    renderSleep() {
        const list = document.getElementById('sleep-list');
        const dashS = document.getElementById('dash-sleep-value');
        
        if (state.sleepHistory.length === 0) {
            list.innerHTML = '<p style="text-align:center; color: var(--text-muted); padding: 2rem;">No sleep data logged yet</p>';
            dashS.textContent = '-- hrs';
            return;
        }
        
        dashS.textContent = `${state.sleepHistory[0].hours} hrs`;
        
        list.innerHTML = state.sleepHistory.map(record => {
            const displayDate = new Date(record.date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
            
            // Highlight color based on sleep length (ideal ~8 hrs)
            let pillHtml = '';
            if (record.hours >= 7 && record.hours <= 9) {
                pillHtml = `<div class="trend-pill" style="background: rgba(16, 185, 129, 0.1); color: var(--accent);"><i class="fa-solid fa-check"></i> Great</div>`;
            } else if (record.hours < 6) {
                pillHtml = `<div class="trend-pill" style="background: rgba(239, 68, 68, 0.1); color: var(--danger);"><i class="fa-solid fa-arrow-down"></i> Low</div>`;
            } else {
                pillHtml = `<div class="trend-pill" style="background: rgba(255, 255, 255, 0.05); color: var(--text-muted);">Normal</div>`;
            }
            
            return `
                <div class="progress-item">
                    <div>
                        <div class="weight-val">${record.hours} Hours</div>
                        <div class="date-val">${displayDate}</div>
                    </div>
                    <div>${pillHtml}</div>
                </div>
            `;
        }).join('');
    },

    // -------------------------
    // Settings System
    // -------------------------
    saveSettings() {
        const nameVal = document.getElementById('settings-name').value;
        const waterVal = document.getElementById('settings-water').value;
        const stepVal = document.getElementById('settings-step').value;
        const calsVal = document.getElementById('settings-cals').value;
        
        if (nameVal) state.userName = nameVal;
        if (waterVal) state.waterGoal = parseInt(waterVal);
        if (stepVal) state.stepGoal = parseInt(stepVal);
        if (calsVal) state.macros.calsGoal = parseInt(calsVal);
        
        this.updateSettingsUI();
        this.updateWaterUI();
        this.updateActivityUI();
        this.updateDietUI();
        this.saveState();
        
        alert('Settings saved successfully!');
    },
    
    updateSettingsUI() {
        document.getElementById('settings-name').value = state.userName;
        document.getElementById('settings-water').value = state.waterGoal;
        document.getElementById('settings-step').value = state.stepGoal;
        if(state.macros) document.getElementById('settings-cals').value = state.macros.calsGoal;
        
        const goalDisplay = document.getElementById('settings-step-goal-display');
        if(goalDisplay) goalDisplay.textContent = state.stepGoal;
    },
    
    // -------------------------
    // Data Management
    // -------------------------
    exportData() {
        const dataStr = JSON.stringify(state, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `fittrack-data-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        
        setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 0);
    },
    
    importData(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedState = JSON.parse(e.target.result);
                if (importedState && typeof importedState === 'object') {
                    state = { ...state, ...importedState };
                    this.saveState();
                    localStorage.setItem('fitTrackData', JSON.stringify(state));
                    window.location.reload(); // Quick refresh to apply all state changes
                }
            } catch (err) {
                alert("Invalid file format. Please upload a valid FitTrack Data JSON file.");
            }
        };
        reader.readAsText(file);
    },

    // -------------------------
    // Diet & Macros
    // -------------------------
    addMeal() {
        const cals = parseInt(document.getElementById('meal-cals').value) || 0;
        const pro = parseInt(document.getElementById('meal-pro').value) || 0;
        const carbs = parseInt(document.getElementById('meal-carbs').value) || 0;
        const fats = parseInt(document.getElementById('meal-fats').value) || 0;
        
        if (cals <= 0 && pro <= 0 && carbs <= 0 && fats <= 0) return;
        
        state.macros.cals += cals;
        state.macros.pro += pro;
        state.macros.carbs += carbs;
        state.macros.fats += fats;
        
        this.saveState();
        this.updateDietUI();
        
        document.getElementById('meal-name').value = '';
        document.getElementById('meal-cals').value = '';
        document.getElementById('meal-pro').value = '';
        document.getElementById('meal-carbs').value = '';
        document.getElementById('meal-fats').value = '';
    },
    
    updateDietUI() {
        if(!state.macros) return;
        document.getElementById('ui-cals').textContent = state.macros.cals;
        document.getElementById('ui-protein').textContent = state.macros.pro + 'g';
        document.getElementById('ui-carbs').textContent = state.macros.carbs + 'g';
        document.getElementById('ui-fats').textContent = state.macros.fats + 'g';
        
        const calsGoal = state.macros.calsGoal || 2000;
        const goalDisp = document.getElementById('ui-cals-goal');
        if(goalDisp) goalDisp.textContent = calsGoal;
        
        const calsPercent = Math.min(state.macros.cals / calsGoal, 1);
        const calsOffset = 283 - (calsPercent * 283);
        const ring = document.getElementById('cals-ring');
        if(ring) ring.style.strokeDashoffset = calsOffset;
    },

    // -------------------------
    // Analytics Charts
    // -------------------------
    initCharts() {
        if (typeof Chart === 'undefined') return;
        
        const wCtx = document.getElementById('weightChart');
        const sCtx = document.getElementById('sleepChart');
        if (!wCtx || !sCtx) return;
        
        Chart.defaults.color = '#94a3b8';
        Chart.defaults.font.family = "'Outfit', sans-serif";
        
        const commonOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { color: 'rgba(255,255,255,0.05)' } },
                y: { grid: { color: 'rgba(255,255,255,0.05)' } }
            }
        };

        const wData = [...state.weightHistory].reverse();
        const sData = [...state.sleepHistory].reverse();

        chartInstances.weight = new Chart(wCtx, {
            type: 'line',
            data: {
                labels: wData.map(d => new Date(d.date).toLocaleDateString([], {month:'short', day:'numeric'})),
                datasets: [{
                    label: 'Weight (kg)',
                    data: wData.map(d => d.weight),
                    borderColor: '#0ea5e9',
                    backgroundColor: 'rgba(14, 165, 233, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: commonOptions
        });
        
        chartInstances.sleep = new Chart(sCtx, {
            type: 'bar',
            data: {
                labels: sData.map(d => new Date(d.date).toLocaleDateString([], {month:'short', day:'numeric'})),
                datasets: [{
                    label: 'Hours Slept',
                    data: sData.map(d => d.hours),
                    backgroundColor: '#8b5cf6',
                    borderRadius: 4
                }]
            },
            options: commonOptions
        });
    },
    
    updateCharts() {
        if (!chartInstances.weight || !chartInstances.sleep || typeof Chart === 'undefined') return;
        
        const wData = [...state.weightHistory].reverse();
        chartInstances.weight.data.labels = wData.map(d => new Date(d.date).toLocaleDateString([], {month:'short', day:'numeric'}));
        chartInstances.weight.data.datasets[0].data = wData.map(d => d.weight);
        chartInstances.weight.update();
        
        const sData = [...state.sleepHistory].reverse();
        chartInstances.sleep.data.labels = sData.map(d => new Date(d.date).toLocaleDateString([], {month:'short', day:'numeric'}));
        chartInstances.sleep.data.datasets[0].data = sData.map(d => d.hours);
        chartInstances.sleep.update();
    },

    // -------------------------
    // Workout Timer Core System
    // -------------------------
    openTimer(name, time) {
        this.timeLeft = time;
        document.getElementById('timer-title').textContent = name;
        this.updateTimerDisplay();
        
        const modal = document.getElementById('timer-modal');
        const startBtn = document.getElementById('timer-start-btn');
        const display = document.getElementById('timer-display');
        
        modal.classList.add('active');
        display.classList.remove('running');
        startBtn.textContent = 'Start';
        startBtn.disabled = false;
        
        this.isTimerRunning = false;
        clearInterval(this.timerInterval);
    },

    closeTimer() {
        document.getElementById('timer-modal').classList.remove('active');
        clearInterval(this.timerInterval);
        this.isTimerRunning = false;
        document.getElementById('timer-display').classList.remove('running');
    },

    toggleTimer() {
        const btn = document.getElementById('timer-start-btn');
        const display = document.getElementById('timer-display');
        
        if (this.isTimerRunning) {
            // Pause logic
            clearInterval(this.timerInterval);
            this.isTimerRunning = false;
            btn.textContent = 'Resume';
            display.classList.remove('running');
        } else {
            // Start logic
            this.isTimerRunning = true;
            btn.textContent = 'Pause';
            display.classList.add('running');
            
            this.timerInterval = setInterval(() => {
                this.timeLeft--;
                this.updateTimerDisplay();
                
                if (this.timeLeft <= 0) {
                    // Finished
                    clearInterval(this.timerInterval);
                    this.isTimerRunning = false;
                    display.classList.remove('running');
                    
                    btn.textContent = 'Done!';
                    btn.disabled = true;
                    
                    if(!state.badges) state.badges = [];
                    if (!state.badges.includes('workout1')) {
                        state.badges.push('workout1');
                        this.saveState();
                        this.checkAchievements();
                    }
                    
                    // Auto close modal slightly after finish
                    setTimeout(() => {
                        this.closeTimer();
                    }, 2000);
                }
            }, 1000);
        }
    },

    updateTimerDisplay() {
        const mm = Math.floor(this.timeLeft / 60).toString().padStart(2, '0');
        const ss = (this.timeLeft % 60).toString().padStart(2, '0');
        document.getElementById('timer-display').textContent = `${mm}:${ss}`;
    },

    // -------------------------
    // Achievements & Gamification
    // -------------------------
    checkAchievements() {
        if (!state.badges) state.badges = [];
        let didUnlock = false;
        
        // 1. Hydration Master
        if (state.water >= state.waterGoal && !state.badges.includes('water')) {
            state.badges.push('water');
            didUnlock = true;
        }
        
        // 2. Iron Streak
        if (state.streak >= 7 && !state.badges.includes('streak7')) {
            state.badges.push('streak7');
            didUnlock = true;
        }
        
        if (didUnlock) this.saveState();
        this.renderBadges();
    },
    
    renderBadges() {
        const container = document.getElementById('badges-container');
        if(!container) return;
        
        const badgeDefinitions = [
            { id: 'water', icon: 'fa-droplet', color: 'var(--primary)', name: 'Hydration Master' },
            { id: 'workout1', icon: 'fa-dumbbell', color: 'var(--accent)', name: 'First Workout' },
            { id: 'streak7', icon: 'fa-fire', color: 'var(--warning)', name: '7-Day Streak' }
        ];
        
        const currentBadges = state.badges || [];
        document.getElementById('badge-count-disp').textContent = `${currentBadges.length}/${badgeDefinitions.length}`;
        
        container.innerHTML = badgeDefinitions.map(b => {
            const isUnlocked = currentBadges.includes(b.id);
            const statusClass = isUnlocked ? 'unlocked' : 'locked';
            const iconStyle = isUnlocked ? `background: linear-gradient(135deg, ${b.color}, var(--secondary))` : '';
            
            return `
                <div class="badge-item ${statusClass}">
                    <div class="badge-icon" style="${iconStyle}">
                        <i class="fa-solid ${b.icon}"></i>
                    </div>
                    <h4>${b.name}</h4>
                </div>
            `;
        }).join('');
    }
};

// Bootstrap application once DOM loads
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
