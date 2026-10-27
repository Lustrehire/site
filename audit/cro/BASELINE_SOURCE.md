# Recovered CRO baseline

The original JSON fixture was never committed. Its genuine content source is
`index.html` at commit `e763e5243304ead6d3b68314c4a01b11e3709de3`, the parent of
CRO extraction commit `251246567b6998e2b7fe03fdc10342926ddb34ff`.

`content-baseline.json` recovers all 16 `.faq-item` questions, original answer
HTML, categories/search metadata and all 46 distinct `.gallery-image` asset
paths from that historical document. Its provenance includes the commit and
SHA-256 of the source bytes. FAQ records also match the committed
`content/faqs.json` exactly. No current rendered output was used to establish
expected answers. All recovered gallery assets exist locally.

Verify the immutable source with:

```
git show e763e5243304ead6d3b68314c4a01b11e3709de3:index.html
```
