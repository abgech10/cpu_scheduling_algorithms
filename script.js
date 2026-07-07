const colors = ["#ef4444", "#3b82f6", "#22c55e", "#a855f7", "#f59e0b", "#14b8a6", "#ec4899", "#6366f1"];
let tasks = [], pid = 1;
const $ = (id) => document.getElementById(id);

// Toggle Quantum parameter visibility based on selection
$("algo").onchange = e => {
  const val = e.target.value;
  $("quantumBox").classList.toggle("hidden", val !== "RR" && val !== "FCS");
};

function addRandom() {
  tasks.push({ 
    id: `P${pid}`, 
    at: Math.floor(Math.random() * 6), 
    bt: Math.floor(Math.random() * 8) + 1, 
    color: colors[pid++ % 8],
    historyQ: [] // Tracking dynamic allocation changes
  });
  renderTasks();
}

function resetAll() { tasks = []; pid = 1; renderTasks(); clearOutput(); }

function clearOutput() { $("gantt").innerHTML = $("stats").innerHTML = $("avg").textContent = ""; }

function renderTasks() {
  $("noTask").style.display = tasks.length ? "none" : "block";
  $("taskList").innerHTML = tasks.map(t => `<div class="task" style="background:${t.color}">${t.id}<small>AT:${t.at}|BT:${t.bt}</small></div>`).join("");
}

function run() {
  if (!tasks.length) return alert("Add tasks");
  const type = $("algo").value, q = +$("quantum").value || 2;
  
  // Clone tasks and reset runtime state tracker arrays
  const p = tasks.map(t => ({ ...t, rem: t.bt, historyQ: [] })).sort((a, b) => a.at - b.at);
  
  let time = 0, done = 0, timeline = [], queue = [];
  
  while (done < p.length) {
    // Collect freshly arrived tasks to execution ready queue
    p.filter(t => t.at <= time && t.rem > 0 && !queue.includes(t)).forEach(t => queue.push(t));
    
    if (!queue.length) { 
      time = p.find(t => t.rem > 0).at; 
      continue; 
    }

    // Heuristic Sorting Rules
    if (type === "SJF") queue.sort((a, b) => a.rem - b.bt); 
    
    const cur = queue.shift();
    let slice = cur.rem;
    
    if (type === "RR") {
      slice = Math.min(cur.rem, q);
    } else if (type === "FCS") {
      /* Feedback Control Loop implementation:
        Error Signal (e) = queue.length (System Workload Congestion Level)
        Control Action: Dynamically tune the scheduled process time-slice budget.
        - High congestion (e > 1): Reduce slice to prioritize low responsiveness times and high multi-task fluidity.
        - Low congestion (e <= 1): Increase quantum up to an optimized scale to slash unnecessary context-switch overheads.
      */
      const error = queue.length;
      const adaptiveQuantum = Math.max(1, Math.round(q - (0.5 * error)));
      slice = Math.min(cur.rem, adaptiveQuantum);
      cur.historyQ.push(adaptiveQuantum);
    }
    
    timeline.push({ id: cur.id, start: time, end: time + slice, color: cur.color });
    time += slice;
    cur.rem -= slice;
    
    // Re-check for new arrivals during execution interval before re-inserting preempted task
    p.filter(t => t.at <= time && t.rem > 0 && !queue.includes(t) && t !== cur).forEach(t => queue.push(t));
    
    if (cur.rem > 0) {
      queue.push(cur); 
    } else { 
      cur.ct = time; 
      done++; 
    }
  }

  renderGantt(timeline);
  renderStats(p);
}

function renderGantt(tl) {
  const merged = tl.reduce((acc, cur) => {
    let prev = acc[acc.length - 1];
    if (prev && prev.id === cur.id) prev.end = cur.end;
    else acc.push({...cur});
    return acc;
  }, []);

  $("gantt").innerHTML = merged.map((s, i) => `
    <div class="seg" style="background:${s.color}; width:${(s.end - s.start) * 40}px">
      ${s.id}<span class="time">${s.end}</span>
      ${i === 0 ? `<span class="time start">${s.start}</span>` : ""}
    </div>`).join("");
}

function renderStats(p) {
  const stats = p.map(t => ({ ...t, tat: t.ct - t.at, wt: t.ct - t.at - t.bt }));
  const avg = (key) => (stats.reduce((a, b) => a + b[key], 0) / stats.length).toFixed(2);
  
  $("stats").innerHTML = stats.map(t => {
    const note = t.historyQ && t.historyQ.length ? `Allocated Qs: [${t.historyQ.join(', ')}]` : 'Fixed Allocation';
    return `<tr>
      <td>${t.id}</td>
      <td>${t.at}</td>
      <td>${t.bt}</td>
      <td>${t.ct}</td>
      <td>${t.tat}</td>
      <td>${t.wt}</td>
      <td style="font-size:12px; color:#38bdf8;">${note}</td>
    </tr>`;
  }).join("");
  
  $("avg").textContent = `Avg TAT: ${avg('tat')} | Avg WT: ${avg('wt')}`;
}