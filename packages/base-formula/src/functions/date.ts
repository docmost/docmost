import { register } from "./registry";
import { makeErrorCell } from "../error";

const toDate = (v: unknown): Date | null => {
  if (v == null) return null;
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d;
};

register({
  name: "now", arity: { min: 0, max: 0 }, paramTypes: [], returnType: "date",
  eval: () => new Date().toISOString(),
  doc: "Current timestamp.", category: "date",
});
register({
  name: "today", arity: { min: 0, max: 0 }, paramTypes: [], returnType: "date",
  eval: () => {
    const d = new Date(); d.setUTCHours(0, 0, 0, 0); return d.toISOString();
  },
  doc: "Midnight UTC of today.", category: "date",
});
register({
  name: "dateAdd", arity: { min: 3, max: 3 }, paramTypes: ["date", "number", "string"], returnType: "date",
  eval: ([base, amt, unit]) => {
    const d = toDate(base);
    if (!d) return makeErrorCell("DATE_INVALID", "invalid date");
    const n = Number(amt);
    const u = String(unit);
    const r = new Date(d);
    if (u === "days")    r.setUTCDate(r.getUTCDate() + n);
    else if (u === "hours")   r.setUTCHours(r.getUTCHours() + n);
    else if (u === "minutes") r.setUTCMinutes(r.getUTCMinutes() + n);
    else if (u === "months")  r.setUTCMonth(r.getUTCMonth() + n);
    else if (u === "years")   r.setUTCFullYear(r.getUTCFullYear() + n);
    else return makeErrorCell("TYPE_MISMATCH", `unknown unit ${u}`);
    return r.toISOString();
  },
  doc: "Adds a duration to a date. Units: days, hours, minutes, months, years.", category: "date",
});
register({
  name: "dateBetween", arity: { min: 3, max: 3 }, paramTypes: ["date", "date", "string"], returnType: "number",
  eval: ([a, b, unit]) => {
    const da = toDate(a), db = toDate(b);
    if (!da || !db) return makeErrorCell("DATE_INVALID", "invalid date");
    const ms = db.getTime() - da.getTime();
    const u = String(unit);
    if (u === "days")    return Math.floor(ms / 86_400_000);
    if (u === "hours")   return Math.floor(ms / 3_600_000);
    if (u === "minutes") return Math.floor(ms / 60_000);
    return makeErrorCell("TYPE_MISMATCH", `unknown unit ${u}`);
  },
  doc: "Difference between two dates in a given unit.", category: "date",
});
