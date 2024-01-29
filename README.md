
## Description
WIP

## Installation
Make sure you have pnpm installed `npm install -g pnpm`

```bash
$ git clone https://github.com/docmost/docmost
$ pnpm install
```

## Running the app

### Development

#### Frontend
```bash
$ pnpm nx run client:dev
```
#### Backend
```bash
# build extension package first
$ nx run @docmost/editor-ext:build

# development
$ pnpm nx run server:start

# watch mode
$ pnpm nx run server:start:dev

```

### Production
```bash
$ pnpm run build

$ pnpm nx run server:start:prod
```
The server will be available on `http://localhost:3000`

## Migrations

```bash
# This creates a new empty migration file named 'init'
$ pnpm nx run server:migration:create init

# Generates 'init' migration file from existing entities to update the database schema
$ pnpm nx run server:migration:generate init

# Runs all pending migrations to update the database schema
$ pnpm nx run server:migration:run

# Reverts the last executed migration
$ pnpm nx run server:migration:revert

# Shows the list of executed and pending migrations
$ pnpm nx run server:migration:show

```
