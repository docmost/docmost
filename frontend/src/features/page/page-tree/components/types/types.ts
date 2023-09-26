export interface Page {
  id: number;
  parent: number;
  droppable?: boolean;
  text: string;
  data?: PageProperties;
}

export interface PageProperties {
  icon?: string,
  fileType: string;
  fileSize: string;
}
