/*************************************************
 * DISCIPLINE TRACKER – STABLE & MANUAL START
 *************************************************/

/* ========= NOTIFICATIONS ========= */
function requestNotificationPermission() {
  if ("Notification" in window) {
    if (Notification.permission === "default") {
      Notification.requestPermission().then(permission => {
        if (permission === "granted") {
          console.log("Notification permission granted.");
        } else {
          console.log("Notification permission denied.");
        }
      });
    } else if (Notification.permission === "granted") {
      console.log("Notification permission already granted.");
    } else {
      console.log("Notification permission denied.");
    }
  } else {
    console.log("Notifications not supported in this browser.");
  }
}

function notify(title, body) {
  if ("Notification" in window && Notification.permission === "granted") {
    console.log("Showing notification: " + title);
    new Notification(title, { body });
  } else {
    console.log("Cannot show notification: permission not granted.");
  }
}

/* ========= SOUND ALERT ========= */
let soundPlayedForSlot = null;

function playAlertSound(slotKey) {
  if (soundPlayedForSlot === slotKey) return;

  const audio = new Audio(
    "https://actions.google.com/sounds/v1/alarms/beep_short.ogg"
  );

  let count = 0;
  const playThreeTimes = () => {
    audio.currentTime = 0;
    audio.play().catch(() => {});
    console.log("Playing alert sound for slot: " + slotKey);  // ← debug log

    count++;
    if (count < 3) {
      setTimeout(playThreeTimes, 1200); // ~1.2 seconds between beeps
    } else {
      soundPlayedForSlot = slotKey;
    }
  };

  playThreeTimes();
}

function minutesToTime(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12.toString().padStart(2, "0")}:${m
    .toString()
    .padStart(2, "0")} ${ampm}`;
}
/* ========= HELPERS ========= */
function toMinutes(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function nowMinutes() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

function formatNow() {
  return new Date().toLocaleString();
}

function todayKey() {
  return new Date().toISOString().split("T")[0];
}

/* ========= STORAGE ========= */
function getLog() {
  try {
    const raw = localStorage.getItem(todayKey());
    if (!raw) return [];
    return JSON.parse(raw) || [];
  } catch (err) {
    console.error("Log corrupted. Resetting.", err);
    localStorage.removeItem(todayKey());
    return [];
  }
}


function saveLog(log) {
  localStorage.setItem(todayKey(), JSON.stringify(log));
}

/* ========= TIMETABLE ========= */
function getTimetable() {
  try {
    const raw = localStorage.getItem("timetable");
    if (!raw) return [];

    const data = JSON.parse(raw);

    if (!Array.isArray(data)) return [];

    return data.filter(e => {
      if (!e || typeof e.start !== "string" || typeof e.end !== "string" || !e.name) return false;

      // Only allow correct time format like 08:00 or 14:30
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(e.start) || !timeRegex.test(e.end)) return false;

      const startMin = toMinutes(e.start);
      const endMin = toMinutes(e.end);
      return !isNaN(startMin) && !isNaN(endMin) && startMin < endMin;
    });

  } catch (err) {
    console.error("Timetable corrupted. Resetting.", err);
    localStorage.removeItem("timetable");
    return [];
  }
}


/* ========= CURRENT EVENT ========= */
function getCurrentMainEvent() {
  const now = nowMinutes();
  return getTimetable().filter(e =>
    now >= toMinutes(e.start) && now < toMinutes(e.end)
  );
}


/* ========= HYDRATION (ONLY AFTER START) ========= */


// Helper function – put this OUTSIDE of render(), for example right after render() ends
function handleStartClick() {
  const name     = this.dataset.name;
  const start    = this.dataset.start;
  const phase    = Number(this.dataset.phase);
  const severity = Number(this.dataset.severity);

  startMainEvent(name, start, phase, severity);
}
function handleWaterClick() {
  const slot = Number(this.dataset.slot);
  const startMinute = Number(this.dataset.start);
  markWater(slot, startMinute);
}
// ──────────────────────────────────────────────
// Your render function – only small change at the end
// ──────────────────────────────────────────────
function render() {
    // Optimization: skip redraw if still in the same minute
    

    syncLogsWithTimetable();

    const container = document.getElementById("mainContainer");
    const phaseInfo = document.getElementById("phaseInfo");

    if (!container) {
        console.error("mainContainer not found in HTML");
        return;
    }

    container.innerHTML = ""; // clear old content
    
    
    const activeEvents = getCurrentMainEvent();
    const log = getLog();
    const waterInfo = shouldShowWaterReminder();

    if (waterInfo) {
        const waterCard = document.createElement("div");
        waterCard.className = "card";
        waterCard.innerHTML = `
            <h2>💧 Drink Water (Hour ${waterInfo.slot + 1})</h2>
            <p>${formatNow()}</p>
