export LC_ALL="en_US.UTF-8"
export EDITOR="micro"
export MICRO_TRUECOLOR=1

autoload -Uz compinit
compinit

### Added by Zinit's installer.
if [[ ! -f $HOME/.zinit/bin/zinit.zsh ]]; then
    print -P "%F{33}▓▒░ %F{220}Installing %F{33}DHARMA%F{220} Initiative Plugin Manager (%F{33}zdharma/zinit%F{220})…%f"
    command mkdir -p "$HOME/.zinit" && command chmod g-rwX "$HOME/.zinit"
    command git clone https://github.com/zdharma-continuum/zinit.git "$HOME/.zinit/bin" && \
        print -P "%F{33}▓▒░ %F{34}Installation successful.%f%b" || \
        print -P "%F{160}▓▒░ The clone has failed.%f%b"
fi

source "$HOME/.zinit/bin/zinit.zsh"
autoload -Uz _zinit
(( ${+_comps} )) && _comps[zinit]=_zinit
### End of Zinit's installer chunk.

zinit light zsh-users/zsh-autosuggestions
zinit light zsh-users/zsh-syntax-highlighting
zinit light spaceship-prompt/spaceship-prompt

SPACESHIP_PROMPT_ORDER=(
  user
  dir
  git
  exec_time
  line_sep
  char
)

HISTFILE="$HOME/.zsh_history"
HISTSIZE=100000
SAVEHIST=100000

setopt HIST_IGNORE_DUPS
setopt HIST_IGNORE_ALL_DUPS
setopt SHARE_HISTORY
setopt AUTO_CD
setopt PROMPT_SUBST

alias ..='cd ..'
alias ...='cd ../..'
alias ....='cd ../../..'

alias ls='eza -lh --group-directories-first --icons=auto'
alias lsa='ls -a'
alias lt='eza --tree --level=2 --long --icons --git'
alias lta='lt -a'
alias ff="fzf --preview 'bat --style=numbers --color=always {}'"

alias m='micro'
alias g='git'
n() { if [ "$#" -eq 0 ]; then nvim .; else nvim "$@"; fi; }

alias gcm='git commit -m'
alias gcam='git commit -a -m'
alias gcad='git commit -a --amend'

alias cat='batcat --theme=base16'
alias catp='batcat --theme=base16 -p'
alias catl='batcat --theme=base16 --list-languages'

alias grep='ag'
alias grepi='ag -i'
alias grepl='ag -l'
alias grepc='ag --count'

alias m='micro'
alias g='git'
