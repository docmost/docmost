import { ReactNode } from "react";
import {
  AzureDevOpsIcon,
  FigmaIcon,
  GithubIcon,
  GitlabIcon,
  GoogleDocsIcon,
  JiraIcon,
  LinearIcon,
  SlackIcon,
} from "@/components/icons";
import { IconPuzzle } from "@tabler/icons-react";

const integrationIconMap: Record<string, (size: number) => ReactNode> = {
  github: (size) => <GithubIcon size={size} />,
  gitlab: (size) => <GitlabIcon size={size} />,
  slack: (size) => <SlackIcon size={size} />,
  linear: (size) => <LinearIcon size={size} />,
  jira: (size) => <JiraIcon size={size} />,
  figma: (size) => <FigmaIcon size={size} />,
  google_docs: (size) => <GoogleDocsIcon size={size} />,
  azure_devops: (size) => <AzureDevOpsIcon size={size} />,
};

export function getIntegrationIcon(
  type: string,
  size: number,
): ReactNode {
  // The type can come from a document; ignore inherited keys like "constructor".
  if (Object.prototype.hasOwnProperty.call(integrationIconMap, type)) {
    return integrationIconMap[type](size);
  }
  return <IconPuzzle size={size} stroke={1.5} />;
}