<button class="water-btn"
        data-slot="${waterInfo.slot}"
        data-start="${waterInfo.startMinute}">
                ✔ Done
            </button>
        `;
        container.appendChild(waterCard);

        // Add notification and sound here to always trigger when card shows
        const slotKey = `${todayKey()}_daily_${waterInfo.slot}`;
        if (!localStorage.getItem("notified_" + slotKey)) {
            notify("💧 Drink Water", "Time for your hourly hydration!");
            localStorage.setItem("notified_" + slotKey, "yes");
        }
        playAlertSound(slotKey);
    }

    if (activeEvents.length === 0) {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
        <h2>No scheduled event right now</h2>
    `;
    container.appendChild(card);
    if (phaseInfo) phaseInfo.innerText = "—";
} else {
    if (phaseInfo) phaseInfo.innerText = `Phase ${activeEvents.map(e => e.phase).join(', ')}`;
}


    activeEvents.forEach(event => {
        const entry = log.find(e => e.name === event.name);
        const entryStatus = entry 
            ? (entry.score === null ? "🟢 Started | Score: Pending" : `✅ Completed | Score: ${entry.score}`)
            : '';

        // Main event card
        const eventCard = document.createElement("div");
        eventCard.className = "card";
        eventCard.innerHTML = `
            <h2>${event.name}</h2>
            <p>${formatNow()}</p>
            <p>${event.start} – ${event.end}</p>
            <p>Severity: ${event.severity}</p>
            ${entryStatus ? `<p>${entryStatus}</p>` : ''}
            ${!entry ? `
                <button class="start-btn" 
                        data-name="${event.name}" 
                        data-start="${event.start}" 
                        data-phase="${event.phase}" 
                        data-severity="${event.severity}">
                    ▶ Start Event
                </button>
            ` : ''}
        `;
        container.appendChild(eventCard);

        // Separate hydration card (only if applicable)
        
    });

    // Finalize any pending past events in real-time
        // Force finalize any ended event with pending score during render
    activeEvents.forEach(event => {
        const entry = log.find(e => e.name === event.name);
        if (entry && entry.started && entry.score === null && nowMinutes() >= toMinutes(event.end)) {
            finalizeMainEvent(entry);
            saveLog(log);
        }
    });

    // ──────────────────────────────────────────────
    // IMPORTANT: Re-attach listeners to "Start Event" buttons EVERY TIME we render
    // ──────────────────────────────────────────────
    document.querySelectorAll('.start-btn[data-name]').forEach(btn => {
        // Remove old listener first (prevents double clicks / memory issues)
        btn.removeEventListener('click', handleStartClick);
        btn.addEventListener('click', handleStartClick);
    });
    // Bind hydration buttons
document.querySelectorAll('.water-btn').forEach(btn => {
    btn.removeEventListener('click', handleWaterClick);
    btn.addEventListener('click', handleWaterClick);
});
}
// Ensure the buttons are clickable by adding event listeners again after rendering new events.




  /* ---- MAIN EVENT CARD ---- */


