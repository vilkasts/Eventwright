// Reading "## " sections of a Markdown artifact.

const SECTION_PREFIX = "## ";

// Lines between the '## <heading>' line and the next '## ' heading, or null when the heading is absent.
export const sectionLines = (lines: readonly string[], heading: string): string[] | null => {
  const start = lines.findIndex((line) => line.trim() === `${SECTION_PREFIX}${heading}`);
  if (start === -1) return null;
  const end = lines.findIndex((line, index) => index > start && line.startsWith(SECTION_PREFIX));
  return lines.slice(start + 1, end === -1 ? lines.length : end);
};
