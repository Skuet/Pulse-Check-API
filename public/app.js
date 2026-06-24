document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('registerForm');
    const monitorsGrid = document.getElementById('monitorsGrid');
    const activeCountEl = document.getElementById('activeCount');
    const downCountEl = document.getElementById('downCount');

    let monitorsData = [];

    // Register a new monitor
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('deviceId').value;
        const timeout = document.getElementById('timeout').value;

        try {
            const res = await fetch('/monitors', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, timeout: parseInt(timeout, 10), alert_email: 'dashboard@critmon.com' })
            });
            if (res.ok) {
                registerForm.reset();
                fetchMonitors();
            }
        } catch (err) {
            console.error('Error registering:', err);
        }
    });

    // Fetch and render monitors
    const fetchMonitors = async () => {
        try {
            const res = await fetch('/monitors');
            monitorsData = await res.json();
            renderMonitors();
        } catch (err) {
            console.error('Error fetching monitors:', err);
        }
    };

    const action = async (id, endpoint) => {
        try {
            await fetch(`/monitors/${id}/${endpoint}`, { method: 'POST' });
            fetchMonitors();
        } catch (err) {
            console.error(`Error on ${endpoint}:`, err);
        }
    };

    // Global attached functions for button clicks
    window.sendHeartbeat = (id) => action(id, 'heartbeat');
    window.togglePause = (id) => action(id, 'pause');

    // UI Render
    const renderMonitors = () => {
        const now = new Date().getTime();
        let activeCount = 0;
        let downCount = 0;

        monitorsGrid.innerHTML = monitorsData.map(m => {
            if (m.status === 'active') activeCount++;
            if (m.status === 'down') downCount++;

            // Calculate time left
            const lastPing = new Date(m.lastHeartbeat).getTime();
            const expiresAt = lastPing + (m.timeout * 1000);
            let timeLeft = Math.max(0, Math.ceil((expiresAt - now) / 1000));
            
            if (m.status === 'down') timeLeft = 0;

            let displayTime = m.status === 'paused' ? 'PAUSED' : `${timeLeft}s`;
            if (m.status === 'down') displayTime = 'OFFLINE';

            return `
                <div class="monitor-card" data-status="${m.status}">
                    <div class="card-header">
                        <span class="device-id">${m.id}</span>
                        <span class="status-badge">${m.status}</span>
                    </div>
                    <div class="timer-display">${displayTime}</div>
                    <div class="card-actions">
                        <button class="btn-action" onclick="sendHeartbeat('${m.id}')">
                            ${m.status === 'down' ? 'Reset' : 'Heartbeat'}
                        </button>
                        ${m.status !== 'down' ? `
                            <button class="btn-action" onclick="${m.status === 'paused' ? `sendHeartbeat('${m.id}')` : `togglePause('${m.id}')`}">
                                ${m.status === 'paused' ? 'Resume' : 'Pause'}
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');

        activeCountEl.textContent = `${activeCount} Active`;
        downCountEl.textContent = `${downCount} Down`;
    };

    // Start poll loop (every 1 second) to refresh timers
    setInterval(fetchMonitors, 1000);
    fetchMonitors();
});