/* ========= START / COMPLETE ========= */
function startMainEvent(name, start, phase, severity) {
  const log = getLog();
  if (log.some(e => e.name === name)) return;

  log.push({
    name,
    phase,
    severity,
    start,
    started: true,
    startedAt: nowMinutes(),
    delay: null,
    score: null
  });

  saveLog(log);
render();
}

function finalizeMainEvent(entry) {
  const delay = Math.max(0, entry.startedAt - toMinutes(entry.start));
  let score = 0;

  if (delay <= 15) {
    score = entry.severity * 10 - delay;
    if (score < 0) score = 0;
  }

  entry.delay = delay;
  entry.score = score;
}

/* ========= MICRO HABIT ========= */
function markMicro(name, parent, slot, startMinute) {
  const log = getLog();

  const delay = Math.max(0, nowMinutes() - startMinute);
  const score = delay <= 15 ? 10 - delay : 0;

  log.push({
    name,
    parent,
    slot,
    phase: "micro",
    severity: 1,
    delay,
    score
  });

  saveLog(log);
  render();
}

/* ========= AUTO MISS (STRICT) ========= */
function autoMiss() {
  const now = nowMinutes();
  const log = getLog();
  const timetable = getTimetable();

  timetable.forEach(event => {
    const entry = log.find(l => l.name === event.name);

    if (now >= toMinutes(event.end) && !entry) {
      log.push({
        name: event.name,
        phase: event.phase,
        severity: event.severity,
        delay: 999, // mark entire time as wasted
        score: 0,
        autoMissed: true
      });
    }

    if (entry && entry.started && entry.score === null && now >= toMinutes(event.end)) {
      finalizeMainEvent(entry);
    }
  });

  saveLog(log);
  // ──────────────────────────────────────────────
  // NEW: Penalize ignored hydration slots at end of day
  // ──────────────────────────────────────────────
  // ──────────────────────────────────────────────
// NEW: Penalize ignored hydration slots at end of day
// ──────────────────────────────────────────────
const dayStart = getDayStartMinute();
const dayEnd = getDayEndMinute();
if (dayStart !== null && dayEnd !== null && now >= dayEnd) {
  const totalSlots = Math.floor((dayEnd - dayStart) / 60);
  let updated = false;
  for (let s = 0; s <= totalSlots; s++) {
    const alreadyLogged = log.some(e => e.name === "Drink Water" && e.slot === s);
    if (!alreadyLogged) {
      log.push({
        name: "Drink Water",
        parent: "Daily Hydration",
        slot: s,
        phase: "hydration",
        severity: 1,
        delay: 999,
        score: 0
      });
      updated = true;
    }
  }
  if (updated) saveLog(log);
}
}

document.addEventListener("DOMContentLoaded", () => {

  // NAV BUTTONS
  const historyBtn = document.getElementById("historyBtn");
  const statsBtn = document.getElementById("statsBtn");

  if (historyBtn) {
    historyBtn.onclick = () => {
      window.location.href = "history.html";
    };
  }

  if (statsBtn) {
    statsBtn.onclick = () => {
      window.location.href = "stats.html";
    };
  }

  // INIT
  requestNotificationPermission();
  updateLiveUI();

  setInterval(updateLiveUI, 15 * 1000);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      updateLiveUI();
    }
  });

  window.addEventListener("focus", updateLiveUI);

  window.addEventListener("storage", (e) => {
    if (e.key === "timetable" || e.key === "timetableUpdated") {
      updateLiveUI();
    }
  });

});

/* ========= INIT ========= */



function updateLiveClock() {
  const clock = document.getElementById("liveClock");
  if (!clock) return;

  const now = new Date();
  clock.innerHTML = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });
}

// start live clock
updateLiveClock();
setInterval(updateLiveClock, 1000);

function syncLogsWithTimetable() {
  const timetable = getTimetable();
  const validNames = timetable.map(e => e.name);

  const log = getLog();
  const cleaned = log.filter(e =>
  e.phase === "micro" ||
  e.phase === "hydration" ||
  validNames.includes(e.name)
);


  if (cleaned.length !== log.length) {
    saveLog(cleaned);
  }
}

