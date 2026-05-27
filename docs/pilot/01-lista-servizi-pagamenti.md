# Pilot — Lista Servizi Famiglia "Pagamenti"

15 servizi da creare manualmente in DocOps prima della sessione demo.

## Come creare un servizio

1. Accedi a DocOps → **Catalogo Servizi** → **Nuovo Servizio**
2. Compila i campi con i dati della tabella sotto
3. Salva → il sistema crea automaticamente lo Space Docmost e la root page

---

## Servizi da creare

| # | Codice (`code`) | Nome esteso | Dominio | Owner | Priorità pilot |
|---|---|---|---|---|---|
| 1 | `slcone` | Domanda Maternità | Pagamenti | team-prestazioni | ★ demo principale |
| 2 | `pens-ord` | Pensione Ordinaria | Pagamenti | team-prestazioni | ★ demo |
| 3 | `contrib-obb` | Contributi Obbligatori | Pagamenti | team-contributi | ★ demo |
| 4 | `rimborso-san` | Rimborso Spese Sanitarie | Pagamenti | team-prestazioni | secondario |
| 5 | `contrib-vol` | Contributi Volontari | Pagamenti | team-contributi | secondario |
| 6 | `riscatto-laurea` | Riscatto Anni di Laurea | Pagamenti | team-prestazioni | secondario |
| 7 | `prestito-pers` | Prestito Personale | Pagamenti | team-credito | secondario |
| 8 | `anticipo-tfr` | Anticipo TFR | Pagamenti | team-credito | secondario |
| 9 | `indenni-malattia` | Indennità di Malattia | Pagamenti | team-prestazioni | secondario |
| 10 | `assegno-famiglia` | Assegno Nucleo Familiare | Pagamenti | team-prestazioni | secondario |
| 11 | `domanda-pens` | Domanda di Pensionamento | Pagamenti | team-prestazioni | secondario |
| 12 | `estratto-conto` | Estratto Conto Contributivo | Pagamenti | team-contributi | secondario |
| 13 | `sussidio-straord` | Sussidio Straordinario | Pagamenti | team-prestazioni | secondario |
| 14 | `verifica-pos` | Verifica Posizione Contributiva | Pagamenti | team-contributi | secondario |
| 15 | `bonus-giovani` | Bonus Iscritti Under 35 | Pagamenti | team-prestazioni | secondario |

---

## Minimo per la demo

Per la sessione bastano i **3 servizi ★**. Crea tutti e 15 se hai tempo, ma il workflow completo si dimostra su `slcone`.

## Contenuto root page

Per ogni servizio, la root page può essere lasciata vuota o con questo placeholder:

```
# [Nome Servizio]

Documentazione in corso di redazione.

**Dominio**: Pagamenti
**Owner**: [team]
**Stato**: Attivo
```
