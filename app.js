// Configurazione Firebase (l'utente dovrà inserire i propri dati qui)
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Inizializzazione Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Variabili di stato globale
let currentRoomId = null;
let playerName = "";
let isNarrator = false;
let myPlayerId = null;

// Elementi DOM
const screens = {
    setup: document.getElementById('setup-screen'),
    lobby: document.getElementById('lobby-screen'),
    game: document.getElementById('game-screen')
};

const inputs = {
    playerName: document.getElementById('player-name'),
    roomId: document.getElementById('room-id')
};

const buttons = {
    createRoom: document.getElementById('btn-create-room'),
    joinRoom: document.getElementById('btn-join-room'),
    startGame: document.getElementById('btn-start-game'),
    revealRole: document.getElementById('btn-reveal-role'),
    nextPhase: document.getElementById('btn-next-phase')
};

const displays = {
    roomId: document.getElementById('display-room-id'),
    playersList: document.getElementById('players-list'),
    roleName: document.getElementById('role-name'),
    roleCard: document.getElementById('role-card'),
    gamePhase: document.getElementById('game-phase'),
    gameInfo: document.getElementById('game-info'),
    managePlayersList: document.getElementById('manage-players-list')
};

const containers = {
    narratorLobby: document.getElementById('narrator-controls'),
    narratorGame: document.getElementById('game-narrator-controls'),
    waitingMsg: document.getElementById('waiting-msg')
};

// Utility per cambiare schermata
function showScreen(screenId) {
    Object.values(screens).forEach(s => s.classList.add('hidden'));
    screens[screenId].classList.remove('hidden');
}

// Creazione Stanza
buttons.createRoom.addEventListener('click', async () => {
    playerName = inputs.playerName.value.trim();
    if (!playerName) return alert("Inserisci il tuo nome!");

    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    currentRoomId = roomId;
    isNarrator = true;
    myPlayerId = 'p1';

    try {
        await db.collection('rooms').doc(roomId).set({
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            status: 'lobby',
            phase: 'Preparazione',
            narrator: playerName,
            players: {
                'p1': { name: playerName, role: 'Narratore', alive: true }
            }
        });

        setupRoomListener(roomId);
        displays.roomId.textContent = roomId;
        containers.narratorLobby.classList.remove('hidden');
        containers.waitingMsg.classList.add('hidden');
        showScreen('lobby');
    } catch (error) {
        console.error("Errore creazione stanza:", error);
        alert("Errore nella creazione della stanza.");
    }
});

// Entrata in Stanza
buttons.joinRoom.addEventListener('click', async () => {
    playerName = inputs.playerName.value.trim();
    const roomId = inputs.roomId.value.trim().toUpperCase();

    if (!playerName || !roomId) return alert("Inserisci nome e codice stanza!");

    try {
        const roomDoc = await db.collection('rooms').doc(roomId).get();
        if (!roomDoc.exists) return alert("Stanza non trovata!");

        const data = roomDoc.data();
        if (data.status !== 'lobby') return alert("Gioco già iniziato!");

        const players = data.players;
        const newPlayerId = 'p' + (Object.keys(players).length + 1);
        myPlayerId = newPlayerId;

        await db.collection('rooms').doc(roomId).update({
            [`players.${newPlayerId}`]: { name: playerName, role: 'Villico', alive: true }
        });

        currentRoomId = roomId;
        setupRoomListener(roomId);
        displays.roomId.textContent = roomId;
        showScreen('lobby');
    } catch (error) {
        console.error("Errore entrata stanza:", error);
        alert("Errore nell'entrare nella stanza.");
    }
});

// Reveal Role logic
buttons.revealRole.addEventListener('click', () => {
    displays.roleCard.classList.toggle('hidden-role');
    buttons.revealRole.textContent = displays.roleCard.classList.contains('hidden-role') ? "Premi per rivelare" : "Nascondi";
});

// Listener per la stanza (placeholder per ora)
function setupRoomListener(roomId) {
    db.collection('rooms').doc(roomId).onSnapshot((doc) => {
        if (!doc.exists) return;
        const data = doc.data();
        renderLobby(data.players);

        if (data.status === 'playing' && screens.game.classList.contains('hidden')) {
            startClientGame(data);
        }

        if (!screens.game.classList.contains('hidden')) {
            updateGameUI(data);
        }
    });
}

