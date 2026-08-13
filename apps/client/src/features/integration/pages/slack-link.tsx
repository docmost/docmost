import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Alert, Button, Card, Group, Loader, Stack, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { useAtomValue } from "jotai";
import {
  decodeSlackLinkState,
  confirmSlackLink,
  SlackLinkStateInfo,
} from "../services/slack-link-service";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom";
import APP_ROUTE from "@/lib/app-route";

export default function SlackLinkPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const state = searchParams.get("state");
  const currentUser = useAtomValue(currentUserAtom);

  const [info, setInfo] = useState<SlackLinkStateInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!currentUser) {
      const redirectPath = window.location.pathname + window.location.search;
      navigate(`${APP_ROUTE.AUTH.LOGIN}?redirect=${encodeURIComponent(redirectPath)}`);
      return;
    }

    if (!state) {
      setError(t("Missing state parameter"));
      return;
    }

    decodeSlackLinkState(state)
      .then(setInfo)
      .catch((e) => setError(e?.response?.data?.message ?? e.message));
  }, [state, t, currentUser, navigate]);

  async function onConfirm() {
    if (!state) return;
    setSubmitting(true);
    try {
      await confirmSlackLink(state);
      setDone(true);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <Card maw={500} mx="auto" mt={80} p="lg">
        <Stack>
          <Text fw={600}>{t("Connected")}</Text>
          <Text c="dimmed">{t("You can close this tab and return to Slack.")}</Text>
        </Stack>
      </Card>
    );
  }

  if (error) {
    return (
      <Card maw={500} mx="auto" mt={80} p="lg">
        <Alert color="red" title={t("Could not link account")}>
          {error}
        </Alert>
      </Card>
    );
  }

  if (!info || !currentUser) {
    return (
      <div style={{ display: "flex", justifyContent: "center", marginTop: 80 }}>
        <Loader />
      </div>
    );
  }

  return (
    <Card maw={500} mx="auto" mt={80} p="lg">
      <Stack>
        <Text fw={600}>{t("Link your Docmost account to Slack")}</Text>
        <Text>
          {t("Connect Docmost account")}{" "}
          <b>{currentUser.user.email}</b>{" "}
          {t("to Slack user")} <b>@{info.slackUserName}</b>
          {info.slackTeamName && (
            <>
              {" "}
              {t("in")} <b>{info.slackTeamName}</b>
            </>
          )}
          ?
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={() => window.close()}>
            {t("Cancel")}
          </Button>
          <Button onClick={onConfirm} loading={submitting}>
            {t("Confirm")}
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}
