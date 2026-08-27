import { Logger } from '@nestjs/common';
import { AuthProviderGroupMappingRepo } from '@docmost/db/repos/auth-provider/auth-provider-group-mapping.repo';
import { AuthProviderRepo } from '@docmost/db/repos/auth-provider/auth-provider.repo';
import { GoogleGroupsService } from '../../../core/auth/sso/services/google-groups.service';
import { GoogleProvisioningService } from '../../../core/auth/sso/services/google-provisioning.service';
import { IGoogleGroupSyncJob } from '../constants/queue.interface';

const logger = new Logger('GoogleGroupSyncTask');

/**
 * Admin-triggered full resync. Walks each mapping, pulls the Google group's
 * members, and reconciles the corresponding Docmost group. One failing mapping
 * is recorded against that mapping and does not abort the rest.
 */
export async function processGoogleGroupSync(
  deps: {
    authProviderRepo: AuthProviderRepo;
    mappingRepo: AuthProviderGroupMappingRepo;
    googleGroupsService: GoogleGroupsService;
    provisioningService: GoogleProvisioningService;
  },
  data: IGoogleGroupSyncJob,
): Promise<void> {
  const { mappingRepo, googleGroupsService, provisioningService } = deps;

  if (!googleGroupsService.isConfigured()) {
    logger.warn(
      'Google group sync requested but GOOGLE_SERVICE_ACCOUNT_KEY is not set',
    );
    return;
  }

  const provider = await deps.authProviderRepo.findGoogleProvider(
    data.workspaceId,
  );

  if (!provider?.groupSync) {
    logger.debug(
      `Google group sync skipped: disabled for workspace ${data.workspaceId}`,
    );
    return;
  }

  const all = await mappingRepo.findByWorkspace(data.workspaceId);
  const mappings = data.mappingId
    ? all.filter((m) => m.id === data.mappingId)
    : all;

  for (const mapping of mappings) {
    try {
      const memberEmails = await googleGroupsService.listGroupMemberEmails(
        mapping.externalGroupKey,
      );

      const result = await provisioningService.syncMapping(
        mapping,
        memberEmails,
      );

      await mappingRepo.recordSyncResult(mapping.id, 'success', null);

      logger.debug(
        `Synced ${mapping.externalGroupKey} -> ${mapping.groupName}: ` +
          `+${result.added} -${result.removed}, ${result.skipped} without a Docmost account`,
      );
    } catch (err: any) {
      logger.error(
        `Failed syncing ${mapping.externalGroupKey}: ${err?.message}`,
      );
      await mappingRepo.recordSyncResult(
        mapping.id,
        'error',
        err?.message ?? 'Unknown error',
      );
    }
  }
}
