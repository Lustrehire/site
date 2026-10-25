// Static content stays readable/crawlable without JavaScript. Run after editing content/faqs.json.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const faqs = JSON.parse(fs.readFileSync(path.join(root, 'content/faqs.json'), 'utf8'));
const previewIndices = [0, 11, 14, 7, 5, 15];
const escape = text => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
for (const [file, items] of [['index.html', previewIndices.map(i => faqs[i])], ['faq.html', faqs]]) {
  const markup = items.map((item, i) => `<div class="faq-item" data-faq-category="${escape(item.categories.join(' '))}" data-faq-search="${escape(item.search)}">
    <button class="faq-question" type="button" aria-expanded="false" aria-controls="faq-answer-${i}" id="faq-question-${i}"><strong>${item.question}</strong><span class="cro-faq-icon" aria-hidden="true"></span></button>
    <div class="answer" id="faq-answer-${i}" role="region" aria-labelledby="faq-question-${i}"><p>${item.answerHTML}</p></div>
  </div>`).join('\n');
  const schema = JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: items.map(item => ({ '@type': 'Question', name: item.question, acceptedAnswer: { '@type': 'Answer', text: item.answerHTML.replace(/<[^>]+>/g, '') } })) }, null, 2).replace(/</g, '\\u003c');
  const filename = path.join(root, file);
  let html = fs.readFileSync(filename, 'utf8');
  for (const [key, value] of [['ITEMS', markup], ['SCHEMA', `<script type="application/ld+json">${schema}</script>`]]) {
    const pattern = new RegExp(`<!-- FAQ_${key}_START -->[\\s\\S]*?<!-- FAQ_${key}_END -->`);
    if (!pattern.test(html)) throw new Error(`Missing FAQ ${key} markers in ${file}`);
    html = html.replace(pattern, () => `<!-- FAQ_${key}_START -->\n${value}\n<!-- FAQ_${key}_END -->`);
  }
  fs.writeFileSync(filename, html);
}
