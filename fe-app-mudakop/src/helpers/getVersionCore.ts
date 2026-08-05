/**
 * Reduces a version string to the numeric core used for up-to-date comparisons.
 *
 * An installed build reports a plain "<version>", while a release tag is
 * "<version>-r<revision>". Comparing them verbatim would always look outdated, so the
 * leading "v" and everything from the first "-" are dropped before comparing.
 */
export function getVersionCore(version: string): string {
  return version.replace(/^v/, '').split('-')[0];
}
