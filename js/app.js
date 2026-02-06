
// DOM Elements
const app = {
    init() {
        this.store = new Store();
        this.cacheDOM();
        this.bindEvents();
        this.render();
    },

    cacheDOM() {
        this.dom = {
            totalTime: document.getElementById('total-time'),
            levelBadge: document.getElementById('level-badge'),
            taskList: document.getElementById('task-list'),
            commentInput: document.getElementById('daily-comment'),
            streakVal: document.getElementById('streak-value'),
            rate30Val: document.getElementById('rate-30-value'),
            cycleProgress: document.getElementById('cycle-progress'),
            cycleText: document.getElementById('cycle-text'),
            karaokeBadge: document.getElementById('karaoke-badge'),
            historyGrid: document.getElementById('history-grid')
        };
    },


    bindEvents() {
        this.dom.commentInput.addEventListener('change', (e) => {
            this.store.updateComment(e.target.value);
        });

        // Dismiss Karaoke Badge on click
        this.dom.karaokeBadge.addEventListener('click', () => {
            this.dom.karaokeBadge.classList.remove('visible');
        });

        // Rewrite Button
        const rewriteBtn = document.getElementById('rewrite-btn');
        if (rewriteBtn) {
            rewriteBtn.addEventListener('click', () => {
                alert("🎉 Congratulations on 45 days!\n\nSuggested Level Ups:\n1. Words: 10 -> 15\n2. English: Listen + Read 1 sentence\n3. Reading: 1 page -> 2 pages\n4. Outdoors: Walk for 10 mins\n\n(Edit feature coming soon!)");
            });
        }

        // --- Data Backup Handlers ---

        // Export
        const exportBtn = document.getElementById('export-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                const dataStr = JSON.stringify(this.store.state, null, 2);
                const blob = new Blob([dataStr], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `habit-backup-${new Date().toISOString().split('T')[0]}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            });
        }

        // Import
        const importTrigger = document.getElementById('import-btn-trigger');
        const fileInput = document.getElementById('import-file');

        if (importTrigger && fileInput) {
            importTrigger.addEventListener('click', () => fileInput.click());

            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = (event) => {
                    const success = this.store.importState(event.target.result);
                    if (success) {
                        alert("Data imported successfully! Reloading...");
                        location.reload();
                    } else {
                        alert("Failed to import data. Invalid file format.");
                    }
                };
                reader.readAsText(file);
            });
        }

        // Delegate task events
        this.dom.taskList.addEventListener('click', (e) => {
            const card = e.target.closest('.task-card');
            if (!card) return;
            const taskId = parseInt(card.dataset.id);

            // Checkbox interaction
            if (e.target.classList.contains('check-btn') || e.target.closest('.check-btn')) {
                const current = this.store.getTodayData().tasks[taskId].done;
                this.store.updateTask(taskId, { done: !current });
                this.render();
            }
        });

        this.dom.taskList.addEventListener('input', (e) => {
            const card = e.target.closest('.task-card');
            if (!card) return;
            const taskId = parseInt(card.dataset.id);

            if (e.target.classList.contains('time-input')) {
                const newTime = parseInt(e.target.value) || 0;
                this.store.updateTask(taskId, { time: newTime });
                this.render(); // To update total time
            }
        });

        // Timer Logic (Simple implementation)
        this.dom.taskList.addEventListener('click', (e) => {
            if (e.target.classList.contains('timer-btn')) {
                this.toggleTimer(e.target);
            }
        });
    },

    timers: {},

    toggleTimer(btn) {
        const card = btn.closest('.task-card');
        const taskId = parseInt(card.dataset.id);
        const input = card.querySelector('.time-input');

        if (this.timers[taskId]) {
            // Stop
            clearInterval(this.timers[taskId]);
            delete this.timers[taskId];
            btn.textContent = '⏱ Start';
            btn.classList.remove('active');
            // Save final time
            this.store.updateTask(taskId, { time: parseInt(input.value) || 0 });
            this.render();
        } else {
            // Start
            btn.textContent = '⏹ Stop';
            btn.classList.add('active');
            this.timers[taskId] = setInterval(() => {
                let val = parseInt(input.value) || 0;
                val++;
                input.value = val;
                // Optional: Auto-save every minute? For now just visual update
            }, 60000); // Update every minute
        }
    },

    render() {
        const data = this.store.getTodayData();
        const stats = this.store.getStats();

        // 1. Header Stats
        this.dom.totalTime.textContent = `${stats.todayTime} min`;
        this.updateLevelDisplay(stats.todayLevel);

        // 2. Tasks
        this.dom.taskList.innerHTML = '';
        CONFIG.tasks.forEach(taskDef => {
            const taskState = data.tasks[taskDef.id];
            const card = this.createTaskCard(taskDef, taskState);
            this.dom.taskList.appendChild(card);
        });

        // 3. Comment
        this.dom.commentInput.value = data.comment || '';

        // 4. Dashboard Stats
        this.dom.streakVal.textContent = `🔥 ${stats.streak} Days`;
        this.dom.rate30Val.textContent = `${stats.rate30}% (30d)`;

        // 5. Cycle
        const cyclePercent = Math.min(100, (stats.passCountCycle / stats.passTarget) * 100);
        this.dom.cycleProgress.style.width = `${cyclePercent}%`;
        this.dom.cycleText.textContent = `${stats.passCountCycle} / ${stats.passTarget} Days (Goal: 45)`;

        // 6. Reward Challenge
        if (stats.passCountCycle >= stats.passTarget) {
            document.getElementById('rewrite-btn').disabled = false;
        }

        // 7. History Grid
        this.renderHistory();

        // Show Reward if Perfect (Only show once per session ideally, but for now just state based)
        if (stats.todayLevel === 4) {
            // Check if already acknowledged? Simplified: Just show badge in header is enough, 
            // but user asked for "Eye catching popup".
            // We can check a flag 'rewardShown' if we wanted, but CSS animation is less intrusive.
            // Let's make the Level Badge pulse actively.
        }
    },

    renderHistory() {
        this.dom.historyGrid.innerHTML = '';
        const today = new Date();
        // Show last 28 days (4 weeks) for neat grid
        const daysToShow = 28;

        for (let i = daysToShow - 1; i >= 0; i--) {
            const d = new Date();
            d.setDate(today.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            const dayData = this.store.state.history[dateStr];

            const level = dayData ? dayData.level : 0;
            const div = document.createElement('div');
            div.className = `history-day l-${level}`;
            div.dataset.date = dateStr;
            div.dataset.level = level;
            div.textContent = d.getDate(); // Show day number

            this.dom.historyGrid.appendChild(div);
        }
    },

    createTaskCard(def, state) {
        const div = document.createElement('div');
        div.className = `task-card ${state.done ? 'done' : ''}`;
        div.dataset.id = def.id;

        div.innerHTML = `
            <div class="task-header">
                <button class="check-btn">
                    ${state.done ? '✅' : '⬜'}
                </button>
                <span class="task-label">${def.label}</span>
            </div>
            <div class="task-controls">
                <button class="timer-btn">⏱ Start</button>
                <input type="number" class="time-input" value="${state.time}" min="0">
                <span class="min-label">min</span>
            </div>
        `;
        return div;
    },

    updateLevelDisplay(level) {
        let text = "LEVEL 0";
        let colorClass = "level-0";

        if (level >= 4) {
            text = "🔵 PERFECT!!";
            colorClass = "level-4";
            this.showKaraokeInvite();
        } else if (level === 3) {
            text = "🟡 GREAT";
            colorClass = "level-3";
        } else if (level === 2) {
            text = "🟢 PASSED";
            colorClass = "level-2";
        }

        this.dom.levelBadge.className = `level-badge ${colorClass}`;
        this.dom.levelBadge.textContent = text;
    },

    showKaraokeInvite() {
        const badge = document.getElementById('karaoke-badge');
        if (badge) badge.classList.add('visible');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
