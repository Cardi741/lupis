// Global error catcher for debugging on mobile
window.onerror = function(message, source, lineno, colno, error) {
    alert("ERRORE JS: " + message + "\nIn: " + source + " linea: " + lineno);
    return false;
};

// Configurazione Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBT1o5tEsw3sEfPkCf3Me8E5pg9r_ZhS_M",
  authDomain: "lupus-d3632.firebaseapp.com",
  projectId: "lupus-d3632",
  storageBucket: "lupus-d3632.firebasestorage.app",
  messagingSenderId: "821941195440",
  appId: "1:821941195440:web:73d1ac175a5da7a52de175",
  measurementId: "G-32321CJM9P"
};

// Verifica che Firebase sia caricato
if (typeof firebase === 'undefined') {
    alert("ERRORE: Firebase non è stato caricato. Controlla la tua connessione o se un AdBlock sta bloccando gli script di Google.");
}

// Inizializzazione Firebase
const GAME_PHASES = [
    "🌖 Giorno: Sveglia tutti! Chi è morto? Discutete...",
    "⚖️ Votazione: Chi volete mandare al rogo?",
    "🌑 Notte: Tutti a dormire...",
    "🐺 Rodolfo (Lupo): Chi vuoi uccidere?",
    "🛡️ Farell (Bodyguard): Chi vuoi proteggere?",
    "🔮 Leo AZ (Veggente): Di chi vuoi sapere il ruolo?",
    "🏠 Marco P (Protettore): Con chi sei a casa?"
];

let db;
try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
} catch (e) {
    alert("Errore inizializzazione Firebase: " + e.message);
}

// Abilita persistenza offline se possibile e long polling per reti mobili instabili
try {
    db.settings({ experimentalForceLongPolling: true });
} catch (e) {
    console.warn("Could not set long polling:", e);
}

// Variabili di stato globale
let currentRoomId = localStorage.getItem('lupus_roomId');
let playerName = localStorage.getItem('lupus_playerName') || "";
let isNarrator = localStorage.getItem('lupus_isNarrator') === 'true';
let myPlayerId = localStorage.getItem('lupus_myPlayerId');

// Elementi DOM
const screens = {
    setup: document.getElementById('setup-screen'),
    lobby: document.getElementById('lobby-screen'),
    game: document.getElementById('game-screen')
};

const inputs = {
    playerName: document.getElementById('player-name'),
    roomId: document.getElementById('room-id'),
    counts: {
        lupo: document.getElementById('count-lupo'),
        veggente: document.getElementById('count-veggente'),
        protettore: document.getElementById('count-protettore'),
        bodyguard: document.getElementById('count-bodyguard'),
        villico: document.getElementById('count-villico')
    }
};

