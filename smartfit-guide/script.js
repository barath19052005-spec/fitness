/**
 * SmartFit Guide Application Logic
 * Calculates personalized fitness & diet recommendations.
 */

const EXERCISE_DB = {
    general: ['Push-ups', 'Squats', 'Plank', 'Lunges'],
    cardio: ['Running', 'Jump rope', 'Cycling', 'Burpees', 'Jumping Jacks'],
    strength: ['Pull-ups', 'Dumbbell Rows', 'Bench Press', 'Deadlifts', 'Bicep Curls'],
    low_impact: ['Walking', 'Swimming', 'Yoga', 'Wall Push-ups', 'Seated Leg Raises']
};

const FOOD_DB = {
    weight_loss: {
        breakfast: ['Oats with berries', '2 Boiled Eggs & Coffee', 'Greek Yogurt', 'Fruit Smoothie (no sugar)'],
        lunch: ['Grilled Chicken Salad', 'Quinoa & Veggies', 'Lentil Soup (Dal)', 'Tofu Wrap'],
        dinner: ['Baked Salmon & Asparagus', '1 Chapati with mixed vegetables', 'Chicken stir-fry', 'Clear Soup & Salad']
    },
    muscle_gain: {
        breakfast: ['3 Eggs & Whole Wheat Toast', 'Proteins Oats with Peanut Butter', 'Protein Shake & Banana'],
        lunch: ['Chicken Breast with Brown Rice', 'Beef Pasta', 'Large portion Dal & Rice with Ghee', 'Tuna Salad Sandwich'],
        dinner: ['Steak & Sweet Potato', 'Paneer Tikka with 2 Chapatis', 'Grilled Fish & Quinoa', 'Chicken Curry']
    },
    maintain: {
        breakfast: ['Oats', 'Eggs', 'Fruits', 'Avocado Toast'],
        lunch: ['Rice', 'Vegetables', 'Chicken / Dal', 'Pasta Salad'],
        dinner: ['Chapati', 'Salad', 'Milk', 'Grilled Chicken & Veggies']
    }
};

