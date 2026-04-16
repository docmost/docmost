import { Global, Module } from '@nestjs/common';
import { TokenModule } from '../core/auth/token.module';
import { NotificationModule } from '../core/notification/notification.module';
import { PageModule } from '../core/page/page.module';
import { SearchModule } from '../core/search/search.module';
import { WorkspaceModule } from '../core/workspace/workspace.module';
import { LicenseController } from './licence/license.controller';
import { LicenseService } from './licence/license.service';
import { AUDIT_SERVICE } from '../integrations/audit/audit.service';
import { EeAuditService } from './audit/ee-audit.service';
import { AuditController } from './audit/audit.controller';
import { ApiKeyService } from './api-key/api-key.service';
import { ApiKeyController } from './api-key/api-key.controller';
import { CommentEeController } from './comment/comment-ee.controller';
import { SecurityController } from './security/security.controller';
import { TemplateService } from './template/template.service';
import { TemplateController } from './template/template.controller';
import { MfaService } from './mfa/services/mfa.service';
import { MfaController } from './mfa/mfa.controller';
import { PagePermissionController } from './page-permission/page-permission.controller';
import { PagePermissionService } from './page-permission/page-permission.service';
import { PageVerificationController } from './page-verification/page-verification.controller';
import { PageVerificationService } from './page-verification/page-verification.service';
import { PageVerificationSchedulerService } from './page-verification/page-verification-scheduler.service';
import { AttachmentEeService } from './attachments-ee/attachment-ee.service';
import { PageSearchService } from './typesense/services/page-search.service';
import { McpController } from './mcp/mcp.controller';
import { DocxImportService } from './docx-import/docx-import.service';
import { ConfluenceImportService } from './confluence-import/confluence-import.service';
import { PdfExportService } from './pdf-export/pdf-export.service';
import { PdfExportController } from './pdf-export/pdf-export.controller';
import { OidcAuthService } from './security/oidc-auth.service';

@Global()
@Module({
  imports: [
    TokenModule,
    NotificationModule,
    PageModule,
    SearchModule,
    WorkspaceModule,
  ],
  controllers: [
    AuditController,
    ApiKeyController,
    CommentEeController,
    MfaController,
    McpController,
    PagePermissionController,
    PageVerificationController,
    PdfExportController,
    SecurityController,
    LicenseController,
    TemplateController,
  ],
  providers: [
    {
      provide: AUDIT_SERVICE,
      useClass: EeAuditService,
    },
    EeAuditService,
    ApiKeyService,
    AttachmentEeService,
    ConfluenceImportService,
    DocxImportService,
    LicenseService,
    MfaService,
    PagePermissionService,
    PageSearchService,
    PageVerificationSchedulerService,
    PageVerificationService,
    PdfExportService,
    OidcAuthService,
    TemplateService,
  ],
  exports: [
    AUDIT_SERVICE,
    EeAuditService,
    ApiKeyService,
    AttachmentEeService,
    ConfluenceImportService,
    DocxImportService,
    LicenseService,
    MfaService,
    PagePermissionService,
    PageSearchService,
    PageVerificationSchedulerService,
    PageVerificationService,
    PdfExportService,
    OidcAuthService,
    TemplateService,
  ],
})
export class EeModule {}