const buttons = {
    createRoom: document.getElementById('btn-create-room'),
    joinRoom: document.getElementById('btn-join-room'),
    startGame: document.getElementById('btn-start-game'),
    revealRole: document.getElementById('btn-reveal-role'),
    nextPhase: document.getElementById('btn-next-phase'),
    reset: document.getElementById('btn-reset'),
    testDB: document.getElementById('btn-test-db')
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

// Timeout helper per Firebase
function withTimeout(promise, ms, operationName) {
    const timeout = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Timeout operazione: ${operationName}`)), ms);
    });
    return Promise.race([promise, timeout]);
}

// Reset App logic
buttons.reset.addEventListener('click', () => {
    if (confirm("Vuoi davvero resettare l'app? Perderai la connessione alla stanza attuale.")) {
        localStorage.clear();
        location.reload();
    }
});

// Test Database logic
buttons.testDB.addEventListener('click', async () => {
    if (!db) return alert("ERRORE: db non inizializzato");

    try {
        await db.collection('test_connection').add({
            time: Date.now(),
            msg: "Test da app"
        });
        alert("Connessione riuscita! Se la creazione stanza fallisce ancora, è un problema di permessi specifici su 'rooms'.");
    } catch (e) {
        console.error(e);
        if (e.code === 'permission-denied') {
            alert("ERRORE: Permessi negati. Devi impostare le regole di Firestore su 'Test Mode'.");
        } else {
            alert("Errore Test: " + e.message);
        }
    }
});

// Reconnect logic
window.addEventListener('load', () => {
    if (currentRoomId && myPlayerId) {
        setupRoomListener(currentRoomId);
        displays.roomId.textContent = currentRoomId;
        if (isNarrator) {
            containers.narratorLobby.classList.remove('hidden');
            containers.waitingMsg.classList.add('hidden');
        }
        showScreen('lobby');
    }
});

// Creazione Stanza
buttons.createRoom.addEventListener('click', async () => {
    playerName = inputs.playerName.value.trim();
    if (!playerName) return alert("Inserisci il tuo nome!");

    if (!db) return alert("ERRORE: Database non inizializzato.");

    buttons.createRoom.disabled = true;
    buttons.createRoom.textContent = "Creazione in corso...";

    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    currentRoomId = roomId;
    isNarrator = true;
    myPlayerId = 'p1';

    try {
        // Prima proviamo senza timeout per vedere se Firebase ci dà un errore specifico (es. permessi)
        // Il timeout lo mettiamo solo come rete di sicurezza
        const creationPromise = db.collection('rooms').doc(roomId).set({
            createdAt: Date.now(),
            status: 'lobby',
            phase: 'Preparazione',
            narrator: playerName,
            players: {
                'p1': { name: playerName, role: 'Narratore', alive: true }
            }
        });

        await withTimeout(creationPromise, 10000, "Creazione Stanza");

        localStorage.setItem('lupus_roomId', roomId);
        localStorage.setItem('lupus_myPlayerId', 'p1');
        localStorage.setItem('lupus_isNarrator', 'true');
        localStorage.setItem('lupus_playerName', playerName);

        setupRoomListener(roomId);
        displays.roomId.textContent = roomId;
        containers.narratorLobby.classList.remove('hidden');
        containers.waitingMsg.classList.add('hidden');
        showScreen('lobby');
    } catch (error) {
        console.error("Errore dettagliato creazione stanza:", error);
        alert("Errore nella creazione della stanza. Controlla la connessione o se hai attivato Firestore nel pannello Firebase.\n\nErrore: " + error.message);
    } finally {
        buttons.createRoom.disabled = false;
        buttons.createRoom.textContent = "Crea Stanza";
    }
});

// Entrata in Stanza
buttons.joinRoom.addEventListener('click', async () => {
    playerName = inputs.playerName.value.trim();
    const roomId = inputs.roomId.value.trim().toUpperCase();

    if (!playerName || !roomId) return alert("Inserisci nome e codice stanza!");

    try {
        const roomRef = db.collection('rooms').doc(roomId);

        await db.runTransaction(async (transaction) => {
            const roomDoc = await transaction.get(roomRef);
            if (!roomDoc.exists) throw "Stanza non trovata!";

            const data = roomDoc.data();
            if (data.status !== 'lobby') throw "Gioco già iniziato!";

            const players = data.players;
            // Verifica se il giocatore è già presente (per nome, semplice controllo)
            const existingPlayer = Object.values(players).find(p => p.name === playerName);
            if (existingPlayer) {
                // Se esiste già, riutilizziamo l'ID esistente (reconnect implicito)
                myPlayerId = Object.keys(players).find(id => players[id].name === playerName);
            } else {
                const newPlayerId = 'p' + (Object.keys(players).length + 1);
                myPlayerId = newPlayerId;
                transaction.update(roomRef, {
                    [`players.${newPlayerId}`]: { name: playerName, role: 'Villico', alive: true }
                });
            }
        });

        currentRoomId = roomId;
        localStorage.setItem('lupus_roomId', roomId);
        localStorage.setItem('lupus_myPlayerId', myPlayerId);
        localStorage.setItem('lupus_isNarrator', 'false');
        localStorage.setItem('lupus_playerName', playerName);

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

        // Calcolo ruoli scelti
        const roles = [];
        for (let i = 0; i < parseInt(inputs.counts.lupo.value); i++) roles.push('Rodolfo (Lupo)');
        for (let i = 0; i < parseInt(inputs.counts.veggente.value); i++) roles.push('Leo AZ (Veggente)');
        for (let i = 0; i < parseInt(inputs.counts.protettore.value); i++) roles.push('Marco P (Protettore)');
        for (let i = 0; i < parseInt(inputs.counts.bodyguard.value); i++) roles.push('Farell (Bodyguard)');
        for (let i = 0; i < parseInt(inputs.counts.villico.value); i++) roles.push('Piaciarolo (Villico)');

        if (roles.length !== playerIds.length) {
            return alert(`Errore: Hai selezionato ${roles.length} ruoli per ${playerIds.length} giocatori!`);
        }

        // Assegnazione Ruoli
        const shuffledRoles = roles.sort(() => Math.random() - 0.5);
        const shuffledIds = playerIds.sort(() => Math.random() - 0.5);

        const updates = {};
        shuffledIds.forEach((id, index) => {
            updates[`players.${id}.role`] = shuffledRoles[index];
        });
        updates.status = 'playing';
        updates.phaseIndex = 2; // Inizia dalla Notte (GAME_PHASES[2])
        updates.phase = GAME_PHASES[2];
        updates.gameLog = 'Il gioco è iniziato!';

        await roomRef.update(updates);
    } catch (error) {
        console.error("Errore inizio gioco:", error);
        alert("Errore nell'avvio del gioco: " + error.message);
    }
});

// Prossima Fase (Solo Narratore)
buttons.nextPhase.addEventListener('click', async () => {
    if (!isNarrator) return;
    const roomRef = db.collection('rooms').doc(currentRoomId);
    const doc = await roomRef.get();
    const data = doc.data();

    let nextIndex = (data.phaseIndex + 1) % GAME_PHASES.length;

    await roomRef.update({
        phaseIndex: nextIndex,
        phase: GAME_PHASES[nextIndex]
    });
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
    displays.gamePhase.textContent = data.phase;

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
