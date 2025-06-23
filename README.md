> [!WARNING]
> Do not use in current state. I will remove this in the next few days when it should be usable without any new bugs. Until then, I will also merge some new PRs.

> [!NOTE]
> This is a custom, updated fork of Docmost, optimized for personal and educational use, especially for sharing with multiple different users. It also includes features that Docmost is either "too" slow to add or chooses not to include, sometimes because they are behind a paywall or because Docmost aims to "keep it simple." (No judgment)
> 
> I do not guarantee that this fork will be maintained. I have also removed some features that others might find useful and may have introduced some bugs.
> 
> The re-branding to "Bettermost" is not an assertion that this fork is superior in any way; rather, the original name is held by Docmost and I do not want any conflicts going on.
> 
> For added/merged features, see the note at Features.

<div align="center">
    <h1><b>Fork of Docmost</b></h1>
    <p>
        All rights and naming of Docmost belong to Docmost
        Open-source collaborative wiki and documentation software.
        <br />
        <a href="https://docmost.com"><strong>Website</strong></a> | 
        <a href="https://docmost.com/docs"><strong>Documentation</strong></a> |
        <a href="https://twitter.com/DocmostHQ"><strong>Twitter / X</strong></a>
    </p>
</div>
<br />

## Getting started

To get started with Docmost, please refer to our [documentation](https://docmost.com/docs) or try our [cloud version](https://docmost.com/pricing) .

## Features

- Real-time collaboration
- Diagrams (Draw.io, Excalidraw and Mermaid)
- Spaces
- Permissions management
- Groups
- Comments
- Page history
- Search
- File attachments
- Embeds (Airtable, Loom, Miro and more)
- Translations (10+ languages)

> [!NOTE]
> The following features or changes have been added to this fork:
> - The "Docmost" branding has been removed from the editor when sharing (but moved to the header)
> - Users who are not in the same space (and the user viewing needs at least edit permissions) are hidden
> - Group members are hidden unless you are an admin or owner
> - Allow users to change their email address
> - Open links in edit mode with ctrl
> - Added audio extension support <- Do not use if you want to go back
> - Use more blocks in tables (like bullet list, todo, ...)
> 
> The following PRs have been merged into this fork pre Docmost (or closed in Docmost):
> - ctrl/cmd-s by fuscodev
> - shared-page-width-toggle by sanua356
> - extra-ligatures by Webblitchy
> - highlight-support by fuscodev (Edit: Addition so clicking on default colors automatically applies the highlight color)
> - float-image by fuscodev <- Do not use if you want to go back
> - add-more-headings by sanua356 (Edit: Only show headings 1-3 in ToC)

### Screenshots

<p align="center">
<img alt="home" src="https://docmost.com/screenshots/home.png" width="70%">
<img alt="editor" src="https://docmost.com/screenshots/editor.png" width="70%">
</p>

### License
Docmost core is licensed under the open-source AGPL 3.0 license.  
Enterprise features are available under an enterprise license (Enterprise Edition).  

All files in the following directories are licensed under the Docmost Enterprise license defined in `packages/ee/License`.
  - apps/server/src/ee
  - apps/client/src/ee
  - packages/ee

### Contributing

See the [development documentation](https://docmost.com/docs/self-hosting/development)

## Thanks
Special thanks to;

<img width="100" alt="Crowdin" src="https://github.com/user-attachments/assets/a6c3d352-e41b-448d-b6cd-3fbca3109f07" />

[Crowdin](https://crowdin.com/) for providing access to their localization platform.


<img width="48" alt="Algolia-mark-square-white" src="https://github.com/user-attachments/assets/6ccad04a-9589-4965-b6a1-d5cb1f4f9e94" />

[Algolia](https://www.algolia.com/) for providing full-text search to the docs.

