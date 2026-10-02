export function pageHead(title: string, description: string) {
  const full = `${title} — Reality Investor`;
  return {
    meta: [
      { title: full },
      { name: "description", content: description },
      { property: "og:title", content: full },
      { property: "og:description", content: description },
      { name: "robots", content: "noindex" },
    ],
  };
}
