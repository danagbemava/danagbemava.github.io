export const toTagString = (value?: string | string[]) => {
  if (!value) {
    return "";
  }

  if (Array.isArray(value)) {
    return value.join(", ");
  }

  return value;
};

export const sortByDateDesc = <T extends { data: { date?: Date } }>(items: T[]) =>
  [...items].sort((a, b) => {
    const aTime = a.data.date ? new Date(a.data.date).getTime() : 0;
    const bTime = b.data.date ? new Date(b.data.date).getTime() : 0;
    return bTime - aTime;
  });

const collapse = (value: string) => value.replace(/\s+/g, " ").trim();

export const stripMarkdown = (markdown: string) => {
  const noFence = markdown.replace(/```[\s\S]*?```/g, " ");
  const noCode = noFence.replace(/`([^`]+)`/g, "$1");
  const noImages = noCode.replace(/!\[[^\]]*\]\([^)]+\)/g, " ");
  const noLinks = noImages.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  const noHeaders = noLinks.replace(/^#{1,6}\s+/gm, "");
  const noQuotes = noHeaders.replace(/^>\s?/gm, "");
  const noList = noQuotes.replace(/^\s*[-*+]\s+/gm, "");
  return collapse(noList);
};

export const summarizeMarkdown = (markdown: string, maxLength = 220) => {
  const plain = stripMarkdown(markdown);
  if (plain.length <= maxLength) {
    return plain;
  }

  return `${plain.slice(0, maxLength - 1)}...`;
};

export const formatDateLabel = (date?: Date) => {
  if (!date) {
    return "Entry";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(date);
};
