import { Module } from '@nestjs/common';
import { LicenceModule } from './licence/licence.module';
import { ApiKeyModule } from './api-key/api-key.module';
import { AuditEeModule } from './audit/audit.module';
import { MfaModule } from './mfa/mfa.module';
import { PagePermissionModule } from './page-permission/page-permission.module';
import { TemplateModule } from './template/template.module';
import { ScimModule } from './scim/scim.module';
import { PageVerificationModule } from './page-verification/page-verification.module';
import { PersonalSpaceModule } from './personal-space/personal-space.module';
import { SsoModule } from './sso/sso.module';
import { SsoAuthModule } from './sso-auth/sso-auth.module';
import { AiChatModule } from './ai-chat/ai-chat.module';
import { AiModule } from './ai/ai.module';
import { BillingModule } from './billing/billing.module';
import { BaseModule } from './base/base.module';
import { CommentEeModule } from './comment/comment.module';
import { DocumentImportModule } from './document-import/document-import.module';
import { ConfluenceImportModule } from './confluence-import/confluence-import.module';
import { AttachmentEeModule } from './attachments-ee/attachment-ee.module';
import { TypesenseEeModule } from './typesense/typesense.module';
import { DocxExportModule } from './docx-export/docx-export.module';
import { PdfExportModule } from './pdf-export/pdf-export.module';
import { McpModule } from './mcp/mcp.module';
import { FeatureGateGuard } from './common/guards/feature-gate.guard';

@Module({
  imports: [
    LicenceModule,
    AuditEeModule,
    ApiKeyModule,
    MfaModule,
    PagePermissionModule,
    TemplateModule,
    ScimModule,
    PageVerificationModule,
    PersonalSpaceModule,
    SsoModule,
    SsoAuthModule,
    AiChatModule,
    AiModule,
    BillingModule,
    BaseModule,
    CommentEeModule,
    DocumentImportModule,
    ConfluenceImportModule,
    AttachmentEeModule,
    TypesenseEeModule,
    DocxExportModule,
    PdfExportModule,
    McpModule,
  ],
  providers: [FeatureGateGuard],
  exports: [
    LicenceModule,
    ApiKeyModule,
    MfaModule,
    ScimModule,
    BaseModule,
    DocumentImportModule,
    ConfluenceImportModule,
    AttachmentEeModule,
    TypesenseEeModule,
    PdfExportModule,
  ],
})
export class EeModule {}
