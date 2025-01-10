import { Helmet } from "react-helmet-async";
import { getAppName } from "@/lib/config.ts";
import SettingsTitle from "@/components/settings/settings-title.tsx";

export default function Billing() {
  return (
    <>
      <Helmet>
        <title>Billing - {getAppName()}</title>
      </Helmet>
      <SettingsTitle title="Billing" />


    </>
  );
}
// if there is an active subscription - show it
// show stripe billing portal button
// show total user count/seats
