# Jant Hidden from Latest setup

The English pages use Jant's public archive endpoint with the `english` Collection:

```text
/api/public/archive?collection=english
```

Jant's archive includes published public posts marked `latest_hidden`, so those posts stay
available on `home.html`, `writing.html`, and their detail pages even after they disappear from
Jant's Latest page. The frontend follows cursor pagination and refreshes the data on every page
load.

Keep the posts public and mark them `Hidden from Latest`. `Private` posts are intentionally not
available to this public GitHub Pages frontend. Chinese pages remain on the curated Latest
endpoint; change `JANT_PUBLIC_CONTENT_MODE` if hidden Chinese posts should also be included.

The Jant deployment must allow the exact GitHub Pages origin in `CORS_ORIGINS`:

```text
https://anjouhhh.github.io
```
