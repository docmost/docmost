# Docmost Project Overview

This document provides a comprehensive overview of the Docmost project, its structure, and development conventions to be used as instructional context for future interactions.

## Project Overview

Docmost is an open-source collaborative wiki and documentation software built with a modern technology stack. It features real-time collaboration, diagrams, permissions management, and more. The project is structured as a monorepo using pnpm workspaces and Nx for task management.

### Architecture

The project is divided into two main applications:

*   **`apps/client`**: A React single-page application built with Vite. It uses Mantine for UI components, React Query for data fetching, and i18next for internationalization. The editor is built with Tiptap and Hocuspocus for real-time collaboration.
*   **`apps/server`**: A NestJS application that serves as the backend API. It uses Fastify as the web server, and includes features like authentication with Passport.js, message queues with BullMQ, and file storage with AWS S3. It also includes a WebSocket server for real-time collaboration.

The monorepo also contains shared packages in the `packages` directory, such as `@docmost/editor-ext`.

## Building and Running

The following commands are essential for developing and running the Docmost project.

### Development

To run the client and server applications in development mode with hot-reloading, use the following command from the root of the project:

```bash
pnpm dev
```

### Building for Production

To build both the client and server for production, run the following command from the root of the project:

```bash
pnpm build
```

This will create optimized builds in the `dist` directory of each application.

### Starting in Production

To start the server in production mode, use the following command:

```bash
pnpm start
```

## Development Conventions

### Code Style

The project uses Prettier for code formatting and ESLint for linting. There are `format` and `lint` scripts in the `package.json` files for both the client and server applications.

### Testing

The server application uses Jest for unit and end-to-end testing. The following commands are available in the `apps/server` directory:

*   `pnpm test`: Runs all tests.
*   `pnpm test:watch`: Runs tests in watch mode.
*   `pnpm test:cov`: Runs tests and generates a coverage report.
*   `pnpm test:e2e`: Runs end-to-end tests.

### Migrations

The server application uses `kysely-migration-cli` for database migrations. The following commands are available in the `apps/server` directory:

*   `pnpm migration:create`: Creates a new migration file.
*   `pnpm migration:up`: Applies all pending migrations.
*   `pnpm migration:down`: Reverts the last migration.
*   `pnpm migration:latest`: Applies all pending migrations.
