(() => {
  const storageKey = 'clock-app-v1';
  const tabs = document.querySelectorAll('.tab');
  const panels = document.querySelectorAll('.panel');

  // Load persisted values if they exist
  const persisted = (() => {
    try { return JSON.parse(localStorage.getItem(storageKey)) || {}; }
    catch (_) { return {}; }
  })();

  const saveState = (partial) => {
    const current = (() => {
      try { return JSON.parse(localStorage.getItem(storageKey)) || {}; }
      catch (_) { return {}; }
    })();
    localStorage.setItem(storageKey, JSON.stringify({ ...current, ...partial }));
  };

  // -------- Tabs --------
  const switchTab = (id) => {
    tabs.forEach((tab) => {
      const active = tab.dataset.tab === id;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', active);
    });

    panels.forEach((panel) => {
      const active = panel.id === id;
      panel.classList.toggle('is-active', active);
      panel.setAttribute('aria-hidden', !active);
    });

    saveState({ lastTab: id });
  };

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  // Restore last tab if available
  switchTab(persisted.lastTab || 'pomodoro');

  // -------- Helpers --------
  const pad = (num, len = 2) => num.toString().padStart(len, '0');

  const formatClock = (totalSeconds) => {
    const s = Math.max(0, Math.floor(totalSeconds));
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${pad(mins)}:${pad(secs)}`;
  };

  const formatHMS = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${pad(hours)}:${pad(mins)}:${pad(secs)}`;
  };

  const playBeep = () => {
    // Short, gentle beep using Web Audio (no external assets)
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  };

  // -------- Pomodoro --------
  const pomodoroDisplay = document.getElementById('pomodoro-display');
  const pomodoroMode = document.getElementById('pomodoro-mode');
  const workInput = document.getElementById('work-min');
  const breakInput = document.getElementById('break-min');
  const pomodoroSoundToggle = document.getElementById('pomodoro-sound');

  if (persisted.workMin) workInput.value = persisted.workMin;
  if (persisted.breakMin) breakInput.value = persisted.breakMin;
  if (typeof persisted.pomodoroSound === 'boolean') pomodoroSoundToggle.checked = persisted.pomodoroSound;

  const pomodoro = {
    workDuration: parseInt(workInput.value, 10) * 60,
    breakDuration: parseInt(breakInput.value, 10) * 60,
    mode: 'work',
    remaining: parseInt(workInput.value, 10) * 60,
    intervalId: null,
    running: false,
  };

  const updatePomodoroDisplay = () => {
    pomodoroDisplay.textContent = formatClock(pomodoro.remaining);
    pomodoroMode.textContent = pomodoro.mode === 'work' ? 'Work' : 'Break';
    pomodoroMode.classList.toggle('is-break', pomodoro.mode === 'break');
  };

  const clearPomodoroInterval = () => {
    if (pomodoro.intervalId) {
      clearInterval(pomodoro.intervalId);
      pomodoro.intervalId = null;
    }
    pomodoro.running = false;
  };

  const switchPomodoroMode = (nextMode) => {
    pomodoro.mode = nextMode;
    pomodoro.remaining = nextMode === 'work' ? pomodoro.workDuration : pomodoro.breakDuration;
    updatePomodoroDisplay();
  };

  const startPomodoro = () => {
    if (pomodoro.running) return;
    pomodoro.running = true;
    pomodoro.intervalId = setInterval(() => {
      pomodoro.remaining -= 1;
      if (pomodoro.remaining <= 0) {
        if (pomodoroSoundToggle.checked) playBeep();
        const next = pomodoro.mode === 'work' ? 'break' : 'work';
        switchPomodoroMode(next);
        return;
      }
      updatePomodoroDisplay();
    }, 1000);
  };

  const resetPomodoro = () => {
    clearPomodoroInterval();
    pomodoro.mode = 'work';
    pomodoro.remaining = pomodoro.workDuration;
    updatePomodoroDisplay();
  };

  document.getElementById('pomodoro-start').addEventListener('click', startPomodoro);
  document.getElementById('pomodoro-pause').addEventListener('click', clearPomodoroInterval);
  document.getElementById('pomodoro-reset').addEventListener('click', resetPomodoro);

  const handleDurationInput = () => {
    const work = Math.max(1, parseInt(workInput.value || '0', 10));
    const brk = Math.max(1, parseInt(breakInput.value || '0', 10));
    pomodoro.workDuration = work * 60;
    pomodoro.breakDuration = brk * 60;
    if (!pomodoro.running) {
      pomodoro.remaining = pomodoro.mode === 'work' ? pomodoro.workDuration : pomodoro.breakDuration;
      updatePomodoroDisplay();
    }
    saveState({ workMin: work, breakMin: brk });
  };

  workInput.addEventListener('change', handleDurationInput);
  breakInput.addEventListener('change', handleDurationInput);
  pomodoroSoundToggle.addEventListener('change', () => saveState({ pomodoroSound: pomodoroSoundToggle.checked }));

  updatePomodoroDisplay();

  // -------- Timer --------
  const timerDisplay = document.getElementById('timer-display');
  const timerMinInput = document.getElementById('timer-min');
  const timerSecInput = document.getElementById('timer-sec');
  const timerSoundToggle = document.getElementById('timer-sound');

  if (typeof persisted.timerMin === 'number') timerMinInput.value = persisted.timerMin;
  if (typeof persisted.timerSec === 'number') timerSecInput.value = persisted.timerSec;
  if (typeof persisted.timerSound === 'boolean') timerSoundToggle.checked = persisted.timerSound;

  const timer = {
    remaining: 0,
    intervalId: null,
    running: false,
  };

  const updateTimerDisplay = () => {
    timerDisplay.textContent = formatClock(timer.remaining);
  };

  const clearTimerInterval = () => {
    if (timer.intervalId) {
      clearInterval(timer.intervalId);
      timer.intervalId = null;
    }
    timer.running = false;
  };

  const setTimerFromInputs = () => {
    const mins = Math.max(0, parseInt(timerMinInput.value || '0', 10));
    const secs = Math.max(0, Math.min(59, parseInt(timerSecInput.value || '0', 10)));
    timerMinInput.value = mins;
    timerSecInput.value = secs;
    timer.remaining = mins * 60 + secs;
    updateTimerDisplay();
    saveState({ timerMin: mins, timerSec: secs });
  };

  const startTimer = () => {
    if (timer.running) return;
    if (timer.remaining === 0) setTimerFromInputs();
    if (timer.remaining === 0) return; // nothing to run
    timer.running = true;
    timer.intervalId = setInterval(() => {
      timer.remaining -= 1;
      updateTimerDisplay();
      if (timer.remaining <= 0) {
        clearTimerInterval();
        if (timerSoundToggle.checked) playBeep();
      }
    }, 1000);
  };

  const resetTimer = () => {
    clearTimerInterval();
    setTimerFromInputs();
  };

  document.getElementById('timer-start').addEventListener('click', startTimer);
  document.getElementById('timer-pause').addEventListener('click', clearTimerInterval);
  document.getElementById('timer-reset').addEventListener('click', resetTimer);
  timerMinInput.addEventListener('change', setTimerFromInputs);
  timerSecInput.addEventListener('change', setTimerFromInputs);
  timerSoundToggle.addEventListener('change', () => saveState({ timerSound: timerSoundToggle.checked }));

  setTimerFromInputs();

  // -------- Stopwatch --------
  const stopwatchDisplay = document.getElementById('stopwatch-display');
  const lapsContainer = document.getElementById('laps');

  const stopwatch = {
    elapsed: 0,
    intervalId: null,
    running: false,
    lastTick: null,
    laps: [],
  };

  const renderLaps = () => {
    lapsContainer.innerHTML = '';
    stopwatch.laps.forEach((time, idx) => {
      const row = document.createElement('div');
      row.className = 'lap';
      row.innerHTML = `<span>Lap ${idx + 1}</span><span>${formatHMS(time)}</span>`;
      lapsContainer.prepend(row);
    });
  };

  const updateStopwatchDisplay = () => {
    stopwatchDisplay.textContent = formatHMS(stopwatch.elapsed);
  };

  const clearStopwatchInterval = () => {
    if (stopwatch.intervalId) {
      clearInterval(stopwatch.intervalId);
      stopwatch.intervalId = null;
    }
    stopwatch.running = false;
  };

  const startStopwatch = () => {
    if (stopwatch.running) return;
    stopwatch.running = true;
    stopwatch.lastTick = Date.now();
    stopwatch.intervalId = setInterval(() => {
      const now = Date.now();
      stopwatch.elapsed += now - stopwatch.lastTick;
      stopwatch.lastTick = now;
      updateStopwatchDisplay();
    }, 200);
  };

  const pauseStopwatch = () => {
    clearStopwatchInterval();
  };

  const resetStopwatch = () => {
    clearStopwatchInterval();
    stopwatch.elapsed = 0;
    stopwatch.laps = [];
    renderLaps();
    updateStopwatchDisplay();
  };

  const addLap = () => {
    if (!stopwatch.running) return;
    stopwatch.laps.push(stopwatch.elapsed);
    renderLaps();
  };

  document.getElementById('stopwatch-start').addEventListener('click', startStopwatch);
  document.getElementById('stopwatch-pause').addEventListener('click', pauseStopwatch);
  document.getElementById('stopwatch-reset').addEventListener('click', resetStopwatch);
  document.getElementById('stopwatch-lap').addEventListener('click', addLap);

  updateStopwatchDisplay();

  // Initial save of toggles in case defaults were changed
  saveState({
    workMin: parseInt(workInput.value, 10),
    breakMin: parseInt(breakInput.value, 10),
    pomodoroSound: pomodoroSoundToggle.checked,
    timerMin: parseInt(timerMinInput.value, 10),
    timerSec: parseInt(timerSecInput.value, 10),
    timerSound: timerSoundToggle.checked,
    lastTab: persisted.lastTab || 'pomodoro',
  });
})();
