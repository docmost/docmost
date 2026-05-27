# Guida Utente — DocOps

**Versione**: 1.0 — Maggio 2026  
**Destinatari**: Process Owner, Approver, Developer, Tech Lead

---

## Indice

1. [Come creare una Change Request](#1-come-creare-una-change-request)
2. [Come approvare una Change Request](#2-come-approvare-una-change-request)
3. [Come implementare una Change Request](#3-come-implementare-una-change-request)
4. [Come pubblicare la documentazione](#4-come-pubblicare-la-documentazione)
5. [FAQ](#5-faq)

---

## 1. Come creare una Change Request

**Ruolo richiesto**: Process Owner

Una Change Request (CR) è la richiesta formale di modifica alle specifiche di un servizio. Ogni modifica documentale deve passare attraverso una CR — non è possibile modificare direttamente la documentazione pubblicata.

### Quando aprire una CR

Apri una CR quando:
- le specifiche di un servizio non riflettono più il comportamento reale o atteso del sistema
- è necessario documentare una nuova funzionalità o variazione di processo
- va corretta un'imprecisione nella documentazione corrente

### Procedura

1. Accedi a DocOps e naviga alla sezione **Catalogo Servizi** (menu laterale sinistro).
2. Cerca il servizio da modificare tramite nome, codice o dominio (es. cerca `slcone` o filtra per dominio `Pagamenti`).
3. Apri la scheda del servizio e clicca **"Nuova Change Request"**.
4. Compila i campi obbligatori:

| Campo | Descrizione | Esempio |
|---|---|---|
| **Titolo** | Descrizione breve della modifica richiesta | `Aggiornamento flusso domanda maternità post-partum` |
| **Descrizione** | Cosa deve cambiare e dove | `La sezione "Step 1 — Inserimento domanda" va aggiornata per includere il caso di parto gemellare` |
| **Motivazione** | Perché è necessaria questa modifica | `Il sistema attuale non gestisce il caso di nascita multipla; gli utenti ricevono un errore bloccante` |
| **Priorità** | `LOW / MEDIUM / HIGH / CRITICAL` | `HIGH` |
| **Impatto** | `LOW / MEDIUM / HIGH` | `MEDIUM` |

5. Clicca **"Invia per revisione"**. La CR passa allo stato `REQUESTED`.

### Stati della CR

```
DRAFT → REQUESTED → IN_REVIEW → APPROVED → IN_IMPLEMENTATION → IN_VERIFICATION → PUBLISHED → CLOSED
```

Stati terminali: `REJECTED` (rifiutata dall'Approver), `CANCELLED` (annullata dal Process Owner).

Puoi seguire lo stato delle tue CR nella dashboard **"Le mie richieste"**.

---

## 2. Come approvare una Change Request

**Ruolo richiesto**: Approver

### Dove trovare le CR da approvare

Accedi alla dashboard **"Coda Revisioni"** (menu principale → Change Requests → In Revisione). Vengono mostrate tutte le CR nello stato `IN_REVIEW` assegnate al tuo gruppo.

### Procedura di approvazione

1. Clicca sulla CR da esaminare per aprire il dettaglio.
2. Leggi i campi **Descrizione**, **Motivazione** e **Impatto**.
3. Consulta la documentazione corrente del servizio cliccando **"Vedi specifiche"** (si apre lo Space Docmost del servizio in una nuova tab).
4. Leggi i commenti lasciati da altri revisori, se presenti.
5. Scegli una delle due azioni:

**Approvare**
- Clicca **"Approva"**.
- La CR passa allo stato `APPROVED` e viene messa in coda per implementazione.
- Il Developer assegnato riceve notifica via email.

**Rifiutare**
- Clicca **"Rifiuta"**.
- Inserisci obbligatoriamente la motivazione del rifiuto nel campo **"Note di rifiuto"**.
- La CR passa allo stato `REJECTED`. Il Process Owner riceve notifica con la motivazione.

### Richiedere chiarimenti

Se hai bisogno di informazioni aggiuntive prima di decidere, usa la sezione **Commenti** nella scheda CR. Il Process Owner riceve notifica e può rispondere. Non blocca lo stato della CR.

---

## 3. Come implementare una Change Request

**Ruolo richiesto**: Developer

### Dove trovare le CR da implementare

Accedi alla dashboard **"Backlog Implementazione"** (menu principale → Change Requests → Approvate). Vengono mostrate le CR in stato `APPROVED` assegnate al tuo team.

### Procedura

1. Apri la CR assegnata e clicca **"Prendi in carico"**. La CR passa allo stato `IN_IMPLEMENTATION` e acquisisce il lock logico sul documento: nessun altro Developer può modificare le specifiche dello stesso servizio finché questa CR non è chiusa.

2. Naviga allo Space documentale del servizio (link diretto nella scheda CR).

3. Il banner in cima all'editor mostra:
   ```
   Stai editando in contesto CR-2026-0142 (slcone)
   ```
   Questo conferma che sei in modalità modifica controllata.

4. Clicca **"Modifica"** — il pulsante è abilitato solo perché hai una CR attiva in `IN_IMPLEMENTATION`. Se il pulsante è grigio, verifica di aver cliccato "Prendi in carico".

5. Apporta le modifiche nel editor BlockNote (formattazione, tabelle, sezioni, allegati).
   - Le modifiche vengono salvate automaticamente in bozza.
   - La versione pubblicata del documento non cambia finché non pubblichi.

6. **Allega i riferimenti tecnici** (obbligatorio prima di procedere alla verifica):
   - Torna alla scheda CR → sezione **"Riferimenti Esterni"**.
   - Aggiungi almeno uno tra: PR GitHub/GitLab, commit hash, ticket Jira/Redmine, build CI.
   - Clicca **"Aggiungi riferimento"** e incolla l'URL o l'identificativo.

7. Una volta completate le modifiche e aggiunto almeno un riferimento tecnico, clicca **"Invia per verifica"**. La CR passa allo stato `IN_VERIFICATION`. Il Tech Lead assegnato riceve notifica.

### Note

- Non chiudere il browser durante la modifica: la bozza è salvata automaticamente, ma attendere il completamento del salvataggio (icona "Salvato" in alto a destra) prima di chiudere.
- Se devi interrompere il lavoro a metà, la CR rimane in `IN_IMPLEMENTATION` e la bozza è mantenuta. Puoi riprendere in qualsiasi momento.

---

## 4. Come pubblicare la documentazione

**Ruoli coinvolti**: Tech Lead (verifica tecnica) + Developer (pubblicazione finale)

La pubblicazione è la fase finale del workflow: la bozza diventa la versione ufficiale pubblicata e viene creato uno snapshot immutabile collegato alla CR.

### 4a — Verifica tecnica (Tech Lead)

1. Accedi alla dashboard **"In Verifica"** (menu principale → Change Requests → In Verifica).
2. Apri la CR da verificare.
3. Clicca **"Visualizza diff"** per confrontare il contenuto corrente (bozza) con l'ultima versione pubblicata. Le righe aggiunte appaiono in verde, quelle rimosse in rosso.
4. Controlla i **Riferimenti Esterni** allegati (PR, commit, ticket) per verificare la coerenza con le modifiche documentali.
5. Scegli:

**Verifica superata**
- Clicca **"Approva per pubblicazione"**.
- Il Developer viene notificato e può procedere alla pubblicazione.

**Verifica fallita**
- Clicca **"Richiedi modifiche"**.
- Inserisci le note sulle correzioni necessarie.
- La CR torna allo stato `IN_IMPLEMENTATION`. Il Developer riceve notifica con le note.

### 4b — Pubblicazione (Developer)

Dopo l'approvazione del Tech Lead:

1. Apri la CR (ora in stato `IN_VERIFICATION`, approvata dal Tech Lead).
2. Clicca **"Pubblica"**.
3. Il sistema esegue automaticamente:
   - Sostituisce la versione pubblicata del documento con la bozza corrente.
   - Crea uno snapshot immutabile (`page_history`) con riferimento alla CR.
   - Aggiorna il timestamp di pubblicazione e registra chi ha pubblicato.
   - Notifica via email il Process Owner e i Reader del servizio.
4. La CR passa allo stato `PUBLISHED`, poi a `CLOSED`.

### Navigare le versioni precedenti

Nella pagina del servizio, clicca **"Storico versioni"** (icona orologio in alto a destra) per vedere l'elenco di tutte le versioni pubblicate, con:
- Data di pubblicazione
- Utente che ha pubblicato
- CR di riferimento (con titolo, motivazione, chi ha richiesto)
- Link al diff rispetto alla versione precedente

---

## 5. FAQ

**Posso modificare un documento senza aprire una CR?**  
No. Il pulsante "Modifica" è abilitato solo se esiste una CR attiva in `IN_IMPLEMENTATION` assegnata all'utente corrente. Questa è una garanzia intenzionale: ogni modifica deve essere tracciata e approvata.

**Posso avere più CR aperte sullo stesso servizio contemporaneamente?**  
No. Un solo lock di modifica per servizio alla volta. Se una CR è già in `IN_IMPLEMENTATION` su un servizio, non è possibile aprire o approvare un'altra CR sullo stesso servizio finché quella corrente non viene pubblicata o annullata.

**Ho aperto una CR per errore. Come la annullo?**  
Apri la scheda CR → clicca **"Annulla CR"** (visibile finché lo stato è `DRAFT` o `REQUESTED`). Una CR in stato `IN_REVIEW` o successivo può essere annullata solo dall'Approver o dall'Admin.

**Come posso trovare chi ha modificato una specifica in passato?**  
Apri la pagina del servizio → clicca **"Storico versioni"** → ogni versione mostra la CR collegata con il nome del richiedente, dell'Approver e del Developer.

**Il diff non appare in "Visualizza diff". Cosa faccio?**  
Il diff richiede almeno una versione pubblicata precedente. Se il servizio è nuovo (nessuna versione pubblicata), il diff mostra l'intero contenuto come "aggiunto". È comportamento atteso.

**Posso assegnare una CR a un Developer specifico?**  
Sì. In fase di approvazione, l'Approver può selezionare un Developer dall'elenco nel campo **"Assegna a"**. Se non viene selezionato nessuno, la CR appare nel backlog condiviso del team.

**Cosa succede se il Tech Lead richiede modifiche dopo la verifica?**  
La CR torna allo stato `IN_IMPLEMENTATION`. Il Developer riceve notifica con le note del Tech Lead, apporta le correzioni nell'editor e reinvia per verifica. Non è necessario riaprire una nuova CR.

**Non vedo il servizio che cerco nel catalogo. Come lo segnalo?**  
Solo l'Admin può creare nuovi servizi nel catalogo. Contatta l'amministratore di sistema o apri una segnalazione interna indicando: codice servizio proposto, nome, dominio, owner.

**Come posso allegare una PR GitHub a una CR?**  
Nella scheda CR → sezione **"Riferimenti Esterni"** → **"Aggiungi riferimento"** → seleziona tipo `PR` → incolla l'URL completo della PR (es. `https://github.com/org/repo/pull/123`).

**Ricevo una notifica email per ogni transizione di stato?**  
Sì, per le transizioni che ti riguardano direttamente. Il Process Owner riceve notifica a: approvazione, rifiuto, pubblicazione. Developer a: approvazione, richiesta modifiche post-verifica. Tech Lead a: invio per verifica.
