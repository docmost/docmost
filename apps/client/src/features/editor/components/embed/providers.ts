export interface IEmbedProvider {
  name: string;
  regex: RegExp;
  getEmbedUrl: (match: RegExpMatchArray) => string;
}

export const embedProviders: IEmbedProvider[] = [
  {
    name: 'Loom',
    regex:  /^https?:\/\/(?:www\.)?loom\.com\/(?:share|embed)\/([\da-zA-Z]+)\/?/,
    getEmbedUrl: (match) => {
      return `https://loom.com/embed/${match[1]}`;
    }
  },
];

export function getEmbedProviderByName(name: string) {
  return embedProviders.find(provider => provider.name.toLowerCase() === name.toLowerCase());
}


export interface IEmbedResult {
  embedUrl: string;
  provider: string;
}

export function getEmbedUrlAndProvider(url: string): IEmbedResult {
  for (const provider of embedProviders) {
    const match = url.match(provider.regex);
    if (match) {
      return {
        embedUrl: provider.getEmbedUrl(match),
        provider: provider.name.toLowerCase()
      };
    }
  }
  return {
    embedUrl: url,
    provider: 'iframe',
  };
}


