# Pilot — Script Demo DocOps

**Durata stimata**: 45-60 minuti  
**Servizio usato**: `slcone` (Domanda Maternità)  
**Prerequisiti**: ambiente locale avviato, servizio `slcone` creato con root page popolata

---

## Setup pre-demo (fare prima che arrivino i tester)

- [ ] `docker compose -f docker-compose.dev.yml up -d` — container up
- [ ] `pnpm --filter ./apps/server run start:dev` — backend avviato
- [ ] `pnpm --filter ./apps/client run dev` — frontend su http://localhost:5173
- [ ] Utenti già creati con ruoli assegnati (vedi tabella sotto)
- [ ] Servizio `slcone` creato con root page contenente la guida maternità
- [ ] Browser aperto su http://localhost:5173, loggato come Process Owner

### Utenti demo da creare in anticipo

| Utente | Email | Ruolo |
|---|---|---|
| Demo PO | po@demo.local | Process Owner |
| Demo Approver | approver@demo.local | Approver |
| Demo Dev | dev@demo.local | Developer |
| Demo TL | tl@demo.local | Tech Lead |
| Demo Reader | reader@demo.local | Reader |

---

## Atto 1 — Il catalogo (5 min)

**Loggato come**: Process Owner

1. Apri http://localhost:5173 → mostra la homepage/dashboard
2. Naviga a **Catalogo Servizi**
3. Mostra i servizi creati, filtra per dominio `Pagamenti`
4. Apri scheda `slcone` — mostra: codice, nome, owner, dominio
5. Clicca sul link allo **Space documentale** — si apre la documentazione corrente
6. Scorri la guida per mostrare che è documentazione reale, ricercabile

**Messaggio chiave**: *"Ogni servizio ha il suo spazio documentale. La documentazione che vedete ora è la versione pubblicata — nessuno può modificarla direttamente."*

---

## Atto 2 — Creare una Change Request (10 min)

**Loggato come**: Process Owner

**Scenario**: il flusso di domanda maternità per parto gemellare dà errore agli utenti — va aggiornata la documentazione.

1. Dalla scheda `slcone` clicca **"Nuova Change Request"**
2. Compila il form:
   - **Titolo**: `Aggiornamento gestione parto gemellare`
   - **Descrizione**: `La sezione Step 1 non copre il caso di nascita multipla. Gli utenti ricevono un errore bloccante alla selezione del tipo domanda.`
   - **Motivazione**: `Segnalazione pervenuta da 3 utenti nella settimana corrente. Blocca l'operatività.`
   - **Priorità**: `HIGH`
   - **Impatto**: `MEDIUM`
3. Clicca **"Invia per revisione"**
4. Mostra lo stato cambiato a `REQUESTED`
5. Apri dashboard **"Le mie richieste"** — la CR appare in lista

**Messaggio chiave**: *"Il Process Owner non può modificare nulla direttamente. Apre una richiesta formale con motivazione. Da questo momento è tracciato tutto: chi ha chiesto, quando, perché."*

---

## Atto 3 — Approvare la CR (8 min)

**Switcha account**: logout → login come Approver

1. Apri **"Coda Revisioni"** — la CR `slcone` appare
2. Clicca sulla CR → mostra il dettaglio completo
3. Clicca **"Vedi specifiche"** — si apre la doc corrente di `slcone` in nuova tab
4. Torna alla CR → clicca **"Approva"**
5. Mostra stato cambiato a `APPROVED`

**Messaggio chiave**: *"L'Approver valuta impatto e priorità. Solo dopo l'approvazione entra nel backlog del Developer."*

---

## Atto 4 — Implementare la modifica (12 min)

**Switcha account**: logout → login come Developer

1. Apri **"Backlog Implementazione"** — la CR appare
2. Clicca **"Prendi in carico"** → stato `IN_IMPLEMENTATION`
3. Naviga allo Space di `slcone`
4. Mostra il **banner CR** in cima all'editor
5. Clicca **"Modifica"** — l'editor BlockNote si apre
6. Aggiungi una riga nella tabella dei tipi di evento:
   ```
   | Nascita gemellare | • Certificato medico (entrambi) • Documento di identificazione |
   ```
7. Attendi il salvataggio automatico ("Salvato" in alto a destra)
8. Torna alla scheda CR → **"Riferimenti Esterni"** → **"Aggiungi riferimento"**
   - Tipo: `PR`
   - URL: `https://github.com/tigre9/docops/pull/1` (usa un URL placeholder)
9. Clicca **"Invia per verifica"** → stato `IN_VERIFICATION`

**Messaggio chiave**: *"Il Developer modifica sotto lock logico — nessun altro può modificare questo servizio contemporaneamente. E deve allegare un riferimento tecnico: non si può pubblicare senza traccia del lavoro fatto."*

---

## Atto 5 — Verifica e pubblicazione (8 min)

**Switcha account**: logout → login come Tech Lead

1. Apri **"In Verifica"** — la CR appare
2. Clicca **"Visualizza diff"** — mostra in verde la riga aggiunta
3. Controlla i riferimenti esterni (la PR allegata)
4. Clicca **"Approva per pubblicazione"**

**Switcha account**: logout → login come Developer

5. Apri la CR (ora approvata dal TL)
6. Clicca **"Pubblica"**
7. Mostra stato `PUBLISHED` → poi `CLOSED`
8. Apri la documentazione di `slcone` — la riga gemellare è ora visibile nella versione pubblicata

**Messaggio chiave**: *"La pubblicazione è un atto deliberato, non automatico. Da questo momento la nuova versione è la verità ufficiale."*

---

## Atto 6 — Storico versioni (5 min)

**Loggato come**: Reader (o qualsiasi ruolo)

1. Apri la pagina di `slcone`
2. Clicca **"Storico versioni"** (icona orologio)
3. Mostra le 2 versioni: quella originale e quella appena pubblicata
4. Clicca sulla versione precedente → mostra il contenuto prima della modifica
5. Clicca **"Diff"** → mostra il confronto visuale

**Messaggio chiave**: *"Ogni modifica è permanentemente tracciata. Chi l'ha chiesta, chi l'ha approvata, chi l'ha implementata, quando. Audit-ready per natura."*

---

## Domande attese e risposte

| Domanda | Risposta |
|---|---|
| "Posso modificare senza aprire una CR?" | No, il pulsante Modifica è disabilitato. È intenzionale. |
| "Chi può creare nuovi servizi nel catalogo?" | Solo l'Admin. |
| "E se ho urgenza e devo modificare subito?" | Apri CR con priorità CRITICAL — il workflow rimane, ma la visibilità è massima. |
| "Posso avere due CR sullo stesso servizio?" | No, lock esclusivo. Una CR alla volta per servizio. |
| "Come si fa il rollback a una versione precedente?" | Feature pianificata per fase successiva — ora è consultabile ma non ripristinabile con un click. |

---

## Dopo la demo

Distribuisci `03-template-feedback.md` e chiedi compilazione entro 24-48 ore.
