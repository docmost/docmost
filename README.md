<div align="center">
    <h1><b>Docmost</b></h1>
    <p>
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

## Release automation

Pushing a tag like `v1.0.3` triggers [`.github/workflows/release.yml`](.github/workflows/release.yml). The workflow will:

- build and push `ghcr.io/<owner>/<repo>:v1.0.3`
- push the tag to the mirror repository and create/update a GitHub release
- optionally call `1panel-cli deploy-compose-update` to update the `docmost` service image in 1Panel

To enable the 1Panel deployment step, configure these repository settings in GitHub Actions:

- Variable `ONEPANEL_COMPOSE_NAME`: for example `wiki`
- Variable `ONEPANEL_COMPOSE_PATH`: for example `/opt/1panel/docker/compose/wiki/docker-compose.yml`
- Optional variable `ONEPANEL_IMAGE_NAME`: override the image name used for deployment, for example `ghcr.io/ssigpoy/docmost`
- Optional variable `ONEPANEL_CLI_VERSION`: defaults to `v0.1.6`
- Secret `ONEPANEL_HOST`: for example `120.234.52.52`
- Secret `ONEPANEL_PORT`: for example `34583`
- Secret `ONEPANEL_API_KEY`: the 1Panel API key

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

