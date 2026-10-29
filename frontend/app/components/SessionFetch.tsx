"use client";

// Importing the module installs the fetch patch that adds the session token
// to backend requests; this component only exists to load it on every page.
import "../lib/session";

export default function SessionFetch() {
  return null;
}
