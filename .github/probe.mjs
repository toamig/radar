// Temporary probe: which Reddit and social endpoints answer from a GitHub runner?
const UAS = {
  bot: 'Mozilla/5.0 (compatible; RadarSweep/1.0; +https://toamig.com/radar/)',
  reddit: 'node:com.toamig.radar:v1.0 (by /u/toamig)',
  browser: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function hit(label, url, ua = 'bot', accept = '*/*') {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UAS[ua], Accept: accept }, signal: AbortSignal.timeout(20000) });
    const body = await res.text();
    const h = ['retry-after', 'x-ratelimit-remaining', 'x-ratelimit-reset', 'server'].map((k) => `${k}=${res.headers.get(k) ?? '-'}`).join(' ');
    console.log(`${res.status} ${label} [${ua}] ${body.length}b ${h} | ${body.slice(0, 70).replace(/\s+/g, ' ')}`);
  } catch (e) { console.log(`ERR ${label} [${ua}] ${String(e.message).slice(0, 80)}`); }
}
const multi = 'https://www.reddit.com/r/gamedev+godot+unrealengine+IndieDev+Unity3D+aigamedev/top/.rss?t=day&limit=50';
for (const ua of ['bot', 'reddit', 'browser']) { await hit('reddit multi rss', multi, ua); await sleep(6000); }
await hit('reddit single godot', 'https://www.reddit.com/r/godot/top/.rss?t=day', 'reddit'); await sleep(6000);
await hit('old.reddit multi', multi.replace('www.', 'old.'), 'reddit'); await sleep(6000);
await hit('reddit json multi', 'https://www.reddit.com/r/gamedev+godot/top.json?t=day&limit=25', 'reddit', 'application/json'); await sleep(6000);
await hit('reddit gamedev hot rss', 'https://www.reddit.com/r/gamedev/hot/.rss', 'reddit');
await hit('arxiv api cs.GR', 'https://export.arxiv.org/api/query?search_query=cat:cs.GR&sortBy=submittedDate&sortOrder=descending&max_results=5');
await hit('bsky whats-hot', 'https://public.api.bsky.app/xrpc/app.bsky.feed.getFeed?feed=at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/whats-hot&limit=5');
await hit('bsky search', 'https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=gamedev&sort=top&limit=5');
await hit('bsky search via bsky.social', 'https://bsky.social/xrpc/app.bsky.feed.searchPosts?q=gamedev&sort=top&limit=5');
await hit('bsky profile rss', 'https://bsky.app/profile/simonwillison.net/rss');
await hit('mastodon gamedev tag', 'https://mastodon.gamedev.place/api/v1/timelines/tag/gamedev?limit=5');
await hit('mastodon.social tag', 'https://mastodon.social/api/v1/timelines/tag/gamedev?limit=5');
await hit('youtube channel rss', 'https://www.youtube.com/feeds/videos.xml?channel_id=UCJ0-OtVpF0wOKEqT2Z1HEtA');
await hit('dev.to', 'https://dev.to/api/articles?top=7&tag=ai&per_page=5');
await hit('substack addy', 'https://addyo.substack.com/feed');
await hit('substack addy browser', 'https://addyo.substack.com/feed', 'browser');
await hit('substack kent browser', 'https://tidyfirst.substack.com/feed', 'browser');
await hit('cgf wiley', 'https://onlinelibrary.wiley.com/feed/14678659/most-recent');
await hit('acm tog', 'https://dl.acm.org/action/showFeed?type=etoc&feed=rss&jc=tog');
await hit('semantic scholar', 'https://api.semanticscholar.org/graph/v1/paper/search?query=real-time+rendering&limit=2&fields=title');
