"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const ability_1 = require("@casl/ability");
const permission_1 = require("../../../common/helpers/types/permission");
const space_member_repo_1 = require("../../../database/repos/space/space-member.repo");
const space_ability_type_1 = require("../interfaces/space-ability.type");
const utils_1 = require("../../../database/repos/space/utils");
let SpaceAbilityFactory = class SpaceAbilityFactory {
    constructor(spaceMemberRepo) {
        this.spaceMemberRepo = spaceMemberRepo;
    }
    async createForUser(user, spaceId) {
        const userSpaceRoles = await this.spaceMemberRepo.getUserSpaceRoles(user.id, spaceId);
        const userSpaceRole = (0, utils_1.findHighestUserSpaceRole)(userSpaceRoles);
        switch (userSpaceRole) {
            case permission_1.SpaceRole.ADMIN:
                return buildSpaceAdminAbility();
            case permission_1.SpaceRole.WRITER:
                return buildSpaceWriterAbility();
            case permission_1.SpaceRole.READER:
                return buildSpaceReaderAbility();
            default:
                throw new common_1.NotFoundException('Space permissions not found');
        }
    }
};
SpaceAbilityFactory = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [space_member_repo_1.SpaceMemberRepo])
], SpaceAbilityFactory);
exports.default = SpaceAbilityFactory;
function buildSpaceAdminAbility() {
    const { can, build } = new ability_1.AbilityBuilder(ability_1.createMongoAbility);
    can(space_ability_type_1.SpaceCaslAction.Manage, space_ability_type_1.SpaceCaslSubject.Settings);
    can(space_ability_type_1.SpaceCaslAction.Manage, space_ability_type_1.SpaceCaslSubject.Member);
    can(space_ability_type_1.SpaceCaslAction.Manage, space_ability_type_1.SpaceCaslSubject.Page);
    can(space_ability_type_1.SpaceCaslAction.Manage, space_ability_type_1.SpaceCaslSubject.Share);
    return build();
}
function buildSpaceWriterAbility() {
    const { can, build } = new ability_1.AbilityBuilder(ability_1.createMongoAbility);
    can(space_ability_type_1.SpaceCaslAction.Read, space_ability_type_1.SpaceCaslSubject.Settings);
    can(space_ability_type_1.SpaceCaslAction.Read, space_ability_type_1.SpaceCaslSubject.Member);
    can(space_ability_type_1.SpaceCaslAction.Manage, space_ability_type_1.SpaceCaslSubject.Page);
    can(space_ability_type_1.SpaceCaslAction.Manage, space_ability_type_1.SpaceCaslSubject.Share);
    return build();
}
function buildSpaceReaderAbility() {
    const { can, build } = new ability_1.AbilityBuilder(ability_1.createMongoAbility);
    can(space_ability_type_1.SpaceCaslAction.Read, space_ability_type_1.SpaceCaslSubject.Settings);
    can(space_ability_type_1.SpaceCaslAction.Read, space_ability_type_1.SpaceCaslSubject.Member);
    can(space_ability_type_1.SpaceCaslAction.Read, space_ability_type_1.SpaceCaslSubject.Page);
    can(space_ability_type_1.SpaceCaslAction.Read, space_ability_type_1.SpaceCaslSubject.Share);
    return build();
}
//# sourceMappingURL=space-ability.factory.js.map