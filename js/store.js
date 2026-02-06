// Store Data Management

const CONFIG = {
    tasks: [
        { id: 0, label: "外に出る" },
        { id: 1, label: "英文を1個聞く" },
        { id: 2, label: "新しい英単語を10個覚える" },
        { id: 3, label: "経営工学の本を1ページ読む" }
    ],
    STORAGE_KEY: 'habit_app_v1',
    CYCLE_DAYS: 60,
    PASSING_TARGET: 2, // 2 tasks for "green"
    PERFECT_TARGET: 4  // 4 tasks for "blue" + reward
};

class Store {
    constructor() {
        this.state = this.load();
        this.checkNewDay();
    }

    load() {
        const stored = localStorage.getItem(CONFIG.STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
        return this.getInitialState();
    }

    save() {
        localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(this.state));
    }

    getInitialState() {
        return {
            startDate: this.getTodayDate(),
            history: {}, // Key: YYYY-MM-DD, Value: { tasks: {0:{done:bool, time:int}}, comment:string }
            lastVisit: this.getTodayDate()
        };
    }

    getTodayDate() {
        // Use local time for date string (YYYY-MM-DD)
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    checkNewDay() {
        const today = this.getTodayDate();
        if (!this.state.history[today]) {
            this.state.history[today] = {
                tasks: {},
                comment: "",
                level: 0 // 0=neutral, 1=bad(not really used), 2=pass, 3=good, 4=perfect
            };
            // Init tasks for day
            CONFIG.tasks.forEach(task => {
                this.state.history[today].tasks[task.id] = { done: false, time: 0 };
            });
            this.state.lastVisit = today;
            this.save();
        }
    }

    updateTask(taskId, updates) {
        const today = this.getTodayDate();
        const task = this.state.history[today].tasks[taskId];
        Object.assign(task, updates);
        this.calculateLevel(today);
        this.save();
    }

    updateComment(text) {
        const today = this.getTodayDate();
        this.state.history[today].comment = text;
        this.save();
    }

    calculateLevel(date) {
        const dayData = this.state.history[date];
        if (!dayData) return;

        const completedCount = Object.values(dayData.tasks).filter(t => t.done).length;

        // Level definition:
        // 0-1: Not passed
        // 2: Pass (Green)
        // 3: Good (Yellow) 
        // 4: Perfect (Blue)
        dayData.level = completedCount;
    }

    // Statistics
    getStats() {
        const historyKeys = Object.keys(this.state.history).sort();
        const today = this.getTodayDate();

        // 1. Today's Total Time
        let todayTime = 0;
        if (this.state.history[today]) {
            Object.values(this.state.history[today].tasks).forEach(t => todayTime += (parseInt(t.time) || 0));
        }

        // 2. Streak
        // Count backwards from yesterday (or today if at least 2 done)
        let streak = 0;
        // Logic: Check consecutive days meeting "level >= 2"
        // If today is not yet level 2, don't break streak from yesterday, but don't count today yet if checked mid-day. 
        // Actually simplest is just count consecutive days in history that meet criteria.
        // But gaps in history mean 0 items, so they break streak.

        // We need to iterate backwards from TODAY (or Yesterday if today is not done?)
        // Requirement: "2個以上達成した日" continuously.

        // Let's look at all history keys sorted desc
        // We need to handle gaps (days where user didn't open app). Data strictly relies on keys existing? 
        // Or should we fill gaps? For MVP, we assume keys exist if user visited. 
        // If user missed a day, no key -> streak break.

        // Robust Streak Calc: Convert keys to timestamps, find gaps.
        // For MVP: Simple iteration.

        let currentRun = 0;
        let checkDate = new Date();

        // Loop back 60 days max for safety
        for (let i = 0; i < 60; i++) {
            const dStr = checkDate.toISOString().split('T')[0];
            const data = this.state.history[dStr];

            if (dStr === today) {
                // If today is done, count it. If not, ignore and check yesterday.
                if (data && data.level >= CONFIG.PASSING_TARGET) {
                    currentRun++;
                }
            } else {
                if (data && data.level >= CONFIG.PASSING_TARGET) {
                    currentRun++;
                } else {
                    // Break if day missed OR level too low
                    // If simply no data for that day (user didn't open), it's a break
                    break;
                }
            }
            checkDate.setDate(checkDate.getDate() - 1);
        }
        streak = currentRun;

        // 3. 30-Day Rate
        let passCount30 = 0;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 30);

        historyKeys.forEach(dateStr => {
            if (dateStr >= cutoffDate.toISOString().split('T')[0] && dateStr <= today) {
                if (this.state.history[dateStr].level >= CONFIG.PASSING_TARGET) {
                    passCount30++;
                }
            }
        });
        const rate30 = Math.round((passCount30 / 30) * 100);

        // 4. 60-Day Progress
        // Count days since startDate where level >= 2
        let passCountCycle = 0;
        historyKeys.forEach(dateStr => {
            // Check if within cycle (Simplified: just count all for now, or check vs startDate)
            // Ideally we reset startDate after 60 days? Requirement 7-1 says "60日中..."
            // Let's just count total passes since startDate.
            if (dateStr >= this.state.startDate) {
                if (this.state.history[dateStr].level >= CONFIG.PASSING_TARGET) {
                    passCountCycle++;
                }
            }
        });

        return {
            todayTime,
            streak,
            rate30,
            passCountCycle,
            passTarget: 45, // Target for 60 days
            todayLevel: this.state.history[today] ? this.state.history[today].level : 0
        };
    }

    getTodayData() {
        return this.state.history[this.getTodayDate()];
    }

    importState(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            // Basic validation
            if (!data.history || !data.config) {
                throw new Error("Invalid data format");
            }
            this.state = data;
            this.save();
            return true;
        } catch (e) {
            console.error("Import failed:", e);
            return false;
        }
    }
}
