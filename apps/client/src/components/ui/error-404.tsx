import { Title, Text, Button, Container, Group } from "@mantine/core";
import classes from "./error-404.module.css";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";

export function Error404() {
  const { t } = useTranslation();

  return (
    <>
      <Helmet>
        <title>{t("404 page not found")} - Docmost</title>
      </Helmet>
      <Container className={classes.root}>
        <Title className={classes.title}>{t("404 page not found")}</Title>
        <Text c="dimmed" size="lg" ta="center" className={classes.description}>
          {t("Sorry, we can't find the page you are looking for.")}
        </Text>
        <Group justify="center">
          <Button component={Link} to={"/home"} variant="subtle" size="md">
            {t("Take me back to homepage")}
          </Button>
        </Group>
      </Container>
    </>
  );
}
