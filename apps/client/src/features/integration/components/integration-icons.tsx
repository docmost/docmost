import { ReactNode } from "react";
import {
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
};

export function getIntegrationIcon(
  type: string,
  size: number,
): ReactNode {
  const renderIcon = integrationIconMap[type];
  if (renderIcon) return renderIcon(size);
  return <IconPuzzle size={size} stroke={1.5} />;
}
