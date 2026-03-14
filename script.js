// Fitness Hub - Global Controller

const challenges = [
    { title: "Hydration Hero", desc: "Log at least 2000ml of water in FitTrack today.", target: 2000, type: "water" },
    { title: "Calorie Crusher", desc: "Burn over 500 calories through workouts today.", target: 500, type: "calories" },
    { title: "Zen Master", desc: "Complete a 5-minute meditation in ZenBreath.", target: 5, type: "meditation" },
    { title: "Macro Maven", desc: "Log all your meals (Protein, Carbs, Fats) in FitTrack.", target: 3, type: "meals" },
    { title: "Step Warrior", desc: "Reach 10,000 steps in your activity tracker.", target: 10000, type: "steps" }
];

const HUB = {
    init() {
        this.loadTheme();
        this.loadDailyChallenge();
        this.updatePips();
        this.setupEventListeners();
        
        // Listen for storage changes from other tabs/apps
        window.addEventListener('storage', () => {
            this.updatePips();
            this.checkChallengeProgress();
        });
    },

    setupEventListeners() {
        document.getElementById('theme-toggle').addEventListener('click', () => this.toggleTheme());
        document.getElementById('btn-complete-challenge').addEventListener('click', () => this.manualCompleteChallenge());
    },

    // --- Theme Logic ---
    toggleTheme() {
        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');
        localStorage.setItem('fitnessHubTheme', isDark ? 'dark' : 'light');
        this.updateThemeButton();
    },

    loadTheme() {
        const theme = localStorage.getItem('fitnessHubTheme');
        if (theme === 'dark') {
            document.body.classList.add('dark-mode');
        }
        this.updateThemeButton();
    },

    updateThemeButton() {
        const btn = document.getElementById('theme-toggle');
        const isDark = document.body.classList.contains('dark-mode');
        btn.innerHTML = isDark ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
    },

    // --- Daily Challenge Logic ---
    loadDailyChallenge() {
        const today = new Date().toDateString();
        let saved = localStorage.getItem('fitnessHubDailyChallenge');
        
        if (saved) {
            saved = JSON.parse(saved);
            if (saved.date !== today) {
                saved = this.generateNewChallenge(today);
            }
        } else {
            saved = this.generateNewChallenge(today);
        }

        this.currentChallenge = saved;
        this.renderChallenge();
    },

    generateNewChallenge(dateString) {
        // Simple seeded random based on date
        const seed = dateString.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
        const index = seed % challenges.length;
        const challenge = { ...challenges[index], date: dateString, completed: false };
        localStorage.setItem('fitnessHubDailyChallenge', JSON.stringify(challenge));
        return challenge;
    },

    renderChallenge() {
        const titleEl = document.getElementById('challenge-title');
        const descEl = document.getElementById('challenge-desc');
        const btnEl = document.getElementById('btn-complete-challenge');

        titleEl.textContent = this.currentChallenge.title;
        descEl.textContent = this.currentChallenge.desc;

        if (this.currentChallenge.completed) {
            btnEl.classList.add('completed');
            btnEl.innerHTML = '<i class="fa-solid fa-circle-check"></i> Completed';
        } else {
            btnEl.classList.remove('completed');
            btnEl.innerHTML = '<i class="fa-solid fa-circle-check"></i> Complete Task';
        }
    },

    manualCompleteChallenge() {
        if (this.currentChallenge.completed) return;
        this.currentChallenge.completed = true;
        localStorage.setItem('fitnessHubDailyChallenge', JSON.stringify(this.currentChallenge));
        this.renderChallenge();
    },

    // --- Quick Stats (Pips) Logic ---
    updatePips() {
        // 1. FitTrack Pip (Water/Calories progress)
        const ftData = localStorage.getItem('fitTrackData');
        if (ftData) {
            const data = JSON.parse(ftData);
            const water = data.water || 0;
            const pip = document.getElementById('pip-fittrack');
            pip.textContent = `${water}ml`;
            pip.classList.remove('hidden');
        }

        // 2. ZenBreath Pip (Mins today)
        const zenData = localStorage.getItem('zenBreathHistory');
        if (zenData) {
            const data = JSON.parse(zenData);
            const today = new Date().toDateString();
            // In a real app we'd filter by date, for now we show total or sessions
            const pip = document.getElementById('pip-zenbreath');
            pip.textContent = `${data.sessions} sessions`;
            pip.classList.remove('hidden');
        }
    }
};

// Start HUB
HUB.init();
