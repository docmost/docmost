export type CalloutType = "default" | "info" | "success" | "warning" | "danger";
const validCalloutTypes = ["default", "info", "success", "warning", "danger"];

export function getValidCalloutType(value: string): string {
  if (value) {
    return validCalloutTypes.includes(value) ? value : "info";
  }
}
