import { Injectable } from '@nestjs/common';
import { SearchDTO, SearchSuggestionDTO } from './dto/search.dto';
import { SearchResponseDto } from './dto/search-response.dto';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';
import { UserRepo } from '@docmost/db/repos/user/user.repo';
import { GroupRepo } from '@docmost/db/repos/group/group.repo';

@Injectable()
export class SearchService {
  constructor(
    private readonly pageRepo: PageRepo,
    private readonly userRepo: UserRepo,
    private readonly groupRepo: GroupRepo,
    private readonly spaceMemberRepo: SpaceMemberRepo,
  ) {}

  async searchPage(
    query: string,
    searchParams: SearchDTO,
  ): Promise<SearchResponseDto[]> {
    if (query.length < 1) {
      return;
    }
    const queryResults = await this.pageRepo.searchForPage(query, searchParams);

    const searchResults = queryResults.map((result) => {
      if (result.highlight) {
        result.highlight = result.highlight
          .replace(/\r\n|\r|\n/g, ' ')
          .replace(/\s+/g, ' ');
      }
      return result;
    });

    return searchResults;
  }

  async searchSuggestions(
    suggestion: SearchSuggestionDTO,
    userId: string,
    workspaceId: string,
  ) {
    let users = [];
    let groups = [];
    let pages = [];

    const limit = suggestion?.limit || 10;
    const query = suggestion.query.toLowerCase().trim();

    if (suggestion.includeUsers) {
      users = await this.userRepo.searchSuggestionsUsers(
        query,
        workspaceId,
        limit,
      );
    }

    if (suggestion.includeGroups) {
      groups = await this.groupRepo.searchSuggestionsGroups(
        query,
        workspaceId,
        limit,
      );
    }

    if (suggestion.includePages) {
      pages = await this.pageRepo.searchSuggestionsPages(
        query,
        limit,
        workspaceId,
        userId,
        suggestion.spaceId,
      );
    }

    return { users, groups, pages };
  }
}
