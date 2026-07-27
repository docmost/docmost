# Reverse proxy: requisitos do WebSocket

O editor em tempo real do Docmost não usa HTTP. Ele mantém um WebSocket aberto em
**`/collab`** (e um segundo em `/socket.io` para notificações). Se o proxy à frente do
container não repassar o *upgrade* corretamente, o resultado **não** é um erro claro:
o usuário vê um ícone de wifi cortado, o conteúdo digitado não é salvo e, ao recarregar,
a página aparece com o texto antigo.

O config do proxy vive fora deste repositório. Este documento é o contrato que ele
precisa cumprir.

## Contrato

```nginx
map $http_upgrade $connection_upgrade {
  default upgrade;
  ''      close;
}

server {
  listen 443 ssl;
  http2 on;                                  # HTTP/2 voltado ao cliente é OK
  server_name docs.exemplo.com;
  client_max_body_size 200m;                 # casar com FILE_IMPORT_SIZE_LIMIT

  location / {
    proxy_pass http://127.0.0.1:3000;        # upstream em HTTP/1.1 puro
    proxy_http_version 1.1;                  # 1.0 não carrega header Upgrade
    proxy_set_header Upgrade    $http_upgrade;
    proxy_set_header Connection $connection_upgrade;   # via map, NÃO literal
    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 3600s;                # default de 60s é curto demais
    proxy_send_timeout 3600s;
    proxy_buffering off;                     # buffering atrasa frames
  }
}
```

### Regras, cada uma ligada a um sintoma observável

1. **Nunca faça proxy para o upstream em HTTP/2 / h2c.** WebSocket sobre HTTP/2 exige
   Extended CONNECT (RFC 8441), que `proxy_pass` do nginx e `cloudflared --http2Origin`
   não implementam. *Sintoma: 502 no handshake.*
2. **`Connection` precisa vir do `map`, não de um literal `"upgrade"`.** Um literal quebra
   as requisições HTTP normais que compartilham o mesmo `location`.
3. **`proxy_read_timeout` ≥ 3600s.** O único keepalive é o re-anúncio de *awareness* do
   y-protocols (~15s), que normalmente sobrevive ao default de 60s — mas uma aba oculta,
   uma pausa de GC ou um `onAuthenticate` lento estouram. *Sintoma: close 1006 em
   intervalos suspeitosamente regulares.*
4. **`proxy_buffering off`.** *Sintoma: close 4408* — o cliente ficou 30s sem receber
   frame com o socket ainda aberto.
5. **`/socket.io` precisa do mesmo tratamento.** É um segundo WebSocket (notificações).
   O bloco `location /` acima cobre os dois.
6. **Toda camada precisa disso.** Cloudflare → Traefik → Docker são três lugares.
   No Cloudflare: WebSockets habilitado; o limite de ~100s de idle é coberto pelo
   heartbeat de 15s; Rocket Loader e Auto Minify não podem tocar o app.
   No Traefik: WS funciona por padrão — os assassinos são um middleware `compress` ou
   `buffering` no router e um `respondingTimeouts.writeTimeout` diferente de zero no
   entrypoint.
7. **`COLLAB_URL` fica vazio** em deploy same-origin: o cliente deriva
   `wss://<origin>/collab` sozinho. Só preencha ao rodar o servidor de collab separado
   (`collab-main.ts`, `COLLAB_PORT`) — e aí o proxy daquele host precisa de tudo acima.

## Diagnóstico

### O proxy está entregando o upgrade?

```bash
KEY=$(openssl rand -base64 16)
curl -isS -o /dev/null -D - -N \
  -H "Connection: Upgrade" -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Key: $KEY" -H "Sec-WebSocket-Version: 13" \
  -H "Origin: https://SEUDOMINIO" \
  https://SEUDOMINIO/collab
```

Esperado: `HTTP/1.1 101 Switching Protocols`.

> **Atenção:** o servidor registra um catch-all `GET *` para servir a SPA. Um **`200` com
> HTML** significa que o proxy **removeu** os headers `Upgrade`/`Connection` — não que a
> rota sumiu. `502`/`504` = o proxy chegou no app mas não conseguiu fazer upgrade.

Repita de dentro do container para isolar a camada:

```bash
docker compose -f docker-compose.prod.yml exec docmost \
  curl -isS -o /dev/null -D - -N -H "Connection: Upgrade" -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Key: $KEY" -H "Sec-WebSocket-Version: 13" \
  http://localhost:3000/collab
```

101 dentro e não-101 fora ⇒ 100% proxy.

### Evidência no navegador

DevTools → Network → filtro **WS**. Ao abrir uma página deve aparecer **uma** linha
`collab` em 101, e ela deve permanecer. *Cada linha nova é uma reconexão.*

O console loga `[collab] socket closed` com o código:

| Code | Significado |
|---|---|
| **1006** | close anormal sem frame de close — proxy/LB matou o TCP (`proxy_read_timeout`, limite de idle) |
| **4408** | `checkConnection` do cliente: 30s sem frame de entrada com socket aberto — proxy **bufferizando** |
| **1011** | falha no servidor: frame não aplicado, forçando resync. Ver os logs do container (geralmente Redis) |
| **1000 / 1001** | normal, iniciado pelo app (aba oculta/idle, release do refcount) |

### Evidência no servidor

Com `DEBUG_MODE=true`, `docker compose -f docker-compose.prod.yml logs -f docmost`
enquanto edita. `CollabWsAdapter` loga cada upgrade aceito (debug) e cada upgrade
rejeitado (warn, com o pathname). **Silêncio aqui com o cliente mostrando wifi cortado
significa que a requisição nunca chegou.**

### O conteúdo persistiu mesmo?

```bash
docker compose -f docker-compose.prod.yml exec db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c \
"select slug_id, title, updated_at, octet_length(ydoc) ydoc_bytes, left(text_content,120) preview
 from pages where slug_id = 'SLUGID';"
```

`slug_id` é o token final da URL `/s/<space>/p/<titulo>-<slugId>`. Digite uma frase,
espere o `maxDebounce` (padrão 45s) e rode de novo. Se `updated_at` não avançar, nada
chegou ao Postgres.
