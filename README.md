# Lupus in Tabula - Web App

Un'applicazione semplice basata su HTML/JS e Firebase per giocare a Lupus in Tabula con gli amici.

## Configurazione Firebase

Per far funzionare l'app, devi configurare il tuo progetto Firebase:

1.  **Crea un progetto:** Vai su [Firebase Console](https://console.firebase.google.com/) e crea un nuovo progetto.
2.  **Aggiungi Firestore:** Nel menu a sinistra, clicca su "Firestore Database" e poi su "Crea database". Scegli una posizione vicina a te.
3.  **Imposta le Regole:** Vai nella scheda "Rules" di Firestore e incolla il contenuto del file `firestore.rules` incluso in questa cartella. Clicca su "Pubblica".
4.  **Configura l'App:**
    *   Registra una nuova "Web App" nelle impostazioni del progetto.
    *   Copia l'oggetto `firebaseConfig` fornito da Firebase.
    *   Apri `app.js` e sostituisci la configurazione esistente con la tua.

## Caratteristiche

*   **Real-time:** Utilizza Firestore per sincronizzare i giocatori in tempo reale.
*   **Mobile-first:** Design ottimizzato per schermi piccoli.
*   **Persistenza:** La sessione rimane attiva anche ricaricando la pagina (grazie a localStorage).
*   **Narratore:** Un set di controlli dedicato per chi gestisce la partita.

## Autore

Creato con l'aiuto di Jules.
