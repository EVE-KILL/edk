/**
 * Redirect /kill/* to /killmail/*
 * Legacy URL compatibility
 */
export default defineEventHandler((event) => {
  const path = event.path;
  const newPath = path.replace(/^\/kill\//, '/killmail/');

  return sendRedirect(event, newPath, 301);
});
