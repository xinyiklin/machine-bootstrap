// One owner for "is this relative path safe to materialize on any supported
// platform". Used for reviewed skill trees and for portable workflow sources,
// so both reject traversal, absolute paths, and Windows-hostile names the same
// way.

const windowsReservedName =
  /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;

export function isPortablePathPart(part) {
  return (
    Boolean(part) &&
    part !== "." &&
    part !== ".." &&
    !/[<>:"\\|?*\u0000-\u001f]/.test(part) &&
    !/[. ]$/.test(part) &&
    !windowsReservedName.test(part)
  );
}

export function isPortableRelativePath(path) {
  return (
    typeof path === "string" &&
    Boolean(path) &&
    !path.startsWith("/") &&
    path.split("/").every(isPortablePathPart)
  );
}
