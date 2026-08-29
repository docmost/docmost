# End-to-end encrypted pages

Any page can be encrypted with a password. Its content is encrypted in the
browser and the server only ever stores ciphertext — it cannot read the page,
and neither can anyone with database or backup access.

Encrypting a page encrypts everything nested under it. That subtree is called a
**section**: one key, one password, shared by every page in it.

## What is protected

Content is encrypted with **AES-256-GCM** under a random 256-bit data
encryption key (DEK). The DEK is wrapped with a key derived from the password
by **PBKDF2-HMAC-SHA256**, 600,000 iterations, with a random 16-byte salt. Each
encryption uses a fresh random 96-bit IV.

The DEK exists only in the memory of the tab that derived it. It is never
written to `localStorage`, `sessionStorage`, IndexedDB, or the query cache, and
never sent to another tab or to the server. Opening the section in a second tab
prompts for the password again.

Every ciphertext is bound to its section with AES-GCM associated data, so the
server cannot serve one section's content in place of another's, or replay a
live collaboration frame as a stored document.

## What is *not* protected

The server still sees, and an administrator can still read:

- **Page titles.** They stay in plaintext so the page tree, breadcrumbs, and
  navigation keep working.
- **Structure and metadata.** Which pages exist, how they nest, who created and
  edited them, and when.
- **Sizes and timing.** How large each page is and when it changed.

Within a single section, blobs are interchangeable: the server could swap one
page's content for another page's, or for one of its own history snapshots,
without detection. This follows from the design — every page in a section
shares one key, and history snapshots are byte-identical copies of the page
ciphertext.

Encryption protects content at rest on the server. It does **not** defend
against a compromised browser: anything that runs script in the page (a
malicious extension, an XSS bug) can read a section that is currently unlocked.

Files pasted or dropped into an encrypted page are **refused**. Attachments are
stored as uploaded, outside the encryption, so accepting them would publish the
contents of an image the page implies is protected.

## What is disabled on encrypted pages

The server cannot read the content, so anything it would have to read is turned
off for these pages:

- Full-text search and AI features
- Public sharing links
- Comments
- Server-side export (PDF and server-rendered formats)

Markdown and HTML export still work — they run in the browser, on the decrypted
content.

**Page history** is kept, encrypted with the same key, and is readable while the
section is unlocked.

**Real-time collaboration** works. Clients exchange encrypted updates through a
blind relay: the server authenticates who may join a page's room and forwards
ciphertext between members without being able to decode it.

## Converting a page

Encrypting a section **permanently destroys** data the server cannot re-encrypt:

- page history for every page in the subtree
- comments
- public share links
- backlinks and transclusions (including inbound links and transclusion references)
- **attachments and files** uploaded to any page in the subtree (they are stored
  outside the encryption envelope, so keeping them would leave readable
  plaintext next to ciphertext)

None of this is recoverable from the trash. The client shows a warning and must
explicitly acknowledge the deletion before the server will perform the
conversion; the audit log records how many rows of each kind were removed.

Removing encryption is the reverse: the client decrypts every page in the
section and the server stores the plaintext again. Encrypted history snapshots
are dropped, since they cannot be read once the key metadata is gone.

## Passwords

**A forgotten password cannot be recovered.** There is no reset, no escrow, and
no administrator override — the server has never seen the key. If the password
is lost, the content is gone.

Passwords are at least 12 characters and are Unicode-normalized (NFKC) before
key derivation, so the same text typed on a different keyboard or IME derives
the same key. The minimum is higher than for an account password because the
wrapped key is served to everyone with access to the space: a weak one can be
attacked offline, at the attacker's own pace, rather than through a login
endpoint that can rate-limit.

Changing a section's password re-wraps the existing key; the content is not
re-encrypted. It requires the current password, and — like removing encryption
— is restricted to whoever *encrypted* the section (recorded in
`pages.encrypted_by_id`, which is not necessarily the page's author) or an
administrator of its space. Both operations are irreversible and the server
cannot verify that the caller holds the key, so edit rights alone are not
enough: otherwise any editor could lock everyone out, or replace the section's
contents wholesale.

Unlocked sections lock again automatically after ten minutes of inactivity, and
can be locked immediately from the page menu.

## Limits

- A section holds at most 200 pages. A conversion covers the whole section in
  one request in each direction, so this is enforced both when converting and
  when adding a page to an existing section — a section that grew past the cap
  one page at a time could never be decrypted again.
- An encrypted section cannot be nested inside another one.
- A page cannot be moved out of its section, or into one, while encrypted —
  remove encryption first, or drag it in and let it be encrypted on arrival.
- Pages cannot be imported into an encrypted section; import them elsewhere and
  move them in.

## Upgrading from an earlier build of this branch

The three `page-encryption-root*` migrations were consolidated into a single
`20260724T120000-page-encryption-root`. Kysely records applied migrations by
name and refuses to run when a recorded migration no longer exists on disk, so a
database that applied the old names will report a corrupted migration set.

Nothing has been released with the old names, so the fix is to tell the database
it ran the consolidated one instead:

```sql
DELETE FROM kysely_migration
 WHERE name IN ('20260725T120000-page-encryption-root-checks',
                '20260726T120000-page-encryption-root-no-action');
```

The schema those two produced is identical to what the consolidated migration
produces, so no schema change is needed — only the bookkeeping. A database that
never ran them needs nothing.

`pages.encrypted_by_id` arrives as its own migration
(`20260727T120000-page-encrypted-by`) and uses `ADD COLUMN IF NOT EXISTS`, so it
applies cleanly whether or not the column was already added by hand. Sections
encrypted before it existed have a null value and fall back to the page's
creator for the permission check.

## Storage format

`pages.encrypted_blob` holds base64 AES-GCM output as `IV ‖ ciphertext ‖ tag`.
The decrypted bytes are one of two containers:

- **v2** — the bytes `DMYD2:` followed by a full-state Yjs update. This is what
  every current write produces; it is what makes collaboration possible.
- **v1** — bare UTF-8 ProseMirror JSON, written by earlier builds. Read-only
  compatibility: the first save of such a page rewrites it as v2.

`pages.encryption_meta` on the section root holds the wrapped DEK, the salt, the
KDF parameters, and a check value used to distinguish a wrong password from
damaged data. Clients reject metadata naming an unknown cipher or KDF, a work
factor outside the accepted range, or a salt or key blob too short to be what it
claims — so a hostile server cannot weaken a section by handing out different
parameters. The server enforces the same bounds on the way in.

Stored blobs written before context tags existed are still accepted without
one, and are rewritten with a tag on their next save. Live relay frames are
**not** covered by that fallback: they are created and consumed within a single
session, so an untagged frame can only be ciphertext minted elsewhere and
replayed. The stored-blob fallback exists only to migrate data written by
earlier builds of this feature and can be removed once no such blobs remain.
