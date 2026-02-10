# Control Plane API Service (TypeScript)

An implementation of control plane API using [Express.js](https://expressjs.com/) and [TypeScript](https://www.typescriptlang.org/).
Included also workflow management using [Temporal](https://temporal.io).

## Quickstart

### Prepare Prerequisites
```bash
# Install node js
sudo apt install nodejs

# Install PNPM
wget -qO- https://get.pnpm.io/install.sh | sh -

# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc

# To install and use the latest Long-Term Support (LTS) version of Node.js using nvm,run the following
nvm install --lts
nvm use --lts
```

Create a `.env` file based on `.env.example`.

### Run Supporting Services
```bash
docker compose up -d
```

### TLS & mTLS Architecture

Express serves **plain HTTP**. TLS and mTLS are handled by the reverse proxy:

- **Local dev**: Caddy (in docker-compose) terminates TLS, verifies agent client certs, and forwards identity via headers
- **Kubernetes**: nginx ingress does the same

```
Agent ──mTLS──▶ Reverse Proxy ──HTTP──▶ Express (reads headers)
                (Caddy / nginx)
```

The API still **issues** agent certificates via Step CA during registration (`CertService`).
It just no longer terminates TLS or verifies certs itself.

#### Prepare CA Issuer .env values

The `STEP_CA_*` variables are used by `CertService` to issue agent mTLS certificates.

Get the value for `STEP_CA_JWK_PRIVATE_KEY`:
```bash
jq -r '.authority.provisioners[0].encryptedKey' ../docker/step-ca/config/ca.json | \
  step crypto jwe decrypt --password-file=../docker/step-ca/secrets/password
```

Add to `.env`:
```bash
CA_PROVIDER=step-ca
STEP_CA_URL=https://ca.saas.internal:9000
STEP_CA_ROOT=../docker/step-ca/certs/root_ca.crt
STEP_CA_INTERMEDIATE=../docker/step-ca/certs/intermediate_ca.crt
STEP_CA_PROVISIONER=admin
STEP_CA_JWK_PRIVATE_KEY=<result of jq command above>
```

### Development
Next, run this:

```bash
# Install dependencies
pnpm install

# Initialise development (generate tsoa spec & routes)
npx prisma migrate
pnpm dev:init

# [OPTIONAL] Copy the generated swagger to docs
cp src/openapi/swagger.yaml ../docs/static/openapi/control-plane.yaml

# Installs and runs Prisma Migrate in dev mode to apply changes to the database, create a migration file if needed, and generate the Prisma client.
npx prisma migrate dev

# Generates the Prisma Client based on your schema.
npx prisma generate

# Runs the seed script to add initial data to the database, useful for local testing or resetting the DB
pnpm seed

# Run development server
pnpm dev

# Reset database & seed
npx prisma migrate reset
```

Control Plane API service will be accessible on **http://localhost:3000** and API docs can be accessed on **http://localhost:3000/docs**.

### Tests
```bash
cd control-plane-api

# 1. Start test services
docker compose -f docker-compose.test.yaml up -d

# 2. Wait for keycloak to be healthy (~30s)
docker compose -f docker-compose.test.yaml ps

# 3. Run tests
pnpm test

# 4. Tear down
docker compose -f docker-compose.test.yaml down -v
```

---

## Features

- **TypeScript Support**: Leverages TypeScript for type safety and improved developer experience.
- **Express.js Framework**: Utilizes Express.js for handling HTTP requests and routing.
- **ESLint & Prettier**: Integrated for consistent code formatting and linting.
- **Modular Structure**: Organized project structure promoting scalability and maintainability.
- **Environment Configuration**: Manage environment variables seamlessly using `.env` files.
- **Package Management with pnpm**: Efficient and fast package management using [pnpm](https://pnpm.io/).

## Prisma: ORM & Database Migration

In this repository, we use Prisma as the ORM and migration tool.

### Prisma CLI

- **Prisma commands cheatsheets**

| Description                                                                                              | Command                      | Notes                                                                                  |
| -------------------------------------------------------------------------------------------------------- | ---------------------------- | -------------------------------------------------------------------------------------- |
| Generate artifacts (e.g. Prisma Client)                                                                  | `$ npx prisma generate`      | Run after updating `schema.prisma` to regenerate the client code.                      |
| Browse your data ([http://localhost:5555](http://localhost:5555) locally)                                | `$ npx prisma studio`        | Opens a web UI to view and edit data directly in your database.                        |
| Create migrations from your Prisma schema, apply them to the DB, generate artifacts (e.g. Prisma Client) | `$ npx prisma migrate dev`   | Best used in development; creates and applies migrations automatically.                |
| Pull the schema from an existing database, updating the Prisma schema                                    | `$ npx prisma db pull`       | Good for reverse-engineering an existing database into Prisma format.                  |
| Push the Prisma schema state to the database                                                             | `$ npx prisma db push`       | Directly updates the database to match schema (no migration history, caution in prod). |
| Validate your Prisma schema                                                                              | `$ npx prisma validate`      | Checks if your schema file is valid.                                                   |
| Format your Prisma schema                                                                                | `$ npx prisma format`        | Auto-formats the `schema.prisma` file for consistency.                                 |
| Display Prisma version info                                                                              | `$ npx prisma version`       | Shows CLI and client versions.                                                         |
| Display Prisma debug info                                                                                | `$ npx prisma debug`         | Useful for diagnosing issues; shows environment info.                                  |
| If needed, reset the local DB (⚠️ deletes all data)                                                      | `$ npx prisma migrate reset` | Drops all data and reapplies migrations — great for starting fresh in development.     |

### Prisma Development Flow

#### 1. Make model changes (Local)

Modify your `schema.prisma`.

#### 2. Preview the migration (Local, no DB changes yet)

```bash
npx prisma migrate dev --name add_initial_tables --create-only
```

#### 3. Review the generated SQL (Local, no DB changes yet)

Open `prisma/migrations/.../migration.sql` to inspect.

#### 4. Cancel or iterate (Local, no DB changes yet)

If it's not correct:

1. Fix the model
2. Delete the last created migration folder(s)
3. Repeat step 1–3

#### 5. Apply and test the migration (Local)

```bash
npx prisma migrate dev --name add_initial_tables
```

That will:

- Applies migration to your local DB
- Updates \_prisma_migrations
- Regenerates Prisma Client
- Runs prisma/seed.ts (if set up)

#### 6. Review changes in DB (Local)

Use `npx prisma studio`, raw SQL, or DB client to verify.
You can also use https://prismaliser.app/ to visualize.

##### 7. Revert the migration (Local)

If needed, reset the local DB (⚠️ deletes all data):

```bash
npx prisma migrate reset
```

You’ll be prompted to confirm.

### Running the Application

| Description                     | Command                    |
| ------------------------------- | -------------------------- |
| Create and migrate the local DB | `$ npx prisma migrate dev` |
| Regenerate Prisma client DB     | `$ npx prisma generate`    |
| Seed DB                         | `$ pnpm seed`              |
| Development mode                | `$ pnpm dev`               |
| Linting & Formatting            | `$ pnpm lint`              |
| Test                            | `$ pnpm test`              |
| Generate production build       | `$ pnpm build`             |

### Running Temporal Workers

| Description                   | Command                                   |
| ----------------------------- | ----------------------------------------- |
| Workspace Provisioning worker | `$ pnpm dev:worker:workspaceProvisioning` |
| Cluster Provisioning worker   | `$ pnpm dev:worker:clusterProvisioning`   |

The Temporal workers are responsible to perform platform provisioning
