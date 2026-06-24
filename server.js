const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
const path = require('path');
app.use(express.static('public', { index: 'critmon.html' }));

// In-memory store for monitors
const monitors = new Map();

// Structure of a monitor:
// {
//   id: string,
//   timeout: number, (seconds)
//   alert_email: string,
//   status: 'active' | 'paused' | 'down',
//   timer: NodeJS.Timeout | null,
//   lastHeartbeat: Date
// }

// Helper function to trigger alert
const triggerAlert = (id) => {
    const monitor = monitors.get(id);
    if (!monitor) return;

    monitor.status = 'down';
    monitor.timer = null;

    // Simulate alert
    console.log(JSON.stringify({
        ALERT: `Device ${id} is down!`,
        time: new Date().toISOString()
    }));
};

// Helper function to start/reset the timer
const startTimer = (monitor) => {
    if (monitor.timer) {
        clearTimeout(monitor.timer);
    }
    // Set new timer
    monitor.timer = setTimeout(() => {
        triggerAlert(monitor.id);
    }, monitor.timeout * 1000);
    monitor.status = 'active';
    monitor.lastHeartbeat = new Date();
};

// 1. Register a Monitor
app.post('/monitors', (req, res) => {
    const { id, timeout, alert_email } = req.body;

    if (!id || !timeout) {
        return res.status(400).json({ error: 'Missing required fields: id, timeout' });
    }

    if (monitors.has(id)) {
        // Clear existing timer if any
        const existing = monitors.get(id);
        if (existing.timer) clearTimeout(existing.timer);
    }

    const monitor = {
        id,
        timeout,
        alert_email,
        status: 'active',
        timer: null,
        lastHeartbeat: new Date()
    };

    monitors.set(id, monitor);
    startTimer(monitor);

    res.status(201).json({ message: `Monitor ${id} created with ${timeout}s timeout.` });
});

// 2. The Heartbeat (Reset)
app.post('/monitors/:id/heartbeat', (req, res) => {
    const { id } = req.params;
    const monitor = monitors.get(id);

    if (!monitor) {
        return res.status(404).json({ error: 'Monitor not found' });
    }

    if (monitor.status === 'down') {
        // According to AC: "If the ID exists and the timer has NOT expired: Restart the countdown... If ID does not exist: 404". 
        // It doesn't strictly say what to do if it has expired. Let's return a 400 or just allow it to reset. 
        // Wait, "If the ID exists and the timer has NOT expired: Restart the countdown...". It implies if it HAS expired, it doesn't just return 200. Let's return 400.
        return res.status(400).json({ error: 'Monitor is down. Create a new monitor to resume monitoring.' });
    }

    startTimer(monitor);
    res.status(200).json({ message: 'Heartbeat received, timer reset.' });
});

// 3. Pause (The "Snooze" Button)
app.post('/monitors/:id/pause', (req, res) => {
    const { id } = req.params;
    const monitor = monitors.get(id);

    if (!monitor) {
        return res.status(404).json({ error: 'Monitor not found' });
    }

    if (monitor.timer) {
        clearTimeout(monitor.timer);
        monitor.timer = null;
    }
    monitor.status = 'paused';

    res.status(200).json({ message: `Monitor ${id} is paused.` });
});


// Developer's Choice: Get all monitors
app.get('/monitors', (req, res) => {
    const list = Array.from(monitors.values()).map(m => ({
        id: m.id,
        timeout: m.timeout,
        alert_email: m.alert_email,
        status: m.status,
        lastHeartbeat: m.lastHeartbeat
    }));

    res.status(200).json(list);
});

// Developer's Choice: Get specific monitor
app.get('/monitors/:id', (req, res) => {
    const { id } = req.params;
    const monitor = monitors.get(id);

    if (!monitor) {
        return res.status(404).json({ error: 'Monitor not found' });
    }

    res.status(200).json({
        id: monitor.id,
        timeout: monitor.timeout,
        alert_email: monitor.alert_email,
        status: monitor.status,
        lastHeartbeat: monitor.lastHeartbeat
    });
});

app.listen(PORT, () => {
    console.log(`CritMon API is running on port ${PORT}`);
});
