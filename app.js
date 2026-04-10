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
    testDB: document.getElementById('btn-test-db'),
    newGame: document.getElementById('btn-new-game'),
    leaveRoom: document.getElementById('btn-leave-room')
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

    // Mostra/nascondi badge narratore
    const badge = document.getElementById('narrator-badge');
    if (isNarrator && screenId !== 'setup') {
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
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

// Leave Room logic
buttons.leaveRoom.addEventListener('click', async () => {
    if (!currentRoomId || !myPlayerId) return;

    try {
        const roomRef = db.collection('rooms').doc(currentRoomId);
        const doc = await roomRef.get();
        const data = doc.data();

        // Se la partita è in corso, i giocatori non possono uscire
        if (data.status === 'playing' && !isNarrator) {
            return alert("La partita è in corso! Non puoi scappare ora... finisci il gioco!");
        }

        if (!confirm("Vuoi uscire dalla stanza?")) return;

        if (isNarrator) {
            if (confirm("Sei il narratore. Se esci, la stanza verrà chiusa per tutti. Procedere?")) {
                await roomRef.delete();
            } else {
                return;
            }
        } else {
            await roomRef.update({
                [`players.${myPlayerId}`]: firebase.firestore.FieldValue.delete()
            });
        }

        localStorage.clear();
        location.reload();
    } catch (error) {
        console.error("Errore uscita:", error);
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

// Listener per la stanza
function setupRoomListener(roomId) {
    db.collection('rooms').doc(roomId).onSnapshot((doc) => {
        if (!doc.exists) {
            // Se la stanza viene eliminata (es. dal narratore), torniamo alla home
            localStorage.clear();
            location.reload();
            return;
        }
        const data = doc.data();

        // Se lo stato torna a lobby mentre siamo in gioco, forziamo il ritorno alla lobby
        if (data.status === 'lobby' && !screens.game.classList.contains('hidden')) {
            showScreen('lobby');
        }

        // Se il mio ID non è più nella lista giocatori (sono stato rimosso o la stanza è resettata male)
        if (myPlayerId && !data.players[myPlayerId]) {
            alert("Sei stato rimosso dalla stanza o la sessione è scaduta.");
            localStorage.clear();
            location.reload();
            return;
        }

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

async function removePlayer(playerId) {
    if (!isNarrator) return;
    if (!confirm("Vuoi davvero rimuovere questo giocatore dalla stanza?")) return;

    try {
        const roomRef = db.collection('rooms').doc(currentRoomId);
        await roomRef.update({
            [`players.${playerId}`]: firebase.firestore.FieldValue.delete()
        });
    } catch (error) {
        console.error("Errore rimozione:", error);
    }
}

// Nuova Partita / Reset Stanza (Solo Narratore)
buttons.newGame.addEventListener('click', async () => {
    if (!isNarrator) return;
    if (!confirm("Vuoi terminare questa partita e tornare alla lobby?")) return;

    try {
        const roomRef = db.collection('rooms').doc(currentRoomId);
        const doc = await roomRef.get();
        const players = doc.data().players;

        const updates = {
            status: 'lobby',
            phase: 'Preparazione',
            phaseIndex: 0,
            gameLog: 'Partita terminata dal narratore.'
        };

        // Reset stato vivi e ruoli base
        Object.keys(players).forEach(id => {
            updates[`players.${id}.alive`] = true;
            if (players[id].role !== 'Narratore') {
                updates[`players.${id}.role`] = 'Villico'; // Reset temporaneo
            }
        });

        await roomRef.update(updates);
    } catch (error) {
        alert("Errore nel reset: " + error.message);
    }
});

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

    // Logica di Vittoria rimossa come richiesto (100% manuale del narratore)
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

        const btnGroup = document.createElement('div');
        btnGroup.className = 'btn-group';

        const btnToggle = document.createElement('button');
        btnToggle.textContent = p.alive ? 'Uccidi' : 'Resuscita';
        btnToggle.onclick = () => togglePlayerStatus(id);

        const btnRemove = document.createElement('button');
        btnRemove.textContent = '❌';
        btnRemove.className = 'remove-btn';
        btnRemove.onclick = () => removePlayer(id);

        btnGroup.appendChild(btnToggle);
        btnGroup.appendChild(btnRemove);

        li.appendChild(span);
        li.appendChild(btnGroup);
        displays.managePlayersList.appendChild(li);
    });
}
