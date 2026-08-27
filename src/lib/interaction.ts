import type { MouseEvent } from "react";

const INTERACTIVE_SELECTOR = [
  "a",
  "button",
  "input",
  "textarea",
  "select",
  "[role='button']",
  "[role='menu']",
  "[data-record-click-ignore]",
].join(",");

export function isInteractiveClick(event: MouseEvent<HTMLElement>) {
  return (
    event.target instanceof Element &&
    event.target.closest(INTERACTIVE_SELECTOR) !== null
  );
}