// ================= TIMETABLE-BASED HYDRATION & DAY BOUNDARY =================

function getDayStartMinute() {
  const tt = getTimetable();
  if (tt.length === 0) return null;

  const starts = tt.map(e => toMinutes(e.start)).filter(n => !isNaN(n));
  if (starts.length === 0) return null;

  return Math.min(...starts);
}

function getDayEndMinute() {
  const tt = getTimetable();
  if (tt.length === 0) return null;

  const ends = tt.map(e => toMinutes(e.end)).filter(n => !isNaN(n));
  if (ends.length === 0) return null;

  return Math.max(...ends);
}

function getCurrentWaterSlot() {
  const dayStart = getDayStartMinute();
  if (dayStart === null) return null;

  const now = nowMinutes();
  if (now < dayStart) return null;

  const elapsed = now - dayStart;
  return Math.floor(elapsed / 60);
}

function shouldShowWaterReminder() {
  const dayStart = getDayStartMinute();
  if (dayStart === null) return null;

  const now = nowMinutes();
  if (now < dayStart) return null;

  const dayEnd = getDayEndMinute();
  if (dayEnd !== null && now >= dayEnd) return null;

  const elapsed = now - dayStart;

  // 🔥 IMPORTANT CHANGE:
  // Slot 0 = first event start time
  const slot = Math.floor(elapsed / 60);

  const log = getLog();

  // 🔴 Penalize ALL previous missed slots
for (let s = 0; s < slot; s++) {
  const alreadyLogged = log.some(
    e => e.name === "Drink Water" && e.slot === s
  );
  if (!alreadyLogged) {
    log.push({
      name: "Drink Water",
      parent: "Daily Hydration",
      slot: s,
      phase: "hydration",
      severity: 1,
      delay: 999,
      score: 0
    });
  }
}
if (slot > 0) saveLog(log); // Save only if we added something

  // 🔵 Show reminder only if current slot not logged
  const currentLogged = log.some(
    e => e.name === "Drink Water" && e.slot === slot
  );

  if (currentLogged) return null;

  const startMin = dayStart + slot * 60;

  return { slot, startMinute: startMin };
}



function markWaterDone(slot) {
  render();
}

function markWater(slot, startMinute) {
  const log = getLog();

  // 🚫 Prevent duplicate logging for same slot
  const alreadyLogged = log.some(
    e => e.name === "Drink Water" && e.slot === slot
  );

  if (alreadyLogged) {
    render();
    return;
  }

  const delay = Math.max(0, nowMinutes() - startMinute);
  const score = delay <= 15 ? 10 - delay : 0;

  log.push({
    name: "Drink Water",
    parent: "Daily Hydration",
    slot,
    phase: "hydration",
    severity: 1,
    delay,
    score
  });

  saveLog(log);
  render();
}


// ──────────────────────────────────────────────
// LIVE UPDATES – clock + events + hydration + auto-miss
// ──────────────────────────────────────────────

function updateLiveUI() {
    updateLiveClock();     // refresh clock
    autoMiss();            // check for missed/ended events
    render();              // update screen
}


// Helper to calculate total unique scheduled minutes from timetable (merges overlaps)
function getTotalUniqueScheduledMinutes(tt) {
  if (tt.length === 0) return 0;

  // Sort events by start time
  const events = tt.slice().sort((a, b) => toMinutes(a.start) - toMinutes(b.start));

  let total = 0;
  let currentStart = toMinutes(events[0].start);
  let currentEnd = toMinutes(events[0].end);

  for (let i = 1; i < events.length; i++) {
    const start = toMinutes(events[i].start);
    const end = toMinutes(events[i].end);

    if (start >= currentEnd) {
      // No overlap, add previous duration
      total += currentEnd - currentStart;
      currentStart = start;
      currentEnd = end;
    } else {
      // Overlap, extend end if needed
      currentEnd = Math.max(currentEnd, end);
    }
  }

  // Add the last interval
  total += currentEnd - currentStart;

  return total;
}
