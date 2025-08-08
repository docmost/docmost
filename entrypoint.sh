#!/bin/sh

# Get PUID/PGID
# setting the default to user and group 1000:1000
PUID=${PUID:-1000}
PGID=${PGID:-1000}

echo "Creating user with UID $PUID and GID $PGID"

# Create group if it doesn't exist
if ! getent group skywalker >/dev/null 2>&1; then
  addgroup -g "$PGID" skywalker
fi

# Create user if it doesn't exist
if ! id -u skywalker >/dev/null 2>&1; then
  adduser -D -u "$PUID" -G skywalker skywalker
fi

# Add user skywalker to group docmost
addgroup skywalker docmost

echo "Running as user skywalker (UID $PUID)"
su -s /bin/sh -c "pnpm start" skywalker




