# Plugin Management Documentation

Complete documentation for Docmost plugin system implementation - fork-safe architecture with minimal core changes.

---

## 📋 Documentation Files

### 1. **FORK_SAFE_PLUGIN_ARCHITECTURE.md**
- Strategic approach to minimize merge conflicts with upstream Docmost
- Architecture ensuring only 3 files changed in core (5 lines total)
- Risk assessment showing 99% auto-merge compatibility
- Plugin system completely isolated in EE module

### 2. **PHASE_1_IMPLEMENTATION_PLAN.md** ⭐ START HERE
- **Duration**: 2 weeks (10 working days)
- **Daily breakdown** with specific tasks and file locations
- All code scaffolding provided (TypeScript, SQL, React)
- Testing checklist and success criteria

**Week 1: Backend Infrastructure**
- Day 1-2: Hook interface & database schema (3 migration files)
- Day 3-4: Plugin registry & manager services
- Day 5: Hook registry implementation

**Week 2: API & Frontend**
- Day 1-2: Plugin configuration service
- Day 3: Plugin module & controller (API endpoints)
- Day 4-5: Frontend UI (plugin settings page, components)

### 3. **RECAPTCHA_PLUGIN_POC.md**
- Complete reCAPTCHA v3 plugin specification
- Architecture, database schema, API design
- Frontend components and backend services
- Implementation plan (5 weeks after Phase 1 completion)
- **Status**: Ready to implement AFTER Phase 1 ✅

---

## 🎯 Quick Start

1. **Review Architecture**: Read FORK_SAFE_PLUGIN_ARCHITECTURE.md (10 min)
2. **Understand Plan**: Read PHASE_1_IMPLEMENTATION_PLAN.md (15 min)
3. **Start Implementation**: Follow Day 1 tasks exactly as written

### Day 1 Tasks
- [ ] Create hook interface file: `apps/server/src/core/plugins/plugin-hooks.ts`
- [ ] Create 3 database migration files
- [ ] Run migrations to verify schema

### Success Criteria for Phase 1
✅ Plugin system loads on startup  
✅ Admin can see list of available plugins  
✅ Admin can enable/disable plugins  
✅ Admin can navigate to plugin settings  
✅ Configuration changes persist to database  
✅ Audit trail recorded for all changes  
✅ No core code modified (except hook interface + calls)  
✅ All tests passing  

---

## 📊 Project Status

| Phase | Status | Duration | Start | Notes |
|-------|--------|----------|-------|-------|
| 1: Plugin Infrastructure | 📋 Planned | 2 weeks | Ready | Core hook system, config management, UI |
| 2: reCAPTCHA PoC | 📅 Queued | 2 weeks | After Phase 1 | Bot detection with score-based thresholds |
| 3: Monitoring & Polish | 📅 Queued | 1 week | After Phase 2 | Observability, audit logging, optimization |

**Total Timeline**: ~5-6 weeks for Phases 1-3

---

## 🏗️ Architecture Overview

### Core Changes (3 files, 5 lines)
```
apps/server/src/core/plugins/plugin-hooks.ts     [NEW]
  - CoreHooks enum, HookRegistry interface

apps/server/src/modules/auth/auth.controller.ts  [+4 lines]
  - Hook emission (BEFORE_LOGIN, AFTER_LOGIN, etc.)

main.ts or app.module.ts                          [+1 line]
  - Register PluginModule
```

### EE Plugin System
```
apps/server/src/ee/plugins/
  ├── plugin.registry.ts
  ├── plugin.manager.ts
  ├── hook/hook.registry.ts
  ├── plugin-config/
  │   ├── plugin-config.service.ts
  │   └── plugin-config.repository.ts
  ├── plugins.controller.ts
  ├── plugin.module.ts
  └── migrations/
      ├── 001_plugin_definitions.sql
      ├── 002_plugin_configurations.sql
      └── 003_plugin_audit_logs.sql

apps/client/src/ee/plugins/
  ├── pages/plugin-settings.tsx
  └── components/
      ├── plugin-list.tsx
      └── plugin-config-panel.tsx
```

---

## 🔗 Related Documentation

- **EE_FEATURE_AUDIT.md** - Complete EE feature audit
- **SSO_IMPLEMENTATION_SPEC.md** - SSO integration spec (separate track)
- **IMPLEMENTATION_ROADMAP.md** - Overall project timeline

---

## ❓ FAQ

**Q: Why isolate plugins in EE?**  
A: Minimizes merge conflicts when upgrading from upstream Docmost. Only 5 lines in core.

**Q: When should we start Phase 2 (reCAPTCHA)?**  
A: Only after Phase 1 is complete and tested. Phase 1 is the foundation.

**Q: What's the minimum viable product?**  
A: Admin can toggle plugins on/off and configure settings (Phase 1).

**Q: Can multiple instances of a plugin be configured?**  
A: No, one configuration per workspace. Each plugin is workspace-scoped.

**Q: How are plugin secrets encrypted?**  
A: Using workspace encryption key before storage in database.

---

## 📝 Notes for Implementation

- All code scaffolding is included in PHASE_1_IMPLEMENTATION_PLAN.md
- Copy the code exactly as written to maintain consistency
- Run migrations before starting backend services
- Test each day's work before moving to the next day
- Keep plugin discovery in `plugins/` directory at project root

---

**Last Updated**: 2026-06-28  
**Status**: ✅ Documentation complete, ready for implementation  
**Next Step**: Begin Phase 1 Day 1
