const fs = require('fs');
const matter = require('gray-matter');

function generateDeal(data) {
  const date = new Date().toISOString().split('T')[0];
  const slug = data.title.toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-');
  
  const content = `---
title: "${data.title}"
date: ${date}
draft: false
categories: ["${data.category}"]
stores: ["${data.store}"]
oldPrice: ${data.oldPrice}
newPrice: ${data.newPrice}
discount: ${data.discount}
affiliateUrl: "${data.affiliateUrl}"
couponCode: "${data.couponCode || ''}"
image: "${data.image}"
---

${data.description}
`;

  fs.writeFileSync(`content/deals/${slug}.md`, content);
  console.log(`Deal créé : ${slug}.md`);
}

// Export pour n8n
module.exports = { generateDeal };