const app = {
    // Initialization
    init() {
        this.syncWithHub();
        if(this.loadProfile()) {
            this.switchView('view-dashboard');
        }

        // Listen for global changes
        window.addEventListener('storage', (e) => {
            if (e.key === 'fitnessHubTheme') {
                this.applyTheme(e.newValue);
            }
            if (e.key === 'fitnessHubSharedProfile') {
                this.syncWithHub();
            }
        });
    },

    applyTheme(theme) {
        if (theme === 'dark') {
            document.body.classList.remove('light-mode');
        } else {
            document.body.classList.add('light-mode');
        }
    },

    syncWithHub() {
        try {
            const shared = JSON.parse(localStorage.getItem('fitnessHubSharedProfile') || '{}');
            const theme = localStorage.getItem('fitnessHubTheme');
            
            if (theme) this.applyTheme(theme);

            if (shared.weight || shared.userName) {
                // If we are on the form, pre-fill it
                const nameInp = document.getElementById('user-name');
                const weightInp = document.getElementById('user-weight');
                
                if (nameInp && !nameInp.value && shared.userName) nameInp.value = shared.userName;
                if (weightInp && !weightInp.value && shared.weight) weightInp.value = shared.weight;

                // If we already have a profile, update it with new shared data
                const savedStr = localStorage.getItem('smartFitGuideProfile');
                if (savedStr) {
                    const local = JSON.parse(savedStr);
                    let changed = false;
                    if (shared.userName && local.name !== shared.userName) { local.name = shared.userName; changed = true; }
                    if (shared.weight && local.weightKg !== shared.weight) { local.weightKg = shared.weight; changed = true; }
                    
                    if (changed) {
                        localStorage.setItem('smartFitGuideProfile', JSON.stringify(local));
                        // Re-run dashboard update if active
                        if (document.getElementById('view-dashboard').classList.contains('active')) {
                            this.loadProfile();
                        }
                    }
                }
            }
        } catch (e) {
            console.warn("Global sync failed", e);
        }
    },
    
    // Switch between specific views
    switchView(viewId) {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById(viewId).classList.add('active');
    },
    
    // Clear and go back to input form
    resetForm() {
        localStorage.removeItem('smartFitGuideProfile');
        this.switchView('view-form');
    },

    // Handle initial form submission
    processForm(event) {
        event.preventDefault();
        
        // 1. Gather Inputs
        const user = {
            name: document.getElementById('user-name').value,
            age: parseInt(document.getElementById('user-age').value),
            gender: document.querySelector('input[name="user-gender"]:checked').value,
            heightCm: parseFloat(document.getElementById('user-height').value),
            weightKg: parseFloat(document.getElementById('user-weight').value),
            goal: document.getElementById('user-goal').value,
            activityLevel: parseFloat(document.getElementById('user-activity').value)
        };
        
        // 2. Perform Calculations
        const heightM = user.heightCm / 100;
        const bmi = user.weightKg / (heightM * heightM);
        const bmiRounded = Math.round(bmi * 10) / 10;
        
        // Baseline water: 35ml per kg of bodyweight
        const waterMl = Math.round(user.weightKg * 35);
        
        // 3. Update Dashboard UI Arrays
        this.updateDashboard(user, bmiRounded, waterMl);
        
        // Save profile
        this.saveProfile(user);
        
        // 4. Change UI
        this.switchView('view-dashboard');
    },

    updateDashboard(user, bmi, waterMl) {
        // --- Greeting ---
        document.getElementById('dash-greeting').textContent = `Hi ${user.name},`;
        document.getElementById('ui-goal-text').textContent = 
            user.goal === 'lose' ? 'weight loss' : 
            user.goal === 'gain' ? 'muscle building' : 'maintenance';
            
        // --- BMI Logic ---
        document.getElementById('ui-bmi-value').textContent = bmi;
        const statusEl = document.getElementById('ui-bmi-status');
        const descEl = document.getElementById('ui-bmi-desc');
        
        let bmiCategory = '';
        if (bmi < 18.5) {
            statusEl.textContent = 'Underweight';
            statusEl.className = 'status-badge warning';
            descEl.textContent = 'Focus on a nutrient-dense surplus.';
            bmiCategory = 'under';
        } else if (bmi >= 18.5 && bmi <= 25) {
            statusEl.textContent = 'Normal Weight';
            statusEl.className = 'status-badge normal';
            descEl.textContent = 'You are in a healthy weight range.';
            bmiCategory = 'normal';
        } else if (bmi > 25 && bmi <= 30) {
            statusEl.textContent = 'Overweight';
            statusEl.className = 'status-badge warning';
            descEl.textContent = 'A slight caloric deficit is suggested.';
            bmiCategory = 'over';
        } else {
            statusEl.textContent = 'Obese';
            statusEl.className = 'status-badge danger';
            descEl.textContent = 'Low-impact movements are prioritized.';
            bmiCategory = 'obese';
        }

        // --- Water Logic ---
        document.getElementById('ui-water-goal').innerHTML = `${waterMl}<small>ml</small>`;

        // --- TDEE & Macro Logic ---
        let bmr = (10 * user.weightKg) + (6.25 * user.heightCm) - (5 * user.age);
        bmr += (user.gender === 'male') ? 5 : -161;
        let tdee = Math.round(bmr * user.activityLevel);

        if (user.goal === 'lose') tdee -= 500;
        if (user.goal === 'gain') tdee += 500;

        document.getElementById('ui-tdee-value').innerHTML = `${tdee}<small>kcal</small>`;

        let pro = Math.round(user.weightKg * 2.2);
        if (user.goal === 'lose') pro = Math.round(user.weightKg * 2.4);
        let fats = Math.round((tdee * 0.25) / 9);
        let carbs = Math.round((tdee - (pro * 4) - (fats * 9)) / 4);

        if(carbs < 0) carbs = 0; // fallback if deficit is extreme

        document.getElementById('ui-macro-pro').textContent = `${pro}g`;
        document.getElementById('ui-macro-fats').textContent = `${fats}g`;
        document.getElementById('ui-macro-carbs').textContent = `${carbs}g`;

        // --- 4-Week Projection Logic ---
        // 1 lb fat = ~3500 kcal, or ~0.45 kg
        // Weekly deficit/surplus = daily diff * 7
        const diffKcal = tdee - bmr*user.activityLevel; // negative if deficit, positive if surplus
        const weeklyChangeKg = (diffKcal * 7 / 3500) * 0.45;
        const projectedWeight = user.weightKg + (weeklyChangeKg * 4);
        
        document.getElementById('ui-proj-weight').innerHTML = `${projectedWeight.toFixed(1)}<small>kg</small>`;
        const pdEl = document.getElementById('ui-proj-desc');
        
        if (user.goal === 'lose') {
            const loss = (user.weightKg - projectedWeight).toFixed(1);
            pdEl.textContent = `You are on track to lose ~${loss}kg in 4 weeks.`;
        } else if (user.goal === 'gain') {
            const gain = (projectedWeight - user.weightKg).toFixed(1);
            pdEl.textContent = `You are on track to gain ~${gain}kg of mass in 4 weeks.`;
        } else {
            pdEl.textContent = "You are on track to maintain your current weight.";
        }

        // --- Exercise Recommendation Logic ---
        this.generateWeeklyWorkout(user, bmiCategory);

        // --- Food Recommendation Logic ---
        let mealPlanKey = 'maintain';
        if (user.goal === 'lose') mealPlanKey = 'weight_loss';
        if (user.goal === 'gain') mealPlanKey = 'muscle_gain';

        const db = FOOD_DB[mealPlanKey];
        
        // Grab 3 random foods for each meal slot
        const brk = this.getRandomItems(db.breakfast, 3);
        const lun = this.getRandomItems(db.lunch, 3);
        const din = this.getRandomItems(db.dinner, 3);
        
        const formatMeal = (arr) => arr.map(f => `<li><i class="fa-solid fa-check"></i> ${f}</li>`).join('');
        
        document.getElementById('ui-breakfast-list').innerHTML = formatMeal(brk);
        document.getElementById('ui-lunch-list').innerHTML = formatMeal(lun);
        document.getElementById('ui-dinner-list').innerHTML = formatMeal(din);
        
        const mealGoalStr = mealPlanKey.replace('_', ' ');
        document.getElementById('ui-food-desc').textContent = `A sample daily menu tailored for ${mealGoalStr}.`;
        
        // --- Grocery List Logic ---
        this.generateGroceryList(brk, lun, din);
    },
    
    generateWeeklyWorkout(user, bmiCategory) {
        let split = [];
        if (bmiCategory === 'obese' || user.age > 60) {
            const low = () => this.getRandomItems(EXERCISE_DB.low_impact, 4);
            split = [
                { title: 'Full Body (Light)', ex: low() },
                { title: 'Active Recovery', ex: ['Walking', 'Stretching'] },
                { title: 'Full Body (Light)', ex: low() },
                { title: 'Rest Day', ex: ['Rest', 'Hydrate'] },
                { title: 'Cardio Core', ex: this.getRandomItems(EXERCISE_DB.low_impact, 3).concat(['Plank']) },
                { title: 'Active Recovery', ex: ['Swimming', 'Walking'] },
                { title: 'Rest Day', ex: ['Rest'] }
            ];
        } else if (user.goal === 'lose') {
            const card = () => this.getRandomItems(EXERCISE_DB.cardio, 4);
            const gen = () => this.getRandomItems(EXERCISE_DB.general, 4);
            split = [
                { title: 'HIIT Cardio', ex: card() },
                { title: 'Full Body Resistance', ex: gen() },
                { title: 'Active Recovery', ex: ['Walking', 'Yoga'] },
                { title: 'HIIT Cardio', ex: card() },
                { title: 'Full Body Resistance', ex: gen() },
                { title: 'Endurance Cardio', ex: ['Cycling', 'Running'] },
                { title: 'Rest Day', ex: ['Rest'] }
            ];
        } else if (user.goal === 'gain') {
            const push = () => this.getRandomItems(['Push-ups', 'Bench Press', 'Overhead Press', 'Dips'], 4);
            const pull = () => this.getRandomItems(['Pull-ups', 'Dumbbell Rows', 'Barbell Rows', 'Bicep Curls'], 4);
            const legs = () => this.getRandomItems(['Squats', 'Deadlifts', 'Lunges', 'Calf Raises'], 4);
            split = [
                { title: 'Push Day (Chest/Triceps)', ex: push() },
                { title: 'Pull Day (Back/Biceps)', ex: pull() },
                { title: 'Leg Day (Quads/Calves)', ex: legs() },
                { title: 'Rest Day', ex: ['Rest', 'Recover'] },
                { title: 'Upper Body Power', ex: push().slice(0,2).concat(pull().slice(0,2)) },
                { title: 'Lower Body Core', ex: legs().slice(0,3).concat(['Plank', 'Crunches']) },
                { title: 'Rest Day', ex: ['Rest'] }
            ];
        } else {
            const full = () => this.getRandomItems(EXERCISE_DB.general.concat(EXERCISE_DB.strength), 4);
            split = [
                { title: 'Full Body A', ex: full() },
                { title: 'Cardio', ex: this.getRandomItems(EXERCISE_DB.cardio, 3) },
                { title: 'Full Body B', ex: full() },
                { title: 'Active Recovery', ex: ['Yoga', 'Walking'] },
                { title: 'Full Body C', ex: full() },
                { title: 'Cardio', ex: this.getRandomItems(EXERCISE_DB.cardio, 3) },
                { title: 'Rest Day', ex: ['Rest'] }
            ];
        }
        app.currentWeeklySplit = split;
        app.showWorkoutDay(0);
    },
    
    showWorkoutDay(dayIndex) {
        document.querySelectorAll('.day-tab').forEach(t => t.classList.remove('active'));
        const tab = document.querySelector(`.day-tab[data-day="${dayIndex}"]`);
        if(tab) tab.classList.add('active');
        
        const dayData = app.currentWeeklySplit[dayIndex];
        document.getElementById('ui-day-title').textContent = dayData.title;
        const exList = document.getElementById('ui-exercise-list');
        exList.innerHTML = dayData.ex.map(ex => `<li>${ex}</li>`).join('');
    },

    generateGroceryList(brk, lun, din) {
        const foodItems = [...brk, ...lun, ...din];
        let groceries = new Set();
        
        const ingredientMap = {
            'Oats': 'Rolled Oats',
            'Eggs': 'Eggs (1 dozen)',
            'Yogurt': 'Greek Yogurt',
            'Smoothie': 'Mixed Fruits (Bananas, Berries)',
            'Chicken': 'Chicken Breast',
            'Quinoa': 'Quinoa',
            'Dal': 'Lentils (Dal)',
            'Tofu': 'Tofu block',
            'Salmon': 'Salmon Filets',
            'Chapati': 'Whole Wheat Flour (Atta)',
            'Salad': 'Salad Greens',
            'Milk': 'Milk (1 Gallon)',
            'Peanut Butter': 'Peanut Butter',
            'Beef': 'Lean Ground Beef',
            'Steak': 'Steak',
            'Paneer': 'Paneer block',
            'Rice': 'Rice',
            'Veggies': 'Mixed Vegetables',
            'Vegetables': 'Mixed Vegetables',
            'Toast': 'Whole Wheat Bread',
            'Banana': 'Bananas'
        };

        foodItems.forEach(item => {
            Object.keys(ingredientMap).forEach(key => {
                if(item.toLowerCase().includes(key.toLowerCase())) {
                    groceries.add(ingredientMap[key]);
                }
            });
        });
        
        groceries.add('Olive Oil / Cooking Spray');

        const gList = document.getElementById('ui-grocery-list');
        gList.innerHTML = Array.from(groceries).map(g => `
            <li>
                <label style="display: flex; align-items: center; gap: 0.8rem; cursor: pointer; width: 100%;">
                    <input type="checkbox" onchange="app.toggleGrocery(this)"> 
                    <span>${g}</span>
                </label>
            </li>
        `).join('');
    },
    
    toggleGrocery(checkbox) {
        const span = checkbox.nextElementSibling;
        if(checkbox.checked) {
            span.classList.add('checked-item');
        } else {
            span.classList.remove('checked-item');
        }
    },

    // --- Persistence Logic ---
    saveProfile(userObj) {
        try {
            localStorage.setItem('smartFitGuideProfile', JSON.stringify(userObj));
        } catch(e) {
            console.error("Local Storage restricted");
        }
    },
    
    loadProfile() {
        try {
            const savedStr = localStorage.getItem('smartFitGuideProfile');
            if (savedStr) {
                const user = JSON.parse(savedStr);
                // Trigger form processing manually
                document.getElementById('user-name').value = user.name;
                document.getElementById('user-age').value = user.age;
                document.querySelector(`input[name="user-gender"][value="${user.gender}"]`).checked = true;
                document.getElementById('user-height').value = user.heightCm;
                document.getElementById('user-weight').value = user.weightKg;
                document.getElementById('user-goal').value = user.goal;
                document.getElementById('user-activity').value = user.activityLevel;
                
                // Simulate form submission to re-run calculations
                document.getElementById('onboarding-form').dispatchEvent(new Event('submit', { cancelable: true }));
                return true;
            }
        } catch(e) {}
        return false;
    },

    // Utility to grab N random elements from an array
    getRandomItems(arr, count) {
        // Clone array to prevent mutating constants mapped to reference
        const shuffled = [...arr].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count);
    }
};

// Bootstrap application once DOM loads
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
