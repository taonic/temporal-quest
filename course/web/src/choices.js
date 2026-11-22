// What becomes of a choice this browser keeps (the persona, the language) when someone signs in.
// The server's is the learner's own, and wins. A choice made here goes up to the server only if
// it's theirs: made before anyone signed in on this browser, or by them. One another learner left
// here (on a shared machine) is dropped, so it never becomes this learner's.
//
//   local:   { id, chosen, fromUrl }   this page's (persona.js, language.js)
//   server:  the learner's, or null    (their progress)
//   owner:   who this browser's progress was before this sign-in (null: nobody's yet)
//   email:   who just signed in
//
// "adopt": switch to the server's. "upload": record this browser's as theirs. "reset": forget
// this browser's (it's someone else's). "keep": nothing to do.
export function settleChoice({ local, server, owner, email }) {
  if (local.fromUrl) return server === local.id ? "keep" : "upload"; // asked for in this page's link
  if (server) return server === local.id ? "keep" : "adopt";
  if (!local.chosen) return "keep";
  return owner === null || owner === email ? "upload" : "reset";
}