function renderLobby(players) {
    displays.playersList.innerHTML = '';
    Object.values(players).forEach(p => {
        const li = document.createElement('li');
        li.textContent = p.name + (p.role === 'Narratore' ? ' (Narratore)' : '');
        displays.playersList.appendChild(li);
    });
}

// Inizio Gioco (Solo Narratore)
buttons.startGame.addEventListener('click', async () => {
    if (!isNarrator) return;

    try {
        const roomRef = db.collection('rooms').doc(currentRoomId);
        const doc = await roomRef.get();
        const players = doc.data().players;
        const playerIds = Object.keys(players).filter(id => players[id].role !== 'Narratore');

        if (playerIds.length < 3) return alert("Servono almeno 3 giocatori (escluso il narratore)!");

        // Assegnazione Ruoli
        const roles = assignRoles(playerIds.length);
        const shuffledIds = playerIds.sort(() => Math.random() - 0.5);

        const updates = {};
        shuffledIds.forEach((id, index) => {
            updates[`players.${id}.role`] = roles[index];
        });
        updates.status = 'playing';
        updates.phase = 'Notte 1';
        updates.gameLog = 'Il gioco è iniziato. È notte...';

        await roomRef.update(updates);
    } catch (error) {
        console.error("Errore inizio gioco:", error);
    }
});

function assignRoles(count) {
    let roles = [];
    if (count >= 3) {
        roles.push('Lupo');
        roles.push('Veggente');
        for (let i = 0; i < count - 2; i++) {
            roles.push('Villico');
        }
    }
    // Aggiusta i lupi per gruppi più grandi
    if (count >= 7) roles[2] = 'Lupo';
    if (count >= 11) roles[3] = 'Lupo';

    return roles.sort(() => Math.random() - 0.5);
}

// Prossima Fase (Solo Narratore)
buttons.nextPhase.addEventListener('click', async () => {
    if (!isNarrator) return;
    const roomRef = db.collection('rooms').doc(currentRoomId);
    const doc = await roomRef.get();
    const currentPhase = doc.data().phase;

    let nextPhase = "";
    if (currentPhase.includes("Notte")) {
        nextPhase = currentPhase.replace("Notte", "Giorno");
    } else {
        const num = parseInt(currentPhase.match(/\d+/)[0]);
        nextPhase = `Notte ${num + 1}`;
    }

    await roomRef.update({ phase: nextPhase });
});

async function togglePlayerStatus(playerId) {
    if (!isNarrator) return;
    const roomRef = db.collection('rooms').doc(currentRoomId);
    const doc = await roomRef.get();
    const players = doc.data().players;
    const isAlive = players[playerId].alive;

    await roomRef.update({
        [`players.${playerId}.alive`]: !isAlive
    });
}

function startClientGame(data) {
    showScreen('game');
    const myData = data.players[myPlayerId];
    displays.roleName.textContent = myData.role;

    if (isNarrator) {
        containers.narratorGame.classList.remove('hidden');
    }
    updateGameUI(data);
}

function updateGameUI(data) {
    const myData = data.players[myPlayerId];
    displays.gamePhase.textContent = `Fase: ${data.phase}`;

    if (!myData.alive) {
        displays.gameInfo.textContent = "Sei morto. Spetta ai vivi decidere il tuo destino...";
        displays.gameInfo.style.color = "var(--accent-color)";
    } else {
        displays.gameInfo.textContent = data.gameLog || "";
        displays.gameInfo.style.color = "var(--text-color)";
    }

    if (isNarrator) {
        renderManagePlayers(data.players);
    }
}

function renderManagePlayers(players) {
    displays.managePlayersList.innerHTML = '';
    Object.keys(players).forEach(id => {
        const p = players[id];
        if (p.role === 'Narratore') return;

        const li = document.createElement('li');
        li.className = 'player-item' + (p.alive ? '' : ' dead');

        const span = document.createElement('span');
        span.textContent = `${p.name} (${p.role})`;

        const btn = document.createElement('button');
        btn.textContent = p.alive ? 'Uccidi' : 'Resuscita';
        btn.onclick = () => togglePlayerStatus(id);

        li.appendChild(span);
        li.appendChild(btn);
        displays.managePlayersList.appendChild(li);
    });
}
