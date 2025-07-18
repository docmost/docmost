#!/bin/sh

# Get PUID/PGID
PUID=${PUID:-1000}
PGID=${PGID:-1000}

# Change user if needed
if [ "$(id -u)" != "1000" ]; then
    echo "using user ID: $PUID"
    # If container is started as as non root
    addgroup -g "$PGID" skywalker
    adduser -D -u "$PUID" -G skywalker skywalker
    addgroup skywalker node
    echo "Switching to custom user (UID: $PUID)"
fi

su -s /bin/sh -c "pnpm start" skywalker
