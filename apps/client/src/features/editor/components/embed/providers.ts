export interface IEmbedProvider {
  name: string;
  regex: RegExp;
  getEmbedUrl: (match: RegExpMatchArray, url?: string) => string;
}

export const embedProviders: IEmbedProvider[] = [
  {
    name: 'Loom',
    regex: /^https?:\/\/(?:www\.)?loom\.com\/(?:share|embed)\/([\da-zA-Z]+)\/?/,
    getEmbedUrl: (match) => {
      return `https://loom.com/embed/${match[1]}`;
    }
  },
  {
    name: 'Airtable',
    regex: /^https:\/\/(www.)?airtable.com\/([a-zA-Z0-9]{2,})\/.*/,
    getEmbedUrl: (match, url: string) => {
      const path = url.split('airtable.com/');
      return `https://airtable.com/embed/${path[1]}`;
    }
  },
  {
    name: 'Figma',
    regex: /^https:\/\/[\w\.-]+\.?figma.com\/(file|proto|board|design|slides|deck)\/([0-9a-zA-Z]{22,128})/,
    getEmbedUrl: (match, url: string) => {
      return `https://www.figma.com/embed?url=${url}&embed_host=docmost`;
    }
  },
  {
    name: 'Typeform',
    regex: /^(https?:)?(\/\/)?[\w\.]+\.typeform\.com\/to\/.+/,
    getEmbedUrl: (match, url: string) => {
      return url;
    }
  },
  {
    name: 'Miro',
    regex: /^https:\/\/(www\.)?miro\.com\/app\/board\/([\w-]+=)/,
    getEmbedUrl: (match, url: string) => {
      return `https://miro.com/app/live-embed/${match[2]}?embedMode=view_only_without_ui&autoplay=true&embedSource=docmost`;
    }
  },
  {
    name: 'Vimeo',
    regex: /^(https:)?\/\/(?:www\.|player\.)?vimeo.com\/(?:channels\/(?:\w+\/)?|groups\/([^/]*)\/videos\/|album\/(\d+)\/video\/|video\/|)(\d+)/,
    getEmbedUrl: (match, url: string) => {
      return `https://player.vimeo.com/video/${match[4]}`;
    }
  },
  {
    name: 'Framer',
    regex: /^https:\/\/(www\.)?framer\.com\/embed\/([\w-]+)/,
    getEmbedUrl: (match, url: string) => {
      return url;
    }
  },
  {
    name: 'Google Drive',
    regex: /^((?:https?:)?\/\/)?((?:www|m)\.)?(drive\.google\.com)\/file\/d\/([a-zA-Z0-9_-]+)\/.*$/,
    getEmbedUrl: (match) => {
      return `https://drive.google.com/file/d/${match[4]}/preview`;
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
        embedUrl: provider.getEmbedUrl(match, url),
        provider: provider.name.toLowerCase()
      };
    }
  }
  return {
    embedUrl: url,
    provider: 'iframe',
  };
}


