import {
  Avatar,
  Group,
  Text,
  UnstyledButton,
} from "@mantine/core";
import { spotlight } from "@mantine/spotlight";
import {
  IconHome,
  IconSearch,
} from "@tabler/icons-react";
import classes from "./space-sidebar.module.css";
import switchSpaceClasses from "./switch-space.module.css";
import { SharedSearchSpotlight } from "@/features/search/shared-search-spotlight.tsx";
import { Link, useLocation, useParams } from "react-router-dom";
import clsx from "clsx";
import { getSpaceUrl } from "@/lib/config.ts";
import { useTranslation } from "react-i18next";
import { useGetSharedSpaceBySlugQuery } from "@/features/space/queries/shared-space-query";
import SharedSpaceTree from "@/features/page/tree/components/shared-space-tree";

export function SharedSpaceSidebar() {
  const { t } = useTranslation();
  const location = useLocation();
  const { spaceSlug } = useParams();
  const { data: space } = useGetSharedSpaceBySlugQuery(spaceSlug);

  if (!space) {
    return <></>;
  }

  return (
    <>
      <div className={classes.navbar}>
        <div
          className={classes.section}
          style={{
            border: "none",
            marginTop: 2,
            marginBottom: 3,
          }}
        >
          <div className={classes.spaceName}>
            <Avatar
              size={20}
              color="initials"
              variant="filled"
              name={space?.name}
            />
            <Text size="md" fw={500} lineClamp={1}>
              {space?.name}
            </Text>
          </div>
        </div>

        <div className={classes.section}>
          <div className={classes.menuItems}>
            <UnstyledButton
              component={Link}
              to={getSpaceUrl(spaceSlug)}
              className={clsx(
                classes.menu,
                location.pathname.toLowerCase() === getSpaceUrl(spaceSlug)
                  ? classes.activeButton
                  : "",
              )}
            >
              <div className={classes.menuItemInner}>
                <IconHome
                  size={18}
                  className={classes.menuItemIcon}
                  stroke={2}
                />
                <span>{t("Overview")}</span>
              </div>
            </UnstyledButton>

            <UnstyledButton className={classes.menu} onClick={spotlight.open}>
              <div className={classes.menuItemInner}>
                <IconSearch
                  size={18}
                  className={classes.menuItemIcon}
                  stroke={2}
                />
                <span>{t("Search")}</span>
              </div>
            </UnstyledButton>
          </div>
        </div>

        <div className={clsx(classes.section, classes.sectionPages)}>
          <Group className={classes.pagesHeader} justify="space-between">
            <Text size="xs" fw={500} c="dimmed">
              {t("Pages")}
            </Text>
          </Group>

          <div className={classes.pages}>
            <SharedSpaceTree spaceId={space.id} />
          </div>
        </div>
      </div>

      <SharedSearchSpotlight spaceId={space.id} />
    </>
  );
}
