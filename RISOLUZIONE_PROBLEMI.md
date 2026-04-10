# 🚨 Guida per Risolvere l'Errore delle Regole

Se ricevi un errore come **"Line 1: Parse error"** o errori HTTP, significa che stai incollando le regole nella sezione **sbagliata** di Firebase.

### 1. Assicurati di essere nel posto giusto
Firebase ha due database diversi. Tu devi usare **Cloud Firestore**.

*   ❌ **NON ANDARE QUI:** Realtime Database (Icona grigia con `{ }`) -> Questo database **NON** accetta le regole che iniziano con `rules_version = '2'`.
*   ✅ **DEVI ANDARE QUI:** **Firestore Database** (Icona arancione con una fiammella bianca).

### 2. Passaggi esatti
1.  Apri la [Console di Firebase](https://console.firebase.google.com/).
2.  Nel menu laterale (sotto la voce "Build" o "Build"), clicca su **Firestore Database**.
3.  Se vedi un pulsante "Crea database", cliccalo e completa la creazione.
4.  Una volta dentro, in alto vedrai delle schede: *Dati, Indici, **Regole**, Utilizzo*. Clicca su **Regole**.
5.  Cancella tutto quello che c'è scritto e incolla **ESATTAMENTE** questo:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

6.  Clicca sul pulsante azzurro **Pubblica**.

### 3. Perché l'errore?
Il "Realtime Database" si aspetta un formato JSON (che inizia con `{`). "Firestore Database" usa il formato sopra. Se provi a mettere il codice sopra nel Realtime Database, lui non lo capisce e ti dà "Parse error" alla riga 1.
