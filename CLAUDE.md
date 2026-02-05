# SaaS Data Platform on Kubernetes

Multi-tenant SaaS data platform with control plane API and UI for managing accounts, workspaces, and cluster agents on Kubernetes-based infrastructure.

## Architecture

```
┌─────────────────────┐     ┌─────────────────────┐
│  control-plane-ui   │────▶│  control-plane-api  │
│  (React Admin)      │     │  (Express + tsoa)   │
└─────────────────────┘     └──────────┬──────────┘
                                       │
                    ┌──────────────────┼──────────────────┐
                    ▼                  ▼                  ▼
             ┌───────────┐      ┌───────────┐      ┌───────────┐
             │ PostgreSQL│      │  Keycloak │      │  Cerbos   │
             │ (Prisma)  │      │  (Auth)   │      │  (Authz)  │
             └───────────┘      └───────────┘      └───────────┘
```

## Tech Stack

| Component | Technology |
|-----------|------------|
| API | Express 5, tsoa, Prisma, PostgreSQL |
| UI | React Admin, shadcn/ui, Vite |
| Auth | Keycloak (JWT) |
| Authorization | Cerbos (RBAC/ABAC) |
| Workflows | Temporal |

## Quick Reference

### API Commands (control-plane-api)
```bash
pnpm run dev:init    # Regenerate tsoa routes (after controller changes)
pnpm run dev         # Start API + workers
pnpm exec tsc --noEmit  # Type check
```

### UI Commands (control-plane-ui)
```bash
npm run dev          # Start dev server
npm run build        # Build for production
```

### Database Commands
```bash
pnpm exec prisma migrate dev     # Run migrations
pnpm exec prisma generate        # Generate client
```

## API Patterns

### File Structure
```
control-plane-api/src/domains/{resource}/
├── {resource}.controller.ts  # tsoa controller
├── {resource}.service.ts     # Business logic
├── {resource}.type.ts        # TypeScript interfaces
└── {resource}.select.ts      # Prisma select objects
```

### Controller Pattern
```typescript
@Route('resources')
@Tags('Resources')
@Middlewares(authenticationMiddleware)  // Omit for public routes
export class ResourceController extends Controller {
  @Get('/')
  @SuccessResponse(200)
  public async list(@Request() req: express.Request): Promise<Response> {
    return await ResourceService.list({ principal: req.principal });
  }
}
```

### Service Pattern
```typescript
export async function createResource({ principal, data }) {
  // 1. Check permissions
  await checkPermission({
    principal,
    resource: { kind: 'resource', id: '*' },
    action: 'resource:create',
  });

  // 2. Use transactions for multi-step ops
  return await prisma.$transaction(async (tx) => {
    // ... business logic
  });
}
```

### Error Handling
```typescript
import { HttpError } from '@/types/errors';
throw new HttpError(404, 'Not found');
throw new HttpError(400, 'Validation error');
throw new HttpError(401, 'Invalid token');
throw new HttpError(403, 'Forbidden');
throw new HttpError(409, 'Already exists');
```

## UI Patterns

### File Structure
```
control-plane-ui/src/
├── resources/        # React Admin resources (List, Show, Create)
├── components/
│   ├── admin/        # React Admin wrappers
│   ├── ui/           # shadcn/ui components
│   └── custom/       # Custom components
├── dataProvider.ts   # API integration
└── authProvider.ts   # Keycloak auth
```

### Show Page Pattern
```typescript
export const ResourceShow = () => (
  <Show title="Resource">
    <div className="flex flex-col gap-4">
      <RecordField source="field" label="Label" />
      <RecordField source="nested.field" label="Nested" />
      <RecordField
        source="copyable"
        render={(record) => <CopyCell value={record.copyable} />}
      />
    </div>
  </Show>
)
```

## Data Model

### Entity Hierarchy
```
Account
  └── Workspace
        └── WorkspaceClusterAgent
              └── BootstrapToken
```

### Platform Providers
- `KUBERNETES` - Generic Kubernetes
- `AWS_EKS` - Amazon EKS
- `ALICLOUD_ACK` - Alibaba ACK

### Agent Status Flow
```
PendingRegistration → Active → Suspended / Deleted
```

### Workspace Status Flow
```
PENDING → CREATING → RUNNING → UPDATING → DELETING → DELETED
          ↓           ↓          ↓          ↓
     CREATE_FAILED  (running) UPDATE_FAILED DELETE_FAILED
```

## Conventions

- Use `uid` for public-facing IDs, `id` for internal bigint
- Soft delete with `deletedAt` timestamp
- Principal-based identity (users, agents, service accounts)
- React Admin maps `uid` → `id` in dataProvider
- Run `pnpm run dev:init` after any controller changes

## Adding New Features

### New API Endpoint
1. Add types in `{resource}.type.ts`
2. Add service function in `{resource}.service.ts`
3. Add controller method with tsoa decorators
4. Run `pnpm run dev:init`

### New UI Field
1. Update Prisma select in `{resource}.select.ts`
2. Add `<RecordField source="field" label="Label" />` to Show/List

### New Resource (full CRUD)
1. Create domain folder: `src/domains/{resource}/`
2. Add controller, service, type, select files
3. Register in tsoa (auto via decorators)
4. Create UI resource components
5. Add to React Admin routes
