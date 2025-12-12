# Forkmost

> [!NOTE]
> This is a custom, updated fork of Docmost, optimized for personal and educational use, especially for sharing with multiple different users. It also includes features that Docmost is either "too" slow to add or chooses not to include, sometimes because they are behind a paywall or because Docmost aims to "keep it simple." (No judgment)
>
> I cannot promise that I will keep maintaining this fork forever as I primarily do it for myself, but I will do so as long as the license allows and I actively use Docmost. I have also taken out some features that others might find helpful, and I may have added some bugs. As per license this can be forked at any time

> [!IMPORTANT]
> Everything is my opinion!\
> I am slowly looking for an alternative to Docmost/Forkmost.  
The project is great and has many useful features. But I prefer open-source projects, and Docmost is becoming more closed-source, locking basic security features behind a paywall that hides behind a non-public pricing page.
> 
> Docmost is still great software, but I don't want to maintain and contribute to a project that is getting more and more closed-source in an open-source community.
> 
> When I started using Docmost, there were clear pricing structures for every plan. The pricing was transparent. The cost of the cloud version (non self-hosted) was visible (now it's completely gone - there isn't even any mention of the cloud version anymore. You have to sign up to see pricing). Now there's only one option that says "contact sales." No transparency, just "greedy" and unclear pricing that makes it impossible to compare. And remember, basic security features are locked behind this. Even for self-hosted....
> 
> In addition to this, the maintainer intentionally blocks community contributions. The only maintainer barely reviews any PRs or provides status updates. They often say a feature is planned for the Enterprise Edition (EE) after a PR is opened (which is fine, BUT he (my assumption!) intentionally does not say what will be in EE. So there is no way to know before). And for some , then sortly-later implement that same feature in EE (what is that supposed to be?). The maintainer also ignores questions related to EE. I asked multiple times if (in general or specific features) would be part of EE - silence every time. Even small PRs take months to be reviewed and merged even when stated otherwise.
> 
> The number of EE-only PRs has grown a lot, again including features that would benefit everyone, like APIs and API keys - all hidden behind the unclear paid version.
> 
> There is nothing wrong with paying for a product; developers need to earn money somehow. But hiding basic security features behind a paywall that isn't visible unless you contact the team to get some unclear pricing that could change anytime or differ between people is simply wrong, especially when you host it on your own servers.
> 
> This won't be an option for everyone, but I switched to Typst for regular document writing. I'm still searching for a better alternative for collab and will maintain this project until I find one. After that, I'll keep maintaining the fork for a few more months to support future releases. If someone wants to further maintain the project, please contact me.

## **For added and features merged ahead, see the note under Features.**

<div align="center">
    <h1><b>Forkmost</b></h1>
    <p>
        <p>Open-source collaborative wiki and documentation software.</p>
        <p>View the awesome original project (not associated with this fork other than being a fork of Docmost): <a href="https://docmost.com">Docmost</a></p>
        <p>Renaming was done to avoid confusion and comply with trademark rights with the original project. Forkmost does not have any cloud nor enterprise features and is intended for personal use.</p>
    </p>
</div>
<br />

## Getting started

