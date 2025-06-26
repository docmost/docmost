> [!NOTE]
> This is a custom, updated fork of Docmost, optimized for personal and educational use, especially for sharing with multiple different users. It also includes features that Docmost is either "too" slow to add or chooses not to include, sometimes because they are behind a paywall or because Docmost aims to "keep it simple." (No judgment)
> 
> I do not guarantee that this fork will be maintained. I have also removed some features that others might find useful and may have introduced some bugs.
> 
> For added/merged features, see the note at Features.

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
> - The "Docmost" branding has been removed from the editor when sharing (but moved to the header - Now Forkmost)
> - Users who are not in the same space (and the user viewing needs at least edit permissions) are hidden
> - Group members are hidden unless you are an admin or owner
> - Allow users to change their email address
> - Open links in edit mode with ctrl
> - Added audio extension support <- Do not use if you want to go back
> - Use more blocks in tables (like bullet list, todo, ...)
> - Custom emoji in callouts
> - Added more options to code blocks (See https://github.com/docmost/docmost/pull/1298)
> - Added PWA support (Based on docmost pull request #614)
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
Enterprise features are available under an enterprise license (Enterprise Edition).  <-- Not available in this fork

All files in the following directories are licensed under the Docmost Enterprise license defined in `packages/ee/License`.
  - apps/server/src/ee
  - apps/client/src/ee
  - packages/ee

### Contributing

See the [development documentation](https://docmost.com/docs/self-hosting/development) of Docmost which Forkmost follows

## Thanks

See [Docmost#Thanks](https://github.com/docmost/docmost?tab=readme-ov-file#thanks)

