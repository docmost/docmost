FROM mcr.microsoft.com/devcontainers/typescript-node:24-bookworm

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get -y install --no-install-recommends postgresql-client fzf micro && apt-get clean && rm -rf /var/lib/apt/lists/*

USER node
WORKDIR /home/node

COPY --chown=node:node .devcontainer/install-zinit.sh install-zinit.sh
COPY --chown=node:node .devcontainer/.zshrc .zshrc

RUN chmod +x ./install-zinit.sh && ./install-zinit.sh && rm ./install-zinit.sh
