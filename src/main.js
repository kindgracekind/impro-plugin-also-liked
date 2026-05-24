import { Plugin, VirtualEl, fetch } from "@impro.social/impro-plugin";

const ENDPOINT = "https://foryou.club/also-liked";
const FETCH_LIMIT = 50;
const DISPLAY_LIMIT = 3;

const displayUriCache = new Map();

async function fetchAlsoLikedUris(postUri) {
  const url = `${ENDPOINT}?format=json&post=${encodeURIComponent(
    postUri,
  )}&limit=${FETCH_LIMIT}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`also-liked request failed: ${response.status}`);
  }
  const body = await response.json();
  return (body.feed ?? [])
    .map((entry) => entry.post)
    .filter((uri) => typeof uri === "string");
}

function getAuthorDidFromUri(uri) {
  const match = /^at:\/\/(did:[^/]+)\//.exec(uri);
  return match ? match[1] : null;
}

function getQuotedRecord(post) {
  const embed = post?.embed;
  if (!embed) return null;
  if (embed.record?.author) return embed.record;
  // recordWithMedia: embed.record is itself { record: viewRecord }
  if (embed.record?.record?.author) return embed.record.record;
  return null;
}

function collectExcludedDids(post) {
  const dids = new Set();
  if (post?.author?.did) dids.add(post.author.did);
  const quoted = getQuotedRecord(post);
  if (quoted?.author?.did) dids.add(quoted.author.did);
  // Nested quote: viewRecord exposes its own embeds array
  for (const nestedEmbed of quoted?.embeds ?? []) {
    const nested =
      nestedEmbed?.record?.author != null
        ? nestedEmbed.record
        : nestedEmbed?.record?.record?.author != null
          ? nestedEmbed.record.record
          : null;
    if (nested?.author?.did) dids.add(nested.author.did);
  }
  return dids;
}

export default class AlsoLikedPlugin extends Plugin {
  onload() {
    this.registerSlot("post-thread-view:after-replies", async (context) => {
      if (!context.uri) return null;

      let uris = displayUriCache.get(context.uri);
      if (!uris) {
        const sourcePost = await this.app.data.getPost(context.uri);
        const excludedDids = collectExcludedDids(sourcePost);
        const currentUserDid = this.app.currentUser?.did;
        if (currentUserDid) excludedDids.add(currentUserDid);
        let candidateUris;
        try {
          candidateUris = await fetchAlsoLikedUris(context.uri);
        } catch (error) {
          console.error("[also-liked]", error);
          return null;
        }
        if (candidateUris.length === 0) return null;

        uris = [];
        for (const uri of candidateUris) {
          const authorDid = getAuthorDidFromUri(uri);
          if (authorDid && excludedDids.has(authorDid)) continue;
          const cached = await this.app.data.getPost(uri).catch(() => null);
          if (cached) {
            if (cached.viewer?.like) continue;
            if (cached.viewer?.repost) continue;
            if (cached.viewer?.bookmarked) continue;
          }
          uris.push(uri);
          if (uris.length >= DISPLAY_LIMIT) break;
        }
        if (uris.length === 0) return null;
        displayUriCache.set(context.uri, uris);
      }

      const section = new VirtualEl("div");
      section.addClass("also-liked-section");
      const header = section.createEl("div", { cls: "also-liked-header" });
      header
        .createEl("h3", { cls: "also-liked-heading" })
        .setText("Also liked");
      header
        .createEl("p", { cls: "also-liked-subheading" })
        .setText("Posts liked by who people who liked this post");
      section.createPostsFeed((feed) =>
        feed.setUris(uris).setEmptyMessage("No related posts."),
      );
      return section;
    });
  }
}