To get started with Forkmost, please refer to the Docmost [documentation](https://docmost.com/docs).

## Versioning

Forkmost uses the same versioning as upstream. The tags use this format: `vX.Y.Z.W`, where:

- `X`, `Y`, and `Z` are the version numbers from upstream
- `W` is the version number for this fork, starting at 0 for each new upstream release and increasing with each minor release in this fork

For Docker, these tags are available:

- `dev` - The newest development version of Forkmost. It should be stable, but it might have bugs.
- `latest` - The newest stable version of Forkmost. This matches `vX.Y.Z.W`.
- `vX.Y.Z.W` - A specific version of Forkmost.
- `vX.Y.Z` - The newest version of Forkmost for the upstream version `X.Y.Z`. This matches `vX.Y.Z.latest`.

> [!IMPORTANT]  
> Rolling back to Docmost is not supported and has not been tested. It is unclear if the migrations will work if you try to return to Docmost. Even if they do work, all blocks that were added in Forkmost but do not exist in Docmost will be lost and cannot be recovered.  
> This includes, but is not limited to, the following blocks: Highlight, Audio, Column layout, and more.

## Features

### Core Features

- Real-time collaboration
- Diagrams (Draw.io, Excalidraw, and Mermaid)
- Spaces
- Permissions management
- Groups
- Comments
- Page history
- Search
- File attachments (Video, audio, images, PDF)
- Embeds (Airtable, Loom, Miro, and more)
- Translations (10+ languages)
- public sharing (with optional password protection)
- free SSO with **OIDC** (tested with Authentik)

---

#### Fork-Specific Enhancements

<details>

<summary>Expand for merged or pre-fork pull requests</summary>

- "Docmost" branding removed from the editor when sharing (moved to header as "Forkmost")
- Users not in the same space (and without at least edit permissions) are hidden
- Group members are hidden unless you are an admin or owner
- Allow users to change their email address
- Open links in edit mode with Ctrl
- Added audio extension support[^2]
- Use more blocks in tables (e.g., bullet list, todo, etc.)
- Custom emoji in callouts
- More options for code blocks ([see details](https://github.com/docmost/docmost/pull/1298))
- PWA support ([based on](https://github.com/docmost/docmost/pull/1298))
- Anchor link support for page mentions
- Password-protected pages
- PDF embedding support. Allows to set PDFs for all participants to view

</details>

<br>

---

#### Merged or Pre-Fork Pull Requests

<details>

<summary>Expand for merged or pre-fork pull requests</summary>

List as follows[^1]:

[^1]: Footnotes are used to indicate any changes made to the original pull request or any additional information.

- **ctrl/cmd-s** by fuscodev[^3]
- **shared-page-width-toggle** by sanua356
- **extra-ligatures** by Webblitchy
- **highlight-support** by fuscodev[^4]
- **float-image** by fuscodev[^2]
- **add-more-headings** by sanua356[^5]
- **anchor-link** by fuscodev[^6]
- **forkmost/aside-pref** by fuscodev
- **forkmost/breadcrumb-mentions** by fuscodev
- **sanitize-tree-export-space** by fuscodev
- **forkmost/find-and-replace** by fuscodev[^7]
- **forkmost/colum-layout** by fuscodev[^2]
- **forkmost/spellcheck-pref** by fuscodev

</details>

[^2]: Do not use if you plan to revert to upstream in the future. This is added to features that are not in upstream at the moment or never will. You should be able to always go back to upstream, but used blocks e.g. then are lost and not recoverable.
[^3]: Force saving will save directly to the database
[^4]: Clicking default colors automatically applies highlight color to make it easier to use
[^5]: The Table of Contents (ToC) only displays the first 3 levels of headings.
[^6]: The UI for copying redesigned; scrolling is now faster.
[^7]: Updated UI and shortcuts for find and replace and better UX - Focus

<br>

---

### License

Docmost core is licensed under the open-source AGPL 3.0 license.

Enterprise features (meaning the code not the features itself) from upstream are not allowed due to Docmost license. Pull requests that add enterprise (everything in ee files) features will not be accepted and checks will not pass. See the original [license here](https://github.com/docmost/docmost?tab=readme-ov-file#license).

### Contributing

See the [development documentation](https://docmost.com/docs/self-hosting/development) of Docmost which Forkmost follows

## Thanks

Major thanks to [@fuscodev](https://github.com/fuscodev), who contributed their changes from upstream themselves. Also, many pull requests I merged are based on their work.

Many thanks to [@Philipinho](https://github.com/Philipinho) for the great base, general features, and the good codebase to work with.

Also see [Docmost#Thanks](https://github.com/docmost/docmost?tab=readme-ov-file#thanks)
